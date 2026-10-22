import { NextResponse } from "next/server";
import { ConfigError } from "./anthropic";

export function fail(e: unknown, fallback = "Request failed") {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[majlis]", msg);
  if (e instanceof ConfigError) return NextResponse.json({ error: msg, code: "config" }, { status: 500 });
  const status = /rate limit|429/i.test(msg) ? 429 : /401|authentication|api key/i.test(msg) ? 401 : 500;
  return NextResponse.json({ error: msg || fallback, code: "upstream" }, { status });
}

export function bad(msg: string) {
  return NextResponse.json({ error: msg, code: "validation" }, { status: 400 });
}
