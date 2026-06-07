import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useChainId } from 'wagmi';
import { RefreshCcw, Send, X } from '@/components/ui/icons';
import SennaSignCard from '@/components/senna/SennaSignCard';
import QuickActionMenu, { type QuickAction } from '@/components/senna/QuickActionMenu';
import SuggestionStrip from '@/components/senna/SuggestionStrip';
import VoiceMic from '@/components/senna/VoiceMic';
import type { SennaActionDraft, SennaActionType } from '@/components/senna/types';

type SennaRole = 'user' | 'assistant';

type CopilotMessage = {
  role: 'bot' | 'user';
  text: string;
  time: string;
  actionDraft?: SennaActionDraft | null;
};

type SennaChatResponse = {
  blocked?: boolean;
  sessionId?: string;
  answer?: string;
  actionDraft?: SennaActionDraft | null;
  suggestions?: string[];
};

const nowTime = (): string => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const INTRO_MESSAGES = [
  "Hey, I'm Senna. What would you like to do today?",
  "Hi, I'm here. Tell me what you're trying to do on Stage0.",
  "Hey. Want help with a launch, token, NFT, lock, airdrop, or name?",
  "Hi. We can take it step by step. What are you building?",
];

const RESET_MESSAGES = [
  "Fresh start. What would you like to do next?",
  "All clear. What can I help with?",
  "Reset done. Tell me what you want to work on.",
  "Clean slate. Where should we start?",
];

const DEFAULT_SUGGESTIONS = [
  'Create a token',
  'Lock tokens',
  'Buy a .rise name',
];

