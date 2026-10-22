export type Speaker = "rep" | "buyer";

export interface Turn {
  id: string;
  speaker: Speaker;
  text: string;
  start: number; // seconds from session start
  end: number;
  /** prosody features computed on the client */
  features?: {
    wordsPerSec?: number;
    pauseBeforeSec?: number;
    energy?: number; // 0..1 RMS
  };
}

export const EMOTIONS = [
  "Confident", "Hesitant", "Skeptical", "Urgent", "Warm", "Frustrated", "Reassured", "Resistant",
  "Interested", "Confused", "Engaged", "Concerned", "Trusting", "Anxious", "Excited", "Disappointed",
  "Relieved", "Curious", "Impatient", "Open", "Neutral",
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export interface StageState {
  current: string;
  completed: string[]; // stage names completed
  checklist: { item: string; done: boolean }[]; // items in current stage
}

export interface CoachOutput {
  emotion: Emotion;
  emotionReason: string;
  nextAction: string; // <= 2 sentences, what to do now
  sayThis?: string; // optional exact wording from playbook
  flag?: "objection" | "buying_signal" | "question" | "risk" | "none";
  stage: StageState;
  confidence: number; // 0..1
}

export interface Prompted {
  id: string;
  at: number; // seconds
  output: CoachOutput;
  triggeredBy: string;
}

export interface Playbook {
  id: string;
  name: string;
  company: string;
  product: string;
  stages: { name: string; items: string[] }[];
  objections: { objection: string; response: string }[];
  talkTracks: string[];
  rubric: { criterion: string; description: string; weight: number }[];
  notes: string; // free text (product knowledge, pricing, etc.)
}

export interface Persona {
  id: string;
  name: string;
  title: string;
  company: string;
  difficulty: "easy" | "medium" | "brutal";
  summary: string;
  goals: string[];
  objections: string[];
  voice?: { lang: string; pitch: number; rate: number };
}

export interface Scorecard {
  healthScore: number; // 0..100
  summary: string;
  sentimentArc: { at: number; label: Emotion; score: number }[]; // score -1..1
  dealRisks: string[];
  positives: string[];
  missedMoments: { at: number; what: string; recommendedInstead: string }[];
  rubricScores: { criterion: string; score: number; evidence: string }[];
  stageScores: { stage: string; completed: boolean; note: string }[];
  talkRatio: { rep: number; buyer: number };
  notes: { overview: string; highlights: string[]; actionItems: { owner: string; item: string }[] };
  nextDrill: { title: string; scenario: string; persona: string };
}

export interface CallRecord {
  id: string;
  mode: "live" | "roleplay";
  startedAt: string; // ISO
  durationSec: number;
  playbookId: string;
  playbookName: string;
  personaName?: string;
  turns: Turn[];
  prompts: Prompted[];
  scorecard?: Scorecard;
  scoringError?: string;
}
