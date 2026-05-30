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

/** The UNIQUE conflict target — keep byte-identical with the migration. */
export const WATCHLIST_CONFLICT_TARGET = "email,card_slug,variant,condition";

export type WatchlistUpsertInput = {
  email: string;
  card_slug: string;
  variant: string;
  condition: string;
  target_price_cents: number;
};

/**
 * UPSERT a watchlist row. On (email, card_slug, variant, condition) conflict,
 * updates target_price_cents. Never throws — returns {ok, error} so callers
 * can soft-fail and return a generic error tag.
 */
export async function upsertWatchlist(
  admin: SupabaseClient<Database>,
  input: WatchlistUpsertInput,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await admin.from("watchlists").upsert(
    {
      email: input.email,
      card_slug: input.card_slug,
      variant: input.variant,
      condition: input.condition,
      target_price_cents: input.target_price_cents,
    },
    { onConflict: WATCHLIST_CONFLICT_TARGET },
  );
  return { ok: !error, error: error ? error.message : null };
}
