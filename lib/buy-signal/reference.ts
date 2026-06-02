// Buy-signal reference resolver (ROADMAP #32 / ADR-053).
//
// The buy-signal badge on a card page needs a single "what has it recently sold
// for" number plus the sale count behind it. That is exactly the raw-condition,
// saleCount-weighted 30-day average the SoldHistoryPanel headlines. This module
// computes the same reference at the page level so the page can classify the
// live ask against it, WITHOUT re-implementing the panel's rendering.
//
// Honesty note (see /pricing-methodology): the reference is a 30-day AVERAGE,
// not a median. The pure median classifier in compute.ts is ready for the day a
// per-sale feed exists; today the wiring feeds the aggregate average.
//
// I-008 guard: the raw tier set is imported from lib/cards/conditions
// (RAW_POKETRACE_TIERS) — the same constant the panel uses — so the comparison
// universe can never silently drift between the two surfaces.

import { getSoldHistory, type SoldHistory, type SoldStat, type SoldSource } from "../poketrace/by-uuid.ts";
import type { PoketraceVariant } from "../poketrace/variant.ts";
import { RAW_POKETRACE_TIERS } from "../cards/conditions.ts";
import type { ListingConditionTier } from "./condition-infer.ts";

// ebay/tcgplayer first (per-condition US tiers); cardmarket last (EU AGGREGATED
// roll-up). Mirrors SoldHistoryPanel's SOURCES order.
const SOURCES: readonly SoldSource[] = ["ebay", "tcgplayer", "cardmarket"];

/** First source carrying a stat for `tier`. Mirrors the panel's statFor. */
function statFor(history: SoldHistory | null, tier: string): SoldStat | null {
  if (!history) return null;
  for (const src of SOURCES) {
    const s = history.bySource[src]?.[tier];
    if (s) return s;
  }
  return null;
}

/** "How actively traded" score for ranking the default variant (panel parity). */
function tradedScore(history: SoldHistory | null): number {
  if (!history) return 0;
  let score = 0;
  for (const src of SOURCES) {
    const tiers = history.bySource[src];
    if (!tiers) continue;
    for (const s of Object.values(tiers)) {
      score += (s.saleCount ?? 0) * (s.avg30d ?? s.avg ?? 0);
    }
  }
  return score;
}

export type SoldReference = {
  /** saleCount-weighted 30-day average across raw tiers; null if none priced. */
  reference: number | null;
  /** Total comparable raw sales in the window — the buy-signal sample size. */
  sampleSize: number;
};

/**
 * Pure: the raw-condition, saleCount-weighted 30-day average + total sale count
 * for one variant's sold history. Graded slabs are excluded by construction (we
 * only walk RAW_POKETRACE_TIERS), satisfying the condition-filter requirement.
 */
export function rawReferenceFromHistory(history: SoldHistory | null): SoldReference {
  const stats = RAW_POKETRACE_TIERS
    .map((t) => statFor(history, t))
    .filter((s): s is SoldStat => s != null);

  let weightedNum = 0;
  let weightDen = 0;
  let sampleSize = 0;
  for (const s of stats) {
    const v = s.avg30d ?? s.avg;
    const w = s.saleCount && s.saleCount > 0 ? s.saleCount : 0;
    sampleSize += s.saleCount ?? 0;
    if (v == null) continue;
    // Weight by sale count so NM (the busiest tier) dominates naturally; fall
    // back to an equal weight for a tier that priced but reported no count.
    const weight = w > 0 ? w : 1;
    weightedNum += v * weight;
    weightDen += weight;
  }

  return {
    reference: weightDen > 0 ? weightedNum / weightDen : null,
    sampleSize,
  };
}

/**
 * Fetch the card's variant histories, pick the same default variant the
 * SoldHistoryPanel shows (?v= match, else most-traded), and return its raw
 * reference. Soft-fails to a zero-sample reference (badge renders UNKNOWN → null
 * on a thin/absent sample) so a PokeTrace outage never breaks the card page.
 */
export async function resolveSoldReference(
  variants: PoketraceVariant[] | undefined,
  selectedKey?: string,
): Promise<SoldReference> {
  if (!variants || variants.length === 0) return { reference: null, sampleSize: 0 };
  try {
    const histories = await Promise.all(variants.map((v) => getSoldHistory(v.poketraceId)));
    const pairs = variants.map((variant, i) => ({ variant, history: histories[i] }));
    const explicit = selectedKey ? pairs.find((p) => p.variant.variantKey === selectedKey) : undefined;
    const ranked = [...pairs].sort((a, b) => tradedScore(b.history) - tradedScore(a.history));
    const selected = explicit ?? ranked[0];
    return rawReferenceFromHistory(selected.history);
  } catch {
    return { reference: null, sampleSize: 0 };
  }
}

// --- Condition-matched reference (ROADMAP #32.1 / ADR-053 / PATTERN I-009) ---

