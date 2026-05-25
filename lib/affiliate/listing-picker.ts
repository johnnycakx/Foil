// Quality-aware "best listing" picker. See ADR-026.
//
// Replaces the previous lowest-price-wins selector that inlined in
// `lib/affiliate/ebay-browse.ts::getBestListing`. The lowest-price selector
// shipped a real product bug — a wishlist alert sent "$1.75 Venusaur ex 151
// NEAR MINT" when real market was $40-80. The title keyword-matched the
// search; the listing was keyword-stuffed garbage. Every /cards/[slug]
// "Best current listing" block was affected by the same failure mode.
//
// This module is the fix. It takes the Browse-API hits the search returned
// and picks the cheapest *credible* one — not the cheapest absolute one.
//
// Four stages, each fall-through-to-null on total filter:
//
//   1. **Outlier rejection.** Compute the median price across hits. Reject
//      any hit priced below 30% of the median (likely a keyword-stuffed
//      sleeve / single common / accessory listing piggybacking on a hot
//      search) OR below a $3 absolute floor (catches the cases where the
//      median itself is junk).
//   2. **Title quality.** Reject listings whose titles contain bulk /
//      multi-card / proxy / fake keywords — these aren't the single-card
//      product the search was looking for, even when their prices look
//      reasonable.
//   3. **Condition.** Reject titles describing damaged or near-unsellable
//      condition. A "$15 heavily-creased Charizard" passes the price + the
//      title-keyword filter but isn't what a buyer would call a deal.
//   4. **Lowest price among survivors.** The original behaviour, narrowed
//      to listings that cleared the prior three gates.
//
// Soft-fail: if every hit is filtered out, return null. The caller
// (`getBestListing`) already falls back to `affiliateSearchUrl` in that
// case — the page renders a sponsored search-result CTA instead of a
// curated card. That's strictly better than a curated *junk* card.
//
// R-010 anchor: fixtures in `lib/__fixtures__/ebay-listings/` are drawn
// from REAL eBay junk-listing patterns observed in production (the $1.75
// Venusaur, damaged Charizard, lot listing, graded slab). They drive the
// test suite, so the picker's behaviour is pinned against actual catalog
// observations rather than synthetic data that happens to match the
// implementation. See `docs/RISKS.md` R-010 for the meta-lesson.
//
// Thresholds (0.30 outlier ratio, $3 floor) are first-cut. Tune by
// observing rejection-rate telemetry across catalog (followup goal — out
// of scope for Session 36).

import type { EpnProductHit } from "./epn.ts";

// ---------------------------------------------------------------------------
// Thresholds. Centralized for ADR-traceability + future tuning.
// ---------------------------------------------------------------------------

/** Reject hits priced below (median * OUTLIER_RATIO). */
export const OUTLIER_RATIO = 0.30;

/** Absolute floor regardless of median — catches the case where the
 *  median itself is dragged low by a herd of junk. */
export const ABSOLUTE_PRICE_FLOOR = 3;

/** Substrings (case-insensitive) that flag a multi-card / bulk / non-
 *  authentic listing in the title. A hit whose title contains any of
 *  these is rejected at stage 2. */
export const TITLE_JUNK_KEYWORDS: readonly string[] = [
  "lot",
  "bulk",
  "commons",
  "collection",
  "job lot",
  "proxy",
  "fake",
  "reproduction",
  "custom",
  "fan art",
];

/** Substrings (case-insensitive) that flag near-unsellable condition.
 *  Stage 3 rejects any hit whose title contains any of these. */
export const CONDITION_JUNK_KEYWORDS: readonly string[] = [
  "damaged",
  "poor",
  "for parts",
  "heavily played",
  "dmg",
  "creased",
  "bent",
  "ripped",
  "burn",
  "ink",
  "water damage",
];

/** Special-case " HP " regex: rejects "Heavily Played" abbreviation forms
 *  ("in HP", "NM/HP", "HP condition", trailing-token "HP") but NOT the
 *  Pokémon HP stat ("Charizard HP 120", "HP 100", etc.). The Pokémon HP
 *  stat is *always* followed by a number; the heavily-played abbreviation
 *  never is.
 *
 *  Pattern: word-boundary HP, not followed by optional whitespace + a
 *  digit. Documented deviation from the goal's literal " HP " substring
 *  in ADR-026 — the literal-substring approach would false-positive on
 *  virtually every Pokémon card title that lists the HP stat. */
