// Sold-data coherence + honest display resolution (sold-data-integrity goal).
//
// Born from the 2026-07-03 xy4-122 Dialga-EX incident: the card page rendered
// "30-DAY SOLD AVG $391 · n=63 sales" for a low-liquidity 2014 secret rare
// that had THREE raw sales in the actual last 30 days. Root cause (H3, our
// rollup — verified against live /cards/{uuid} + /cards/{uuid}/listings):
//   1. PokeTrace's per-tier `saleCount` is an ALL-TIME count (records span
//      2021→2026), and we summed it across tiers under a "30-day" label.
//   2. PokeTrace's `avg30d` is anchored to the tier's `lastUpdated` (its most
//      recent sale), NOT to today — a tier whose last sale was in January
//      still carries an avg30d, and we rendered it as current.
//   3. The pooled "any-raw" headline weighted avg30d across mixed condition
//      tiers by all-time counts, excluding tiers whose avg30d was null while
//      still counting their sales in n.
//   4. `lastUpdated`/`approxSaleCount` were dropped at parse, so none of this
//      was visible to the render.
// Secondary (H2, upstream): PokeTrace pools other-language printings (e.g.
// Brazilian Portuguese) into the English card's tiers — filed upstream; the
// coherence gate below is our render-side defense.
//
// This module is the ONE place that turns a SoldHistory into figures a page
// may render. Doctrine: null-over-guess extended to the data surface — a
// number we can't stand behind renders as the honest empty state, never as a
// number (same doctrine as vision and alerts).
//
// Calibration note (John, L4 seller): the catalog is top-5 chase cards per
// set, so extreme absolute prices and huge graded/raw multipliers are often
// LEGITIMATE (vintage PSA 10s run 100x+ raw NM). We deliberately do NOT flag
// magnitude. We flag INCOHERENCE only:
//   - a non-monotonic raw condition ladder (worse condition selling above a
//     better one, beyond noise tolerance, on fresh windowed values), and
//   - cross-source divergence on the same printing + tier (two sources both
//     fresh on the SAME tier disagreeing wildly = mixed populations).
// Thresholds were picked from the 2026-07-03 coherence scan's distribution
// across the belt pool + curated set (docs/goals/_results/
// sold-coherence-scan.md) so no legit grail gets suppressed.

import type { SoldHistory, SoldSource, SoldStat } from "../poketrace/by-uuid.ts";
import { RAW_POKETRACE_TIERS } from "./conditions.ts";

// ebay/tcgplayer first (per-condition US tiers); cardmarket last (EU
// AGGREGATED roll-up). The one source-order constant every sold surface uses.
export const SOLD_SOURCES: readonly SoldSource[] = ["ebay", "tcgplayer", "cardmarket"];

/** A windowed stat older than this (days since the tier's last recorded sale)
 *  may not be rendered as a "30-day" figure. 30-day window + 5 days grace. */
export const SOLD_FRESHNESS_MAX_DAYS = 35;

/** Ladder tolerance: a worse condition's fresh windowed value may exceed a
 *  better condition's by up to this factor before the ladder is incoherent
 *  (thin windows are noisy; a 2x inversion is a mixed-population signature). */
export const LADDER_TOLERANCE = 1.5;

/** Cross-source tolerance: when two sources are BOTH fresh on the same tier,
 *  max/min beyond this factor means they're describing different populations. */
export const CROSS_SOURCE_RATIO_MAX = 2.5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Graded headline/row preference (panel parity, freshness applied first). */
export const GRADED_PREFERENCE = ["PSA_10", "PSA_9", "BGS_10", "CGC_10"] as const;

export type TierStat = { stat: SoldStat; source: SoldSource };

/** First source carrying a stat for `tier` (the shared statFor). */
export function statFor(history: SoldHistory | null, tier: string): TierStat | null {
  if (!history) return null;
  for (const source of SOLD_SOURCES) {
    const stat = history.bySource[source]?.[tier];
    if (stat) return { stat, source };
  }
  return null;
}

/** All distinct tier keys present across sources. */
export function allTierKeys(history: SoldHistory | null): string[] {
  if (!history) return [];
  const keys = new Set<string>();
  for (const source of SOLD_SOURCES) {
    for (const k of Object.keys(history.bySource[source] ?? {})) keys.add(k);
  }
  return [...keys];
}

