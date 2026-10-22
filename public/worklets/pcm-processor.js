// Receives a 2-channel input (0 = rep mic, 1 = buyer/tab audio), emits interleaved Int16 PCM frames
// plus per-channel RMS so the UI can draw level meters without touching the audio graph again.
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = 2048; // frames per message (~128 ms at 16 kHz)
    this.buf = new Int16Array(this.frameSize * 2);
    this.i = 0;
    this.sumSq = [0, 0];
    this.count = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const ch0 = input[0] || new Float32Array(128);
    const ch1 = input[1] || new Float32Array(ch0.length);
    for (let n = 0; n < ch0.length; n++) {
      const a = Math.max(-1, Math.min(1, ch0[n]));
      const b = Math.max(-1, Math.min(1, ch1[n]));
      this.buf[this.i * 2] = a < 0 ? a * 0x8000 : a * 0x7fff;
      this.buf[this.i * 2 + 1] = b < 0 ? b * 0x8000 : b * 0x7fff;
      this.sumSq[0] += a * a;
      this.sumSq[1] += b * b;
      this.count++;
      this.i++;
      if (this.i >= this.frameSize) {
        const out = this.buf.slice();
        this.port.postMessage(
          { pcm: out.buffer, rms: [Math.sqrt(this.sumSq[0] / this.count), Math.sqrt(this.sumSq[1] / this.count)] },
          [out.buffer]
        );
        this.i = 0;
        this.sumSq = [0, 0];
        this.count = 0;
      }
    }
    return true;
  }
}
registerProcessor("pcm-processor", PCMProcessor);
