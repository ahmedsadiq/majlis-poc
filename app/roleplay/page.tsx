"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain, Eye, EyeOff, PhoneOff, Send, Swords, Volume2 } from "lucide-react";
import { addUsage, getActivePlaybook, getPersonas, getPlaybooks, setActivePlaybookId } from "@/lib/store";
import { EMPTY_PLAYBOOK, useCoachEngine } from "@/lib/engine";
import { RepRecognizer, isSpeechRecognitionSupported, speak } from "@/lib/speech";
import type { Emotion, Persona, Playbook } from "@/lib/types";
import { EmotionBadge, NextAction, PromptHistory, StageTracker, toneOf } from "@/components/CoachPanel";
import { Transcript } from "@/components/Transcript";
import { Banner, Pill, useHydrated } from "@/components/ui";
import { Suspense } from "react";

export default function RoleplayPage() {
  return <Suspense fallback={<div className="py-24 text-center text-sand-300/50">Loading…</div>}><Roleplay /></Suspense>;
}

function Roleplay() {
  const hydrated = useHydrated();
  const router = useRouter();
  const search = useSearchParams();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [scenario, setScenario] = useState("");
  const [phase, setPhase] = useState<"setup" | "live" | "ending">("setup");
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);
  const [interim, setInterim] = useState<{ rep?: string; buyer?: string }>({});
  const [buyerState, setBuyerState] = useState<{ thinking: boolean; speaking: boolean; emotion?: Emotion; internal?: string }>({ thinking: false, speaking: false });
  const [reveal, setReveal] = useState(false);
  const [typed, setTyped] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const [srOk, setSrOk] = useState(true);

  const rec = useRef<RepRecognizer | null>(null);
  const endingRef = useRef(false);
  const engine = useCoachEngine(playbook ?? EMPTY_PLAYBOOK, "roleplay");
  const turnsLen = useRef(0);

  useEffect(() => {
    if (!hydrated) return;
    setPlaybooks(getPlaybooks()); setPlaybook(getActivePlaybook());
    const ps = getPersonas(); setPersonas(ps);
    const wanted = search.get("persona");
    setPersona(ps.find((p) => p.name === wanted || p.id === wanted) ?? ps[0]);
    const sc = search.get("scenario"); if (sc) setScenario(sc);
    setSrOk(isSpeechRecognitionSupported());
    window.speechSynthesis?.getVoices?.();
  }, [hydrated, search]);

  const personaWithScenario = useCallback((): Persona | null => {
    if (!persona) return null;
    return scenario.trim() ? { ...persona, summary: `${persona.summary} Scenario for this session: ${scenario.trim()}` } : persona;
  }, [persona, scenario]);

  const buyerTurn = useCallback(async (opening: boolean) => {
    const p = personaWithScenario();
    if (!p || endingRef.current) return;
    setBuyerState((s) => ({ ...s, thinking: true }));
    rec.current?.pause();
    try {
      const r = await fetch("/api/buyer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playbookText: engine.playbookText.current, persona: p, turns: engine.getTurns(), opening }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Buyer request failed (${r.status})`);
      addUsage({ buyerCalls: 1 });
      const start = engine.now();
      setBuyerState({ thinking: false, speaking: true, emotion: j.emotion, internal: j.internal });
      setInterim((i) => ({ ...i, buyer: j.reply }));
      const spokenSec = Math.max(1.2, j.reply.split(/\s+/).length / 2.6);
      if (voiceOn) await speak(j.reply, p.voice ?? { lang: "en-GB", pitch: 1, rate: 1 });
      else await new Promise((res) => setTimeout(res, Math.min(4000, spokenSec * 1000)));
      setInterim((i) => ({ ...i, buyer: undefined }));
      engine.addTurn("buyer", j.reply, start, engine.now());
      setBuyerState((s) => ({ ...s, speaking: false }));
      if (j.wantsToEnd) setError({ title: `${p.name} is wrapping up the call.`, detail: "End the roleplay to see your scorecard, or keep going." });
    } catch (e: any) {
      setBuyerState({ thinking: false, speaking: false });
      setError({ title: "The AI buyer did not respond", detail: e?.message ?? String(e) });
    } finally {
      if (!endingRef.current) rec.current?.resume();
    }
  }, [engine, personaWithScenario, voiceOn]);

  const repSaid = useCallback((text: string, start: number, end: number) => {
    if (!text.trim()) return;
    setInterim((i) => ({ ...i, rep: undefined }));
    engine.addTurn("rep", text.trim(), start, end);
    buyerTurn(false);
  }, [engine, buyerTurn]);

  function startSession() {
    if (!playbook || !persona) return;
    setError(null);
    endingRef.current = false;
    engine.start();
    setPhase("live");
    rec.current = new RepRecognizer({
      onInterim: (t) => setInterim((i) => ({ ...i, rep: t })),
      onFinal: (t, s, e) => repSaid(t, s, e),
      onError: (m) => setError({ title: "Microphone / speech", detail: m }),
      now: engine.now,
    });
    if (srOk) rec.current.start();
    setTimeout(() => buyerTurn(true), 400);
  }

  const endSession = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setPhase("ending");
    rec.current?.stop(); rec.current = null;
    window.speechSynthesis?.cancel();
    await engine.finish({ personaName: persona?.name, onSaved: (id) => router.push(`/report/${id}`) });
  }, [engine, persona, router]);

  useEffect(() => () => { rec.current?.stop(); window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { turnsLen.current = engine.turns.length; }, [engine.turns.length]);

  if (!hydrated || !playbook || !persona) return <div className="py-24 text-center text-sand-300/50">Loading…</div>;

  if (phase === "setup") {
    return (
      <div className="py-10 max-w-5xl mx-auto">
        <div className="label mb-2">AI roleplay</div>
        <h1 className="font-display text-4xl text-sand-50">Practice before it costs a real deal.</h1>
        <p className="text-sand-200/70 mt-2 max-w-2xl">Talk to an AI buyer built from your playbook. The same coach watches, the same rubric scores it.</p>
        {error && <div className="mt-6"><Banner title={error.title} onClose={() => setError(null)}>{error.detail}</Banner></div>}
        {!srOk && <div className="mt-6"><Banner kind="info" title="Voice input needs Google Chrome">You can still roleplay by typing your lines.</Banner></div>}
        <div className="grid md:grid-cols-5 gap-6 mt-8">
          <div className="md:col-span-3">
            <div className="label mb-3">Choose a buyer</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {personas.map((p) => (
                <button key={p.id} onClick={() => setPersona(p)} className={`text-left glass p-4 transition hover:border-gold-500/40 ${persona.id === p.id ? "border-gold-500/60 shadow-glow" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sand-50">{p.name}</div>
                    <Pill tone={p.difficulty === "brutal" ? "live" : p.difficulty === "medium" ? "warn" : "ok"}>{p.difficulty}</Pill>
                  </div>
                  <div className="text-xs text-sand-300/70">{p.title} · {p.company}</div>
                  <p className="text-sm text-sand-200/80 mt-2 line-clamp-3">{p.summary}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 space-y-4">
            <div className="glass p-5">
              <div className="label mb-2">Playbook</div>
              <select className="input" value={playbook.id} onChange={(e) => { setActivePlaybookId(e.target.value); setPlaybook(getActivePlaybook()); }}>
                {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="glass p-5">
              <div className="label mb-2">Scenario (optional)</div>
              <textarea className="input min-h-[96px]" placeholder="e.g. Second call. Last time they said the price was too high. Open by addressing it." value={scenario} onChange={(e) => setScenario(e.target.value)} maxLength={600} />
              <div className="text-[11px] text-sand-300/50 mt-1 text-right">{scenario.length}/600</div>
            </div>
            <label className="glass p-4 flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2 text-sm text-sand-100"><Volume2 size={16} className="text-gold-300" /> Buyer speaks aloud</span>
              <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} className="accent-[#e2bd5c] h-4 w-4" />
            </label>
            <button onClick={startSession} className="btn-gold w-full"><Swords size={16} /> Start roleplay with {persona.name.split(" ")[0]}</button>
          </div>
        </div>
      </div>
    );
  }

  const latest = engine.latest?.output;
  return (
    <div className="py-5">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <Pill tone="warn">Roleplay</Pill>
          <span className="text-sm text-sand-100">{persona.name} <span className="text-sand-300/60">· {persona.title}</span></span>
          {buyerState.thinking && <span className="text-xs text-sand-300/60 flex items-center gap-1.5"><Brain size={13} className="animate-pulse text-gold-300" /> buyer thinking…</span>}
          {buyerState.speaking && <span className="text-xs text-emerald-450 flex items-center gap-1.5"><Volume2 size={13} className="animate-pulse" /> buyer speaking</span>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setReveal((r) => !r)} className="btn-ghost !px-3" title="Reveal what the buyer is really thinking">{reveal ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          <button onClick={endSession} className="btn-danger" disabled={phase === "ending"}><PhoneOff size={15} /> {phase === "ending" ? "Scoring…" : "End roleplay"}</button>
        </div>
      </div>
      {error && <div className="mb-4"><Banner title={error.title} onClose={() => setError(null)}>{error.detail}</Banner></div>}
      {engine.coachError && <div className="mb-4"><Banner kind="info" title="Coach hiccup, retrying on the next turn">{engine.coachError}</Banner></div>}
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between"><div className="label">Buyer reads as</div>{reveal && buyerState.internal && <div className="text-xs italic text-sand-300/70 animate-rise">“{buyerState.internal}”</div>}</div>
          <EmotionBadge emotion={latest?.emotion ?? buyerState.emotion} reason={latest?.emotionReason} large />
          <NextAction out={latest} thinking={engine.thinking} />
          <StageTracker stage={engine.stage} stages={playbook.stages} />
        </div>
        <div className="lg:col-span-5 space-y-4">
          <Transcript turns={engine.turns} interim={interim} buyerLabel={persona.name.split(" ")[0]} height="h-[380px]" />
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!typed.trim() || buyerState.thinking || buyerState.speaking) return; const s = engine.now(); repSaid(typed, s - Math.max(1, typed.split(/\s+/).length / 2.5), s); setTyped(""); }}>
            <input className="input" placeholder={srOk ? "Speak, or type your line and press Enter" : "Type your line and press Enter"} value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={500} disabled={buyerState.thinking || buyerState.speaking} />
            <button className="btn-gold !px-3" type="submit" disabled={!typed.trim() || buyerState.thinking || buyerState.speaking} aria-label="Send"><Send size={15} /></button>
          </form>
          <PromptHistory prompts={engine.prompts} />
        </div>
      </div>
      <div className="mt-3 text-[11px] text-sand-300/40">Tone: <span className={toneOf(latest?.emotion).dot === "bg-uae-red" ? "text-uae-red" : "text-sand-300/60"}>{latest?.emotion ?? "—"}</span> · your mic is paused while the buyer speaks.</div>
    </div>
  );
}
