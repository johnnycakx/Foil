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
