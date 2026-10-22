import Anthropic from "@anthropic-ai/sdk";
import { EMOTIONS, type CoachOutput, type Persona, type Scorecard, type StageState, type Turn } from "./types";

export const MODELS = {
  live: process.env.LIVE_MODEL || "claude-haiku-5-5",
  score: process.env.SCORE_MODEL || "claude-sonnet-5-5",
};

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new ConfigError("ANTHROPIC_API_KEY is not set on the server.");
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}
export class ConfigError extends Error {}

const fmt = (t: number) => `${Math.floor(t / 60).toString().padStart(2, "0")}:${Math.floor(t % 60).toString().padStart(2, "0")}`;

export function transcriptText(turns: Turn[]): string {
  return turns.map((t) => `[${fmt(t.start)}] ${t.speaker === "rep" ? "REP" : "BUYER"}: ${t.text}`).join("\n");
}

function playbookSystem(playbookText: string, role: string) {
  return [
    { type: "text" as const, text: role },
    {
      type: "text" as const,
      text: `=== ORGANISATION PLAYBOOK (ground every answer in this; quote approved wording when it fits) ===\n${playbookText}`,
      cache_control: { type: "ephemeral" as const },
    },
  ];
}

async function forcedTool<T>(params: {
  model: string;
  system: Anthropic.Messages.TextBlockParam[];
  messages: Anthropic.Messages.MessageParam[];
  tool: Anthropic.Messages.Tool;
  maxTokens: number;
}): Promise<T> {
  const res = await anthropic().messages.create({
    model: params.model,
    max_tokens: params.maxTokens,
    system: params.system,
    messages: params.messages,
    tools: [params.tool],
    tool_choice: { type: "tool", name: params.tool.name },
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Model returned no structured output.");
  return block.input as T;
}

// ---------- Live coach ----------
const coachTool: Anthropic.Messages.Tool = {
  name: "coach",
  description: "Return one private coaching read for the rep.",
  input_schema: {
    type: "object",
    properties: {
      emotion: { type: "string", enum: [...EMOTIONS] },
      emotionReason: { type: "string", description: "<= 12 words: the words/tone cue behind the label" },
      nextAction: { type: "string", description: "<= 2 short sentences. Concrete. What to do or ask right now." },
      sayThis: { type: "string", description: "Optional: exact approved wording from the playbook to say next, 1 sentence. Omit if none fits." },
      flag: { type: "string", enum: ["objection", "buying_signal", "question", "risk", "none"] },
      stage: {
        type: "object",
        properties: {
          current: { type: "string" },
          completed: { type: "array", items: { type: "string" } },
          checklist: { type: "array", items: { type: "object", properties: { item: { type: "string" }, done: { type: "boolean" } }, required: ["item", "done"] } },
        },
        required: ["current", "completed", "checklist"],
      },
      confidence: { type: "number" },
    },
    required: ["emotion", "emotionReason", "nextAction", "flag", "stage", "confidence"],
  },
};

export async function coach(input: {
  playbookText: string;
  turns: Turn[];
  stage: StageState;
  signals: { talkRatioRep: number; lastPauseSec: number; buyerWordsPerSec: number; elapsedSec: number };
  triggeredBy: string;
}): Promise<CoachOutput> {
  const role = `You are Majlis, a private real-time sales coach whispering to a sales rep during a live call. The buyer cannot see you.
Read the last few turns and the delivery signals, name the buyer's emotional state in ONE word from the allowed list, and give the rep ONE next best action: a question to ask, an objection response, or a factual answer.
Rules:
- Be short. The rep reads this without breaking eye contact: nextAction <= 2 sentences.
- Ground advice in the playbook. If an approved objection response fits, put it in sayThis verbatim or lightly adapted.
- Respect the stage order: do not suggest recommending/pitching until the discovery items are answered. Update the stage checklist from what the buyer has actually said.
- Never invent product facts, prices or guarantees not in the playbook.
- If the buyer just disclosed budget, decision maker, timeline or a past failure, the action is to dig into that, not to pitch.
- Flag objections and buying signals explicitly.`;
  const recent = input.turns.slice(-14);
  const user = `ELAPSED: ${fmt(input.signals.elapsedSec)} | REP TALK RATIO: ${Math.round(input.signals.talkRatioRep * 100)}% | BUYER PACE: ${input.signals.buyerWordsPerSec.toFixed(1)} w/s | PAUSE BEFORE LAST TURN: ${input.signals.lastPauseSec.toFixed(1)}s
TRIGGER: ${input.triggeredBy}
CURRENT STAGE STATE: ${JSON.stringify(input.stage)}

RECENT TRANSCRIPT:
${transcriptText(recent) || "(call just started; no speech yet)"}

Return the coaching read now.`;
  return forcedTool<CoachOutput>({
    model: MODELS.live,
    system: playbookSystem(input.playbookText, role),
    messages: [{ role: "user", content: user }],
    tool: coachTool,
    maxTokens: 600,
  });
}

// ---------- Roleplay buyer ----------
const buyerTool: Anthropic.Messages.Tool = {
  name: "buyer_reply",
  description: "The buyer's next spoken line.",
  input_schema: {
    type: "object",
    properties: {
      reply: { type: "string", description: "What the buyer says next, spoken naturally, 1-3 sentences. No stage directions." },
      emotion: { type: "string", enum: [...EMOTIONS] },
      internal: { type: "string", description: "<= 15 words: what the buyer is really thinking (never spoken)" },
      wantsToEnd: { type: "boolean", description: "true only if the buyer is wrapping up the call" },
    },
    required: ["reply", "emotion", "internal", "wantsToEnd"],
  },
};

export async function buyerReply(input: { playbookText: string; persona: Persona; turns: Turn[]; opening: boolean }) {
  const p = input.persona;
  const role = `You are role-playing ${p.name}, ${p.title} at ${p.company}, a prospective buyer on a sales call. Difficulty: ${p.difficulty}.
Character: ${p.summary}
Your goals: ${p.goals.join("; ")}
Objections you will raise when natural (one at a time, not all at once): ${p.objections.join(" | ")}
Behave like a real buyer: answer questions when asked well, withhold details when the rep pitches instead of asking, get warmer when listened to, cooler when talked over. Keep lines short and speakable. Stay in character; never mention being an AI. You are speaking in English on a call in Dubai.`;
  const user = input.opening
    ? "The call has just connected. The rep has not spoken yet. Say your opening line (a greeting, maybe why you took the call)."
    : `CONVERSATION SO FAR:\n${transcriptText(input.turns.slice(-20))}\n\nGive your next spoken line.`;
  return forcedTool<{ reply: string; emotion: CoachOutput["emotion"]; internal: string; wantsToEnd: boolean }>({
    model: MODELS.live,
    system: playbookSystem(input.playbookText, role),
    messages: [{ role: "user", content: user }],
    tool: buyerTool,
    maxTokens: 300,
  });
}

// ---------- Post-call scorecard ----------
const scoreTool: Anthropic.Messages.Tool = {
  name: "scorecard",
  description: "Post-call analysis.",
  input_schema: {
    type: "object",
    properties: {
      healthScore: { type: "number", description: "0-100 likelihood this conversation advances the deal" },
      summary: { type: "string", description: "2-3 sentences, the honest headline" },
      sentimentArc: { type: "array", items: { type: "object", properties: { at: { type: "number" }, label: { type: "string", enum: [...EMOTIONS] }, score: { type: "number", description: "-1..1" } }, required: ["at", "label", "score"] }, description: "5-8 points across the call, at = seconds" },
      dealRisks: { type: "array", items: { type: "string" } },
      positives: { type: "array", items: { type: "string" } },
      missedMoments: { type: "array", items: { type: "object", properties: { at: { type: "number" }, what: { type: "string" }, recommendedInstead: { type: "string", description: "the exact line the rep should have said" } }, required: ["at", "what", "recommendedInstead"] } },
      rubricScores: { type: "array", items: { type: "object", properties: { criterion: { type: "string" }, score: { type: "number", description: "0-100" }, evidence: { type: "string", description: "timestamped evidence" } }, required: ["criterion", "score", "evidence"] } },
      stageScores: { type: "array", items: { type: "object", properties: { stage: { type: "string" }, completed: { type: "boolean" }, note: { type: "string" } }, required: ["stage", "completed", "note"] } },
      talkRatio: { type: "object", properties: { rep: { type: "number" }, buyer: { type: "number" } }, required: ["rep", "buyer"] },
      notes: { type: "object", properties: { overview: { type: "string" }, highlights: { type: "array", items: { type: "string" } }, actionItems: { type: "array", items: { type: "object", properties: { owner: { type: "string" }, item: { type: "string" } }, required: ["owner", "item"] } } }, required: ["overview", "highlights", "actionItems"] },
      nextDrill: { type: "object", properties: { title: { type: "string" }, scenario: { type: "string" }, persona: { type: "string" } }, required: ["title", "scenario", "persona"] },
    },
    required: ["healthScore", "summary", "sentimentArc", "dealRisks", "positives", "missedMoments", "rubricScores", "stageScores", "talkRatio", "notes", "nextDrill"],
  },
};

export async function score(input: { playbookText: string; turns: Turn[]; promptsShown: { at: number; nextAction: string }[]; talkRatio: { rep: number; buyer: number }; durationSec: number; mode: "live" | "roleplay" }): Promise<Scorecard> {
  const role = `You are Majlis, scoring a ${input.mode === "roleplay" ? "practice roleplay" : "live sales call"} for a sales manager who did not listen to it.
Score every rubric criterion in the playbook from 0-100 with timestamped evidence. Be specific and fair; praise what worked, name the single most costly missed moment and give the exact line that would have worked instead. Use the playbook's approved wording where relevant. Meeting notes must be copy-ready for a CRM. Keep every string concise. Use only facts from the transcript.`;
  const user = `DURATION: ${fmt(input.durationSec)} | TALK RATIO rep ${Math.round(input.talkRatio.rep * 100)}% / buyer ${Math.round(input.talkRatio.buyer * 100)}%

TRANSCRIPT:
${transcriptText(input.turns) || "(empty)"}

LIVE PROMPTS SHOWN TO REP DURING THE CALL:
${input.promptsShown.map((p) => `[${fmt(p.at)}] ${p.nextAction}`).join("\n") || "(none)"}

Produce the scorecard.`;
  return forcedTool<Scorecard>({
    model: MODELS.score,
    system: playbookSystem(input.playbookText, role),
    messages: [{ role: "user", content: user }],
    tool: scoreTool,
    maxTokens: 3500,
  });
}
