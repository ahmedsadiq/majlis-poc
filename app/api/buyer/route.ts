import { NextResponse } from "next/server";
import { buyerReply } from "@/lib/anthropic";
import { bad, fail } from "@/lib/api-util";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return bad("Invalid JSON body."); }
  const { playbookText, persona, turns, opening } = body ?? {};
  if (typeof playbookText !== "string") return bad("playbookText is required.");
  if (!persona || typeof persona.name !== "string") return bad("A buyer persona is required.");
  if (!Array.isArray(turns)) return bad("turns must be an array.");
  try {
    const out = await buyerReply({ playbookText: playbookText.slice(0, 60_000), persona, turns, opening: Boolean(opening) });
    return NextResponse.json(out);
  } catch (e) { return fail(e); }
}
