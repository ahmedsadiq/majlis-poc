"use client";
import { AlertTriangle, CheckCircle2, Circle, Lightbulb, MessageSquareQuote, Sparkles, TrendingUp } from "lucide-react";
import type { CoachOutput, Emotion, Prompted, StageState } from "@/lib/types";

const EMOTION_TONE: Record<string, { bg: string; ring: string; dot: string }> = {
  positive: { bg: "bg-uae-green/15", ring: "ring-uae-green/40", dot: "bg-emerald-450" },
  negative: { bg: "bg-uae-red/15", ring: "ring-uae-red/40", dot: "bg-uae-red" },
  neutral: { bg: "bg-gold-500/15", ring: "ring-gold-500/40", dot: "bg-gold-400" },
};
const POS: Emotion[] = ["Confident", "Warm", "Reassured", "Interested", "Engaged", "Trusting", "Excited", "Relieved", "Curious", "Open"];
const NEG: Emotion[] = ["Hesitant", "Skeptical", "Frustrated", "Resistant", "Confused", "Concerned", "Anxious", "Disappointed", "Impatient"];
export function toneOf(e?: Emotion) { if (!e) return EMOTION_TONE.neutral; if (POS.includes(e)) return EMOTION_TONE.positive; if (NEG.includes(e)) return EMOTION_TONE.negative; return EMOTION_TONE.neutral; }

export function EmotionBadge({ emotion, reason, large }: { emotion?: Emotion; reason?: string; large?: boolean }) {
  const tone = toneOf(emotion);
  return (
    <div className={`inline-flex items-center gap-3 rounded-full ${tone.bg} ring-1 ${tone.ring} ${large ? "px-5 py-2.5" : "px-3 py-1.5"} animate-rise`}>
      <span className="relative flex h-2.5 w-2.5"><span className={`absolute inline-flex h-full w-full rounded-full ${tone.dot} opacity-60 animate-ping`} /><span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${tone.dot}`} /></span>
      <span className={`${large ? "text-2xl font-display tracking-wide" : "text-sm font-semibold"} text-sand-50`}>{emotion ?? "Listening"}</span>
      {reason && <span className="text-xs text-sand-300/70 hidden sm:inline">· {reason}</span>}
    </div>
  );
}

export function NextAction({ out, thinking }: { out?: CoachOutput; thinking: boolean }) {
  const flagIcon = out?.flag === "objection" ? <AlertTriangle size={14} className="text-uae-red" /> : out?.flag === "buying_signal" ? <TrendingUp size={14} className="text-emerald-450" /> : out?.flag === "question" ? <MessageSquareQuote size={14} className="text-gold-300" /> : null;
  const flagText = out?.flag && out.flag !== "none" ? out.flag.replace("_", " ") : null;
  return (
    <div className="glass-strong p-5 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="flex items-center justify-between mb-3">
        <div className="label flex items-center gap-2"><Sparkles size={12} className="text-gold-300" /> Say this next</div>
        {flagText && <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-sand-200">{flagIcon}{flagText}</span>}
      </div>
      {!out && !thinking && <p className="text-sand-300/60 text-sm">Guidance appears here the moment the buyer finishes a sentence.</p>}
      {thinking && !out && <div className="h-6 w-3/4 rounded-md shimmer" />}
      {out && (
        <div key={out.nextAction} className="animate-rise">
          <p className="text-[19px] leading-snug text-sand-50 font-medium">{out.nextAction}</p>
          {out.sayThis && (
            <blockquote className="mt-3 border-l-2 border-gold-400/70 pl-3 text-sand-100/90 italic text-[15px]">“{out.sayThis}”</blockquote>
          )}
          <div className="mt-3 flex items-center gap-3 text-[11px] text-sand-300/60">
            {thinking && <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-pulse" /> updating…</span>}
            <span>confidence {Math.round((out.confidence ?? 0) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function StageTracker({ stage, stages }: { stage: StageState; stages: { name: string; items: string[] }[] }) {
  const idx = Math.max(0, stages.findIndex((s) => s.name === stage.current));
  const done = stage.checklist.filter((c) => c.done).length;
  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="label">Playbook stage</div>
        <div className="text-xs text-sand-300/70">Step {idx + 1} · {stage.current} <span className="text-gold-300 font-semibold">{done}/{stage.checklist.length}</span></div>
      </div>
      <div className="flex items-center gap-1.5 mb-4">
        {stages.map((s, i) => {
          const complete = stage.completed.includes(s.name) || i < idx;
          const current = i === idx;
          return (
            <div key={s.name} className="flex-1" title={s.name}>
              <div className={`h-1.5 rounded-full transition-all ${complete ? "bg-emerald-450" : current ? "bg-gold-400" : "bg-white/10"}`} />
              <div className={`mt-1.5 text-[10px] truncate ${current ? "text-gold-300" : complete ? "text-sand-200/70" : "text-sand-300/40"}`}>{s.name}</div>
            </div>
          );
        })}
      </div>
      <ul className="space-y-1.5">
        {stage.checklist.map((c) => (
          <li key={c.item} className={`flex items-start gap-2 text-[13px] ${c.done ? "text-sand-300/50 line-through" : "text-sand-100"}`}>
            {c.done ? <CheckCircle2 size={15} className="text-emerald-450 mt-0.5 shrink-0" /> : <Circle size={15} className="text-sand-300/40 mt-0.5 shrink-0" />}
            <span>{c.item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PromptHistory({ prompts }: { prompts: Prompted[] }) {
  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  return (
    <div className="glass p-4">
      <div className="label mb-3 flex items-center gap-2"><Lightbulb size={12} className="text-gold-300" /> Guidance so far ({prompts.length})</div>
      <ol className="space-y-2 max-h-56 overflow-auto pr-1">
        {[...prompts].reverse().map((p) => (
          <li key={p.id} className="text-[13px] flex gap-2">
            <span className="font-mono text-[11px] text-sand-300/50 pt-0.5">{fmt(p.at)}</span>
            <span><span className={`mr-1.5 font-semibold ${toneOf(p.output.emotion).dot === "bg-uae-red" ? "text-uae-red" : toneOf(p.output.emotion).dot === "bg-emerald-450" ? "text-emerald-450" : "text-gold-300"}`}>{p.output.emotion}</span>{p.output.nextAction}</span>
          </li>
        ))}
        {prompts.length === 0 && <li className="text-sand-300/50 text-sm">No guidance yet.</li>}
      </ol>
    </div>
  );
}
