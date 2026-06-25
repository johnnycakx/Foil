// Shared per-card buy-signal orchestrator (ROADMAP B.4 / ADR-054).
//
// One function that turns (a card's variants + a live eBay listing's title +
// its ask price) into a condition-matched BuySignal. Extracted so the
// `/cards/[slug]` page render AND the /deals leaderboard refresh cron compute
// the signal IDENTICALLY — the I-008 "two surfaces silently drift" guard. Both
// callers were doing the same three steps inline; now there's one source.
//
// The steps (unchanged from the per-card page wiring, ROADMAP #32.1/#32.3):
//   1. infer the listing's condition from its title (conservative → UNKNOWN),
//   2. resolve the SAME-condition 30-day PokeTrace sold reference (never cross-
//      condition; grade-specific for graded slabs),
//   3. classify the ask against that reference with the symmetric outlier guard.

import type { PoketraceVariant } from "../poketrace/variant.ts";
import type { ListingAspects } from "./aspects.ts";
import { inferListingCondition } from "./condition-infer.ts";
import { resolveConditionMatchedReference } from "./reference.ts";
import { classifyConditionMatched, type BuySignal } from "./compute.ts";

export type CardBuySignal = {
  signal: BuySignal;
  /** The PokeTrace tier key matched against (e.g. "NEAR_MINT", "PSA_9"), or
   *  null when the signal is UNKNOWN. Surfaced so the leaderboard cache can
   *  record which condition the comparison was on (honesty / telemetry). */
  matchedTier: string | null;
};

export async function computeCardBuySignal(input: {
  variants: PoketraceVariant[] | undefined;
  listingTitle: string | undefined | null;
  /** eBay getItem item-specifics for the listing (ADR-057). A record → used as
   *  the authoritative market+condition source; `null` → getItem failed/empty
   *  (→ UNKNOWN); omitted → title-only inference (back-compat). */
  listingAspects?: ListingAspects | null;
  askPrice: number;
  /** ISO 4217 currency of the listing's ask price (e.g. "USD", "GBP"). The
   *  like-for-like CURRENCY gate (ADR-069 / the Moonbreon fix): the PokeTrace
   *  sold reference is USD, so a non-USD ask is NOT numerically comparable and
   *  must NOT be classified — a £1,000 (GBP) UK ask compared against a USD
   *  average was the false-deal class. Omitted/null → no currency gate (legacy
   *  callers + tests that pre-date the currency thread). */
  listingCurrency?: string | null;
  /** Pin a specific variant (the page's ?v= state). Cron leaves undefined →
   *  the reference resolver picks the most-traded variant. */
  selectedVariant?: string;
}): Promise<CardBuySignal> {
  // CURRENCY GATE (ADR-069). Refuse to classify a non-USD ask: the sold
  // reference is USD and a cross-currency comparison is apples-to-oranges (the
  // £1,000 LP/UK Moonbreon false deal). A missing/empty currency is treated as
  // "unknown, not non-USD" → fall through (back-compat); only an explicit
  // non-USD currency hard-stops to UNKNOWN.
  const currency = input.listingCurrency?.trim().toUpperCase();
  if (currency && currency !== "USD") {
    return {
      signal: {
        tier: "UNKNOWN",
        median: null,
        deltaPercent: null,
        sampleSize: 0,
        windowDays: 30,
        reason: `non-USD listing currency (${currency}) — not comparable to the USD sold reference`,
      },
      matchedTier: null,
    };
  }

  const inferred = inferListingCondition({ title: input.listingTitle, aspects: input.listingAspects });
  const matched = await resolveConditionMatchedReference(
    input.variants,
    input.selectedVariant,
    inferred.tier,
    inferred.gradeKey,
  );
  const signal = classifyConditionMatched({
    askPrice: input.askPrice,
    listingTier: inferred.tier,
    conditionReference: matched.conditionReference,
    conditionSampleSize: matched.conditionSampleSize,
    lowestRawReference: matched.lowestRawReference,
  });
  return { signal, matchedTier: matched.matchedTier };
}
