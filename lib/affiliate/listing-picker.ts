// Quality-aware "best listing" picker. See ADR-026.
//
// DEMOTION NOTE (DESIGN-VERIFIED-LISTING-RESOLVER.md §5, Tranche A #1): these
// gates are now a PRE-FILTER. They rank + narrow candidates cheaply (a cost
// optimizer) for the verified-listing resolver (lib/listing/resolve.ts), which
// applies the real admission gate (eBay item-specifics identity). Title parsing
// here MAY drop junk but MUST NEVER be the sole basis to admit a listing for
// display. Current consumers (per-card page, /go, wishlist cron, deals cron)
// still call getBestListing directly until goals #2/#3 migrate them onto the
// resolver — so behavior is unchanged this goal; this is the intent marker.
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

/** Set-aware junk patterns — the set-aware mode's replacement teeth for the
 *  bare junk keywords it suppresses, plus multi-item/merch shapes observed in
 *  the 2026-06-12 base6 paired sweep. Evaluated against BOTH the original title
 *  AND the set-stripped one ("24 Legendary Collection Cards" only reads as a
 *  card count once the set phrase is removed), and ONLY when a `setName` is
 *  supplied to `rejectTitleJunk` — behavior for every set-blind caller is
 *  unchanged.
 *
 *  Why: when the card's own set name contains a junk keyword ("Legendary
 *  Collection"), the keyword is suppressed for occurrences inside the set-name
 *  phrase — but a REAL multi-card lot on that set's page ("Entire Legendary
 *  Collection, 110 cards") must still drop. Each pattern below traces to an
 *  observed production title (R-010 fixtures pin the load-bearing ones). */
