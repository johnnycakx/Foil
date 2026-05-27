// Card variants section — Server Component. Iterates over the SDK's
// `tcgplayerPrices` record and renders one panel per variant
// (Normal / Holofoil / Reverse Holo / 1st Edition / etc) with a
// PriceRangeBar inside. Highlights the variant with the highest market
// price as the "highest value" variant.
//
// Soft-fail: if `tcgplayerPrices` is empty (no upstream pricing data on
// this card, or the SDK soft-failed to a minimal record), returns null.
// Session 41 / ADR-030.

import { PriceRangeBar } from "@/components/price-range-bar";
import type { CardMetadata } from "@/lib/cards/sdk";

const VARIANT_LABELS: Record<string, string> = {
  normal: "Normal",
  holofoil: "Holofoil",
  reverseHolofoil: "Reverse Holo",
  "1stEditionHolofoil": "1st Edition Holofoil",
  "1stEdition": "1st Edition",
  unlimited: "Unlimited",
  unlimitedHolofoil: "Unlimited Holofoil",
};

function humanize(variant: string): string {
  if (VARIANT_LABELS[variant]) return VARIANT_LABELS[variant];
  // Fallback: split camelCase + Title-Case.
  return variant
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

type Props = {
  card: CardMetadata;
  /** Optional — passed through to PriceRangeBar so each bar can mark
   *  the current eBay listing's spot in the range. */
  currentBestPriceUsd?: number | null;
};

export function CardVariantsSection({ card, currentBestPriceUsd }: Props) {
  const entries = Object.entries(card.tcgplayerPrices);
  if (entries.length === 0) return null;

  // Identify the highest-market variant for the "Highest Value" badge.
  let highestVariant: string | null = null;
  let highestMarket = -Infinity;
  for (const [variant, price] of entries) {
    if (price.market !== null && Number.isFinite(price.market) && price.market > highestMarket) {
      highestMarket = price.market;
      highestVariant = variant;
    }
  }

  return (
    <section
      className="mt-10 rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-8"
      aria-labelledby="card-variants-heading"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="card-variants-heading"
          className="text-sm font-semibold uppercase tracking-wider text-foil-gold"
        >
          Variants &amp; market range
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-foil-slate">
          Source: TCGplayer
        </span>
      </div>
      <p className="mt-2 text-sm text-foil-slate">
        The TCGplayer low / mid / high range per printing. The dark marker on
        each bar is the current best live eBay listing for comparison.
      </p>

      <ul className="mt-6 space-y-6">
        {entries.map(([variant, price]) => {
          const isHighest = variant === highestVariant;
          return (
            <li
              key={variant}
              className="rounded-xl border border-foil-navy/10 bg-foil-cream p-4 shadow-sm shadow-foil-navy/5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-foil-navy">{humanize(variant)}</p>
                <div className="flex items-baseline gap-2">
                  {isHighest && highestVariant && (
                    <span className="rounded-full border border-foil-gold/40 bg-foil-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foil-navy">
                      Highest value
                    </span>
                  )}
                  {price.market !== null && Number.isFinite(price.market) && (
                    <span className="font-mono text-sm tabular-nums text-foil-navy">
                      market{" "}
                      <span className="ml-1 font-semibold">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 2,
                        }).format(price.market)}
                      </span>
                    </span>
                  )}
                </div>
              </div>
              <PriceRangeBar
                price={price}
                currentPriceUsd={currentBestPriceUsd ?? null}
                updatedAt={card.tcgplayerUpdatedAt}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
