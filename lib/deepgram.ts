"use client";
import type { Speaker } from "./types";

export interface DGEvents {
  onOpen: () => void;
  onInterim: (speaker: Speaker, text: string) => void;
  onFinalUtterance: (speaker: Speaker, text: string, start: number, end: number, words: number) => void;
  onError: (message: string) => void;
  onClose: (code: number, reason: string) => void;
}

export class DeepgramStream {
  private ws: WebSocket | null = null;
  private keepalive: ReturnType<typeof setInterval> | null = null;
  private partial: Record<number, { text: string[]; start: number; end: number; words: number }> = {};
  private closedByUs = false;
  private queue: ArrayBuffer[] = [];

  constructor(private ev: DGEvents) {}

  static async credential(): Promise<{ kind: "bearer" | "token"; token: string; warning?: string }> {
    const r = await fetch("/api/deepgram-token", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || "Could not get a Deepgram credential from the server.");
    return j;
  }

  async connect(opts: { channels: 1 | 2; language?: string }) {
    const cred = await DeepgramStream.credential();
    const params = new URLSearchParams({
      model: "nova-3",
      encoding: "linear16",
      sample_rate: "16000",
      channels: String(opts.channels),
      multichannel: opts.channels === 2 ? "true" : "false",
      interim_results: "true",
      smart_format: "true",
      punctuate: "true",
      endpointing: "300",
      utterance_end_ms: "1200",
      vad_events: "true",
      language: opts.language || "en",
    });
    const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
    const protocols = cred.kind === "bearer" ? ["bearer", cred.token] : ["token", cred.token];
    this.closedByUs = false;
    const ws = new WebSocket(url, protocols);
    this.ws = ws;
    ws.binaryType = "arraybuffer";
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Deepgram did not answer within 8 s. Check the API key and your network.")), 8000);
      ws.onopen = () => { clearTimeout(t); resolve(); };
      ws.onerror = () => { clearTimeout(t); reject(new Error("Deepgram connection failed (check the DEEPGRAM_API_KEY and remaining credit).")); };
    });
    this.ev.onOpen();
    this.keepalive = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "KeepAlive" })); }, 8000);
    ws.onmessage = (m) => this.handle(m);
    ws.onerror = () => this.ev.onError("Deepgram socket error.");
    ws.onclose = (e) => {
      if (this.keepalive) clearInterval(this.keepalive);
      this.ev.onClose(e.code, e.reason || (this.closedByUs ? "closed" : "Deepgram closed the stream (credit exhausted, idle timeout, or auth expired)."));
    };
    for (const q of this.queue.splice(0)) ws.send(q);
  }

  send(pcm: ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(pcm);
    else if (this.queue.length < 50) this.queue.push(pcm);
  }

  close() {
    this.closedByUs = true;
    if (this.keepalive) clearInterval(this.keepalive);
    const ws = this.ws;
    if (!ws) return;
    try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "CloseStream" })); } catch {}
    setTimeout(() => { try { ws.close(); } catch {} }, 300);
    this.ws = null;
  }

  private handle(m: MessageEvent) {
    let d: any;
    try { d = JSON.parse(m.data); } catch { return; }
    if (d.type === "Error" || d.error) { this.ev.onError(d.message || d.error || "Deepgram error"); return; }
    if (d.type === "UtteranceEnd") {
      const ch = Array.isArray(d.channel) ? d.channel[0] : 0;
      this.flush(ch);
      return;
    }
    if (d.type !== "Results") return;
    const ch: number = Array.isArray(d.channel_index) ? d.channel_index[0] : 0;
    const alt = d.channel?.alternatives?.[0];
    if (!alt) return;
    const text: string = (alt.transcript || "").trim();
    const speaker = this.speakerOf(ch);
    const start: number = d.start ?? 0;
    const end: number = (d.start ?? 0) + (d.duration ?? 0);
    if (!d.is_final) {
      if (text) this.ev.onInterim(speaker, (this.partial[ch]?.text.join(" ") + " " + text).trim());
      return;
    }
    if (text) {
      const p = this.partial[ch] ?? { text: [], start, end, words: 0 };
      if (p.text.length === 0) p.start = start;
      p.text.push(text);
      p.end = end;
      p.words += (alt.words?.length ?? text.split(/\s+/).length);
      this.partial[ch] = p;
      this.ev.onInterim(speaker, p.text.join(" "));
    }
    if (d.speech_final) this.flush(ch);
  }

  private flush(ch: number) {
    const p = this.partial[ch];
    if (!p || p.text.length === 0) return;
    delete this.partial[ch];
    this.ev.onFinalUtterance(this.speakerOf(ch), p.text.join(" "), p.start, p.end, p.words);
  }

  private speakerOf(ch: number): Speaker { return ch === 1 ? "buyer" : "rep"; }
}
