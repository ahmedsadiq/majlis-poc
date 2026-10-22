"use client";
import { SAMPLE_PLAYBOOKS, SAMPLE_PERSONAS } from "./playbooks";
import type { CallRecord, Persona, Playbook } from "./types";

const K = { playbooks: "majlis.playbooks", activePlaybook: "majlis.activePlaybook", personas: "majlis.personas", calls: "majlis.calls", usage: "majlis.usage" };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("majlis:store"));
}

export function getPlaybooks(): Playbook[] {
  const saved = read<Playbook[] | null>(K.playbooks, null);
  if (!saved || saved.length === 0) {
    write(K.playbooks, SAMPLE_PLAYBOOKS);
    return SAMPLE_PLAYBOOKS;
  }
  return saved;
}
export function savePlaybook(pb: Playbook) {
  const all = getPlaybooks();
  const i = all.findIndex((p) => p.id === pb.id);
  if (i >= 0) all[i] = pb; else all.push(pb);
  write(K.playbooks, all);
}
export function deletePlaybook(id: string) {
  const all = getPlaybooks().filter((p) => p.id !== id);
  write(K.playbooks, all.length ? all : SAMPLE_PLAYBOOKS);
  if (getActivePlaybookId() === id) setActivePlaybookId(getPlaybooks()[0].id);
}
export function getActivePlaybookId(): string {
  return read<string>(K.activePlaybook, SAMPLE_PLAYBOOKS[0].id);
}
export function setActivePlaybookId(id: string) { write(K.activePlaybook, id); }
export function getActivePlaybook(): Playbook {
  const all = getPlaybooks();
  return all.find((p) => p.id === getActivePlaybookId()) ?? all[0];
}

export function getPersonas(): Persona[] {
  const saved = read<Persona[] | null>(K.personas, null);
  if (!saved || saved.length === 0) { write(K.personas, SAMPLE_PERSONAS); return SAMPLE_PERSONAS; }
  return saved;
}
export function savePersona(p: Persona) {
  const all = getPersonas();
  const i = all.findIndex((x) => x.id === p.id);
  if (i >= 0) all[i] = p; else all.push(p);
  write(K.personas, all);
}

export function getCalls(): CallRecord[] { return read<CallRecord[]>(K.calls, []); }
export function getCall(id: string): CallRecord | undefined { return getCalls().find((c) => c.id === id); }
export function saveCall(c: CallRecord) {
  const all = getCalls().filter((x) => x.id !== c.id);
  all.unshift(c);
  write(K.calls, all.slice(0, 50));
}
export function deleteCall(id: string) { write(K.calls, getCalls().filter((c) => c.id !== id)); }

export interface Usage { liveSeconds: number; coachCalls: number; buyerCalls: number; scoreCalls: number }
export function getUsage(): Usage { return read<Usage>(K.usage, { liveSeconds: 0, coachCalls: 0, buyerCalls: 0, scoreCalls: 0 }); }
export function addUsage(delta: Partial<Usage>) {
  const u = getUsage();
  write(K.usage, {
    liveSeconds: u.liveSeconds + (delta.liveSeconds ?? 0),
    coachCalls: u.coachCalls + (delta.coachCalls ?? 0),
    buyerCalls: u.buyerCalls + (delta.buyerCalls ?? 0),
    scoreCalls: u.scoreCalls + (delta.scoreCalls ?? 0),
  });
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function playbookToText(pb: Playbook): string {
  return [
    `COMPANY: ${pb.company}`,
    `PRODUCT: ${pb.product}`,
    `NOTES: ${pb.notes}`,
    "",
    "SALES PROCESS (stages and required items):",
    ...pb.stages.map((s) => `- ${s.name}: ${s.items.join("; ")}`),
    "",
    "APPROVED OBJECTION RESPONSES:",
    ...pb.objections.map((o) => `- Objection: "${o.objection}"\n  Approved response: "${o.response}"`),
    "",
    "TALK TRACKS / FACTS:",
    ...pb.talkTracks.map((t) => `- ${t}`),
    "",
    "SCORING RUBRIC:",
    ...pb.rubric.map((r) => `- ${r.criterion} (${r.weight}%): ${r.description}`),
  ].join("\n");
}
