// eBay Marketplace Account Deletion compliance endpoint. See ADR-022.
//
// PUBLIC route (gate-skipped by lib/supabase/proxy.ts via the existing
// `/api/webhooks` prefix). The ECDSA signature header IS the auth on POST.
// GET is unauthenticated by design — eBay calls it before the keyset is
// flipped to "compliant," so we have to answer the challenge without a
// shared secret beyond the verification token baked into the hash.
//
// SLA: eBay rejects responses slower than ~3s. The GET path performs zero
// I/O. The POST path performs at most one OAuth token fetch (module-cached
// for ~2h) and one public-key fetch (in-memory cached by kid for ~1h) per
// instance lifetime; steady-state POSTs are sub-ms.
//
// All decision logic lives in lib/ebay-marketplace-deletion.ts so the full
// GET/POST contract can be unit-tested without next/server. This file is
// the thin Next.js adapter.

import { NextResponse } from "next/server";
import {
  handleChallenge,
  handleNotification,
  type HandlerResult,
} from "@/lib/ebay-marketplace-deletion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT_PATH = "/api/webhooks/ebay-marketplace-deletion";

function endpointUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${ENDPOINT_PATH}`;
}

function toResponse(result: HandlerResult): NextResponse {
  if (typeof result.body === "string") {
    return new NextResponse(result.body, { status: result.status });
  }
  return NextResponse.json(result.body, { status: result.status });
}

export function GET(request: Request): NextResponse {
  const result = handleChallenge({
    challengeCode: new URL(request.url).searchParams.get("challenge_code"),
    verificationToken: process.env.EBAY_DELETION_VERIFICATION_TOKEN,
    endpointUrl: endpointUrl(),
  });
  return toResponse(result);
}

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const result = await handleNotification({
    rawBody,
    signatureHeader: request.headers.get("x-ebay-signature"),
  });
  return toResponse(result);
}
