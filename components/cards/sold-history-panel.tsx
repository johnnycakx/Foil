// SoldHistoryPanel — variant-aware sold prices (Session 49 / ADR-042), made
// honest by the sold-data-integrity goal (2026-07-03, xy4-122 incident).
//
// Server component. Given a card's PokeTrace variants, it fetches each
// variant's sold history, picks a default (most-traded), renders a variant
// selector (SSR-only ?v= chips), and shows the selected variant's figures —
// resolved through lib/cards/sold-coherence.ts, the ONE module allowed to turn
// a SoldHistory into renderable numbers.
//
// Honesty contract (null-over-guess extended to the data surface):
//   - A "30-day" figure renders ONLY from a fresh windowed value (avg30d /
//     median30d anchored within the freshness window). A tier whose last sale
//     is months old renders as "last recorded $X (date)", never as current.
//   - Sale counts are ALL-TIME counts and are labeled "sales on record"
//     (approx-marked). They are never summed into a fabricated windowed n.
//   - The "Any (Raw)" headline names the single tier it actually shows
//     (e.g. "Near Mint") — a pooled mixed-condition average never renders.
//   - A variant whose fresh data fails coherence (non-monotonic ladder,
//     cross-source divergence) renders the honest empty state instead of ANY
//     figures, and pings #errors ("sold-data suppressed: <slug>, reason").
//
// Graceful degradation: no variants → a muted footer; a variant with no
// PokeTrace data → the same honest empty state.

import { getSoldHistory } from "@/lib/poketrace/by-uuid";
import { getPriceHistory, chartTierForCondition } from "@/lib/poketrace/price-history";
import type { PoketraceVariant } from "@/lib/poketrace/variant";
import { ConditionPicker } from "@/components/cards/condition-picker";
import { DetailSection } from "@/components/cards/detail-section";
import { SoldHistoryChart } from "@/components/cards/sold-history-chart";
import { conditionToTier, conditionLabel, DEFAULT_CONDITION } from "@/lib/cards/conditions";
import {
  resolveSoldPanel,
  describeViolations,
  type SoldPanelModel,
  type SoldRowModel,
} from "@/lib/cards/sold-coherence";
// Variant selection + tier labels are shared with the card-page hero
// (lib/cards/sold-headline.ts) so the hero's one trust number and this
// panel's default selection can never disagree (card-page-vault-first goal).
import { pickSelectedVariant, tierLabel } from "@/lib/cards/sold-headline";
import { postError } from "@/lib/notifications/discord";

