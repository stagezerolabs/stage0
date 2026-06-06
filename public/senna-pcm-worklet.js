// AudioWorkletProcessor that downsamples a mono Float32 stream from the AudioContext's
// native sample rate (commonly 48 kHz) to 16 kHz Int16 PCM little-endian.
// Posts ~50 ms chunks (1600 samples / 3200 bytes) back to the main thread.

class SennaPcmDownsampler extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options && options.processorOptions ? options.processorOptions : {};
    this.targetSampleRate = opts.targetSampleRate || 16000;
    this.inputSampleRate = sampleRate; // global from worklet scope
    this.ratio = this.inputSampleRate / this.targetSampleRate;
    // Buffer of Float32 samples already at the target rate.
    this.outputBuffer = new Float32Array(0);
    // Index-based resampling carry (fractional position).
    this.position = 0;
    // 1600 samples = 100 ms at 16 kHz. We post in ~50 ms chunks for snappy partials.
    this.chunkSize = Math.round((this.targetSampleRate * 50) / 1000);
  }

  resample(input) {
    if (this.ratio === 1) return input;
    const outLen = Math.floor((input.length + this.position) / this.ratio);
    const out = new Float32Array(outLen);
    let p = -this.position;
    for (let i = 0; i < outLen; i++) {
      const idx = p + i * this.ratio;
      const i0 = Math.floor(idx);
      const i1 = i0 + 1;
      const frac = idx - i0;
      const s0 = input[i0] || 0;
      const s1 = input[i1] !== undefined ? input[i1] : s0;
      out[i] = s0 + (s1 - s0) * frac;
    }
    // Carry over fractional sample offset.
    const consumed = outLen * this.ratio - this.position;
    this.position = input.length - consumed;
    if (this.position < 0) this.position = 0;
    return out;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    const resampled = this.resample(channel);
    // Append to output buffer.
    const merged = new Float32Array(this.outputBuffer.length + resampled.length);
    merged.set(this.outputBuffer, 0);
    merged.set(resampled, this.outputBuffer.length);
    this.outputBuffer = merged;

    while (this.outputBuffer.length >= this.chunkSize) {
      const chunk = this.outputBuffer.subarray(0, this.chunkSize);
      const pcm = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const v = Math.max(-1, Math.min(1, chunk[i]));
        pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
      this.outputBuffer = this.outputBuffer.subarray(this.chunkSize);
    }

    return true;
  }
}

registerProcessor('senna-pcm-downsampler', SennaPcmDownsampler);
