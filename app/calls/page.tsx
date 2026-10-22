"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import { deleteCall, getCalls } from "@/lib/store";
import type { CallRecord } from "@/lib/types";
import { Pill, useHydrated } from "@/components/ui";

const fmt = (s: number) => `${Math.floor(s / 60)}m ${Math.floor(s % 60).toString().padStart(2, "0")}s`;

export default function CallsPage() {
  const hydrated = useHydrated();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  useEffect(() => { if (!hydrated) return; const load = () => setCalls(getCalls()); load(); window.addEventListener("majlis:store", load); return () => window.removeEventListener("majlis:store", load); }, [hydrated]);
  if (!hydrated) return null;
  return (
    <div className="py-10">
      <div className="label mb-2">History</div>
      <h1 className="font-display text-4xl text-sand-50 mb-6">Calls and roleplays</h1>
      {calls.length === 0 && <div className="glass p-10 text-center text-sand-300/60">Nothing yet. <Link href="/roleplay" className="text-gold-300">Run a roleplay</Link> or <Link href="/live" className="text-gold-300">coach a live call</Link>.</div>}
      <div className="space-y-3">
        {calls.map((c) => (
          <div key={c.id} className="glass p-4 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-display text-xl ${!c.scorecard ? "bg-white/5 text-sand-300/50" : c.scorecard.healthScore >= 70 ? "bg-uae-green/15 text-emerald-450" : c.scorecard.healthScore >= 45 ? "bg-gold-500/15 text-gold-300" : "bg-uae-red/15 text-uae-red"}`}>{c.scorecard ? Math.round(c.scorecard.healthScore) : "—"}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap"><Pill tone={c.mode === "live" ? "live" : "warn"}>{c.mode}</Pill><span className="text-sand-50 font-medium truncate">{c.personaName ? `with ${c.personaName}` : c.playbookName}</span></div>
              <div className="text-xs text-sand-300/60 mt-1">{new Date(c.startedAt).toLocaleString()} · {fmt(c.durationSec)} · {c.turns.length} turns · {c.prompts.length} prompts{c.scoringError ? " · scoring failed" : ""}</div>
              {c.scorecard && <div className="text-sm text-sand-200/80 mt-1 truncate">{c.scorecard.summary}</div>}
            </div>
            <button className="text-sand-300/40 hover:text-uae-red" onClick={() => { if (confirm("Delete this call?")) deleteCall(c.id); }} aria-label="Delete"><Trash2 size={16} /></button>
            <Link href={`/report/${c.id}`} className="btn-ghost">Open <ArrowRight size={14} /></Link>
          </div>
        ))}
      </div>
    </div>
  );
}
