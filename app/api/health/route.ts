import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json({
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    deepgram: Boolean(process.env.DEEPGRAM_API_KEY),
    deepgramProject: Boolean(process.env.DEEPGRAM_PROJECT_ID),
    capMinutes: Number(process.env.LIVE_SESSION_CAP_MINUTES || 15),
    models: { live: process.env.LIVE_MODEL || "claude-haiku-5-5", score: process.env.SCORE_MODEL || "claude-sonnet-5-5" },
  });
}