/** Is the stat's most recent sale within the freshness window of `nowMs`? */
export function isFreshStat(stat: SoldStat, nowMs: number): boolean {
  if (!stat.lastUpdated) return false;
  const t = Date.parse(stat.lastUpdated);
  if (!Number.isFinite(t)) return false;
  return nowMs - t <= SOLD_FRESHNESS_MAX_DAYS * DAY_MS;
}

/** The tier's windowed sold value. avg30d, else median30d (PokeTrace leaves
 *  avg30d null when the window holds a single sale). Never falls back to
 *  `avg` — that's the LAST SALE, not a window. */
export function windowedValue(stat: SoldStat): number | null {
  return stat.avg30d ?? stat.median30d;
}

/** What a surface may show for this tier right now. BOTH kinds carry their
 *  date: a windowed figure is a claim about a moment too (its window is
 *  anchored to `lastUpdated`, not to today), and rendering it undated was the
 *  2026-07-14 audit's central defect. See lib/cards/comp-age.ts. */
export type SoldDisplay =
  | { kind: "windowed"; value: number; asOfIso: string }
  | { kind: "last-sale"; value: number; atIso: string };

/** Resolve a tier stat to its honest display: a fresh windowed value renders
 *  as a 30-day figure; anything else degrades to "last recorded sale" (with
 *  its date), or nothing. */
export function displayFor(stat: SoldStat, nowMs: number): SoldDisplay | null {
  const windowed = windowedValue(stat);
  // isFreshStat is only true for a parseable, non-null lastUpdated, so the
  // windowed branch always has a date to carry — the `??` never fires, it just
  // proves to the type system what the freshness gate already guaranteed.
  if (windowed != null && isFreshStat(stat, nowMs)) {
    return { kind: "windowed", value: windowed, asOfIso: stat.lastUpdated ?? "" };
  }
  if (stat.avg != null && stat.lastUpdated) return { kind: "last-sale", value: stat.avg, atIso: stat.lastUpdated };
  return null;
}

/** Fresh windowed value or null — the only basis a computation (buy signal,
 *  alert floor, mover) may use. */
export function freshWindowedValue(stat: SoldStat | null | undefined, nowMs: number): number | null {
  if (!stat || !isFreshStat(stat, nowMs)) return null;
  return windowedValue(stat);
}

// ---------------------------------------------------------------------------
// Coherence checks
// ---------------------------------------------------------------------------

export type CoherenceViolation =
  | { kind: "ladder"; betterTier: string; betterValue: number; worseTier: string; worseValue: number }
  | { kind: "cross-source"; tier: string; ratio: number; values: Array<{ source: SoldSource; value: number }> };

/** Non-monotonic raw ladder on FRESH windowed values: any worse condition
 *  priced above a better one beyond LADDER_TOLERANCE. Stale tiers don't
 *  participate — they render as dated last-sales and make no windowed claim.
 *  `excludeTiers` (cross-source-disputed tiers, already dropped) don't either. */
export function ladderViolations(
  history: SoldHistory | null,
  nowMs: number,
  excludeTiers?: ReadonlySet<string>,
): CoherenceViolation[] {
  const fresh: Array<{ tier: string; value: number }> = [];
  for (const tier of RAW_POKETRACE_TIERS) {
    if (excludeTiers?.has(tier)) continue;
    const found = statFor(history, tier);
    if (!found) continue;
    const value = freshWindowedValue(found.stat, nowMs);
    if (value != null && value > 0) fresh.push({ tier, value });
  }
  const out: CoherenceViolation[] = [];
  for (let i = 0; i < fresh.length; i++) {
    for (let j = i + 1; j < fresh.length; j++) {
      // fresh[] is in NM→DMG order: i is the better condition.
      if (fresh[j].value > fresh[i].value * LADDER_TOLERANCE) {
        out.push({
          kind: "ladder",
          betterTier: fresh[i].tier,
          betterValue: fresh[i].value,
          worseTier: fresh[j].tier,
          worseValue: fresh[j].value,
        });
      }
    }
  }
  return out;
}

/** Same tier, two+ sources both fresh, disagreeing beyond
 *  CROSS_SOURCE_RATIO_MAX — the same-printing divergence signature. */
