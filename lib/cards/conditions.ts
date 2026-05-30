// Watchlist condition tokens (Session 49b / ADR-043).
//
// A watchlist row now carries a `condition` token alongside `variant` so an
// alert can target a specific grade ("PSA 10") or raw condition ("Near Mint")
// instead of matching any listing. This module is the single source of truth
// for:
//   1. The closed token set (the DB column + the picker UI + the validator).
//   2. Human labels (rendered in the picker and in the alert email subject).
//   3. eBay include/exclude keyword maps — used by buildEbayQuery (to bias the
//      Browse search) AND by the listing-picker's keyword gate (to reject a
//      listing whose title contradicts the targeted condition).
//
// Matching is case-insensitive substring on the eBay listing title. eBay's
// Browse API exposes no structured condition field on the V1 surface, so the
// title is the only signal we have (same constraint the listing-picker's
// condition-junk gate already works under — see ADR-026). Keyword maps are
// deliberately conservative: a too-broad include returns the wrong card; a
// too-broad exclude returns nothing and the page soft-fails to the search CTA.

export const RAW_CONDITION_TOKENS = ["any-raw", "nm", "lp", "mp", "hp", "dmg"] as const;

export const GRADED_CONDITION_TOKENS = [
  "any-graded",
  "psa-10",
  "psa-9",
  "psa-8",
  "psa-7",
  "bgs-10-bl",
  "bgs-9-5",
  "bgs-9",
  "cgc-10",
  "cgc-9-5",
  "cgc-9",
] as const;

export const CONDITION_TOKENS = [...RAW_CONDITION_TOKENS, ...GRADED_CONDITION_TOKENS] as const;

export type ConditionToken = (typeof CONDITION_TOKENS)[number];

/** The default condition for a watchlist row that didn't pick one. */
export const DEFAULT_CONDITION: ConditionToken = "any-raw";

/** Human labels — picker pills + alert-email subject ("… (PSA 10) hit $X"). */
export const CONDITION_LABELS: Record<ConditionToken, string> = {
  "any-raw": "Any (Raw)",
  nm: "Near Mint",
  lp: "Lightly Played",
  mp: "Moderately Played",
  hp: "Heavily Played",
  dmg: "Damaged",
  "any-graded": "Any (Graded)",
  "psa-10": "PSA 10",
  "psa-9": "PSA 9",
  "psa-8": "PSA 8",
  "psa-7": "PSA 7",
  "bgs-10-bl": "BGS 10 Black Label",
  "bgs-9-5": "BGS 9.5",
  "bgs-9": "BGS 9",
  "cgc-10": "CGC 10",
  "cgc-9-5": "CGC 9.5",
  "cgc-9": "CGC 9",
};

/** Played / damaged tiers a buyer would deliberately seek out. The
 *  listing-picker's condition-junk gate (ADR-026) rejects these by default —
 *  getBestListing relaxes that gate when the watchlist explicitly targets one
 *  so a "Damaged" alert isn't silently filtered to zero results. */
export const PLAYED_CONDITION_TOKENS: readonly ConditionToken[] = ["mp", "hp", "dmg"];

export type KeywordSet = {
  /** ≥1 of these must appear in the listing title (empty = no positive gate). */
  include: readonly string[];
  /** None of these may appear in the listing title. */
  exclude: readonly string[];
};

// Any raw condition excludes graded slabs; a raw buyer doesn't want a $4,000
// PSA 10 surfaced as "their" deal.
const GRADED_EXCLUDE = ["PSA", "BGS", "CGC", "SGC", "graded"] as const;

/** eBay include/exclude keyword map per condition token. */
export const CONDITION_EBAY_KEYWORDS: Record<ConditionToken, KeywordSet> = {
  "any-raw": { include: [], exclude: GRADED_EXCLUDE },
  nm: { include: ["Near Mint", "NM"], exclude: GRADED_EXCLUDE },
  lp: { include: ["Lightly Played", "LP"], exclude: GRADED_EXCLUDE },
  mp: { include: ["Moderately Played", "MP"], exclude: GRADED_EXCLUDE },
  hp: { include: ["Heavily Played", "HP"], exclude: GRADED_EXCLUDE },
  dmg: { include: ["Damaged", "DMG"], exclude: GRADED_EXCLUDE },
  "any-graded": { include: ["PSA", "BGS", "CGC", "SGC"], exclude: [] },
  "psa-10": { include: ["PSA 10"], exclude: ["PSA 9", "PSA 8", "PSA 7", "BGS", "CGC", "SGC"] },
  "psa-9": { include: ["PSA 9"], exclude: ["PSA 10", "PSA 8", "PSA 7", "BGS", "CGC", "SGC"] },
  "psa-8": { include: ["PSA 8"], exclude: ["PSA 10", "PSA 9", "PSA 7", "BGS", "CGC", "SGC"] },
  "psa-7": { include: ["PSA 7"], exclude: ["PSA 10", "PSA 9", "PSA 8", "BGS", "CGC", "SGC"] },
  // Black Label is the all-10-subgrade BGS slab; require the phrase so a plain
  // "BGS 10" doesn't match.
  "bgs-10-bl": { include: ["Black Label", "BGS 10 Black"], exclude: ["PSA", "CGC", "SGC"] },
  // "BGS 9.5" titles contain the substring "BGS 9", so bgs-9 must exclude the
  // ".5" form; bgs-9-5 needn't exclude "BGS 9" (its own include is a superset).
  "bgs-9-5": { include: ["BGS 9.5"], exclude: ["BGS 10", "PSA", "CGC", "SGC"] },
  "bgs-9": { include: ["BGS 9"], exclude: ["BGS 9.5", "BGS 10", "PSA", "CGC", "SGC"] },
  "cgc-10": { include: ["CGC 10"], exclude: ["CGC 9", "PSA", "BGS", "SGC"] },
  "cgc-9-5": { include: ["CGC 9.5"], exclude: ["CGC 10", "PSA", "BGS", "SGC"] },
  "cgc-9": { include: ["CGC 9"], exclude: ["CGC 9.5", "CGC 10", "PSA", "BGS", "SGC"] },
};

