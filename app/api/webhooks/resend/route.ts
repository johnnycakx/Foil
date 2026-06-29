// Resend unsubscribe sync webhook (ADR-082).
//
// Closes the unsubscribe-coherence gap: a native one-click unsubscribe in a
// Resend broadcast (or a spam complaint) marked the contact unsubscribed in
// RESEND only — Supabase (our source of truth) still showed them subscribed, so
// the next broadcast re-included an opted-out address (a CAN-SPAM violation +
// a deliverability killer). This endpoint receives Resend's signed webhook,
// verifies it, and propagates the opt-out to Supabase + Beehiiv.
//
// PUBLIC route (gate-skipped by lib/supabase/proxy.ts via the existing
// `/api/webhooks` prefix — same contract as the Stripe / Vercel / eBay webhooks;
// pinned in lib/__tests__/proxy.test.ts). The Svix signature header IS the auth.
//
// All verification + extraction logic lives in lib/resend-webhook.ts so it can
// be unit-tested without next/server. This file is the thin Next.js adapter.

import { NextResponse } from "next/server";
import {
  verifySvixSignature,
  extractUnsubscribeEmails,
  type ResendWebhookEvent,
} from "@/lib/resend-webhook";
import { syncUnsubscribe } from "@/lib/newsletter/unsubscribe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not set — returning 503");
    return NextResponse.json({ ok: false, error: "missing_secret" }, { status: 503 });
  }

  // Raw body is required for the Svix HMAC — never JSON.parse before verifying.
  const rawBody = await request.text();
  const verified = verifySvixSignature({
    body: rawBody,
    headers: {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    secret,
  });
  if (!verified) {
    console.warn("[resend-webhook] signature verification failed");
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const emails = extractUnsubscribeEmails(event);
  if (emails.length === 0) {
    // Not an opt-out event (delivered/opened/clicked/etc.) — ack and move on.
    return NextResponse.json({ ok: true, skipped: event.type ?? "unknown" });
  }

  // Sync each opt-out. Idempotent + soft-fail (a replayed webhook flips 0 rows).
  const results = await Promise.all(emails.map((email) => syncUnsubscribe(email)));

  // Retry only when a genuine Supabase (source-of-truth) error occurred — Svix
  // retries with backoff, and the sync is idempotent so a retry is safe. A
  // Beehiiv-only failure is logged but not retried (Supabase already gates the
  // send; Beehiiv has its own list management).
  const supabaseError = results.some((r) => r.supabase === "error");
  if (supabaseError) {
    return NextResponse.json(
      { ok: false, error: "supabase_sync_failed", type: event.type, count: emails.length },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, type: event.type, synced: results.length });
}
