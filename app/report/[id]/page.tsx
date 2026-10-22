"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCopy, RefreshCw, Swords, ThumbsUp, XCircle } from "lucide-react";
import { addUsage, getCall, playbookToText, getPlaybooks, saveCall } from "@/lib/store";
import type { CallRecord, Scorecard } from "@/lib/types";
import { Banner, Gauge, Pill, useHydrated } from "@/components/ui";
import { toneOf } from "@/components/CoachPanel";
import { Suspense } from "react";

const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

export default function ReportPage() {
  return <Suspense fallback={<div className="py-24 text-center text-sand-300/50">Loading…</div>}><Report /></Suspense>;
}

function Report() {
  const hydrated = useHydrated();
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const [call, setCall] = useState<CallRecord | null | undefined>(undefined);
  const [rescoring, setRescoring] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const load = () => setCall(getCall(id) ?? null);
    load();
    window.addEventListener("majlis:store", load);
    const t = setInterval(load, 1500);
    return () => { window.removeEventListener("majlis:store", load); clearInterval(t); };
  }, [hydrated, id]);

  async function rescore() {
    if (!call) return;
    setRescoring(true);
    const pb = getPlaybooks().find((p) => p.id === call.playbookId) ?? getPlaybooks()[0];
    const rep = call.turns.filter((x) => x.speaker === "rep").reduce((s, x) => s + (x.end - x.start), 0);
    const buyer = call.turns.filter((x) => x.speaker === "buyer").reduce((s, x) => s + (x.end - x.start), 0);
    try {
      const r = await fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playbookText: playbookToText(pb), turns: call.turns, promptsShown: call.prompts.map((p) => ({ at: p.at, nextAction: p.output.nextAction })), talkRatio: { rep: rep / Math.max(1, rep + buyer), buyer: buyer / Math.max(1, rep + buyer) }, durationSec: call.durationSec, mode: call.mode }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Scoring failed (${r.status})`);
      saveCall({ ...call, scorecard: j, scoringError: undefined });
      addUsage({ scoreCalls: 1 });
    } catch (e: any) { saveCall({ ...call, scoringError: e?.message ?? String(e) }); }
    setRescoring(false);
  }

  if (!hydrated || call === undefined) return <div className="py-24 text-center text-sand-300/50">Loading…</div>;
  if (call === null) return <div className="py-24 text-center"><div className="text-sand-50 text-lg">Call not found on this device.</div><Link href="/calls" className="btn-ghost mt-4">All calls</Link></div>;

  const sc = call.scorecard;
  const reason = search.get("reason");

  return (
    <div className="py-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2"><Pill tone={call.mode === "live" ? "live" : "warn"}>{call.mode === "live" ? "Live call" : "Roleplay"}</Pill><span className="text-xs text-sand-300/60">{new Date(call.startedAt).toLocaleString()} · {fmt(call.durationSec)}{call.personaName ? ` · with ${call.personaName}` : ""}</span></div>
          <h1 className="font-display text-4xl text-sand-50">Post-call scorecard</h1>
          <div className="text-sm text-sand-300/70 mt-1">{call.playbookName}</div>
        </div>
        <div className="flex gap-2">
          <Link href="/calls" className="btn-ghost">All calls</Link>
          <Link href={call.mode === "live" ? "/live" : "/roleplay"} className="btn-gold">New {call.mode === "live" ? "call" : "roleplay"}</Link>
        </div>
      </div>

      {reason && <div className="mb-4"><Banner kind="info" title={reason} /></div>}

      {!sc && !call.scoringError && (
        <div className="glass-strong p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-full border-2 border-gold-400 border-t-transparent animate-spin" />
          <div className="mt-5 font-display text-2xl text-sand-50">Analysing the conversation</div>
          <div className="text-sand-300/70 text-sm mt-1">Scoring {call.turns.length} turns against {call.playbookName.split("·")[0].trim()}'s rubric. Usually 15–30 seconds.</div>
        </div>
      )}
      {call.scoringError && !sc && (
        <Banner title="Scoring did not complete" action={<button onClick={rescore} className="btn-gold" disabled={rescoring}><RefreshCw size={14} className={rescoring ? "animate-spin" : ""} /> Retry scoring</button>}>{call.scoringError}</Banner>
      )}

      {sc && <ScoreBody sc={sc} call={call} onCopy={async () => { await navigator.clipboard.writeText(notesText(sc)); setCopied(true); setTimeout(() => setCopied(false), 1500); }} copied={copied} onDrill={() => router.push(`/roleplay?persona=${encodeURIComponent(sc.nextDrill.persona)}&scenario=${encodeURIComponent(sc.nextDrill.scenario)}`)} />}

      <div className="mt-8">
        <div className="label mb-3">Transcript with guidance shown in the moment</div>
        <div className="glass p-4 space-y-2 max-h-[520px] overflow-auto">
          {mergeTimeline(call).map((row, i) => row.kind === "turn" ? (
            <div key={i} className="flex gap-3 text-sm"><span className="font-mono text-[11px] text-sand-300/50 w-12 pt-0.5">{fmt(row.at)}</span><span className={`w-14 shrink-0 text-[11px] uppercase tracking-wider font-semibold pt-0.5 ${row.speaker === "rep" ? "text-gold-300" : "text-sand-300/70"}`}>{row.speaker === "rep" ? "Rep" : "Buyer"}</span><span className="text-sand-100">{row.text}</span></div>
          ) : (
            <div key={i} className="flex gap-3 text-sm bg-gold-500/8 border border-gold-500/20 rounded-lg px-3 py-2 ml-12"><span className="text-[11px] uppercase tracking-wider font-semibold text-gold-300 pt-0.5 w-20 shrink-0">Majlis · {row.emotion}</span><span className="text-sand-200/90 italic">{row.text}</span></div>
          ))}
          {call.turns.length === 0 && <div className="text-sand-300/50 text-sm">No speech was captured.</div>}
        </div>
      </div>
    </div>
  );
}

function notesText(sc: Scorecard) {
  return [`Overview: ${sc.notes.overview}`, "", "Highlights:", ...sc.notes.highlights.map((h) => `- ${h}`), "", "Action items:", ...sc.notes.actionItems.map((a) => `- [${a.owner}] ${a.item}`), "", `Health score: ${sc.healthScore}/100`, `Risks: ${sc.dealRisks.join("; ")}`].join("\n");
}

function mergeTimeline(call: CallRecord) {
  const rows: ({ kind: "turn"; at: number; speaker: string; text: string } | { kind: "prompt"; at: number; text: string; emotion: string })[] = [
    ...call.turns.map((t) => ({ kind: "turn" as const, at: t.start, speaker: t.speaker, text: t.text })),
    ...call.prompts.map((p) => ({ kind: "prompt" as const, at: p.at, text: p.output.nextAction, emotion: p.output.emotion })),
  ];
  return rows.sort((a, b) => a.at - b.at);
}

function ScoreBody({ sc, call, onCopy, copied, onDrill }: { sc: Scorecard; call: CallRecord; onCopy: () => void; copied: boolean; onDrill: () => void }) {
  return (
    <div className="space-y-6 animate-rise">
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 glass-strong p-6 flex items-center gap-6">
          <Gauge value={sc.healthScore} label="Deal health" />
          <div>
            <div className="label mb-1">Summary</div>
            <p className="text-sand-50 text-[15px] leading-snug">{sc.summary}</p>
          </div>
        </div>
        <div className="lg:col-span-4 glass p-6">
          <div className="label mb-3">Talk ratio</div>
          <div className="h-3 rounded-full overflow-hidden bg-white/10 flex">
            <div className="bg-gold-400" style={{ width: `${Math.round(sc.talkRatio.rep * 100)}%` }} />
            <div className="bg-emerald-450" style={{ width: `${Math.round(sc.talkRatio.buyer * 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs mt-2"><span className="text-gold-300">Rep {Math.round(sc.talkRatio.rep * 100)}%</span><span className="text-emerald-450">Buyer {Math.round(sc.talkRatio.buyer * 100)}%</span></div>
          <div className="label mt-5 mb-2">Sentiment arc</div>
          <Sparkline points={sc.sentimentArc} duration={call.durationSec} />
        </div>
        <div className="lg:col-span-4 glass p-6">
          <div className="label mb-3">Rubric</div>
          <div className="space-y-2.5">
            {sc.rubricScores.map((r) => (
              <div key={r.criterion} title={r.evidence}>
                <div className="flex justify-between text-[13px]"><span className="text-sand-100">{r.criterion}</span><span className={`font-mono ${r.score >= 70 ? "text-emerald-450" : r.score >= 45 ? "text-gold-300" : "text-uae-red"}`}>{Math.round(r.score)}</span></div>
                <div className="h-1.5 rounded-full bg-white/10 mt-1"><div className={`h-1.5 rounded-full ${r.score >= 70 ? "bg-emerald-450" : r.score >= 45 ? "bg-gold-400" : "bg-uae-red"}`} style={{ width: `${r.score}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 glass p-6">
          <div className="label mb-3 flex items-center gap-2"><AlertTriangle size={13} className="text-uae-red" /> Missed moments</div>
          {sc.missedMoments.length === 0 && <div className="text-sm text-sand-300/60">None flagged.</div>}
          <div className="space-y-4">
            {sc.missedMoments.map((m, i) => (
              <div key={i} className="border-l-2 border-uae-red/60 pl-4">
                <div className="flex items-center gap-2 text-xs text-sand-300/60"><span className="font-mono">{fmt(m.at)}</span></div>
                <div className="text-sand-50 text-[15px] mt-0.5">{m.what}</div>
                <blockquote className="mt-2 text-sand-100/90 italic text-sm bg-uae-green/8 border border-uae-green/25 rounded-lg px-3 py-2"><span className="not-italic text-[10px] uppercase tracking-wider text-emerald-450 mr-2">Say instead</span>“{m.recommendedInstead}”</blockquote>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-5 space-y-5">
          <div className="glass p-6">
            <div className="label mb-3 flex items-center gap-2"><ThumbsUp size={13} className="text-emerald-450" /> What worked</div>
            <ul className="space-y-1.5 text-sm text-sand-100">{sc.positives.map((p, i) => <li key={i} className="flex gap-2"><CheckCircle2 size={15} className="text-emerald-450 mt-0.5 shrink-0" />{p}</li>)}</ul>
            <div className="label mt-5 mb-3 flex items-center gap-2"><XCircle size={13} className="text-uae-red" /> Deal risks</div>
            <ul className="space-y-1.5 text-sm text-sand-100">{sc.dealRisks.map((p, i) => <li key={i} className="flex gap-2"><span className="h-1.5 w-1.5 rounded-full bg-uae-red mt-2 shrink-0" />{p}</li>)}</ul>
          </div>
          <div className="glass p-6">
            <div className="label mb-3">Playbook stages</div>
            <ul className="space-y-2">{sc.stageScores.map((s) => <li key={s.stage} className="flex gap-2 text-sm">{s.completed ? <CheckCircle2 size={15} className="text-emerald-450 mt-0.5 shrink-0" /> : <XCircle size={15} className="text-uae-red/80 mt-0.5 shrink-0" />}<span><span className="text-sand-50 font-medium">{s.stage}</span> <span className="text-sand-300/70">— {s.note}</span></span></li>)}</ul>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 glass p-6">
          <div className="flex items-center justify-between mb-3"><div className="label">Meeting notes (CRM-ready)</div><button onClick={onCopy} className="btn-ghost !py-1.5 !px-3 text-xs"><ClipboardCopy size={13} /> {copied ? "Copied" : "Copy"}</button></div>
          <p className="text-sm text-sand-100">{sc.notes.overview}</p>
          <div className="label mt-4 mb-1.5">Highlights</div>
          <ul className="list-disc pl-5 text-sm text-sand-200/90 space-y-1">{sc.notes.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
          <div className="label mt-4 mb-1.5">Action items</div>
          <ul className="text-sm space-y-1">{sc.notes.actionItems.map((a, i) => <li key={i} className="flex gap-2"><span className="text-[10px] uppercase tracking-wider text-gold-300 font-semibold pt-1 w-16 shrink-0">{a.owner}</span><span className="text-sand-100">{a.item}</span></li>)}</ul>
        </div>
        <div className="lg:col-span-5 glass-strong p-6 flex flex-col">
          <div className="label mb-2 flex items-center gap-2"><Swords size={13} className="text-gold-300" /> Next drill</div>
          <div className="font-display text-2xl text-sand-50">{sc.nextDrill.title}</div>
          <p className="text-sm text-sand-200/80 mt-2 flex-1">{sc.nextDrill.scenario}</p>
          <div className="text-xs text-sand-300/60 mt-3">Buyer: {sc.nextDrill.persona}</div>
          <button onClick={onDrill} className="btn-gold mt-4 self-start">Practice this moment <ArrowRight size={15} /></button>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ points, duration }: { points: Scorecard["sentimentArc"]; duration: number }) {
  if (!points?.length) return <div className="text-xs text-sand-300/50">—</div>;
  const w = 320, h = 70, pad = 8;
  const maxT = Math.max(duration || 1, ...points.map((p) => p.at));
  const X = (t: number) => pad + (t / maxT) * (w - 2 * pad);
  const Y = (s: number) => h / 2 - s * (h / 2 - pad);
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(p.at).toFixed(1)} ${Y(p.score).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[70px]">
      <line x1={pad} x2={w - pad} y1={h / 2} y2={h / 2} stroke="rgba(255,255,255,.12)" strokeDasharray="3 3" />
      <path d={d} fill="none" stroke="#e2bd5c" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => {
        const tone = toneOf(p.label);
        const c = tone.dot === "bg-uae-red" ? "#ef3340" : tone.dot === "bg-emerald-450" ? "#19a463" : "#e2bd5c";
        return <g key={i}><circle cx={X(p.at)} cy={Y(p.score)} r="3.5" fill={c} /><title>{`${fmt(p.at)} · ${p.label}`}</title></g>;
      })}
    </svg>
  );
}
