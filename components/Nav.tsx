"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Radio, Swords, BookOpen, History, Home } from "lucide-react";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/live", label: "Live call", icon: Radio },
  { href: "/roleplay", label: "Roleplay", icon: Swords },
  { href: "/playbook", label: "Playbook", icon: BookOpen },
  { href: "/calls", label: "Calls", icon: History },
];

export function Nav() {
  const path = usePathname();
  const [health, setHealth] = useState<{ anthropic: boolean; deepgram: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({ anthropic: false, deepgram: false }));
  }, []);
  const ok = health?.anthropic && health?.deepgram;
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-ink-950/70 border-b border-white/[.06]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <Logo />
          <div className="leading-tight">
            <div className="font-display text-xl tracking-wide gold-text">Majlis</div>
            <div className="text-[10px] uppercase tracking-[.25em] text-sand-300/50">Real-time sales coach</div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${active ? "bg-gold-500/15 text-gold-300" : "text-sand-200/80 hover:text-sand-50 hover:bg-white/5"}`}>
                <Icon size={15} /> {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-block h-2 w-2 rounded-full ${health === null ? "bg-sand-300/40" : ok ? "bg-emerald-450" : "bg-uae-red"}`} />
          <span className="text-sand-300/60 hidden sm:inline">
            {health === null ? "Checking keys…" : ok ? "AI services ready" : !health.anthropic ? "Anthropic key missing" : "Deepgram key missing"}
          </span>
        </div>
      </div>
    </header>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  // eight-point star, the classic Islamic geometric motif
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="drop-shadow-[0_0_12px_rgba(226,189,92,.35)]">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e3a3" />
          <stop offset=".5" stopColor="#e2bd5c" />
          <stop offset="1" stopColor="#a8842f" />
        </linearGradient>
      </defs>
      <polygon points="24,2 28.5,15.5 42,10 36.5,23.5 46,24 36.5,24.5 42,38 28.5,32.5 24,46 19.5,32.5 6,38 11.5,24.5 2,24 11.5,23.5 6,10 19.5,15.5" fill="none" stroke="url(#g)" strokeWidth="1.6" />
      <circle cx="24" cy="24" r="5" fill="url(#g)" />
    </svg>
  );
}
