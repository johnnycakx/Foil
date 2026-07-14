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
 * One-way, non-reversible visitor id from the client IP. Keyed with a
 * server-side salt so a leaked table can't be dictionary-attacked back to IPs
 * (the lib/unsubscribe-token.ts / vault-token.ts crypto posture, hash form).
 * Returns null when the IP is unknown — an unattributable event, not a fake id.
 *
 * FUNNEL_VISITOR_SALT is optional: without it we fall back to a fixed build
 * constant so the hash is still stable and non-reversible-in-practice; set the
 * env var to rotate the visitor epoch or harden against IP dictionary attacks.
 */
const SALT = process.env.FUNNEL_VISITOR_SALT ?? "foil-funnel.v1";

export function hashVisitorId(ip: string | null | undefined): string | null {
  if (!ip || ip === "unknown") return null;
  return createHash("sha256").update(`${SALT}|${ip}`).digest("hex").slice(0, 32);
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
