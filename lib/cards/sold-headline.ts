// Sold headline selection — shared by the card-page hero and the
// SoldHistoryPanel (card-page-vault-first goal, 2026-07-03).
//
// The vault-first hero leads with ONE trust number: the 30-day sold average
// for the card's most-traded variant. That number must be EXACTLY the number
// the sold panel below shows for its default selection, or the page argues
// with itself. This module owns the selection logic (traded-score ranking +
// explicit ?v= override) so both surfaces consume the same choice by
// construction instead of by parallel implementations.
//
// Honesty contract: everything routes through resolveSoldPanel
// (lib/cards/sold-coherence.ts). A suppressed or headline-less model yields
// null here, and the hero renders the honest pending line, never a figure.

import { getSoldHistory, type SoldHistory } from "@/lib/poketrace/by-uuid";
import type { PoketraceVariant } from "@/lib/poketrace/variant";
import { conditionToTier, DEFAULT_CONDITION } from "@/lib/cards/conditions";
import {
  resolveSoldPanel,
  windowedValue,
  SOLD_SOURCES,
} from "@/lib/cards/sold-coherence";

/** Human labels for the raw PokeTrace tiers a headline can name. */
const RAW_TIER_LABELS: Record<string, string> = {
  NEAR_MINT: "Near Mint",
  LIGHTLY_PLAYED: "Lightly Played",
  MODERATELY_PLAYED: "Moderately Played",
  HEAVILY_PLAYED: "Heavily Played",
  DAMAGED: "Damaged",
  // EU/cardmarket-only cards headline their AGGREGATED market roll-up.
  AGGREGATED: "Market average",
};

export function tierLabel(tierKey: string): string {
  return RAW_TIER_LABELS[tierKey] ?? tierKey.replace(/_/g, " ");
}

/** A rough "how actively traded" score for ranking the default variant. */
export function tradedScore(history: SoldHistory | null): number {
  if (!history) return 0;
  let score = 0;
  for (const src of SOLD_SOURCES) {
    const tiers = history.bySource[src];
    if (!tiers) continue;
    for (const s of Object.values(tiers)) {
      score += (s.saleCount ?? 0) * (windowedValue(s) ?? s.avg ?? 0);
    }
  }
  return score;
}

/** Selected variant: the explicit ?v= match when present, else most-traded. */
export function pickSelectedVariant<T extends { variant: PoketraceVariant; history: SoldHistory | null }>(
  pairs: readonly T[],
  selectedKey?: string,
): T {
  const explicit = selectedKey ? pairs.find((p) => p.variant.variantKey === selectedKey) : undefined;
  if (explicit) return explicit;
  const ranked = [...pairs].sort((a, b) => tradedScore(b.history) - tradedScore(a.history));
  return ranked[0];
}

export type HeroSoldStat = {
  /** Fresh windowed 30-day value (already coherence-gated). */
  value: number;
  /** All-time sales on record (approx-marked when PokeTrace says so). */
  saleCount: number | null;
  approxSaleCount: boolean;
  /** Human label of the tier the value actually describes (never a blend). */
  tierLabel: string;
  /** The variant the figure belongs to ("Holofoil", …). */
  variantLabel: string;
};

/**
 * The hero's one trust number, or null when we have nothing we can stand
 * behind (no variants, suppressed panel, or no fresh windowed figure).
 * getSoldHistory is in-process SWR-cached, so the SoldHistoryPanel's own
 * fetch of the same UUIDs in the same render costs no extra network call.
 */
export async function getHeroSoldStat(
  variants: readonly PoketraceVariant[] | undefined,
  selectedKey: string | undefined,
  selectedCondition: string | undefined,
  nowMs: number,
): Promise<HeroSoldStat | null> {
  if (!variants || variants.length === 0) return null;
  const histories = await Promise.all(variants.map((v) => getSoldHistory(v.poketraceId)));
  const pairs = variants.map((variant, i) => ({ variant, history: histories[i] }));
  const selected = pickSelectedVariant(pairs, selectedKey);
  const target = conditionToTier(selectedCondition ?? DEFAULT_CONDITION);
  const model = resolveSoldPanel(selected.history, target, nowMs);
  if (model.suppressed || !model.headline) return null;
  return {
    value: model.headline.value,
    saleCount: model.headline.saleCount,
    approxSaleCount: model.headline.approxSaleCount,
    tierLabel: tierLabel(model.headline.tierKey),
    variantLabel: selected.variant.variantLabel,
  };
}
