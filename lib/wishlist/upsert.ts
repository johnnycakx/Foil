// Shared watchlist UPSERT (Session 49b / ADR-043).
//
// A watch is identified by (email, card_slug, variant, condition) — the UNIQUE
// key added in 20260529120000_watchlist_variant_condition.sql. Submitting the
// same watch again updates the target price instead of inserting a duplicate.
// Both write paths use this single helper so the conflict target can never
// drift between them:
//   - app/actions/create-watchlist.ts (the per-card page form, Server Action)
//   - app/api/watchlist/route.ts       (the legacy JSON endpoint)
//
// Validation (email shape, token validity, variant-exists-on-card) happens in
// the callers, which have the card context; this helper is the DB write only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types.ts";
import { getAlertSuppression } from "./pause.ts";
import { enqueueHydrationIfNeeded } from "../poketrace/hydration.ts";

/** The UNIQUE conflict target — keep byte-identical with the migration. */
export const WATCHLIST_CONFLICT_TARGET = "email,card_slug,variant,condition";

export type WatchlistUpsertInput = {
  email: string;
  card_slug: string;
  variant: string;
  condition: string;
  /** null = blank target ("alert at ≥15% under the 30-day sold avg", ADR-091). */
  target_price_cents: number | null;
  /** Inbound traffic source (e.g. a creator pilot tag from `?src=`). Optional,
   *  nullable column — omitting it preserves the pre-F2 write behaviour. */
  src?: string | null;
};

export type WatchlistUpsertOpts = {
  /** Precomputed suppression state for batch callers (/api/start checks once
   *  for up to 50 rows): the suppression record when the email is suppressed,
   *  null when known-unsuppressed. OMIT (undefined) to have the upsert check
   *  itself — the safe default every caller gets for free. */
  suppression?: import("./pause.ts").AlertSuppression | null;
};

/**
 * UPSERT a watchlist row. On (email, card_slug, variant, condition) conflict,
 * updates target_price_cents. Never throws — returns {ok, error} so callers
 * can soft-fail and return a generic error tag.
 *
 * Suppression is per-email and STICKY (ADR-090, hardened after the
 * /security-review suppression-bypass finding): if the email has any paused
 * row (one-click unsubscribe or spam complaint), a new/updated watch inherits
 * the pause instead of being born active, and nothing on this unauthenticated
 * path ever CLEARS a pause — knowing an email address is not consent.
 * Un-pausing requires a verified-email action (the deferred double-opt-in
 * flow, IDEAS).
 */
export async function upsertWatchlist(
  admin: SupabaseClient<Database>,
  input: WatchlistUpsertInput,
  opts: WatchlistUpsertOpts = {},
): Promise<{ ok: boolean; error: string | null }> {
  // Normalize at the choke point: every pause/suppression query lowercases
  // and uses case-sensitive eq, so a mixed-case row would evade the one-click
  // unsubscribe entirely (rows born "Victim@Example.com" never match the
  // lowercase pause update — /security-review residual). The legacy
  // /api/watchlist caller passed the email verbatim; normalizing HERE fixes
  // every caller at once. Backfill: 20260701235000_watchlists_email_lower.sql.
  const email = input.email.trim().toLowerCase();
  const suppression =
    opts.suppression !== undefined ? opts.suppression : await getAlertSuppression(admin, email);
  const { error } = await admin.from("watchlists").upsert(
    {
      email,
      card_slug: input.card_slug,
      variant: input.variant,
      condition: input.condition,
      target_price_cents: input.target_price_cents,
      // Suppressed email → the row (new or updated) carries the pause AND its
      // source (so a complaint-inherited row keeps the not-vault-resumable
      // property, ADR-093). Unsuppressed → the fields are OMITTED entirely:
      // new rows default to active, and a conflict update leaves the stored
      // values untouched.
      ...(suppression
        ? { alerts_paused_at: suppression.pausedAtIso, paused_source: suppression.source }
        : {}),
      // Only set src when present so an existing watch's source isn't
      // overwritten with null on a later target-price update (the conflict
      // path). Absent src column values stay null by default.
      ...(input.src ? { src: input.src } : {}),
    },
    { onConflict: WATCHLIST_CONFLICT_TARGET },
  );

  // Demand-driven hydration trigger (ADR-092): a successful watch on a card
  // with no baked PokeTrace variants enqueues it for the hourly worker —
  // demand allocates the data budget. Idempotent + soft-fail; awaited so the
  // insert isn't dropped by a serverless freeze, but its outcome never
  // affects the watch write's result.
  if (!error) {
    await enqueueHydrationIfNeeded(input.card_slug, {
      getClient: () => admin,
    });
  }

  return { ok: !error, error: error ? error.message : null };
}
