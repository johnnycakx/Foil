// Watchlist condition token (lib/cards/conditions.ts) → resolver ResolveCondition.
// Pure. Goal #3 (wishlist cron migration onto resolveVerifiedListing): the
// stored token set is the closed DB enum; this is the single place it maps to
// the resolver's condition request. Unknown tokens map to null — the cron skips
// the combo (and logs an error) rather than alerting on an unverifiable basis.

import type { ResolveCondition } from "./identity.ts";

const TOKEN_MAP: Record<string, ResolveCondition> = {
  "any-raw": "ANY_RAW",
  nm: "NM",
  lp: "LP",
  mp: "MP",
  hp: "HP",
  dmg: "DMG",
  "any-graded": "ANY_GRADED",
  "psa-10": { graded: { service: "PSA", grade: "10" } },
  "psa-9": { graded: { service: "PSA", grade: "9" } },
  "psa-8": { graded: { service: "PSA", grade: "8" } },
  "psa-7": { graded: { service: "PSA", grade: "7" } },
  // Black Label maps to BGS 10 for the grade gate; the slab's Black-Label-ness
  // is NOT verifiable from item specifics, so the cron adds a title NARROWING
  // check (tokenRequiresBlackLabel) — narrowing only suppresses alerts, it can
  // never admit an unverified listing.
  "bgs-10-bl": { graded: { service: "BGS", grade: "10" } },
  "bgs-9-5": { graded: { service: "BGS", grade: "9.5" } },
  "bgs-9": { graded: { service: "BGS", grade: "9" } },
  "cgc-10": { graded: { service: "CGC", grade: "10" } },
  "cgc-9-5": { graded: { service: "CGC", grade: "9.5" } },
  "cgc-9": { graded: { service: "CGC", grade: "9" } },
};

/** Resolver condition for a watchlist token. Empty/missing token → the
 *  "any-raw" default (mirrors DEFAULT_CONDITION); unknown token → null. */
export function resolveConditionForToken(token: string | null | undefined): ResolveCondition | null {
  const t = (token ?? "").trim().toLowerCase();
  if (!t) return "ANY_RAW";
  return TOKEN_MAP[t] ?? null;
}

/** bgs-10-bl: the all-10-subgrade slab. eBay item specifics expose grade BGS 10
 *  but not Black Label, so the watcher's intent needs a title check on top of
 *  the verified BGS-10 identity. */
export function tokenRequiresBlackLabel(token: string | null | undefined): boolean {
  return (token ?? "").trim().toLowerCase() === "bgs-10-bl";
}

/** True when the alert should fire for this verified listing under the watched
 *  token — the bgs-10-bl Black-Label title narrowing; everything else passes
 *  (the resolver already verified the condition). */
export function verifiedListingMatchesToken(token: string | null | undefined, listingTitle: string): boolean {
  if (!tokenRequiresBlackLabel(token)) return true;
  return /black[\s-]*label/i.test(listingTitle);
}
