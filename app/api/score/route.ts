import { NextResponse } from "next/server";
import { score } from "@/lib/anthropic";
import { bad, fail } from "@/lib/api-util";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return bad("Invalid JSON body."); }
  const { playbookText, turns, promptsShown, talkRatio, durationSec, mode } = body ?? {};
  if (typeof playbookText !== "string") return bad("playbookText is required.");
  if (!Array.isArray(turns) || turns.length < 2) return bad("Not enough conversation to score (need at least two turns).");
  try {
    const out = await score({
      playbookText: playbookText.slice(0, 60_000),
      turns,
      promptsShown: Array.isArray(promptsShown) ? promptsShown : [],
      talkRatio: talkRatio ?? { rep: 0.5, buyer: 0.5 },
      durationSec: Number(durationSec) || 0,
      mode: mode === "roleplay" ? "roleplay" : "live",
    });
    return NextResponse.json(out);
  } catch (e) { return fail(e); }
}