export function crossSourceViolations(history: SoldHistory | null, nowMs: number): CoherenceViolation[] {
  if (!history) return [];
  const out: CoherenceViolation[] = [];
  for (const tier of RAW_POKETRACE_TIERS) {
    const values: Array<{ source: SoldSource; value: number }> = [];
    for (const source of SOLD_SOURCES) {
      const stat = history.bySource[source]?.[tier];
      if (!stat) continue;
      const value = freshWindowedValue(stat, nowMs);
      if (value != null && value > 0) values.push({ source, value });
    }
    if (values.length < 2) continue;
    const max = Math.max(...values.map((v) => v.value));
    const min = Math.min(...values.map((v) => v.value));
    const ratio = max / min;
    if (ratio > CROSS_SOURCE_RATIO_MAX) out.push({ kind: "cross-source", tier, ratio, values });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Panel model — the one resolver the sold-history surface renders from.
// ---------------------------------------------------------------------------

export type SoldRowModel = {
  tier: string;
  display: SoldDisplay;
  /** All-time sales on record (approx-marked when PokeTrace says so). */
  saleCount: number | null;
  approxSaleCount: boolean;
  source: SoldSource;
};

export type SoldHeadlineModel = {
  /** The tier actually shown — the label must name it (never a pooled blend). */
  tierKey: string;
  value: number;
  saleCount: number | null;
  approxSaleCount: boolean;
  /** WHEN this figure's window closed (the tier's most recent recorded sale).
   *  Non-optional on purpose: a headline that cannot say when it is true may
   *  not render. Surfaces pass it through lib/cards/comp-age.ts. */
  asOfIso: string;
};

export type SoldPanelModel = {
  /** True → the page renders the honest empty state instead of ANY figures.
   *  Set by ladder incoherence (the mixed-population signature implicates the
   *  whole raw section). Cross-source disputes are handled at tier
   *  granularity instead: the disputed tier is dropped (we can't arbitrate
   *  which source is wrong — null-over-guess), the rest of the panel stands. */
  suppressed: boolean;
  violations: CoherenceViolation[];
  /** Raw tiers dropped for cross-source dispute (never rendered, even as
   *  last-sales — the data is contested, not merely stale). */
  disputedTiers: string[];
  /** Fresh windowed headline for the selected condition, or null (the panel
   *  then renders the no-recent-sales line, with lastSale when known). */
  headline: SoldHeadlineModel | null;
  /** Most recent last-sale info for the selected condition when no headline. */
  lastSale: { tierKey: string; value: number; atIso: string } | null;
  rows: SoldRowModel[];
  /** EU/cardmarket AGGREGATED fallback row (only when no raw tier renders). */
  aggregatedRow: SoldRowModel | null;
  /** Graded reference row (freshest preferred grade). */
  gradedRow: SoldRowModel | null;
};

function rowFor(history: SoldHistory | null, tier: string, nowMs: number): SoldRowModel | null {
  const found = statFor(history, tier);
  if (!found) return null;
  const display = displayFor(found.stat, nowMs);
  if (!display) return null;
  return {
    tier,
    display,
    saleCount: found.stat.saleCount,
    approxSaleCount: found.stat.approxSaleCount,
    source: found.source,
  };
}

function headlineFromRow(row: SoldRowModel | null): SoldHeadlineModel | null {
  if (!row || row.display.kind !== "windowed") return null;
  // An undated windowed figure is not a headline we may stand behind — null it
  // rather than render a number that cannot say when it was true. In practice
  // the freshness gate makes this unreachable; it is the belt to that braces.
  if (!row.display.asOfIso) return null;
  return {
    tierKey: row.tier,
    value: row.display.value,
    saleCount: row.saleCount,
    approxSaleCount: row.approxSaleCount,
    asOfIso: row.display.asOfIso,
  };
}

function lastSaleFromRow(row: SoldRowModel | null): SoldPanelModel["lastSale"] {
  if (!row || row.display.kind !== "last-sale") return null;
  return { tierKey: row.tier, value: row.display.value, atIso: row.display.atIso };
}

/** Graded tiers present, GRADED_PREFERENCE first, then the rest by all-time
 *  sale count (a proxy for "the grade this card actually trades in"). */
function gradedTierOrder(history: SoldHistory | null): string[] {
  const graded = allTierKeys(history).filter(
    (k) => k !== "AGGREGATED" && !(RAW_POKETRACE_TIERS as readonly string[]).includes(k),
  );
  const preferred = GRADED_PREFERENCE.filter((k) => graded.includes(k));
  const rest = graded
    .filter((k) => !(GRADED_PREFERENCE as readonly string[]).includes(k))
    .sort((a, b) => (statFor(history, b)?.stat.saleCount ?? 0) - (statFor(history, a)?.stat.saleCount ?? 0));
  return [...preferred, ...rest];
}

/** First tier in `order` with a FRESH windowed display; else the most recently
 *  updated last-sale row; else null. */
function bestRow(history: SoldHistory | null, order: readonly string[], nowMs: number): SoldRowModel | null {
  const rows = order.map((t) => rowFor(history, t, nowMs)).filter((r): r is SoldRowModel => r != null);
  const windowed = rows.find((r) => r.display.kind === "windowed");
  if (windowed) return windowed;
  let latest: SoldRowModel | null = null;
  for (const r of rows) {
    if (r.display.kind !== "last-sale") continue;
    if (!latest || r.display.atIso > (latest.display as { atIso: string }).atIso) latest = r;
  }
  return latest;
}

/** Resolution input: which tier(s) the selected condition targets. Mirrors
 *  lib/cards/conditions.ts conditionToTier — passed in resolved so this module
 *  stays independent of the token set. */
export type HeadlineTarget =
  | { kind: "tier"; tier: string }
  | { kind: "raw-agg" }
  | { kind: "graded-agg" };

/**
 * The one resolver: SoldHistory → what the panel may render.
 *
 * - Headline: the selected tier's fresh windowed value; "any raw" resolves to
 *   the best-condition raw tier with fresh data (labeled with THAT tier — a
 *   pooled mixed-condition average is never rendered); "any graded" to the
 *   freshest preferred grade.
 * - Rows: per raw tier, fresh windowed value or a dated last-sale.
 * - Coherence: ladder + cross-source violations on fresh windowed values →
 *   suppressed=true and the page renders the honest empty state.
 */
export function resolveSoldPanel(
  history: SoldHistory | null,
  target: HeadlineTarget,
  nowMs: number,
): SoldPanelModel {
  // Tier-granular first: a cross-source dispute drops THAT tier entirely.
  const crossViolations = crossSourceViolations(history, nowMs);
  const disputed = new Set(crossViolations.map((v) => (v.kind === "cross-source" ? v.tier : "")));
  disputed.delete("");

  // Panel-granular second: a ladder inversion among the SURVIVING fresh tiers
  // implicates the whole raw section (mixed populations) → suppress all figures.
  const ladder = ladderViolations(history, nowMs, disputed);
  const violations = [...ladder, ...crossViolations];

  const undisputedRawTiers = RAW_POKETRACE_TIERS.filter((t) => !disputed.has(t));
  const rows = undisputedRawTiers
    .map((t) => rowFor(history, t, nowMs))
    .filter((r): r is SoldRowModel => r != null);

  const aggregatedRow = rows.length === 0 ? rowFor(history, "AGGREGATED", nowMs) : null;
  const gradedRow = bestRow(history, gradedTierOrder(history), nowMs);

  let headlineRow: SoldRowModel | null = null;
  if (target.kind === "tier") {
    headlineRow = disputed.has(target.tier) ? null : rowFor(history, target.tier, nowMs);
  } else if (target.kind === "graded-agg") {
    headlineRow = gradedRow;
  } else {
    headlineRow = bestRow(history, undisputedRawTiers, nowMs) ?? aggregatedRow;
  }

  return {
    suppressed: ladder.length > 0,
    violations,
    disputedTiers: [...disputed],
    headline: headlineFromRow(headlineRow),
    lastSale: lastSaleFromRow(headlineRow),
    rows,
    aggregatedRow,
    gradedRow,
  };
}

/** Human-readable reason string for the #errors suppression ping. */
export function describeViolations(violations: CoherenceViolation[]): string {
  return violations
    .map((v) =>
      v.kind === "ladder"
        ? `ladder: ${v.worseTier} $${v.worseValue.toFixed(0)} > ${v.betterTier} $${v.betterValue.toFixed(0)}`
        : `cross-source ${v.tier}: ${v.values.map((x) => `${x.source} $${x.value.toFixed(0)}`).join(" vs ")} (${v.ratio.toFixed(1)}x)`,
    )
    .join("; ");
}
