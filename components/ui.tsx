"use client";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

export function Banner({ kind = "error", title, children, onClose, action }: { kind?: "error" | "info" | "success"; title: string; children?: React.ReactNode; onClose?: () => void; action?: React.ReactNode }) {
  const tone = kind === "error" ? "border-uae-red/40 bg-uae-red/10" : kind === "success" ? "border-uae-green/40 bg-uae-green/10" : "border-gold-500/40 bg-gold-500/10";
  const Icon = kind === "error" ? AlertCircle : kind === "success" ? CheckCircle2 : Info;
  return (
    <div className={`rounded-xl border ${tone} px-4 py-3 flex gap-3 items-start animate-rise`} role={kind === "error" ? "alert" : "status"}>
      <Icon size={18} className={`mt-0.5 shrink-0 ${kind === "error" ? "text-uae-red" : kind === "success" ? "text-emerald-450" : "text-gold-300"}`} />
      <div className="flex-1 text-sm">
        <div className="font-semibold text-sand-50">{title}</div>
        {children && <div className="text-sand-200/80 mt-0.5">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onClose && <button onClick={onClose} className="text-sand-300/60 hover:text-sand-50" aria-label="Dismiss"><X size={16} /></button>}
    </div>
  );
}

export function LevelMeter({ level, label, color = "bg-gold-400" }: { level: number; label: string; color?: string }) {
  const bars = 14;
  const lit = Math.min(bars, Math.round(Math.sqrt(Math.min(1, level * 6)) * bars));
  return (
    <div className="flex items-center gap-2">
      <span className="label w-12">{label}</span>
      <div className="flex gap-[3px] items-end h-4">
        {Array.from({ length: bars }).map((_, i) => (
          <span key={i} className={`w-1 rounded-sm transition-all ${i < lit ? color : "bg-white/10"}`} style={{ height: `${6 + (i / bars) * 10}px` }} />
        ))}
      </div>
    </div>
  );
}

export function Countdown({ elapsed, capSec, warnAt = 0.8 }: { elapsed: number; capSec: number; warnAt?: number }) {
  const left = Math.max(0, capSec - elapsed);
  const pct = Math.min(1, elapsed / capSec);
  const warn = pct >= warnAt;
  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  return (
    <div className="flex items-center gap-3" title="Credit protection: the session stops automatically at the cap">
      <div className="relative h-10 w-10">
        <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={warn ? "#ef3340" : "#e2bd5c"} strokeWidth="3" strokeDasharray={`${pct * 97.4} 97.4`} strokeLinecap="round" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className={`font-mono text-sm ${warn ? "text-uae-red" : "text-sand-50"}`}>{fmt(elapsed)} <span className="text-sand-300/50">/ {fmt(capSec)}</span></div>
        <div className="text-[10px] uppercase tracking-wider text-sand-300/50">{warn ? `${fmt(left)} left · auto-stop` : "session cap"}</div>
      </div>
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "live" | "ok" | "warn" }) {
  const cls = tone === "live" ? "bg-uae-red/15 text-uae-red ring-uae-red/40" : tone === "ok" ? "bg-uae-green/15 text-emerald-450 ring-uae-green/40" : tone === "warn" ? "bg-gold-500/15 text-gold-300 ring-gold-500/40" : "bg-white/5 text-sand-200 ring-white/10";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ${cls}`}>{children}</span>;
}

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

export function Gauge({ value, size = 140, label }: { value: number; size?: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 70 ? "#19a463" : v >= 45 ? "#e2bd5c" : "#ef3340";
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="-rotate-90" width={size} height={size}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} style={{ filter: `drop-shadow(0 0 8px ${color}66)` }} />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-4xl text-sand-50">{Math.round(v)}</div>
        {label && <div className="label">{label}</div>}
      </div>
    </div>
  );
}
