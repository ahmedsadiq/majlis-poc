"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Radio, Swords, ShieldCheck, Zap, EyeOff, History } from "lucide-react";
import { getActivePlaybook, getCalls, getUsage } from "@/lib/store";
import { Gauge, useHydrated } from "@/components/ui";

export default function Home() {
  const hydrated = useHydrated();
  const [stats, setStats] = useState({ calls: 0, avg: 0, playbook: "", liveMin: 0 });
  useEffect(() => {
    if (!hydrated) return;
    const calls = getCalls();
    const scored = calls.filter((c) => c.scorecard);
    setStats({ calls: calls.length, avg: scored.length ? scored.reduce((s, c) => s + (c.scorecard?.healthScore ?? 0), 0) / scored.length : 0, playbook: getActivePlaybook().name, liveMin: Math.round(getUsage().liveSeconds / 60) });
  }, [hydrated]);

  return (
    <div className="py-12">
      <section className="relative grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-[11px] uppercase tracking-[.2em] text-gold-300 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-pulse" /> Proof of concept
          </div>
          <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] text-sand-50">
            Win more customers,<br /><span className="gold-text">in real time.</span>
          </h1>
          <p className="mt-5 text-lg text-sand-200/80 max-w-xl">
            Majlis listens to your live call privately, reads how the buyer feels, and shows you the one thing to say next, in your own playbook's words. Practice before, coach during, score after.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/live" className="btn-gold !px-6 !py-3 text-base"><Radio size={18} /> Coach a live call</Link>
            <Link href="/roleplay" className="btn-ghost !px-6 !py-3 text-base"><Swords size={18} /> Practice with an AI buyer</Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-sand-300/70">
            <span className="flex items-center gap-2"><EyeOff size={14} className="text-gold-300" /> No bot joins the call</span>
            <span className="flex items-center gap-2"><Zap size={14} className="text-gold-300" /> Guidance in about two seconds</span>
            <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-gold-300" /> Audio never stored</span>
          </div>
        </div>
        <div className="lg:col-span-5">
          <DemoCard />
        </div>
      </section>

      <div className="hairline my-14" />

      <section className="grid md:grid-cols-3 gap-5">
        <Card icon={<Swords className="text-gold-300" />} step="01 · Practice" title="AI roleplay" desc="Rehearse your hardest objections with a buyer built from your playbook. Scored before it costs a real deal." href="/roleplay" />
        <Card icon={<Radio className="text-uae-red" />} step="02 · Perform" title="Live coaching" desc="A private overlay beside Google Meet: emotion read, next best action, playbook stage tracking." href="/live" accent />
        <Card icon={<History className="text-emerald-450" />} step="03 · Improve" title="Scorecard" desc="Health score, missed moments with the line you should have said, CRM-ready notes, and the next drill." href="/calls" />
      </section>

      <section className="mt-10 grid md:grid-cols-4 gap-4">
        <Stat label="Calls on this device" value={String(stats.calls)} />
        <Stat label="Average deal health" value={stats.avg ? Math.round(stats.avg).toString() : "—"} />
        <Stat label="Live minutes used" value={String(stats.liveMin)} />
        <Link href="/playbook" className="glass p-5 hover:border-gold-500/40 transition flex items-center justify-between"><div><div className="label">Active playbook</div><div className="text-sand-50 font-semibold mt-1 text-sm">{stats.playbook || "—"}</div></div><BookOpen size={18} className="text-gold-300" /></Link>
      </section>
    </div>
  );
}

function Card({ icon, step, title, desc, href, accent }: { icon: React.ReactNode; step: string; title: string; desc: string; href: string; accent?: boolean }) {
  return (
    <Link href={href} className={`${accent ? "glass-strong" : "glass"} p-6 group hover:-translate-y-0.5 transition`}>
      <div className="flex items-center justify-between"><div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">{icon}</div><span className="label">{step}</span></div>
      <div className="font-display text-2xl text-sand-50 mt-5">{title}</div>
      <p className="text-sm text-sand-200/70 mt-2">{desc}</p>
      <div className="mt-4 text-sm text-gold-300 flex items-center gap-1 group-hover:gap-2 transition-all">Open <ArrowRight size={14} /></div>
    </Link>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="glass p-5"><div className="label">{label}</div><div className="font-display text-3xl text-sand-50 mt-1">{value}</div></div>;
}

function DemoCard() {
  return (
    <div className="glass-strong p-5 relative overflow-hidden">
      <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-uae-green/10 blur-3xl" />
      <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-uae-red/10 blur-3xl" />
      <div className="flex items-center justify-between mb-4"><span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-uae-red font-semibold"><span className="h-2 w-2 rounded-full bg-uae-red animate-pulse" /> Live · only you see this</span><span className="font-mono text-xs text-sand-300/50">07:42</span></div>
      <div className="space-y-2 text-sm">
        <div className="rounded-xl bg-white/[.04] border border-white/10 px-3 py-2"><span className="text-[10px] uppercase tracking-wider text-sand-300/60 mr-2">Buyer</span>It's more than I expected, honestly.</div>
      </div>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-uae-red/15 ring-1 ring-uae-red/40 px-3 py-1.5"><span className="h-2 w-2 rounded-full bg-uae-red" /><span className="text-sm font-semibold text-sand-50">Hesitant</span><span className="text-xs text-sand-300/70">· slower, quieter on “expected”</span></div>
      <div className="mt-3 rounded-xl border border-gold-500/30 bg-gold-500/10 p-4">
        <div className="label mb-1">Say this next</div>
        <p className="text-sand-50 text-[15px] leading-snug">Validate the concern, then ask what part of the investment feels hardest to justify. Don't restate the price.</p>
        <blockquote className="mt-2 border-l-2 border-gold-400/70 pl-3 text-sand-100/90 italic text-sm">“Fair. Compared with ready property in the same area you're paying 10–15% less per square foot…”</blockquote>
      </div>
      <div className="mt-4 flex items-center gap-1.5">
        {["Rapport", "Discovery", "Recommend", "Objections", "Next steps"].map((s, i) => <div key={s} className="flex-1"><div className={`h-1.5 rounded-full ${i < 3 ? "bg-emerald-450" : i === 3 ? "bg-gold-400" : "bg-white/10"}`} /><div className={`mt-1 text-[10px] truncate ${i === 3 ? "text-gold-300" : "text-sand-300/50"}`}>{s}</div></div>)}
      </div>
    </div>
  );
}
