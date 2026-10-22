"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Headphones, Mic, MonitorUp, PhoneOff, Radio, Minimize2, Maximize2, ShieldCheck, BookOpen } from "lucide-react";
import { getActivePlaybook, getPlaybooks, setActivePlaybookId, getUsage } from "@/lib/store";
import { CaptureError, getMic, getTabAudio, isCaptureSupported, startGraph, type CaptureHandles } from "@/lib/capture";
import { DeepgramStream } from "@/lib/deepgram";
import { EMPTY_PLAYBOOK, useCoachEngine } from "@/lib/engine";
import type { Playbook } from "@/lib/types";
import { EmotionBadge, NextAction, PromptHistory, StageTracker } from "@/components/CoachPanel";
import { Transcript } from "@/components/Transcript";
import { Banner, Countdown, LevelMeter, Pill, useHydrated } from "@/components/ui";

type Phase = "setup" | "connecting" | "live" | "ending";

export default function LivePage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [capMin, setCapMin] = useState(15);
  const [phase, setPhase] = useState<Phase>("setup");
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);
  const [mic, setMic] = useState<MediaStream | null>(null);
  const [tab, setTab] = useState<MediaStream | null>(null);
  const [levels, setLevels] = useState<[number, number]>([0, 0]);
  const [interim, setInterim] = useState<{ rep?: string; buyer?: string }>({});
  const [compact, setCompact] = useState(false);
  const [dgStatus, setDgStatus] = useState<"idle" | "open" | "closed">("idle");
  const [credit, setCredit] = useState(0);

  const graph = useRef<CaptureHandles | null>(null);
  const dg = useRef<DeepgramStream | null>(null);
  const engine = useCoachEngine(playbook ?? EMPTY_PLAYBOOK, "live");
  const endingRef = useRef(false);
  const phaseRef = useRef<Phase>("setup");
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (!hydrated) return;
    setPlaybooks(getPlaybooks());
    setPlaybook(getActivePlaybook());
    setCredit(getUsage().liveSeconds);
    fetch("/api/health").then((r) => r.json()).then((h) => setCapMin(Number(h.capMinutes) || 15)).catch(() => {});
    if (!isCaptureSupported()) setError({ title: "This browser can't capture call audio.", detail: "Use Google Chrome on a laptop or desktop. Tab-audio sharing is not available on mobile browsers." });
  }, [hydrated]);

  const capSec = capMin * 60;

  const endCall = useCallback(async (reason?: string) => {
    if (endingRef.current) return;
    endingRef.current = true;
    setPhase("ending");
    dg.current?.close(); dg.current = null;
    graph.current?.stop(); graph.current = null;
    setMic(null); setTab(null);
    await engine.finish({ onSaved: (id) => router.push(`/report/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`) });
  }, [engine, router]);

  // hard cap
  useEffect(() => {
    if (phase === "live" && engine.elapsed >= capSec) endCall("Session cap reached (credit protection).");
  }, [engine.elapsed, phase, capSec, endCall]);

  // share stopped from Chrome's bar
  useEffect(() => {
    const h = () => { if (phase === "live") { setError({ title: "Tab sharing stopped.", detail: "The call audio feed ended. Ending the session and scoring what we have." }); endCall("Tab sharing stopped"); } };
    window.addEventListener("majlis:share-ended", h);
    return () => window.removeEventListener("majlis:share-ended", h);
  }, [phase, endCall]);

  useEffect(() => () => { dg.current?.close(); graph.current?.stop(); }, []);

  async function stepMic() {
    setError(null);
    try { setMic(await getMic()); } catch (e: any) { setError({ title: e instanceof CaptureError ? e.message : "Microphone failed", detail: e instanceof CaptureError ? undefined : String(e?.message ?? e) }); }
  }
  async function stepTab() {
    setError(null);
    try { setTab(await getTabAudio()); } catch (e: any) { setError({ title: e instanceof CaptureError ? e.message : "Tab share failed", detail: e instanceof CaptureError ? undefined : String(e?.message ?? e) }); }
  }

  async function startSession() {
    if (!mic || !tab || !playbook) return;
    setError(null);
    setPhase("connecting");
    endingRef.current = false;
    const stream = new DeepgramStream({
      onOpen: () => setDgStatus("open"),
      onInterim: (sp, text) => setInterim((i) => ({ ...i, [sp]: text })),
      onFinalUtterance: (sp, text, start, end, words) => { setInterim((i) => ({ ...i, [sp]: undefined })); engine.addTurn(sp, text, start, end, words); },
      onError: (m) => setError({ title: "Transcription error", detail: m }),
      onClose: (code, reason) => { setDgStatus("closed"); if (!endingRef.current && phaseRef.current !== "setup") setError({ title: "Transcription stream closed", detail: `${reason} (code ${code}). End the call to get the scorecard for what was captured.` }); },
    });
    try {
      await stream.connect({ channels: 2 });
      dg.current = stream;
      graph.current = await startGraph({ mic, tab, onFrame: (pcm, rms) => { stream.send(pcm); setLevels(rms); } });
      engine.start();
      setPhase("live");
      // initial read so the panel isn't empty
      setTimeout(() => engine.requestCoach("call started"), 1500);
    } catch (e: any) {
      stream.close();
      graph.current?.stop(); graph.current = null;
      setPhase("setup");
      setError({ title: "Could not start the session", detail: e?.message ?? String(e) });
    }
  }

  if (!hydrated || !playbook) return <div className="py-24 text-center text-sand-300/50">Loading…</div>;

  // ------------------------------------------------------------ SETUP
  if (phase === "setup" || phase === "connecting") {
    const ready = Boolean(mic && tab);
    return (
      <div className="py-10 max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="label mb-2">Live call</div>
            <h1 className="font-display text-4xl text-sand-50">Coach a real call, privately.</h1>
            <p className="text-sand-200/70 mt-2 max-w-2xl">Majlis listens to your Google Meet tab and your microphone on this computer. Nothing joins the meeting; the buyer sees nothing.</p>
          </div>
          <Link href="/playbook" className="btn-ghost"><BookOpen size={15} /> Edit playbook</Link>
        </div>

        {error && <div className="mb-6"><Banner title={error.title} onClose={() => setError(null)}>{error.detail}</Banner></div>}

        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3 space-y-4">
            <Step n={1} done={Boolean(mic)} title="Allow your microphone" desc="This is your side of the conversation (channel 1)." icon={<Mic size={18} />}
              action={<button onClick={stepMic} className={mic ? "btn-ghost" : "btn-gold"} disabled={phase === "connecting"}>{mic ? "Microphone ready" : "Allow microphone"}</button>} />
            <Step n={2} done={Boolean(tab)} title="Share the Google Meet tab with audio" desc="In the Chrome dialog pick the Chrome Tab option, choose the Meet tab and tick Share tab audio. That is the buyer's side (channel 2)." icon={<MonitorUp size={18} />}
              action={<button onClick={stepTab} className={tab ? "btn-ghost" : "btn-gold"} disabled={!mic || phase === "connecting"}>{tab ? "Call audio ready" : "Share call tab"}</button>} />
            <Step n={3} done={false} title="Start coaching" desc={`Streams both channels to speech recognition and shows one private prompt at a time. Hard stop after ${capMin} minutes.`} icon={<Radio size={18} />}
              action={<button onClick={startSession} className="btn-green" disabled={!ready || phase === "connecting"}>{phase === "connecting" ? "Connecting…" : "Start coaching"}</button>} />
          </div>
          <div className="md:col-span-2 space-y-4">
            <div className="glass p-5">
              <div className="label mb-2">Playbook in use</div>
              <select className="input" value={playbook.id} onChange={(e) => { setActivePlaybookId(e.target.value); setPlaybook(getActivePlaybook()); }}>
                {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <p className="text-xs text-sand-300/60 mt-2">{playbook.stages.length} stages · {playbook.objections.length} approved objection responses · {playbook.rubric.length} rubric criteria</p>
            </div>
            <div className="glass p-5 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-sand-50 font-semibold"><Headphones size={16} className="text-gold-300" /> Before you start</div>
              <ul className="space-y-2 text-sand-200/80">
                <li>Wear headphones so your mic doesn't pick up the buyer twice.</li>
                <li>Open the Meet in its own Chrome tab; keep this window beside it.</li>
                <li>Use the compact overlay once live to keep it glanceable.</li>
              </ul>
              <div className="hairline" />
              <div className="flex items-center gap-2 text-xs text-sand-300/60"><ShieldCheck size={14} className="text-emerald-450" /> Audio is transcribed in flight and never stored. Live minutes used on this device: {Math.round(credit / 60)}.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ LIVE
  const latest = engine.latest?.output;
  return (
    <div className={`py-5 ${compact ? "max-w-xl mx-auto" : ""}`}>
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex h-3 w-3 rounded-full bg-uae-red ring-live" />
          <Pill tone="live">Live · private</Pill>
          <Pill tone={dgStatus === "open" ? "ok" : "warn"}>{dgStatus === "open" ? "Transcribing" : dgStatus === "closed" ? "Stream closed" : "Connecting"}</Pill>
          {!compact && <span className="text-xs text-sand-300/60 hidden lg:inline">{playbook.name}</span>}
        </div>
        <div className="flex items-center gap-5">
          <div className="hidden sm:flex flex-col gap-1">
            <LevelMeter label="You" level={levels[0]} />
            <LevelMeter label="Buyer" level={levels[1]} color="bg-emerald-450" />
          </div>
          <Countdown elapsed={engine.elapsed} capSec={capSec} />
          <button onClick={() => setCompact((c) => !c)} className="btn-ghost !px-3" title={compact ? "Expand" : "Compact overlay"}>{compact ? <Maximize2 size={15} /> : <Minimize2 size={15} />}</button>
          <button onClick={() => endCall()} className="btn-danger" disabled={phase === "ending"}><PhoneOff size={15} /> {phase === "ending" ? "Scoring…" : "End call"}</button>
        </div>
      </div>

      {error && <div className="mb-4"><Banner title={error.title} onClose={() => setError(null)}>{error.detail}</Banner></div>}
      {engine.coachError && <div className="mb-4"><Banner kind="info" title="Coach hiccup, retrying on the next turn">{engine.coachError}</Banner></div>}

      {compact ? (
        <div className="space-y-3">
          <EmotionBadge emotion={latest?.emotion} reason={latest?.emotionReason} large />
          <NextAction out={latest} thinking={engine.thinking} />
          <div className="text-[12px] text-sand-300/60 px-1 truncate">{interim.buyer ? `Buyer: ${interim.buyer}` : interim.rep ? `You: ${interim.rep}` : engine.turns[engine.turns.length - 1]?.text ?? ""}</div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="label">Buyer reads as</div>
            </div>
            <EmotionBadge emotion={latest?.emotion} reason={latest?.emotionReason} large />
            <NextAction out={latest} thinking={engine.thinking} />
            <StageTracker stage={engine.stage} stages={playbook.stages} />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <Transcript turns={engine.turns} interim={interim} height="h-[420px]" />
            <PromptHistory prompts={engine.prompts} />
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ n, done, title, desc, icon, action }: { n: number; done: boolean; title: string; desc: string; icon: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className={`glass p-5 flex items-start gap-4 transition ${done ? "border-uae-green/40" : ""}`}>
      <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${done ? "bg-uae-green/20 text-emerald-450" : "bg-gold-500/15 text-gold-300"}`}>{icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2"><span className="label">Step {n}</span>{done && <span className="text-[11px] text-emerald-450 font-semibold">Done</span>}</div>
        <div className="text-sand-50 font-semibold mt-0.5">{title}</div>
        <div className="text-sm text-sand-200/70 mt-1">{desc}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
