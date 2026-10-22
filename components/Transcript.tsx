"use client";
import { useEffect, useRef } from "react";
import type { Turn } from "@/lib/types";

const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

export function Transcript({ turns, interim, repLabel = "You", buyerLabel = "Buyer", height = "h-[360px]" }: { turns: Turn[]; interim?: { rep?: string; buyer?: string }; repLabel?: string; buyerLabel?: string; height?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); }, [turns.length, interim?.rep, interim?.buyer]);
  return (
    <div ref={ref} className={`glass p-4 ${height} overflow-auto space-y-3`}>
      {turns.length === 0 && !interim?.rep && !interim?.buyer && (
        <div className="h-full flex items-center justify-center text-sand-300/40 text-sm">Transcript will appear here as people speak.</div>
      )}
      {turns.map((t) => <Bubble key={t.id} speaker={t.speaker} text={t.text} time={fmt(t.start)} label={t.speaker === "rep" ? repLabel : buyerLabel} />)}
      {interim?.buyer && <Bubble speaker="buyer" text={interim.buyer} label={buyerLabel} live />}
      {interim?.rep && <Bubble speaker="rep" text={interim.rep} label={repLabel} live />}
    </div>
  );
}

function Bubble({ speaker, text, time, label, live }: { speaker: "rep" | "buyer"; text: string; time?: string; label: string; live?: boolean }) {
  const rep = speaker === "rep";
  return (
    <div className={`flex ${rep ? "justify-end" : "justify-start"} animate-rise`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${rep ? "bg-gold-500/12 border border-gold-500/25 rounded-br-md" : "bg-white/[.04] border border-white/10 rounded-bl-md"} ${live ? "opacity-70" : ""}`}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] uppercase tracking-wider font-semibold ${rep ? "text-gold-300" : "text-sand-300/70"}`}>{label}</span>
          {time && <span className="font-mono text-[10px] text-sand-300/40">{time}</span>}
          {live && <span className="text-[10px] text-sand-300/50 italic">speaking…</span>}
        </div>
        <div className="text-sand-50">{text}</div>
      </div>
    </div>
  );
}
