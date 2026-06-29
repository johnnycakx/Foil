// Unsubscribe coherence (ADR-082). When Resend fires an unsubscribe webhook
// (native one-click on a broadcast, or a spam complaint), this keeps the three
// subscriber stores coherent:
//
//   - Supabase `newsletter_subscribers` — the SOURCE OF TRUTH. The send path
//     (the Resend broadcast audience query / the digest cron) excludes anyone
//     with `unsubscribed_at IS NOT NULL`, so setting it here is what actually
//     stops the next send from re-including an opted-out address.
//   - Beehiiv — the parallel hosted list. Propagated via the existing
//     `unsubscribeEmail` (idempotent: `already_inactive`/`not_found` are ok).
//   - Resend — already coherent. The webhook fires BECAUSE Resend marked the
//     contact unsubscribed (contact.updated) or auto-suppressed a complaint, so
//     no Resend write-back is needed. (If a divergence is ever observed for the
//     complaint path, add a Resend PATCH leg through lib/notifications/resend.ts.)
//
// Idempotent + soft-fail: a replayed webhook is a no-op (the Supabase update is
// gated on `unsubscribed_at IS NULL`, so a second delivery changes 0 rows), and
// no leg throws — each is reported independently so the route can decide whether
// a retry would help (only a genuine Supabase error is worth retrying).
//
// IO is injectable so the idempotency + soft-fail branching is unit-tested with
// fakes (the real wiring hits supabaseAdmin + the Beehiiv SDK).

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase/admin.ts";
import { unsubscribeEmail } from "../beehiiv.ts";

/** Outcome of the Supabase leg. `updated` = a subscribed row was flipped;
 *  `noop` = no matching subscribed row (already unsubscribed, or never on the
 *  owned list — both fine); `error` = a real DB failure (worth a webhook retry). */
export type SupabaseUnsubscribeOutcome = "updated" | "noop" | "error";

export type UnsubscribeSyncResult = {
  email: string;
  supabase: SupabaseUnsubscribeOutcome;
  /** Beehiiv propagation succeeded (or was a documented idempotent no-op). */
  beehiiv: boolean;
};

export type UnsubscribeSyncDeps = {
  /** Set `unsubscribed_at` on the owned-list row IF still subscribed. Returns
   *  the outcome (the gate on `unsubscribed_at IS NULL` is what makes a replay
   *  a no-op). */
  setSupabaseUnsubscribed: (email: string, atIso: string) => Promise<SupabaseUnsubscribeOutcome>;
  /** Mark the address inactive on Beehiiv. Returns true on success/idempotent. */
  beehiivUnsubscribe: (email: string) => Promise<boolean>;
  /** Injectable timestamp (ISO) for deterministic tests. */
  nowIso?: string;
};

/** Default Supabase leg: a single gated UPDATE through the service-role admin
 *  client. `.is("unsubscribed_at", null)` makes a replay change 0 rows. */
async function defaultSetSupabaseUnsubscribed(
  email: string,
  atIso: string,
): Promise<SupabaseUnsubscribeOutcome> {
  try {
    // Untyped client for the isolated table (not in the generated Database type
    // until codegen runs) — same pattern as lib/newsletter/subscribers.ts.
    const db = supabaseAdmin() as unknown as SupabaseClient;
    const { data, error } = await db
      .from("newsletter_subscribers")
      .update({ unsubscribed_at: atIso })
      .eq("email", email)
      .is("unsubscribed_at", null)
      .select("id");
    if (error) {
      console.warn(`[unsubscribe-sync] supabase update failed: ${error.message}`);
      return "error";
    }
    return (data?.length ?? 0) > 0 ? "updated" : "noop";
  } catch (err) {
    console.warn(`[unsubscribe-sync] supabase update threw: ${(err as Error).message}`);
    return "error";
  }
}

async function defaultBeehiivUnsubscribe(email: string): Promise<boolean> {
  const r = await unsubscribeEmail(email);
  return r.ok;
}

/**
 * Sync a single unsubscribe across the owned list + Beehiiv. Never throws.
 * Both legs run regardless of the other's outcome (an address may be on the
 * Beehiiv list but not the owned list, or vice versa).
 */
export async function syncUnsubscribe(
  rawEmail: string,
  deps: Partial<UnsubscribeSyncDeps> = {},
): Promise<UnsubscribeSyncResult> {
  const email = (rawEmail ?? "").trim().toLowerCase();
  if (!email) return { email: "", supabase: "noop", beehiiv: false };

  const setSupabaseUnsubscribed = deps.setSupabaseUnsubscribed ?? defaultSetSupabaseUnsubscribed;
  const beehiivUnsubscribe = deps.beehiivUnsubscribe ?? defaultBeehiivUnsubscribe;
  const atIso = deps.nowIso ?? new Date().toISOString();

  // Run both legs; isolate each so one failure can't deny the other.
  const [supabase, beehiiv] = await Promise.all([
    setSupabaseUnsubscribed(email, atIso).catch((err): SupabaseUnsubscribeOutcome => {
      console.warn(`[unsubscribe-sync] supabase leg threw: ${(err as Error).message}`);
      return "error";
    }),
    beehiivUnsubscribe(email).catch((err) => {
      console.warn(`[unsubscribe-sync] beehiiv leg threw: ${(err as Error).message}`);
      return false;
    }),
  ]);

  return { email, supabase, beehiiv };
}
