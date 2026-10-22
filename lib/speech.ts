"use client";

type SR = any;

export function isSpeechRecognitionSupported() {
  return typeof window !== "undefined" && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export class RepRecognizer {
  private rec: SR | null = null;
  private active = false;
  private segStart = 0;
  constructor(private cb: { onInterim: (t: string) => void; onFinal: (t: string, startSec: number, endSec: number) => void; onError: (m: string) => void; now: () => number }) {}

  start() {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) { this.cb.onError("Speech recognition is not available in this browser. Use Google Chrome, or type your lines below."); return; }
    this.active = true;
    this.spawn(Ctor);
  }
  private spawn(Ctor: any) {
    const r: SR = new Ctor();
    r.lang = "en-US"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onstart = () => { this.segStart = this.cb.now(); };
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0].transcript.trim();
        if (res.isFinal) { if (text) { this.cb.onFinal(text, this.segStart, this.cb.now()); this.segStart = this.cb.now(); } }
        else interim += text + " ";
      }
      if (interim.trim()) { if (this.segStart === 0) this.segStart = this.cb.now(); this.cb.onInterim(interim.trim()); }
    };
    r.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // benign, onend will restart
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { this.active = false; this.cb.onError("Microphone permission denied. Allow the mic from the address bar and start again."); return; }
      if (e.error === "network") { this.cb.onError("Speech recognition lost network. It will retry automatically."); return; }
      this.cb.onError(`Speech recognition error: ${e.error}`);
    };
    r.onend = () => { if (this.active) setTimeout(() => { if (this.active) this.spawn(Ctor); }, 150); };
    this.rec = r;
    try { r.start(); } catch {}
  }
  pause() { this.active = false; try { this.rec?.stop(); } catch {} }
  resume() { if (!this.active) this.start(); }
  stop() { this.active = false; try { this.rec?.abort(); } catch {} this.rec = null; }
}

export function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  const exact = voices.filter((v) => v.lang.replace("_", "-").toLowerCase() === lang.toLowerCase());
  const prefer = (list: SpeechSynthesisVoice[]) => list.find((v) => /natural|neural|premium|enhanced|google/i.test(v.name)) ?? list[0];
  if (exact.length) return prefer(exact);
  const base = lang.split("-")[0].toLowerCase();
  const sameBase = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  return prefer(sameBase) ?? voices[0];
}

export function speak(text: string, voice: { lang: string; pitch: number; rate: number }): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return resolve();
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice.lang; u.pitch = voice.pitch; u.rate = voice.rate;
    const v = pickVoice(voice.lang);
    if (v) u.voice = v;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    // Chrome occasionally never fires onend for long text; guard with a timeout
    const guard = setTimeout(resolve, Math.min(30000, 2000 + text.length * 90));
    u.onend = () => { clearTimeout(guard); resolve(); };
    synth.speak(u);
  });
}