// PokeTrace per-tier keys for the raw conditions, NM→DMG (Session 49c). The
// graded keys follow PokeTrace's `<AUTHORITY>_<GRADE>` shape (PSA_10, BGS_9_5,
// CGC_9_5, …) — verified against the live /v1/cards response.
export const RAW_POKETRACE_TIERS = [
  "NEAR_MINT",
  "LIGHTLY_PLAYED",
  "MODERATELY_PLAYED",
  "HEAVILY_PLAYED",
  "DAMAGED",
] as const;

/** How a condition token resolves against PokeTrace's tiers (Session 49c). */
export type TierResolution =
  | { kind: "tier"; tier: string }
  | { kind: "raw-agg" }
  | { kind: "graded-agg" };

const TOKEN_TO_TIER: Record<ConditionToken, TierResolution> = {
  "any-raw": { kind: "raw-agg" },
  nm: { kind: "tier", tier: "NEAR_MINT" },
  lp: { kind: "tier", tier: "LIGHTLY_PLAYED" },
  mp: { kind: "tier", tier: "MODERATELY_PLAYED" },
  hp: { kind: "tier", tier: "HEAVILY_PLAYED" },
  dmg: { kind: "tier", tier: "DAMAGED" },
  "any-graded": { kind: "graded-agg" },
  "psa-10": { kind: "tier", tier: "PSA_10" },
  "psa-9": { kind: "tier", tier: "PSA_9" },
  "psa-8": { kind: "tier", tier: "PSA_8" },
  "psa-7": { kind: "tier", tier: "PSA_7" },
  // PokeTrace had no BGS_10 tier on the cards probed (grades top out at 9.5);
  // when the tier is absent the panel/chart soft-fall to "—" / unavailable.
  "bgs-10-bl": { kind: "tier", tier: "BGS_10" },
  "bgs-9-5": { kind: "tier", tier: "BGS_9_5" },
  "bgs-9": { kind: "tier", tier: "BGS_9" },
  "cgc-10": { kind: "tier", tier: "CGC_10" },
  "cgc-9-5": { kind: "tier", tier: "CGC_9_5" },
  "cgc-9": { kind: "tier", tier: "CGC_9" },
};

/** Resolve a condition token to a PokeTrace tier (or an aggregate marker).
 *  Unknown tokens fall back to the raw aggregate (the safe default headline). */
export function conditionToTier(token: string | null | undefined): TierResolution {
  return token && isValidConditionToken(token) ? TOKEN_TO_TIER[token] : { kind: "raw-agg" };
}

const TOKEN_SET = new Set<string>(CONDITION_TOKENS);

/** Type guard: is `value` a known condition token? */
export function isValidConditionToken(value: unknown): value is ConditionToken {
  return typeof value === "string" && TOKEN_SET.has(value);
}

/** Human label for a token (falls back to the token itself if unknown). */
export function conditionLabel(token: string): string {
  return isValidConditionToken(token) ? CONDITION_LABELS[token] : token;
}

/** eBay keyword set for a token, or empty sets for an unknown/no token. */
export function ebayKeywordsForCondition(token: string | null | undefined): KeywordSet {
  return token && isValidConditionToken(token)
    ? CONDITION_EBAY_KEYWORDS[token]
    : { include: [], exclude: [] };
}

/** True when targeting this condition should relax the picker's condition-junk
 *  gate (the buyer explicitly wants a played/damaged card). */
export function conditionRelaxesJunkGate(token: string | null | undefined): boolean {
  return !!token && isValidConditionToken(token) && PLAYED_CONDITION_TOKENS.includes(token);
}