export const HP_HEAVILY_PLAYED_PATTERN = /\bHP\b(?!\s*\d)/i;

/** Cap on "Pokemon" / "Pokémon" mentions in a single title. >1 mention
 *  is a strong multi-card signal ("Charizard Pikachu Mewtwo Pokemon Card
 *  Lot"). Single mention is normal ("Charizard Base Set Pokemon Card"). */
export const POKEMON_MENTION_CAP = 1;

// ---------------------------------------------------------------------------
// Stage helpers — exported so tests can pin each gate independently.
// ---------------------------------------------------------------------------

/**
 * Median of an array of positive numbers. For odd-length arrays the
 * middle value; for even-length the mean of the two middle values.
 * Empty array → 0 (caller skips outlier rejection when there are no hits
 * left to compute against).
 */
export function medianPrice(prices: readonly number[]): number {
  if (prices.length === 0) return 0;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Stage 1: outlier rejection. Drops hits priced below
 * `max(median * OUTLIER_RATIO, ABSOLUTE_PRICE_FLOOR)`.
 *
 * Special cases:
 *   - <= 1 hit → median is meaningless; apply absolute floor only.
 *   - 2 hits → median is their average; outlier rejection still meaningful
 *     but skewed; we keep it because two-hit searches are rare and the
 *     downstream gates catch most junk.
 */
export function rejectPriceOutliers(hits: readonly EpnProductHit[]): EpnProductHit[] {
  if (hits.length === 0) return [];
  if (hits.length === 1) {
    return hits[0].price >= ABSOLUTE_PRICE_FLOOR ? [...hits] : [];
  }
  const median = medianPrice(hits.map((h) => h.price));
  const threshold = Math.max(median * OUTLIER_RATIO, ABSOLUTE_PRICE_FLOOR);
  return hits.filter((h) => h.price >= threshold);
}

/** Lowercase a title once for repeated substring matching. */
function lowered(title: string): string {
  return title.toLowerCase();
}

/**
 * Stage 2: title-quality. Rejects bulk / multi-card / proxy / fake
 * keywords AND titles with > POKEMON_MENTION_CAP "pokemon"/"pokémon"
 * mentions.
 */
export function rejectTitleJunk(hits: readonly EpnProductHit[]): EpnProductHit[] {
  return hits.filter((h) => {
    const t = lowered(h.title);
    for (const kw of TITLE_JUNK_KEYWORDS) {
      if (t.includes(kw)) return false;
    }
    // Count both 'pokemon' and 'pokémon' mentions. Combine via a single
    // regex with the unicode flag so the diacritic is handled correctly.
    const pokemonMatches = h.title.match(/pok[eé]mon/gi);
    if (pokemonMatches && pokemonMatches.length > POKEMON_MENTION_CAP) return false;
    return true;
  });
}

/**
 * Stage 3: condition. Rejects damaged / poor / heavily-played condition
 * keywords. Operates over the title only (the Browse API response shape
 * we parse — EpnProductHit — has no separate condition field).
 */
export function rejectConditionJunk(hits: readonly EpnProductHit[]): EpnProductHit[] {
  return hits.filter((h) => {
    const t = lowered(h.title);
    for (const kw of CONDITION_JUNK_KEYWORDS) {
      if (t.includes(kw)) return false;
    }
    if (HP_HEAVILY_PLAYED_PATTERN.test(h.title)) return false;
    return true;
  });
}

/** Stage 4: lowest-price among survivors. */
function lowestPrice(hits: readonly EpnProductHit[]): EpnProductHit | null {
  if (hits.length === 0) return null;
  let best = hits[0];
  for (const h of hits.slice(1)) {
    if (h.price < best.price) best = h;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Public picker.
// ---------------------------------------------------------------------------

/**
 * Pick the best (lowest-priced credible) listing from a Browse search.
 * Returns null when every hit fails the filter chain — caller falls back
 * to the sponsored search CTA per the existing soft-fail pattern.
 */
export function pickBestListing(hits: readonly EpnProductHit[]): EpnProductHit | null {
  if (hits.length === 0) return null;
  const a = rejectPriceOutliers(hits);
  const b = rejectTitleJunk(a);
  const c = rejectConditionJunk(b);
  return lowestPrice(c);
}