/** Inferred listing tier → PokeTrace raw tier key. GRADED/UNKNOWN handled out of band. */
const LISTING_TIER_TO_POKETRACE: Record<"NM" | "LP" | "MP" | "HP" | "DMG", string> = {
  NM: "NEAR_MINT",
  LP: "LIGHTLY_PLAYED",
  MP: "MODERATELY_PLAYED",
  HP: "HEAVILY_PLAYED",
  DMG: "DAMAGED",
};

const stat30d = (s: SoldStat | null): number | null => (s ? (s.avg30d ?? s.avg) : null);

export type ConditionMatchedReference = {
  /** 30-day sold avg for the tier that matches the listing's inferred condition.
   *  null means "no comparable data for that tier" → caller emits UNKNOWN.
   *  We NEVER fall back to a different tier; that mismatch is the I-009 bug. */
  conditionReference: number | null;
  conditionSampleSize: number;
  /** The PokeTrace tier key we matched against (for UI/telemetry/honesty). */
  matchedTier: string | null;
  /** Lowest 30-day avg across present raw tiers — the floor for the outlier guard. */
  lowestRawReference: number | null;
  lowestRawTier: string | null;
};

const EMPTY_MATCH: ConditionMatchedReference = {
  conditionReference: null,
  conditionSampleSize: 0,
  matchedTier: null,
  lowestRawReference: null,
  lowestRawTier: null,
};

/** Lowest present raw-tier 30-day avg (+ its key). null when no raw tier priced. */
export function lowestRawReferenceFromHistory(history: SoldHistory | null): { reference: number | null; tier: string | null } {
  let lowest: number | null = null;
  let lowestTier: string | null = null;
  for (const t of RAW_POKETRACE_TIERS) {
    const v = stat30d(statFor(history, t));
    if (v == null || v <= 0) continue;
    if (lowest == null || v < lowest) {
      lowest = v;
      lowestTier = t;
    }
  }
  return { reference: lowest, tier: lowestTier };
}

/**
 * Pure: resolve the reference for the listing's inferred condition tier from one
 * variant's history. GRADED matches the SPECIFIC grade tier (e.g. PSA_9 vs
 * PSA_9, never a PSA-10-inflated blend — ROADMAP #32.3 / PATTERN I-009); a
 * graded listing with no specific `gradeKey` (a bare grade with no service)
 * resolves to UNKNOWN rather than a blended fallback. Raw tiers match exactly.
 * Returns conditionReference: null on any mismatch so the caller emits UNKNOWN
 * instead of comparing across conditions.
 */
export function conditionMatchedReferenceFromHistory(
  history: SoldHistory | null,
  listingTier: ListingConditionTier,
  gradeKey?: string,
): ConditionMatchedReference {
  const lowest = lowestRawReferenceFromHistory(history);
  const base: ConditionMatchedReference = {
    ...EMPTY_MATCH,
    lowestRawReference: lowest.reference,
    lowestRawTier: lowest.tier,
  };

  // No history, or the listing condition couldn't be inferred → no matched
  // reference (the caller emits UNKNOWN). We still surface lowestRaw for the
  // outlier guard when available.
  if (!history || listingTier === "UNKNOWN") return base;

  if (listingTier === "GRADED") {
    // Grade-SPECIFIC: compare a PSA 9 ask against PSA_9 sold, not a blend.
    // No gradeKey (bare grade, no service) or no data for that exact grade →
    // UNKNOWN. We deliberately do NOT fall back to a blended graded average —
    // that cross-grade blend was the #32.3 false-BELOW bug.
    if (!gradeKey) return base;
    const s = statFor(history, gradeKey);
    const v = stat30d(s);
    if (v == null || v <= 0) return base;
    return { ...base, conditionReference: v, conditionSampleSize: s?.saleCount ?? 0, matchedTier: gradeKey };
  }

  const key = LISTING_TIER_TO_POKETRACE[listingTier];
  const s = statFor(history, key);
  const v = stat30d(s);
  if (v == null || v <= 0) return base;
  return { ...base, conditionReference: v, conditionSampleSize: s?.saleCount ?? 0, matchedTier: key };
}

/**
 * Fetch histories, pick the same default variant the panel shows, and resolve
 * the condition-matched reference for the listing's inferred tier. Soft-fails to
 * EMPTY_MATCH (→ UNKNOWN signal) on outage.
 */
export async function resolveConditionMatchedReference(
  variants: PoketraceVariant[] | undefined,
  selectedKey: string | undefined,
  listingTier: ListingConditionTier,
  gradeKey?: string,
): Promise<ConditionMatchedReference> {
  if (!variants || variants.length === 0) return EMPTY_MATCH;
  try {
    const histories = await Promise.all(variants.map((v) => getSoldHistory(v.poketraceId)));
    const pairs = variants.map((variant, i) => ({ variant, history: histories[i] }));
    const explicit = selectedKey ? pairs.find((p) => p.variant.variantKey === selectedKey) : undefined;
    const ranked = [...pairs].sort((a, b) => tradedScore(b.history) - tradedScore(a.history));
    const selected = explicit ?? ranked[0];
    return conditionMatchedReferenceFromHistory(selected.history, listingTier, gradeKey);
  } catch {
    return EMPTY_MATCH;
  }
}