const SENNA_API_URL =
  (import.meta.env.VITE_SENNA_CHAT_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8788';

const randomItem = (items: string[]) => items[Math.floor(Math.random() * items.length)];

const makeBotMessage = (text: string, actionDraft?: SennaActionDraft | null): CopilotMessage => ({
  role: 'bot',
  text,
  time: nowTime(),
  actionDraft: actionDraft ?? null,
});

const toApiMessages = (messages: CopilotMessage[], nextUserMessage: string) => {
  const mapped = messages.slice(-24).map((message) => ({
    role: (message.role === 'bot' ? 'assistant' : 'user') as SennaRole,
    content: message.text,
  }));

  mapped.push({ role: 'user', content: nextUserMessage });
  return mapped;
};

const buildChatPayload = (input: {
  sessionId: string | null;
  address?: string;
  chainId?: number;
  messages: Array<{ role: SennaRole; content: string }>;
  mode?: 'auto' | 'fast' | 'deep';
  quickAction?: SennaActionType;
}) => {
  const payload: {
    sessionId?: string;
    mode: 'auto' | 'fast' | 'deep';
    walletAddress?: string;
    evmAddress?: string;
    chainId?: number;
    messages: Array<{ role: SennaRole; content: string }>;
    quickAction?: SennaActionType;
  } = {
    mode: input.mode ?? 'auto',
    messages: input.messages,
  };

  if (input.sessionId) payload.sessionId = input.sessionId;
  if (input.address) {
    payload.walletAddress = input.address;
    payload.evmAddress = input.address;
  }
  if (input.chainId) payload.chainId = input.chainId;
  if (input.quickAction) payload.quickAction = input.quickAction;

  return payload;
};

async function safeReadError(response: Response): Promise<string> {
  try {
    const data = await response.clone().json();
    if (data?.detail) return String(data.detail);
    if (data?.error) return '';
  } catch { /* fallthrough */ }
  return '';
}

const SennaGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2a3 3 0 0 1 3 3v1h1a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4h-1l-3 3-3-3H8a4 4 0 0 1-4-4v-3a4 4 0 0 1 4-4h1V5a3 3 0 0 1 3-3z" />
    <circle cx="9.5" cy="11" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="11" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const MARKDOWN_LINK_RE = /\[([^\]]{1,80})\]\((\/[A-Za-z0-9/_?=&:%#.-]*|https?:\/\/[^\s)]+)\)/g;

function MessageText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
    const [raw, label, href] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));

    if (href.startsWith('/')) {
      parts.push(
        <Link key={`${href}-${index}`} to={href} className="ai-msg-link">
          {label}
        </Link>,
      );
    } else {
      parts.push(
        <a key={`${href}-${index}`} href={href} target="_blank" rel="noreferrer" className="ai-msg-link">
          {label}
        </a>,
      );
    }

    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

const AICopilot: React.FC = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>(() => [makeBotMessage(randomItem(INTRO_MESSAGES))]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bottomOffset, setBottomOffset] = useState(24);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [slashOpen, setSlashOpen] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (chatOpen && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [chatOpen, messages, typing]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
  }, [input, chatOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const footer = document.querySelector('footer');
      if (!footer) {
        setBottomOffset(24);
        return;
      }

      const footerRect = footer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      if (footerRect.top < viewportHeight) {
        const visibleFooterHeight = viewportHeight - footerRect.top;
        setBottomOffset(visibleFooterHeight + 24);
      } else {
        setBottomOffset(24);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const openChat = () => {
    setChatOpen(true);
  };

  const startNewChat = () => {
    setSessionId(null);
    setMessages([makeBotMessage(randomItem(RESET_MESSAGES))]);
    setSuggestions(DEFAULT_SUGGESTIONS);
  };

  const send = async (
    text?: string,
    options?: { mode?: 'auto' | 'fast' | 'deep'; quickAction?: SennaActionType },
  ) => {
    const msg = (text ?? input).trim();
    if (!msg || typing) return;
    const nextMessages = [...messages, { role: 'user' as const, text: msg, time: nowTime() }];
    setMessages((m) => [...m, { role: 'user', text: msg, time: nowTime() }]);
    setInput('');
    setSlashOpen(false);
    setTyping(true);
    setSuggestions([]);

    try {
      const response = await fetch(`${SENNA_API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildChatPayload({
          sessionId,
          chainId,
          address,
          messages: toApiMessages(messages, msg),
          mode: options?.mode,
          quickAction: options?.quickAction,
        })),
      });

      if (!response.ok) {
        const detail = await safeReadError(response);
        const fallback = response.status === 429
          ? 'Slow down for a few seconds, then try again.'
          : detail || 'Senna is having trouble right now. Try again in a moment.';
        setMessages([...nextMessages, makeBotMessage(fallback)]);
        return;
      }

      const data = (await response.json()) as SennaChatResponse;
      if (data.sessionId) setSessionId(data.sessionId);

      setMessages([
        ...nextMessages,
        makeBotMessage(data.answer || 'Hmm, blanked on that one. Try once more?', data.actionDraft),
      ]);
      setSuggestions(data.suggestions ?? []);
    } catch {
      setMessages([
        ...nextMessages,
        makeBotMessage("I can't reach Senna right now. Check your connection and try again."),
      ]);
    } finally {
      setTyping(false);
    }
  };

  const handleQuickActionPick = (action: QuickAction) => {
    setInput('');
    setSlashOpen(false);
    void send(action.prompt, { mode: 'deep', quickAction: action.actionType });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setInput(next);
    setSlashOpen(next.startsWith('/'));
  };

  const handleVoicePartial = (text: string) => {
    setInput(text);
    setSlashOpen(false);
  };

  const handleVoiceFinal = (text: string) => {
    setInput(text);
  };

  const trimmedInput = input.trim();
  const hasInputText = trimmedInput.length > 0;

  return (
    <div className="ai-bubble-wrap" style={{ bottom: `${bottomOffset}px` }}>
      {chatOpen && (
        <div className="ai-chat" role="dialog" aria-label="Senna assistant">
          <div className="ai-chat-header">
            <div className="ai-chat-avatar">
              <SennaGlyph className="h-5 w-5" />
            </div>
            <div>
              <div className="ai-chat-name">Senna</div>
              <div className="ai-chat-status">Online, Stage0 assistant</div>
            </div>
            <div className="ai-chat-actions">
              <button
                type="button"
                className="ai-chat-icon-btn"
                title="New chat"
                onClick={startNewChat}
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="ai-chat-icon-btn"
                title="Close"
                onClick={() => setChatOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="ai-chat-body" ref={bodyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                <div className="ai-msg-row">
                  <div className="ai-msg-content">
                    <div className="ai-msg-bubble">
                      <MessageText text={m.text} />
                    </div>
                    {m.actionDraft && <SennaSignCard draft={m.actionDraft} />}
                  </div>
                </div>
                <div className="ai-msg-time">{m.time}</div>
              </div>
            ))}
            {typing && (
              <div className="ai-msg bot">
                <div className="ai-msg-row">
                  <div className="ai-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
          </div>

          <SuggestionStrip
            suggestions={suggestions}
            disabled={typing}
            onPick={(s) => void send(s)}
          />

          <div className="ai-chat-input" style={{ position: 'relative' }}>
            <QuickActionMenu
              open={slashOpen}
              filter={input}
              onPick={handleQuickActionPick}
              onClose={() => setSlashOpen(false)}
            />
            <div className="ai-input-wrap">
              <textarea
                ref={inputRef}
                className="ai-input"
                placeholder="Ask Senna, or type / for quick actions"
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !slashOpen) {
                    e.preventDefault();
                    void send();
                  }
                }}
                disabled={typing}
                rows={1}
              />
            </div>
            {hasInputText && !voiceRecording ? (
              <button
                type="button"
                className="ai-send"
                onClick={() => void send()}
                disabled={typing}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            ) : (
              <VoiceMic
                apiBaseUrl={SENNA_API_URL}
                onPartial={handleVoicePartial}
                onFinal={handleVoiceFinal}
                onRecordingChange={setVoiceRecording}
                disabled={typing}
              />
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className="ai-bubble"
        onClick={() => (chatOpen ? setChatOpen(false) : openChat())}
        aria-label={chatOpen ? 'Close Senna' : 'Open Senna'}
      >
        {chatOpen ? (
          <X className="h-[22px] w-[22px]" />
        ) : (
          <SennaGlyph className="h-[26px] w-[26px]" />
        )}
      </button>
    </div>
  );
};

export default AICopilot;