/** "2026-07-02T…" → "Jul 2, 2026". Deterministic (UTC) so SSR is stable. */
function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function money(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

/** All-time count rendered honestly: "~19" when PokeTrace marks it approximate. */
function countLabel(row: { saleCount: number | null; approxSaleCount: boolean }): string {
  if (row.saleCount == null) return "—";
  return `${row.approxSaleCount ? "~" : ""}${row.saleCount}`;
}

// Suppression pings are deduped in-process so a hot card page can't spam
// #errors on every render (soft-fail; a Discord outage never blocks a render).
const SUPPRESSION_PING_TTL_MS = 6 * 60 * 60 * 1000;
const suppressionPinged = new Map<string, number>();

function pingSuppression(slug: string, variantKey: string, model: SoldPanelModel): void {
  const webhook = process.env.DISCORD_WEBHOOK_ERRORS;
  if (!webhook) return;
  const key = `${slug}:${variantKey}`;
  const now = Date.now();
  const last = suppressionPinged.get(key);
  if (last && now - last < SUPPRESSION_PING_TTL_MS) return;
  suppressionPinged.set(key, now);
  void postError(webhook, {
    source: "sold-coherence",
    errorType: "sold-data-suppressed",
    message: `sold-data suppressed: ${slug} (${variantKey}) — ${describeViolations(model.violations)}`,
    context: { slug, variant: variantKey },
  }).catch(() => {});
}

function HonestEmptyState({ className }: { className?: string }) {
  return (
    <p className={`text-sm text-foil-cream/60 ${className ?? ""}`}>
      Sold data pending for this variant — we only show figures we can stand behind.
    </p>
  );
}

/** One value cell: fresh windowed → plain money; stale → dated last sale. */
function DisplayCell({ row }: { row: SoldRowModel }) {
  if (row.display.kind === "windowed") {
    return <span className="font-mono tabular-nums text-foil-cream">{money(row.display.value)}</span>;
  }
  return (
    <span className="font-mono text-[12px] tabular-nums text-foil-cream/60">
      last {money(row.display.value)} · {formatDate(row.display.atIso)}
    </span>
  );
}

export async function SoldHistoryPanel({
  slug,
  cardName,
  variants,
  hydratedSince,
  selectedKey,
  selectedCondition,
}: {
  slug: string;
  cardName: string;
  variants: PoketraceVariant[] | undefined;
  /** ISO timestamp when the card's variants were runtime-hydrated (ADR-092). */
  hydratedSince?: string | null;
  selectedKey?: string;
  /** ?c= condition token (Session 49b) — drives the reactive headline + chart. */
  selectedCondition?: string;
}) {
  if (!variants || variants.length === 0) {
    return (
      <section className="mt-6" aria-labelledby="sold-history-heading">
        <h2 id="sold-history-heading" className="text-sm font-semibold uppercase tracking-wider text-foil-accent">
          Recent sold prices
        </h2>
        <p className="mt-3 rounded-2xl border border-foil-cream/10 bg-foil-night-2 p-6 text-sm text-foil-cream/70">
          Live sold data not yet available for this card. Adding it to your
          vault (the button above) is what queues it for tracking.
        </p>
      </section>
    );
  }

  const nowMs = Date.now();
  const condition = selectedCondition ?? DEFAULT_CONDITION;
  const target = conditionToTier(condition);

  // Fetch every variant's history (typically 1–2; SWR-cached). Used both to
  // rank the default and to show per-chip quick stats.
  const histories = await Promise.all(variants.map((v) => getSoldHistory(v.poketraceId)));
  const pairs = variants.map((variant, i) => ({
    variant,
    history: histories[i],
    // Chip stats route through the same resolver — a suppressed/stale variant
    // never shows a junk mini-figure either.
    model: resolveSoldPanel(histories[i], { kind: "raw-agg" }, nowMs),
  }));

  // Selected variant: ?v= match, else the most-traded one. Shared with the
  // hero stat (pickSelectedVariant) so both surfaces show the same variant.
  const selected = pickSelectedVariant(pairs, selectedKey);

  const model = resolveSoldPanel(selected.history, target, nowMs);
  const anyData = model.rows.length > 0 || model.aggregatedRow != null || model.gradedRow != null;
  const suppressed = model.suppressed;
  // Ping #errors on ANY coherence violation — full suppression (ladder) and
  // tier-granular drops (cross-source dispute) both count.
  if (model.violations.length > 0) pingSuppression(slug, selected.variant.variantKey, model);

  const conditionSuffixBase = target.kind === "raw-agg" ? null : conditionLabel(condition);
  // The headline names the tier it actually shows — for "Any (Raw)" that's the
  // resolved tier (e.g. "Near Mint"), never a pooled blend.
  const headlineSuffix = model.headline
    ? tierLabel(model.headline.tierKey)
    : (conditionSuffixBase ?? "this condition");

  // Chart: plot the tier the headline actually shows; fall back to the
  // condition's canonical tier (ADR-044 behavior) when there's no headline.
  const chartTier = suppressed
    ? null
    : (model.headline?.tierKey ?? chartTierForCondition(condition, model.gradedRow?.tier ?? null));
  const chartSeries = chartTier
    ? await getPriceHistory({ uuid: selected.variant.poketraceId, tier: chartTier, period: "all" })
    : null;

  // Vault-first hierarchy: the sold panel is depth, OPEN by default (the
  // chart is the page's strongest supporting evidence) with the per-condition
  // table one level deeper, collapsed. All of it stays in the server DOM.
  return (
    <DetailSection title="Recent sold prices" headingId="sold-history-heading" open>
      <div>
        {/* Variant selector — SSR chips (links re-render with ?v=). */}
        {variants.length > 1 && (
          <div role="radiogroup" aria-label="Print variant" className="flex flex-wrap gap-2">
            {pairs.map(({ variant, model: chip }) => {
              const isSel = variant.variantKey === selected.variant.variantKey;
              const chipStat = chip.suppressed
                ? null
                : chip.headline
                  ? `${money(chip.headline.value)} · 30-day`
                  : chip.lastSale
                    ? `last ${money(chip.lastSale.value)}`
                    : null;
              return (
                <a
                  key={variant.variantKey}
                  href={`/cards/${slug}?v=${encodeURIComponent(variant.variantKey)}${selectedCondition ? `&c=${encodeURIComponent(selectedCondition)}` : ""}#sold-history-heading`}
                  role="radio"
                  aria-checked={isSel}
                  className={`flex flex-col rounded-xl border px-3 py-2 text-left transition ${
                    isSel
                      ? "border-foil-accent/50 bg-foil-accent/10 ring-1 ring-foil-accent/30"
                      : "border-foil-cream/15 bg-foil-night hover:border-foil-accent/40 hover:bg-foil-accent/5"
                  }`}
                >
                  <span className="text-sm font-semibold text-foil-cream">{variant.variantLabel}</span>
                  <span className="mt-0.5 font-mono text-[11px] tabular-nums text-foil-cream/60">
                    {chipStat ?? "no sold data"}
                  </span>
                </a>
              );
            })}
          </div>
        )}

        {/* Condition picker — drives the watchlist alert target (Session 49b /
            ADR-043). URL state (?c=), in sync with the form below. */}
        <ConditionPicker />

        {/* Figures — every number below passed the coherence gate. A variant
            whose fresh data is incoherent renders the honest empty state. */}
        {suppressed || !anyData ? (
          <HonestEmptyState className={variants.length > 1 ? "mt-6" : ""} />
        ) : (
          <div className={variants.length > 1 ? "mt-6" : ""}>
            {model.headline ? (
              <>
                <p className="text-xs uppercase tracking-wide text-foil-cream/60">
                  30-day sold avg · {selected.variant.variantLabel} · {headlineSuffix}
                </p>
                <p className="mt-1 flex items-baseline gap-3">
                  <span className="font-display text-4xl font-semibold tabular-nums text-foil-cream">
                    {money(model.headline.value)}
                  </span>
                  {model.headline.saleCount != null && (
                    <span className="text-sm text-foil-cream/60">
                      {countLabel(model.headline)} sales on record
                    </span>
                  )}
                </p>

                {/* Robinhood-style daily sold-price line for the shown tier —
                    real PokeTrace /prices/{tier}/history (ADR-044). */}
                <SoldHistoryChart series={chartSeries} />
              </>
            ) : (
              <p className="text-sm text-foil-cream/60">
                No sales in the last 30 days on record for {headlineSuffix}
                {model.lastSale ? (
                  <> — last recorded {money(model.lastSale.value)} ({formatDate(model.lastSale.atIso)})</>
                ) : (
                  <> — see all conditions below.</>
                )}
              </p>
            )}

            {/* Per-tier table. Fresh tiers show a true 30-day figure; stale
                tiers show their dated last sale; counts are all-time.
                Collapsed by default (vault-first: tables are depth); native
                <details> keeps every row in the server-rendered DOM. */}
            <details className="group/conditions mt-5">
              <summary className="flex cursor-pointer select-none list-none items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-foil-cream/60 outline-none transition hover:text-foil-cream focus-visible:ring-2 focus-visible:ring-foil-accent/40 [&::-webkit-details-marker]:hidden">
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className="h-3 w-3 shrink-0 transition-transform duration-200 ease-out group-open/conditions:rotate-90"
                >
                  <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Every condition &amp; grade
              </summary>
              <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-foil-cream/10 text-left text-[11px] uppercase tracking-wider text-foil-cream/60">
                  <th className="py-2 font-medium">Condition</th>
                  <th className="py-2 text-right font-medium">30-day avg</th>
                  <th className="py-2 text-right font-medium">Sales on record</th>
                </tr>
              </thead>
              <tbody>
                {model.rows.map((row) => (
                  <tr key={row.tier} className="border-b border-foil-cream/8">
                    <td className="py-2 text-foil-cream">{tierLabel(row.tier)}</td>
                    <td className="py-2 text-right">
                      <DisplayCell row={row} />
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-foil-cream/60">{countLabel(row)}</td>
                  </tr>
                ))}
                {/* EU/cardmarket-only cards have no per-condition tiers — show
                    the AGGREGATED market roll-up as a single row instead. */}
                {model.aggregatedRow && (
                  <tr key="AGGREGATED" className="border-b border-foil-cream/8">
                    <td className="py-2 text-foil-cream">Market average</td>
                    <td className="py-2 text-right">
                      <DisplayCell row={model.aggregatedRow} />
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-foil-cream/60">
                      {countLabel(model.aggregatedRow)}
                    </td>
                  </tr>
                )}
                {model.gradedRow && (
                  <tr key={model.gradedRow.tier} className="border-b border-foil-accent/20 bg-foil-accent/5">
                    <td className="py-2 font-medium text-foil-cream">{model.gradedRow.tier.replace(/_/g, " ")}</td>
                    <td className="py-2 text-right">
                      <DisplayCell row={model.gradedRow} />
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-foil-cream/60">
                      {countLabel(model.gradedRow)}
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </details>
            <p className="mt-4 text-[11px] uppercase tracking-wider text-foil-cream/60">
              Sold prices via PokeTrace · refreshed hourly · {cardName} actual completed sales, not active listings.
              {hydratedSince ? <> · Sold data tracked since {formatDate(hydratedSince)}.</> : null}
            </p>
          </div>
        )}
      </div>
    </DetailSection>
  );
}
