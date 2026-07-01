// Pause wishlist alerts for an email address (start-funnel-integrity, ADR-090).
//
// The kill switch behind `watchlists.alerts_paused_at`. Called by:
//   - /api/unsubscribe (GET + RFC 8058 one-click POST) — the unsubscribe link
//     in every alert email now stops ALERTS, not just the newsletter (the old
//     page told recipients to "email john…" to stop alerts — a CAN-SPAM hole
//     on the funnel's highest-volume email type);
//   - the Resend webhook on `email.complained` — a spam complaint is the
//     strongest opt-out signal, so it stops everything.
//
// Idempotent + soft-fail, mirroring lib/newsletter/unsubscribe-sync.ts: the
// update is gated on `alerts_paused_at IS NULL` so a replay flips 0 rows, and
// nothing throws — the caller renders success regardless (the user's intent is
// clear; a retry works). IO is injectable so branching is unit-tested with
// fakes.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types.ts";
import { supabaseAdmin } from "../supabase/admin.ts";

/** `paused` = ≥1 active row flipped; `noop` = nothing to pause (no rows, or
 *  all already paused — both fine); `error` = a real DB failure. */
export type PauseAlertsOutcome = "paused" | "noop" | "error";

export type PauseAlertsResult = {
  email: string;
  outcome: PauseAlertsOutcome;
  /** Rows flipped this call (0 on noop/error). */
  pausedCount: number;
};

export type PauseAlertsDeps = {
  /** Injectable admin client factory (tests pass a fake). */
  getClient?: () => SupabaseClient<Database>;
  /** Injectable timestamp (ISO) for deterministic tests. */
  nowIso?: string;
};

/**
 * Is this email's alert stream suppressed? Returns the ISO timestamp of an
 * existing pause (any row with `alerts_paused_at` set) or null when the email
 * has no paused rows. Used by the WRITE paths to make suppression per-email
 * and sticky: an unauthenticated watch submission for a suppressed address
 * must NOT create active rows or clear the pause — knowing an email address
 * is not consent (/security-review finding, ADR-090). Never throws; a DB
 * error returns null (fail-open for the write, matching the shared-DB-health
 * reality — the subsequent upsert would fail too).
 */
export async function getAlertSuppression(
  admin: SupabaseClient<Database>,
  rawEmail: string,
): Promise<string | null> {
  const email = (rawEmail ?? "").trim().toLowerCase();
  if (!email) return null;
  try {
    const { data, error } = await admin
      .from("watchlists")
      .select("alerts_paused_at")
      .eq("email", email)
      .not("alerts_paused_at", "is", null)
      .limit(1);
    if (error) {
      console.warn(`[wishlist-pause] suppression check failed: ${error.message}`);
      return null;
    }
    const iso = data?.[0]?.alerts_paused_at;
    return typeof iso === "string" && iso ? iso : null;
  } catch (err) {
    console.warn(`[wishlist-pause] suppression check threw: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Set `alerts_paused_at` on EVERY still-active watchlists row for the email.
 * Never throws. Case-insensitive on the email (rows are stored lowercased by
 * the write paths; normalize here too so a mixed-case token still matches).
 */
export async function pauseWatchlistAlerts(
  rawEmail: string,
  deps: PauseAlertsDeps = {},
): Promise<PauseAlertsResult> {
  const email = (rawEmail ?? "").trim().toLowerCase();
  if (!email) return { email: "", outcome: "noop", pausedCount: 0 };
  const atIso = deps.nowIso ?? new Date().toISOString();

  try {
    const db = deps.getClient ? deps.getClient() : supabaseAdmin();
    const { data, error } = await db
      .from("watchlists")
      .update({ alerts_paused_at: atIso })
      .eq("email", email)
      .is("alerts_paused_at", null)
      .select("id");
    if (error) {
      console.warn(`[wishlist-pause] update failed: ${error.message}`);
      return { email, outcome: "error", pausedCount: 0 };
    }
    const count = data?.length ?? 0;
    return { email, outcome: count > 0 ? "paused" : "noop", pausedCount: count };
  } catch (err) {
    console.warn(`[wishlist-pause] update threw: ${(err as Error).message}`);
    return { email, outcome: "error", pausedCount: 0 };
  }
}
