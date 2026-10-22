"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { addUsage, playbookToText, saveCall, uid } from "./store";
import type { CallRecord, CoachOutput, Playbook, Prompted, Scorecard, Speaker, StageState, Turn } from "./types";

export const EMPTY_PLAYBOOK: Playbook = { id: "none", name: "", company: "", product: "", stages: [], objections: [], talkTracks: [], rubric: [], notes: "" };

export interface Signals { talkRatioRep: number; lastPauseSec: number; buyerWordsPerSec: number; elapsedSec: number }

export function initialStage(pb: Playbook): StageState {
  const first = pb.stages[0];
  return { current: first?.name ?? "Discovery", completed: [], checklist: (first?.items ?? []).map((item) => ({ item, done: false })) };
}

export function useCoachEngine(playbook: Playbook, mode: "live" | "roleplay") {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [prompts, setPrompts] = useState<Prompted[]>([]);
  const [stage, setStage] = useState<StageState>(() => initialStage(playbook));
  const [thinking, setThinking] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const turnsRef = useRef<Turn[]>([]);
  const stageRef = useRef<StageState>(stage);
  const promptsRef = useRef<Prompted[]>([]);
  const inFlight = useRef(false);
  const pendingTrigger = useRef<string | null>(null);
  const lastPromptAt = useRef(0);
  const startedAt = useRef<number>(0);
  const startedIso = useRef<string>(new Date().toISOString());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbookText = useRef(playbookToText(playbook));

  useEffect(() => { playbookText.current = playbookToText(playbook); setStage(initialStage(playbook)); }, [playbook]);
  useEffect(() => { stageRef.current = stage; }, [stage]);

  const start = useCallback(() => {
    startedAt.current = performance.now();
    startedIso.current = new Date().toISOString();
    turnsRef.current = []; promptsRef.current = []; setTurns([]); setPrompts([]); setElapsed(0); lastPromptAt.current = 0;
    setStage(initialStage(playbook));
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setElapsed((performance.now() - startedAt.current) / 1000), 500);
  }, [playbook]);

  const stopClock = useCallback(() => { if (timer.current) clearInterval(timer.current); timer.current = null; }, []);
  useEffect(() => () => stopClock(), [stopClock]);

  const now = () => (performance.now() - startedAt.current) / 1000;

  const signals = useCallback((): Signals => {
    const t = turnsRef.current;
    const rep = t.filter((x) => x.speaker === "rep").reduce((s, x) => s + (x.end - x.start), 0);
    const buyer = t.filter((x) => x.speaker === "buyer").reduce((s, x) => s + (x.end - x.start), 0);
    const last = t[t.length - 1];
    const prev = t[t.length - 2];
    const buyerTurns = t.filter((x) => x.speaker === "buyer").slice(-3);
    const bw = buyerTurns.reduce((s, x) => s + (x.features?.wordsPerSec ?? 0), 0) / Math.max(1, buyerTurns.length);
    return {
      talkRatioRep: rep + buyer > 0 ? rep / (rep + buyer) : 0.5,
      lastPauseSec: last && prev ? Math.max(0, last.start - prev.end) : 0,
      buyerWordsPerSec: bw || 2,
      elapsedSec: now(),
    };
  }, []);

  const requestCoach = useCallback(async (triggeredBy: string) => {
    if (inFlight.current) { pendingTrigger.current = triggeredBy; return; }
    inFlight.current = true;
    setThinking(true);
    setCoachError(null);
    try {
      const r = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbookText: playbookText.current, turns: turnsRef.current.slice(-14), stage: stageRef.current, signals: signals(), triggeredBy }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Coach request failed (${r.status})`);
      const out = j as CoachOutput;
      const p: Prompted = { id: uid("p"), at: now(), output: out, triggeredBy };
      promptsRef.current = [...promptsRef.current, p];
      setPrompts(promptsRef.current);
      if (out.stage?.current) { stageRef.current = out.stage; setStage(out.stage); }
      lastPromptAt.current = now();
      addUsage({ coachCalls: 1 });
    } catch (e: any) {
      setCoachError(e?.message ?? "Coach unavailable");
    } finally {
      inFlight.current = false;
      setThinking(false);
      if (pendingTrigger.current) { const t = pendingTrigger.current; pendingTrigger.current = null; setTimeout(() => requestCoach(t), 250); }
    }
  }, [signals]);

  /** Adds a final utterance and decides whether to ask the coach. */
  const addTurn = useCallback((speaker: Speaker, text: string, start: number, end: number, words?: number, energy?: number) => {
    const t = turnsRef.current;
    const prev = t[t.length - 1];
    const dur = Math.max(0.3, end - start);
    const turn: Turn = {
      id: uid("t"), speaker, text, start, end,
      features: { wordsPerSec: (words ?? text.split(/\s+/).length) / dur, pauseBeforeSec: prev ? Math.max(0, start - prev.end) : 0, energy },
    };
    turnsRef.current = [...t, turn];
    setTurns(turnsRef.current);

    const sinceLast = now() - lastPromptAt.current;
    const looksLikeQuestion = /\?\s*$/.test(text) || /^(what|how|why|when|is|are|do|does|can|could|would)\b/i.test(text);
    if (speaker === "buyer") requestCoach(looksLikeQuestion ? "buyer asked a question" : "buyer finished speaking");
    else if (sinceLast > 25) requestCoach("rep has been talking for a while");
    return turn;
  }, [requestCoach]);

  const finish = useCallback(async (opts: { personaName?: string; onSaved?: (id: string) => void }): Promise<CallRecord> => {
    stopClock();
    const durationSec = now();
    const t = turnsRef.current;
    const rep = t.filter((x) => x.speaker === "rep").reduce((s, x) => s + (x.end - x.start), 0);
    const buyer = t.filter((x) => x.speaker === "buyer").reduce((s, x) => s + (x.end - x.start), 0);
    const talkRatio = { rep: rep + buyer > 0 ? rep / (rep + buyer) : 0.5, buyer: rep + buyer > 0 ? buyer / (rep + buyer) : 0.5 };
    const rec: CallRecord = {
      id: uid("call"), mode, startedAt: startedIso.current, durationSec, playbookId: playbook.id, playbookName: playbook.name,
      personaName: opts.personaName, turns: t, prompts: promptsRef.current,
    };
    saveCall(rec);
    if (mode === "live") addUsage({ liveSeconds: Math.round(durationSec) });
    opts.onSaved?.(rec.id);
    if (t.length < 2) { rec.scoringError = "Not enough conversation to score."; saveCall(rec); return rec; }
    try {
      const r = await fetch("/api/score", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbookText: playbookText.current, turns: t, promptsShown: promptsRef.current.map((p) => ({ at: p.at, nextAction: p.output.nextAction })), talkRatio, durationSec, mode }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Scoring failed (${r.status})`);
      rec.scorecard = j as Scorecard;
      addUsage({ scoreCalls: 1 });
    } catch (e: any) {
      rec.scoringError = e?.message ?? "Scoring failed";
    }
    saveCall(rec);
    return rec;
  }, [mode, playbook, stopClock]);

  return { turns, getTurns: () => turnsRef.current, prompts, latest: prompts[prompts.length - 1], stage, thinking, coachError, elapsed, start, stopClock, addTurn, requestCoach, finish, signals, now, playbookText };
}
