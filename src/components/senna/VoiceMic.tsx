import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface VoiceMicProps {
  apiBaseUrl: string;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onRecordingChange?: (recording: boolean) => void;
  disabled?: boolean;
  maxRecordingMs?: number;
}

const WS_URL = [
  'wss://streaming.assemblyai.com/v3/ws',
  new URLSearchParams({
    sample_rate: '16000',
    speech_model: 'u3-rt-pro',
    // Senna uses voice as dictation, so wait longer before ending a turn.
    min_turn_silence: '900',
    max_turn_silence: '3500',
    continuous_partials: 'true',
  }).toString(),
].join('?');

type RecordingState = 'idle' | 'starting' | 'recording' | 'stopping';

export const VoiceMic: React.FC<VoiceMicProps> = ({
  apiBaseUrl,
  onPartial,
  onFinal,
  onRecordingChange,
  disabled,
  maxRecordingMs = 60_000,
}) => {
  const [state, setState] = useState<RecordingState>('idle');
  const stateRef = useRef<RecordingState>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const finalTextRef = useRef('');
  const liveTextRef = useRef('');

  const setRecordingState = (next: RecordingState) => {
    stateRef.current = next;
    setState(next);
  };

  const cleanup = () => {
    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    try { workletNodeRef.current?.disconnect(); } catch { /* noop */ }
    workletNodeRef.current = null;
    try { sourceRef.current?.disconnect(); } catch { /* noop */ }
    sourceRef.current = null;
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => undefined);
      ctxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'Terminate' }));
        }
        wsRef.current.close();
      } catch { /* noop */ }
      wsRef.current = null;
    }
  };

  useEffect(() => () => cleanup(), []);
  useEffect(() => {
    onRecordingChange?.(state === 'starting' || state === 'recording' || state === 'stopping');
  }, [state, onRecordingChange]);

  const stop = (reason?: 'limit') => {
    if (stateRef.current === 'idle') return;
    setRecordingState('stopping');
    const finalText = liveTextRef.current.trim();
    if (finalText) onFinal(finalText);
    cleanup();
    setRecordingState('idle');
    if (reason === 'limit') {
      toast.message('Voice stopped after 60 seconds. Send it, or tap mic again to add more.');
    }
  };

  const start = async () => {
    if (stateRef.current !== 'idle' || disabled) return;
    setRecordingState('starting');
    finalTextRef.current = '';
    liveTextRef.current = '';

    let token: string;
    try {
      const tokenRes = await fetch(`${apiBaseUrl}/api/voice/token`, { method: 'POST' });
      if (!tokenRes.ok) throw new Error('token_mint_failed');
      const json = (await tokenRes.json()) as { token?: string };
      if (!json.token) throw new Error('no_token');
      token = json.token;
    } catch {
      toast.error("Voice isn't available right now. Try again in a sec.");
      setRecordingState('idle');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      toast.error('Mic access denied.');
      setRecordingState('idle');
      return;
    }
    streamRef.current = stream;

    const ws = new WebSocket(`${WS_URL}&token=${encodeURIComponent(token)}`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.addEventListener('error', () => {
      toast.error('Voice connection dropped.');
      cleanup();
      setRecordingState('idle');
    });
    ws.addEventListener('close', () => {
      cleanup();
      setRecordingState('idle');
    });
    ws.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const msg = JSON.parse(event.data) as { type?: string; transcript?: string; end_of_turn?: boolean };
        if (msg.type === 'Turn' && typeof msg.transcript === 'string') {
          const composed = `${finalTextRef.current}${finalTextRef.current ? ' ' : ''}${msg.transcript}`;
          liveTextRef.current = composed;
          onPartial(composed);
          if (msg.end_of_turn && msg.transcript) {
            finalTextRef.current = composed;
            onFinal(composed);
          }
        }
      } catch {
        // ignore malformed messages
      }
    });

    await new Promise<void>((resolve) => ws.addEventListener('open', () => resolve(), { once: true }));

    // Spin up an AudioContext + worklet to downsample to 16 kHz Int16 PCM.
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
      ctxRef.current = ctx;
      await ctx.audioWorklet.addModule('/senna-pcm-worklet.js');
    } catch {
      toast.error('Audio engine failed to start.');
      cleanup();
      setRecordingState('idle');
      return;
    }

    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;
    const node = new AudioWorkletNode(ctx, 'senna-pcm-downsampler', {
      processorOptions: { targetSampleRate: 16000 },
    });
    workletNodeRef.current = node;

    node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(event.data);
      }
    };
    source.connect(node);
    // node terminates here; AssemblyAI receives the binary frames over ws.

    maxTimerRef.current = window.setTimeout(() => stop('limit'), maxRecordingMs);
    setRecordingState('recording');
  };

  const toggle = () => {
    if (state === 'recording') {
      stop();
    } else {
      void start();
    }
  };

  return (
    <button
      type="button"
      className="senna-mic"
      data-active={state === 'recording'}
      onClick={toggle}
      disabled={disabled || state === 'starting' || state === 'stopping'}
      aria-label={state === 'recording' ? 'Stop voice input' : 'Start voice input'}
      title={state === 'recording' ? 'Stop voice input' : 'Voice input'}
    >
      {state === 'recording' ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          <rect x="7" y="7" width="10" height="10" rx="2.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )}
    </button>
  );
};

export default VoiceMic;
