// "About this card" listing copy — tier-honest (card-page-vault-first goal,
// Cowork live audit 2026-07-04).
//
// The old copy promised "the Best Current Listing block above shows the
// lowest live eBay listing we could verify" on EVERY tier, but longtail and
// metadata-only pages render the Browse-on-eBay fallback, not a verified
// block. The paragraph asserted a surface the page doesn't have, on exactly
// the pages that can't keep the promise. Null-over-guess extends to prose:
// each tier's copy describes only the surface that tier actually renders.
//
// Pinned by lib/__tests__/about-copy.test.ts: fallback tiers never render the
// "block above" promise; no tier's copy contains an em dash.

import type { CardTier } from "@/lib/cards/catalog";

export type AboutListingCopy = {
  /** Continues the intro sentence about condition/print/grading variance. */
  lead: string;
  /** The standalone verification paragraph. */
  verify: string;
};

const CURATED: AboutListingCopy = {
  lead:
    "The Best Current Listing block above shows the lowest live eBay listing we could verify is this exact card (set, collector number, and language checked against the listing's own item specifics).",
  verify:
    "Foil verifies the lowest current eBay listing on every page load. No caching of listing data, no stale snapshots. When no listing passes verification, we say so instead of showing a maybe-wrong one. The block above reflects live state at the moment you opened this page.",
};

const FALLBACK: AboutListingCopy = {
  lead:
    "For this card we link you straight to the live eBay search. We only show a curated pick when we can verify it is this exact card, and we are adding verified listings to more cards over time.",
  verify:
    "Foil never shows a listing it could not check. On our most popular cards we verify the lowest live eBay listing against the listing's own item specifics on every page load; here, the honest answer is the live search itself.",
};

/** Tier-conditional listing copy for the About section. */
export function aboutListingCopy(tier: CardTier): AboutListingCopy {
  return tier === "curated" ? CURATED : FALLBACK;
}
