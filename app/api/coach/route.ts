import { NextResponse } from "next/server";
import { coach } from "@/lib/anthropic";
import { bad, fail } from "@/lib/api-util";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return bad("Invalid JSON body."); }
  const { playbookText, turns, stage, signals, triggeredBy } = body ?? {};
  if (typeof playbookText !== "string" || playbookText.length < 20) return bad("A playbook is required before coaching.");
  if (!Array.isArray(turns)) return bad("turns must be an array.");
  if (!stage || typeof stage.current !== "string") return bad("stage state is required.");
  try {
    const out = await coach({
      playbookText: playbookText.slice(0, 60_000),
      turns,
      stage,
      signals: { talkRatioRep: 0.5, lastPauseSec: 0, buyerWordsPerSec: 2, elapsedSec: 0, ...(signals ?? {}) },
      triggeredBy: String(triggeredBy ?? "turn"),
    });
    return NextResponse.json(out);
  } catch (e) { return fail(e); }
}
