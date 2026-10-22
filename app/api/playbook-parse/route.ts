import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODELS } from "@/lib/anthropic";
import { bad, fail } from "@/lib/api-util";

export const runtime = "nodejs";
export const maxDuration = 60;

const tool: Anthropic.Messages.Tool = {
  name: "playbook",
  description: "Structured sales playbook extracted from raw text.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" }, company: { type: "string" }, product: { type: "string" }, notes: { type: "string" },
      stages: { type: "array", items: { type: "object", properties: { name: { type: "string" }, items: { type: "array", items: { type: "string" } } }, required: ["name", "items"] } },
      objections: { type: "array", items: { type: "object", properties: { objection: { type: "string" }, response: { type: "string" } }, required: ["objection", "response"] } },
      talkTracks: { type: "array", items: { type: "string" } },
      rubric: { type: "array", items: { type: "object", properties: { criterion: { type: "string" }, description: { type: "string" }, weight: { type: "number" } }, required: ["criterion", "description", "weight"] } },
    },
    required: ["name", "company", "product", "notes", "stages", "objections", "talkTracks", "rubric"],
  },
};

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return bad("Invalid JSON body."); }
  const text = String(body?.text ?? "").trim();
  if (text.length < 80) return bad("Paste at least a few paragraphs of playbook material (80+ characters).");
  if (text.length > 120_000) return bad("That's too long for the POC (max ~120k characters). Trim it and try again.");
  try {
    const res = await anthropic().messages.create({
      model: MODELS.score,
      max_tokens: 4000,
      system: "You turn raw sales enablement material (playbooks, scripts, objection docs, product sheets, pricing) into a structured playbook. Keep the organisation's own wording for objection responses and talk tracks. If the material has no explicit sales process, infer a sensible 4-6 stage process with 2-6 checklist items each. If no rubric is given, propose 5 criteria whose weights sum to 100. Keep strings concise. Never invent prices or facts that are not in the text; put uncertain items in notes.",
      messages: [{ role: "user", content: `RAW MATERIAL:\n\n${text}` }],
      tools: [tool],
      tool_choice: { type: "tool", name: "playbook" },
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("No structured output.");
    return NextResponse.json(block.input);
  } catch (e) { return fail(e); }
}
