// Cards typeahead — proxies the Pokemon TCG SDK card search for the /start
// onboarding form (Task #20 / Session 38).
//
// Why a proxy: keeping the SDK call server-side means (a) the API base URL
// + headers are controlled, (b) we get Next's revalidate caching for free,
// (c) we can shape the response to exactly the {id, name, setName, ...}
// hits the form needs without leaking the SDK's full schema. Public route;
// rate-limit at the platform level (Fluid Compute) — no auth surface.
//
// Response shape: { hits: CardSearchHit[] } — same struct exported from
// lib/cards/sdk.ts so the client can import the type directly.

import { NextResponse } from "next/server";
import { searchCards } from "@/lib/cards/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_QUERY_LENGTH = 64;
const RESULT_LIMIT = 8;

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q || q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ hits: [] });
  }
  const hits = await searchCards({ query: q, limit: RESULT_LIMIT });
  return NextResponse.json({ hits });
}
