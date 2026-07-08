// Line-tracker sold-figure selection (content-trust-hotfix Defect 1).
//
// The ONE place that turns a card's SoldHistory into the single "sold for ~$X"
// figure baked into lib/lines/sold-snapshot.generated.json. Extracted from
// scripts/seed-line-sold.ts so the selection rule is unit-testable and so the
// /lines snapshot path finally obeys the ADR-104 freshness doctrine that the
// /cards hero already does (lib/cards/sold-coherence.ts::resolveSoldPanel).
//
// THE FIX: the generator used `avg30d ?? avg` — the `?? avg` is PokeTrace's
// ALL-TIME last sale, the exact anti-pattern ADR-104 forbids (a months-old
// outlier sale gets frozen into the committed snapshot and rendered as "sold
// recently"). We now select the FRESH WINDOWED value only (avg30d ?? median30d,
// gated on the tier's last sale being within SOLD_FRESHNESS_MAX_DAYS) and record
// the tier's `lastUpdated` as `soldAsOf` so the render can degrade a figure that
// has since gone stale to dated "last sold" framing. Null-over-guess: a card
// with no fresh windowed value bakes no figure (→ the honest pending state).

import type { SoldHistory, SoldSource } from "../poketrace/by-uuid.ts";
import { SOLD_SOURCES, freshWindowedValue } from "../cards/sold-coherence.ts";

// Headline tiers ONLY (ADR-095 accuracy moat): a card's canonical value is its
// NM (or LP) sold price. MP/HP/DMG are junk-copy prices. Never headline < LP.
const HEADLINE_TIERS = ["NEAR_MINT", "LIGHTLY_PLAYED"] as const;

/** A figure from fewer than this many sales isn't reliable "sold for ~$X". */
export const LINE_MIN_SALES = 3;
/** A sold figure more than this multiple ABOVE the baked TCGplayer market high
 *  (or a fraction BELOW the market low) is a data outlier (mis-parse / graded
 *  bleed) → suppressed to the pending state. */
export const LINE_MAX_OVER_MARKET = 4;
export const LINE_MIN_UNDER_MARKET = 0.15;

export type LineSoldNote = "low_sales" | "over_market" | "under_market";

export type LineSoldPick = {
  cents: number;
  saleCount: number;
  tierLabel: string;
  source: SoldSource;
  /** ISO date of the tier's most recent sale (the freshness anchor). */
  soldAsOf: string | null;
  /** When set, the caller suppresses this pick to the pending state. */
  note?: LineSoldNote;
};

/**
 * The single "recent sold" figure for a card's headline: NM first, then LP, over
 * ebay → tcgplayer → cardmarket. FRESH WINDOWED ONLY — never the all-time last
 * sale. Requires LINE_MIN_SALES and passes a TCGplayer sanity band, else it
 * carries a `note` the generator treats as suppression. `nowMs` anchors the
 * freshness check (pass the generation time).
 */
export function resolveLineSoldEntry(
  h: SoldHistory | null,
  opts: { tcgLowCents: number | null; tcgHighCents: number | null; nowMs: number },
): LineSoldPick | null {
  for (const tier of HEADLINE_TIERS) {
    const label = tier === "NEAR_MINT" ? "Near Mint" : "Lightly Played";
    for (const src of SOLD_SOURCES) {
      const s = h?.bySource[src]?.[tier];
      if (!s) continue;
      // Fresh windowed value only (avg30d ?? median30d, within the freshness
      // window). Returns null for a stale tier or a tier that only has an
      // all-time `avg` — exactly the figures the old `?? avg` fallback leaked.
      const v = freshWindowedValue(s, opts.nowMs);
      if (typeof v !== "number" || v <= 0) continue;
      const cents = Math.round(v * 100);
      const sales = s.saleCount ?? 0;
      const soldAsOf = s.lastUpdated ?? null;
      if (sales < LINE_MIN_SALES) return { cents, saleCount: sales, tierLabel: label, source: src, soldAsOf, note: "low_sales" };
      if (opts.tcgHighCents != null && cents > opts.tcgHighCents * LINE_MAX_OVER_MARKET)
        return { cents, saleCount: sales, tierLabel: label, source: src, soldAsOf, note: "over_market" };
      if (opts.tcgLowCents != null && opts.tcgLowCents > 0 && cents < opts.tcgLowCents * LINE_MIN_UNDER_MARKET)
        return { cents, saleCount: sales, tierLabel: label, source: src, soldAsOf, note: "under_market" };
      return { cents, saleCount: sales, tierLabel: label, source: src, soldAsOf };
    }
  }
  return null;
}
