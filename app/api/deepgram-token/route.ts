import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Hands the browser a credential for Deepgram's streaming WebSocket.
 * Preferred: a short-lived access token from /v1/auth/grant (expires in ~30s, enough to open the socket).
 * Fallback: a temporary project key with a 20-minute TTL (needs DEEPGRAM_PROJECT_ID).
 * Last resort: the raw key (POC only; the key is restricted by the session cap in the UI).
 */
export async function POST() {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return NextResponse.json({ error: "DEEPGRAM_API_KEY is not set on the server.", code: "config" }, { status: 500 });

  // 1) Short-lived JWT via auth grant
  try {
    const r = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_seconds: 60 }),
    });
    if (r.ok) {
      const j = (await r.json()) as { access_token?: string; expires_in?: number };
      if (j.access_token) return NextResponse.json({ kind: "bearer", token: j.access_token, expiresIn: j.expires_in ?? 60 });
    }
  } catch (e) { console.warn("[majlis] auth/grant unavailable:", e); }

  // 2) Temporary project key
  const project = process.env.DEEPGRAM_PROJECT_ID;
  if (project) {
    try {
      const r = await fetch(`https://api.deepgram.com/v1/projects/${project}/keys`, {
        method: "POST",
        headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "majlis-poc temp key", scopes: ["usage:write"], time_to_live_in_seconds: 1200 }),
      });
      if (r.ok) {
        const j = (await r.json()) as { key?: string };
        if (j.key) return NextResponse.json({ kind: "token", token: j.key, expiresIn: 1200 });
      } else {
        console.warn("[majlis] temp key failed:", r.status, await r.text());
      }
    } catch (e) { console.warn("[majlis] temp key error:", e); }
  }

  // 3) Raw key (POC fallback)
  return NextResponse.json({ kind: "token", token: key, expiresIn: 0, warning: "raw-key" });
}
