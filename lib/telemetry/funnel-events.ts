// Funnel-event telemetry (audit 2026-07-14). See migration 20260714130000.
//
// Single module owns the funnel_events table. It is the owned-data trail that
// makes the coming ad test a DIAGNOSIS, not a coin flip: card_view → watch_set →
// pro_view → checkout_start → trial_start, attributable to the utm_* the /pro
// CTA already carries, joinable against subscriptions in funnel-report.ts.
//
// Two hard rules, both cloned from lib/telemetry/browse-calls.ts:
//   1. NEVER throws, NEVER blocks. The instrumentation site fires-and-forgets
//      (`void logFunnelEvent(...)`) — an analytics write may not sit in front of
//      a render or a checkout. Every path resolves to {ok,error}.
//   2. NO raw PII. visitor_id is a one-way hash of the client IP + a salt; there
//      is no way to pass an email or a raw IP through this API.

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase/admin.ts";
import type { Database } from "../supabase/types.ts";

export type FunnelStage =
  | "card_view"
  | "watch_set"
  | "pro_view"
  | "checkout_start"
  | "trial_start";

export type LogFunnelEventInput = {
  stage: FunnelStage;
  /** Already-hashed visitor id (see hashVisitorId). Null when unavailable. */
  visitorId?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  /** Small non-PII context: a card slug, a hook variant. Never an email. */
  meta?: Record<string, string | number | boolean | null> | null;
};

/**
 * A PSEUDONYMOUS visitor id from the client IP — a coarse "same visitor across
 * funnel stages" key, NOT anonymization. Be honest about the crypto (the whole
 * point of this branch): IPv4 is only ~4.3B values and SHA-256 is cheap, so a
 * reader who holds BOTH this table AND the salt can brute-force the id back to
 * an IP. The salt is the one thing standing between a leaked table and that
 * reversal, so it must be a real SECRET, and — following lib/vault-token.ts's
 * fail-closed posture, NOT a source-visible constant — we return null without
 * it rather than write a trivially-reversible id under a fake "anonymous" label.
 *
 * Consequence: until FUNNEL_VISITOR_SALT is provisioned (see docs/ENV-VARS.md),
 * visitor_id is null and the funnel still records stages + utm (the load-bearing
 * attribution) — it just can't link a visitor across stages yet. Honest and
 * safe beats linked-but-deanonymizable.
 */
export function hashVisitorId(ip: string | null | undefined): string | null {
  // Read at call time (not module load): fail-closed without the secret, and
  // provisionable without a redeploy.
  const salt = process.env.FUNNEL_VISITOR_SALT ?? null;
  if (!salt || !ip || ip === "unknown") return null;
  return createHash("sha256").update(`${salt}|${ip}`).digest("hex").slice(0, 32);
}

/**
 * Fire-and-forget insert. Resolves to {ok,error} (tests await it) but the
 * instrumentation site MUST NOT await it on the hot path. Soft-fail: every
 * error resolves, never throws.
 */
export async function logFunnelEvent(
  input: LogFunnelEventInput,
  opts: { client?: SupabaseClient<Database> } = {},
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = opts.client ?? supabaseAdmin();
    const { error } = await admin.from("funnel_events").insert({
      stage: input.stage,
      visitor_id: input.visitorId ?? null,
      utm_source: input.utmSource ?? null,
      utm_campaign: input.utmCampaign ?? null,
      meta: input.meta ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
