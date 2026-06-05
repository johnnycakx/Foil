// SoldHistoryPanel — variant-aware 30-day sold averages (Session 49 / ADR-042).
//
// Server component. Given a card's baked PokeTrace variants (one UUID per
// print edition/finish), it fetches each variant's sold history, picks a
// default (most-traded), renders a variant selector (SSR-only — chips are
// links that re-render with ?v=<key>), and shows the selected variant's
// 30-day sold average, 7-day trend, and a per-tier table.
//
// Sold *averages* (not live listings) come from PokeTrace via getSoldHistory
// (1h SWR cache). Live listings remain eBay-Browse-rendered elsewhere; this
// panel is the "what has it actually been selling for" reference layer.
//
// Graceful degradation: no variants → a muted footer; a variant with no
// PokeTrace data → "—" cells.

import { FoilCornerMark } from "@/components/brand/logo";
import { getSoldHistory, type SoldHistory, type SoldSource, type SoldStat } from "@/lib/poketrace/by-uuid";
import { getPriceHistory, chartTierForCondition } from "@/lib/poketrace/price-history";
import type { PoketraceVariant } from "@/lib/poketrace/variant";
import { ConditionPicker } from "@/components/cards/condition-picker";
import { SoldHistoryChart } from "@/components/cards/sold-history-chart";
import { conditionToTier, conditionLabel, RAW_POKETRACE_TIERS, DEFAULT_CONDITION } from "@/lib/cards/conditions";

const RAW_TIERS: ReadonlyArray<[key: string, label: string]> = [
  ["NEAR_MINT", "Near Mint"],
  ["LIGHTLY_PLAYED", "Lightly Played"],
  ["MODERATELY_PLAYED", "Moderately Played"],
  ["HEAVILY_PLAYED", "Heavily Played"],
  ["DAMAGED", "Damaged"],
];
const GRADED_PREFERENCE = ["PSA_10", "PSA_9", "BGS_10", "CGC_10"] as const;
// ebay/tcgplayer first (per-condition US tiers); cardmarket last — it carries
// the EU "AGGREGATED" roll-up for market-partitioned cards (Session 49.2).
const SOURCES: readonly SoldSource[] = ["ebay", "tcgplayer", "cardmarket"];

