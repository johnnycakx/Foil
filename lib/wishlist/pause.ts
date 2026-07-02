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

/** Who paused (ADR-093). Drives the resume rules: 'vault' + 'unsubscribe'
 *  are resumable from the vault; 'complaint' is not. Only 'unsubscribe' +
 *  'complaint' count as per-email suppression for new watches (ADR-090). */
export type PauseSource = "vault" | "unsubscribe" | "complaint";

/** The sources that constitute address-level suppression (sticky for new
 *  watches; ADR-090). A vault pause is a per-card preference, not suppression. */
export const SUPPRESSION_SOURCES: readonly PauseSource[] = ["unsubscribe", "complaint"];

export type PauseAlertsDeps = {
  /** Injectable admin client factory (tests pass a fake). */
  getClient?: () => SupabaseClient<Database>;
  /** Injectable timestamp (ISO) for deterministic tests. */
  nowIso?: string;
  /** Pause provenance. Default 'unsubscribe' (the pre-vault behavior). */
  source?: PauseSource;
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
export type AlertSuppression = { pausedAtIso: string; source: PauseSource };

export async function getAlertSuppression(
  admin: SupabaseClient<Database>,
  rawEmail: string,
): Promise<AlertSuppression | null> {
  const email = (rawEmail ?? "").trim().toLowerCase();
  if (!email) return null;
  try {
    const { data, error } = await admin
      .from("watchlists")
      .select("alerts_paused_at, paused_source")
      .eq("email", email)
      .not("alerts_paused_at", "is", null)
      // Only address-level opt-outs suppress new watches (ADR-093): a vault
      // pause is a per-card preference and must NOT make new watches dead.
      .in("paused_source", SUPPRESSION_SOURCES as PauseSource[])
      // Complaint outranks unsubscribe — inherit the strongest source so an
      // inherited row keeps the not-vault-resumable property.
      .order("paused_source", { ascending: true })
      .limit(1);
    if (error) {
      console.warn(`[wishlist-pause] suppression check failed: ${error.message}`);
      return null;
    }
    const row = data?.[0];
    const iso = row?.alerts_paused_at;
    if (typeof iso !== "string" || !iso) return null;
    const source: PauseSource = row?.paused_source === "complaint" ? "complaint" : "unsubscribe";
    return { pausedAtIso: iso, source };
  } catch (err) {
    console.warn(`[wishlist-pause] suppression check threw: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Resume alerts for an email — clears the pause on every row EXCEPT
 * complaint-sourced ones (ADR-093: a spam complaint is not overridable from
 * the vault; only a future verified re-opt-in flow may clear it). The rows'
 * `alert_state` is untouched — the alert engine's armed/fired rules (ADR-091)
 * govern what happens next, so a resume can't force a re-fire.
 */
export async function resumeWatchlistAlerts(
  rawEmail: string,
  deps: { getClient?: () => SupabaseClient<Database> } = {},
): Promise<{ email: string; outcome: "resumed" | "noop" | "error"; resumedCount: number }> {
  const email = (rawEmail ?? "").trim().toLowerCase();
  if (!email) return { email: "", outcome: "noop", resumedCount: 0 };
  try {
    const db = deps.getClient ? deps.getClient() : supabaseAdmin();
    const { data, error } = await db
      .from("watchlists")
      .update({ alerts_paused_at: null, paused_source: null })
      .eq("email", email)
      .not("alerts_paused_at", "is", null)
      .neq("paused_source", "complaint")
      .select("id");
    if (error) {
      console.warn(`[wishlist-pause] resume failed: ${error.message}`);
      return { email, outcome: "error", resumedCount: 0 };
    }
    const count = data?.length ?? 0;
    return { email, outcome: count > 0 ? "resumed" : "noop", resumedCount: count };
  } catch (err) {
    console.warn(`[wishlist-pause] resume threw: ${(err as Error).message}`);
    return { email, outcome: "error", resumedCount: 0 };
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
  const source: PauseSource = deps.source ?? "unsubscribe";

  try {
    const db = deps.getClient ? deps.getClient() : supabaseAdmin();
    const { data, error } = await db
      .from("watchlists")
      .update({ alerts_paused_at: atIso, paused_source: source })
      .eq("email", email)
      .is("alerts_paused_at", null)
      .select("id");
    if (error) {
      console.warn(`[wishlist-pause] update failed: ${error.message}`);
      return { email, outcome: "error", pausedCount: 0 };
    }
    let count = data?.length ?? 0;

    // Complaint is an ABSORBING state (/security-review fix): the IS-NULL gate
    // above only touches active rows, so a card the user had ALREADY paused
    // (paused_source 'vault' or 'unsubscribe') would keep its weaker source —
    // then vault-resume could clear it and getAlertSuppression wouldn't see
    // the complaint. Escalate every already-paused, not-yet-complaint row to
    // 'complaint' so it becomes un-resumable + counts as suppression.
    if (source === "complaint") {
      const { data: escalated, error: escErr } = await db
        .from("watchlists")
        .update({ paused_source: "complaint" })
        .eq("email", email)
        .not("alerts_paused_at", "is", null)
        .neq("paused_source", "complaint")
        .select("id");
      if (escErr) {
        console.warn(`[wishlist-pause] complaint escalation failed: ${escErr.message}`);
      } else {
        count += escalated?.length ?? 0;
      }
    }
    return { email, outcome: count > 0 ? "paused" : "noop", pausedCount: count };
  } catch (err) {
    console.warn(`[wishlist-pause] update threw: ${(err as Error).message}`);
    return { email, outcome: "error", pausedCount: 0 };
  }
}
