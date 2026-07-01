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