function money(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

/** First source that has a stat for `tier`. */
function statFor(history: SoldHistory | null, tier: string) {
  if (!history) return null;
  for (const src of SOURCES) {
    const s = history.bySource[src]?.[tier];
    if (s) return s;
  }
  return null;
}

/** A rough "how actively traded" score for ranking the default variant. */
function tradedScore(history: SoldHistory | null): number {
  if (!history) return 0;
  let score = 0;
  for (const src of SOURCES) {
    const tiers = history.bySource[src];
    if (!tiers) continue;
    for (const s of Object.values(tiers)) {
      const sales = s.saleCount ?? 0;
      const avg = s.avg30d ?? s.avg ?? 0;
      score += sales * avg;
    }
  }
  return score;
}

function pickGradedTier(history: SoldHistory | null): string | null {
  if (!history) return null;
  for (const t of GRADED_PREFERENCE) {
    if (statFor(history, t)) return t;
  }
  return null;
}

/** All distinct tier keys present across sources. */
function allTierKeys(history: SoldHistory | null): string[] {
  if (!history) return [];
  const keys = new Set<string>();
  for (const src of SOURCES) {
    for (const k of Object.keys(history.bySource[src] ?? {})) keys.add(k);
  }
  return [...keys];
}

/** saleCount-weighted aggregate across `tierKeys` (Session 49c). Weighted means
 *  NM dominates the raw aggregate naturally (it carries the most sales). Falls
 *  back to a simple mean when no sale counts are present. Returns null when no
 *  tier in the set has data. */
function aggregateStat(history: SoldHistory | null, tierKeys: readonly string[]): SoldStat | null {
  const stats = tierKeys.map((t) => statFor(history, t)).filter((s): s is SoldStat => s != null);
  if (stats.length === 0) return null;
  if (stats.length === 1) return stats[0];

  const weight = (s: SoldStat) => (s.saleCount && s.saleCount > 0 ? s.saleCount : 0);
  const totalW = stats.reduce((a, s) => a + weight(s), 0);

  const wavg = (pick: (s: SoldStat) => number | null): number | null => {
    let num = 0;
    let den = 0;
    for (const s of stats) {
      const v = pick(s);
      if (v == null) continue;
      const w = totalW > 0 ? weight(s) : 1; // unweighted fallback
      num += v * w;
      den += w;
    }
    return den > 0 ? num / den : null;
  };

  return {
    avg: wavg((s) => s.avg),
    low: Math.min(...stats.map((s) => s.low ?? Infinity).filter(Number.isFinite)) || null,
    high: Math.max(...stats.map((s) => s.high ?? -Infinity).filter(Number.isFinite)) || null,
    avg1d: wavg((s) => s.avg1d),
    avg7d: wavg((s) => s.avg7d),
    avg30d: wavg((s) => s.avg30d),
    saleCount: stats.reduce((a, s) => a + (s.saleCount ?? 0), 0) || null,
  };
}

/** Resolve the headline stat + a human suffix for the selected condition
 *  (the Session 49c bug fix: headline now reacts to ?c=). */
function resolveHeadline(
  history: SoldHistory | null,
  condition: string,
): { stat: SoldStat | null; suffix: string | null } {
  const res = conditionToTier(condition);
  if (res.kind === "tier") {
    return { stat: statFor(history, res.tier), suffix: conditionLabel(condition) };
  }
  if (res.kind === "graded-agg") {
    const graded = allTierKeys(history).filter(
      (k) => k !== "AGGREGATED" && !(RAW_POKETRACE_TIERS as readonly string[]).includes(k),
    );
    return { stat: aggregateStat(history, graded), suffix: "Graded" };
  }
  // raw-agg (default). EU/cardmarket-only cards have no raw tiers — fall back
  // to the AGGREGATED market roll-up so those still show a headline.
  const raw = aggregateStat(history, RAW_POKETRACE_TIERS);
  return { stat: raw ?? statFor(history, "AGGREGATED"), suffix: null };
}

export async function SoldHistoryPanel({
  slug,
  cardName,
  variants,
  selectedKey,
  selectedCondition,
}: {
  slug: string;
  cardName: string;
  variants: PoketraceVariant[] | undefined;
  selectedKey?: string;
  /** ?c= condition token (Session 49b plumbing) — drives the reactive headline
   *  + chart series (Session 49c bug fix). */
  selectedCondition?: string;
}) {
  if (!variants || variants.length === 0) {
    return (
      <section className="mt-10" aria-labelledby="sold-history-heading">
        <h2 id="sold-history-heading" className="text-sm font-semibold uppercase tracking-wider text-foil-gold">
          Recent sold prices
        </h2>
        <p className="mt-3 rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 text-sm text-foil-slate shadow-sm shadow-foil-navy/5">
          Live sold data not yet available for this card.
        </p>
      </section>
    );
  }

  // Fetch every variant's history (typically 1–2; SWR-cached). Used both to
  // rank the default and to show per-chip Low/Avg/High.
  const histories = await Promise.all(variants.map((v) => getSoldHistory(v.poketraceId)));
  const pairs = variants.map((variant, i) => ({ variant, history: histories[i] }));

  // Selected variant: ?v= match, else the most-traded one.
  const explicit = selectedKey ? pairs.find((p) => p.variant.variantKey === selectedKey) : undefined;
  const ranked = [...pairs].sort((a, b) => tradedScore(b.history) - tradedScore(a.history));
  const selected = explicit ?? ranked[0];

  const sel = selected.history;
  const hasRawTier = RAW_TIERS.some(([k]) => statFor(sel, k));
  const anyData = allTierKeys(sel).length > 0;
  // Session 49c bug fix: the headline + chart now REACT to the ?c= condition
  // picker (previously locked to NM regardless of selection).
  const condition = selectedCondition ?? DEFAULT_CONDITION;
  const { stat: headline, suffix: conditionSuffix } = resolveHeadline(sel, condition);
  const gradedTierKey = pickGradedTier(sel);
  // Real daily price history for the chart (Session 49c / ADR-044) — the
  // tier-scoped /prices/{tier}/history endpoint. Specific condition → its tier;
  // any-raw → NEAR_MINT; any-graded → the card's top graded tier. Fetch the
  // full series once; the chart slices it per range client-side. Soft-fails null.
  const chartTier = chartTierForCondition(condition, gradedTierKey);
  const chartSeries = chartTier
    ? await getPriceHistory({ uuid: selected.variant.poketraceId, tier: chartTier, period: "all" })
    : null;

  return (
    <section className="mt-10" aria-labelledby="sold-history-heading">
      <h2 id="sold-history-heading" className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foil-gold">
        <FoilCornerMark px={13} />
        Recent sold prices
      </h2>

      <div className="mt-4 rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-8">
        {/* Variant selector — SSR chips (links re-render with ?v=). */}
        {variants.length > 1 && (
          <div role="radiogroup" aria-label="Print variant" className="flex flex-wrap gap-2">
            {pairs.map(({ variant, history }) => {
              const isSel = variant.variantKey === selected.variant.variantKey;
              const nm = statFor(history, "NEAR_MINT") ?? statFor(history, RAW_TIERS.find(([k]) => statFor(history, k))?.[0] ?? "");
              return (
                <a
                  key={variant.variantKey}
                  href={`/cards/${slug}?v=${encodeURIComponent(variant.variantKey)}${selectedCondition ? `&c=${encodeURIComponent(selectedCondition)}` : ""}#sold-history-heading`}
                  role="radio"
                  aria-checked={isSel}
                  className={`flex flex-col rounded-xl border px-3 py-2 text-left transition ${
                    isSel
                      ? "border-foil-gold/50 bg-foil-gold/10 ring-1 ring-foil-gold/30"
                      : "border-foil-navy/15 bg-foil-cream hover:border-foil-gold/40 hover:bg-foil-gold/5"
                  }`}
                >
                  <span className="text-sm font-semibold text-foil-navy">{variant.variantLabel}</span>
                  <span className="mt-0.5 font-mono text-[11px] tabular-nums text-foil-slate">
                    {nm ? `${money(nm.low)} · ${money(nm.avg30d ?? nm.avg)} · ${money(nm.high)}` : "no sold data"}
                  </span>
                </a>
              );
            })}
          </div>
        )}

        {/* Condition picker — drives the watchlist alert target (Session 49b /
            ADR-043). URL state (?c=), in sync with the form below. */}
        <ConditionPicker />

        {/* Headline — reactive to the selected variant + condition (Session 49c).
            The table renders whenever the variant has ANY data; only the
            headline + chart depend on the SELECTED condition having data. */}
        {anyData ? (
          <div className={variants.length > 1 ? "mt-6" : ""}>
            <p className="text-xs uppercase tracking-wide text-foil-slate">
              30-day sold avg · {selected.variant.variantLabel}
              {conditionSuffix ? ` · ${conditionSuffix}` : ""}
            </p>
            {headline ? (
              <>
                <p className="mt-1 flex items-baseline gap-3">
                  <span className="font-display text-4xl font-semibold tabular-nums text-foil-navy">
                    {money(headline.avg30d ?? headline.avg)}
                  </span>
                  {headline.saleCount != null && (
                    <span className="text-sm text-foil-slate">n={headline.saleCount} sales</span>
                  )}
                </p>

                {/* Robinhood-style daily sold-price line for the selected
                    condition — real PokeTrace /prices/{tier}/history (ADR-044).
                    Replaces Session 49's static "↑ 7d" arrow. */}
                <SoldHistoryChart series={chartSeries} />
              </>
            ) : (
              <p className="mt-1 text-sm text-foil-slate">
                No recent sales recorded for {conditionSuffix ?? "this condition"} — see all conditions below.
              </p>
            )}

            {/* Per-tier table */}
            <table className="mt-5 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-foil-navy/10 text-left text-[11px] uppercase tracking-wider text-foil-slate">
                  <th className="py-2 font-medium">Condition</th>
                  <th className="py-2 text-right font-medium">30-day avg</th>
                  <th className="py-2 text-right font-medium">Sales</th>
                </tr>
              </thead>
              <tbody>
                {RAW_TIERS.map(([key, label]) => {
                  const s = statFor(sel, key);
                  if (!s) return null;
                  return (
                    <tr key={key} className="border-b border-foil-navy/5">
                      <td className="py-2 text-foil-navy">{label}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-foil-navy">{money(s.avg30d ?? s.avg)}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-foil-slate">{s.saleCount ?? "—"}</td>
                    </tr>
                  );
                })}
                {/* EU/cardmarket-only cards have no per-condition tiers — show
                    the AGGREGATED market roll-up as a single row instead. */}
                {!hasRawTier && (() => {
                  const s = statFor(sel, "AGGREGATED");
                  if (!s) return null;
                  return (
                    <tr key="AGGREGATED" className="border-b border-foil-navy/5">
                      <td className="py-2 text-foil-navy">Market average</td>
                      <td className="py-2 text-right font-mono tabular-nums text-foil-navy">{money(s.avg30d ?? s.avg)}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-foil-slate">{s.saleCount ?? "—"}</td>
                    </tr>
                  );
                })()}
                {gradedTierKey && (() => {
                  const s = statFor(sel, gradedTierKey);
                  if (!s) return null;
                  return (
                    <tr key={gradedTierKey} className="border-b border-foil-gold/20 bg-foil-gold/5">
                      <td className="py-2 font-medium text-foil-navy">{gradedTierKey.replace("_", " ")}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-foil-navy">{money(s.avg30d ?? s.avg)}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-foil-slate">{s.saleCount ?? "—"}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
            <p className="mt-4 text-[11px] uppercase tracking-wider text-foil-slate">
              Sold averages via PokeTrace · refreshed hourly · {cardName} actual completed sales, not active listings.
            </p>
          </div>
        ) : (
          <p className={`text-sm text-foil-slate ${variants.length > 1 ? "mt-6" : ""}`}>
            Live sold data not yet available for this variant.
          </p>
        )}
      </div>
    </section>
  );
}