export const SET_AWARE_JUNK_PATTERNS: readonly RegExp[] = [
  // "entire/whole/huge/massive/complete/full/my ... collection" — possessive-
  // lot phrasing ("my entire Legendary Collection"). Up to 3 intervening words
  // so the set name itself can sit inside the phrase.
  /\b(?:entire|whole|huge|massive|complete|full|my)\s+(?:[\w'&.-]+\s+){0,3}collection\b/i,
  // "collection lot" / "collection of 50" — lot-of-N phrasing.
  /\bcollection\s+(?:lot|bundle|of\s+\d)/i,
  // Card-count phrasing: "110 cards", "50+ cards", "12x cards". A single-card
  // title's collector number ("1/110") never puts a bare count directly
  // before the word "cards". Observed: "Great Gift For Kids 24 Legendary
  // Collection Cards + Rare Nidoking" (a lot, admitted via absent aspects).
  /\b\d{1,4}\+?\s*(?:x\s*)?cards\b/i,
  // Piece-count merch phrasing. Observed: "3PCS Legendary Color Potion -
  // Dragon Adventures" (a Roblox virtual item, zero aspects).
  /\b\d{1,4}\s*pcs\b/i,
  // You-pick / choose-your-card multi-listings — one listing fronting many
  // cards; the specific card's identity is never verifiable from it.
  // Observed: "Legendary Collection Set 80-89/110 YOU PICK! NM+",
  // "Legendary Collection 2002 WOTC NM/LP: Choose Your Own".
  /\b(?:you|u)[\s-]*pick\b/i,
  /\bchoose\s+your\b/i,
  /\bpick\s+(?:your|a|any)\b/i,
  // Non-card merchandise that carries no identifying aspects and so would
  // sail through absence-tolerant corroboration. Observed: "Pikachu's
  // Legendary Collection - Pokemon Plushies"; the 2026-06-11 lever measure's
  // factory-sealed deck box (base6-19-zapdos).
  /\bplush/i,
  /\bdeck\s*box\b/i,
  /\bfactory\s+sealed\b/i,
];

/** Escape a literal string for use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove every occurrence of the card's own set-name phrase from a title
 * (case-insensitive, whitespace-run tolerant), replacing with a space so no
 * accidental token joins can mint a new keyword match. "Alakazam Legendary
 * Collection 1/110 Holo" → "Alakazam   1/110 Holo".
 */
export function stripSetName(title: string, setName: string): string {
  const tokens = setName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return title;
  const re = new RegExp(tokens.map(escapeRegExp).join("\\s+"), "gi");
  return title.replace(re, " ");
}

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

/** Set-aware options for `rejectTitleJunk` (the "collection" prefilter
 *  collision fix). When `setName` is provided, junk keywords and the Pokemon
 *  mention cap are evaluated on the title WITH the set-name phrase stripped,
 *  so a keyword that is a token of the card's own set name ("Legendary
 *  Collection") can no longer reject a legitimate single-card listing — and
 *  LOT_CONTEXT_PATTERNS run on the original title so real lots still drop.
 *  Omitted → behavior is byte-identical to the set-blind picker (every
 *  existing caller). */
export type TitleJunkOptions = {
  setName?: string;
};

/**
 * Stage 2: title-quality. Rejects bulk / multi-card / proxy / fake
 * keywords AND titles with > POKEMON_MENTION_CAP "pokemon"/"pokémon"
 * mentions. Set-aware when `opts.setName` is given (see TitleJunkOptions).
 */
export function rejectTitleJunk(hits: readonly EpnProductHit[], opts: TitleJunkOptions = {}): EpnProductHit[] {
  const setName = opts.setName?.trim();
  return hits.filter((h) => {
    // In set-aware mode, scan a copy of the title with the card's own
    // set-name phrase removed — its tokens are identity, not junk signal.
    const scanTitle = setName ? stripSetName(h.title, setName) : h.title;
    const t = lowered(scanTitle);
    for (const kw of TITLE_JUNK_KEYWORDS) {
      if (t.includes(kw)) return false;
    }
    // Lot/multi-item protection the stripped keyword can no longer provide:
    // checked against BOTH title forms, set-aware mode only. (The original
    // catches "...collection lot"; the stripped form catches counts the set
    // phrase interrupts — "24 Legendary Collection Cards" → "24 Cards".)
    if (setName) {
      for (const re of SET_AWARE_JUNK_PATTERNS) {
        if (re.test(h.title) || re.test(scanTitle)) return false;
      }
    }
    // Count both 'pokemon' and 'pokémon' mentions. Combine via a single
    // regex with the unicode flag so the diacritic is handled correctly.
    // Counted on the stripped title in set-aware mode — a set name that
    // itself contains "Pokémon" ("Pokémon GO") is identity, not a
    // multi-card signal.
    const pokemonMatches = scanTitle.match(/pok[eé]mon/gi);
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

/**
 * Stage 4 (Session 49b / ADR-043): variant + condition keyword gate. Keeps a
 * hit only when its title carries ≥1 `include` keyword (when any are given)
 * AND none of the `exclude` keywords. Case-insensitive substring match — eBay
 * Browse exposes no structured variant/condition field, so the title is the
 * only signal (same constraint as the condition-junk gate above).
 *
 * When `include` is empty the positive gate is a no-op (e.g. the "any-raw"
 * condition contributes only exclusions); when both are empty the whole gate
 * is a pass-through, so an un-targeted call (page render with no watchlist
 * variant/condition) behaves exactly as before.
 */
export function rejectByKeywords(
  hits: readonly EpnProductHit[],
  include: readonly string[],
  exclude: readonly string[],
): EpnProductHit[] {
  if (include.length === 0 && exclude.length === 0) return [...hits];
  const inc = include.map((k) => k.toLowerCase());
  const exc = exclude.map((k) => k.toLowerCase());
  return hits.filter((h) => {
    const t = lowered(h.title);
    if (exc.some((k) => t.includes(k))) return false;
    if (inc.length > 0 && !inc.some((k) => t.includes(k))) return false;
    return true;
  });
}

/** Stage 5: lowest-price among survivors. */
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
 * Optional variant/condition keyword gate (Session 49b / ADR-043).
 *   - include / exclude: keyword sets from variantEbayKeywords +
 *     ebayKeywordsForCondition (merged by the caller).
 *   - skipConditionJunk: when the buyer explicitly targets a played/damaged
 *     condition, bypass stage 3 so the listings they actually want aren't
 *     pre-filtered out.
 */
export type PickOptions = {
  include?: readonly string[];
  exclude?: readonly string[];
  skipConditionJunk?: boolean;
  /** The card's own set name — opts into set-aware title-junk matching (see
   *  TitleJunkOptions). Only the verified-listing resolver passes this; the
   *  set-blind consumers (deals cron via getBestListing) stay unchanged
   *  because they lack the downstream identity gate that makes the wider
   *  candidate pool safe. */
  setName?: string;
};

/**
 * Pick the best (lowest-priced credible) listing from a Browse search.
 * Returns null when every hit fails the filter chain — caller falls back
 * to the sponsored search CTA per the existing soft-fail pattern.
 *
 * `opts` is omitted on the un-targeted page-render path (behaviour unchanged);
 * the wishlist cron passes the watched row's variant/condition keyword sets.
 */
export function pickBestListing(
  hits: readonly EpnProductHit[],
  opts: PickOptions = {},
): EpnProductHit | null {
  if (hits.length === 0) return null;
  const a = rejectPriceOutliers(hits);
  const b = rejectTitleJunk(a, { setName: opts.setName });
  const c = opts.skipConditionJunk ? b : rejectConditionJunk(b);
  const d = rejectByKeywords(c, opts.include ?? [], opts.exclude ?? []);
  return lowestPrice(d);
}
