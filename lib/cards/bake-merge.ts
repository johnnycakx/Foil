// Snapshot-merge discipline for `npm run bake:cards` (perf-and-data-foundation,
// 2026-07-01).
//
// The bake script fetches LIVE pokemontcg.io records, which never carry the
// baked-only PokeTrace `variants` (sdk.ts::parseCard sets `variants: []`). A
// naive `{ ...prior, ...fresh }` overlay would therefore clobber every
// previously-baked card's variants with an empty array — silently wiping the
// sold-history data for all ~1,189 variant-carrying cards and forcing a full
// rate-limited PokeTrace re-bake to recover. This module strips the baked-only
// fields from the fresh record before overlaying, and lives in lib/ (inside
// the tsconfig include set, unlike scripts/) so the invariant is typechecked
// AND unit-tested (lib/__tests__/bake-snapshot-invariants.test.ts).

import type { CardMetadata } from "./sdk.ts";

/**
 * Overlay a freshly-fetched SDK card record onto the prior snapshot entry,
 * preserving baked-only fields (PokeTrace `variants`) that live upstream
 * fetches can never supply. Net-new cards (no prior entry) pass through
 * as-is — their empty `variants` is correct (PokeTrace enrichment is lazy).
 */
export function overlayFreshMetadata(
  prior: CardMetadata | undefined,
  fresh: CardMetadata,
): CardMetadata {
  if (!prior) return fresh;
  // Baked-only fields stripped from the fresh record before merging.
  const { variants: _freshVariants, ...freshMeta } = fresh;
  return { ...prior, ...freshMeta };
}

/**
 * Overlay ONLY the TCGplayer listed-price fields onto a prior entry — the
 * `--refresh-prices` path (pricing-bridge / ADR-118).
 *
 * Why this exists: the daily bake runs `--only-missing`, which by design leaves
 * an already-baked card "exactly as it is" — including its prices. So a card's
 * `tcgplayerPrices` were frozen at whatever they were the day it was first
 * baked (measured 2026-07-14: median age 13 days, worst 1,231 days). That is
 * fine while prices are decoration, but ADR-118 makes them the FALLBACK the
 * card page falls to when the sold spine goes dark — and a fallback that ages
 * past LISTED_FRESHNESS_MAX_DAYS silently becomes no fallback at all. The
 * refresh keeps it alive.
 *
 * Surgical by construction: everything except the two price fields is taken
 * from `prior`, so a refresh can never clobber the baked PokeTrace `variants`
 * (the exact bug overlayFreshMetadata exists to prevent) or any other field.
 */
export function overlayListedPrices(
  prior: CardMetadata,
  fresh: CardMetadata,
): CardMetadata {
  return {
    ...prior,
    tcgplayerPrices: fresh.tcgplayerPrices,
    tcgplayerUpdatedAt: fresh.tcgplayerUpdatedAt,
  };
}
