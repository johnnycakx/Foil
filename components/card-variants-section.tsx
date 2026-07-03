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
import { DetailSection } from "@/components/cards/detail-section";
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
  /** Optional — the verified live listing's price. Rendered as a marker ONLY
   *  on the variant named by `currentBestVariantKey` (never across all
   *  variants — those are different cards with different markets; the design's
   *  §5 named defect). */
  currentBestPriceUsd?: number | null;
  /** The tcgplayerPrices key the verified listing's finish matched, or null
   *  when no unambiguous match exists → no marker anywhere. */
  currentBestVariantKey?: string | null;
};

export function CardVariantsSection({ card, currentBestPriceUsd, currentBestVariantKey }: Props) {
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

  // Vault-first hierarchy (card-page-vault-first goal): the depth data lives
  // in a collapsed DetailSection. The rows below still render server-side in
  // the DOM (native <details>), so crawlers and the SEO price-checker persona
  // lose nothing; the page just no longer reads as a dashboard first.
  return (
    <DetailSection
      title="Variants & market range"
      headingId="card-variants-heading"
      meta={
        <span className="font-mono text-[10px] uppercase tracking-wider text-foil-cream/60">
          Source: TCGplayer
        </span>
      }
    >
      <p className="text-sm text-foil-cream/70">
        The TCGplayer low / mid / high range per printing.
        {currentBestVariantKey && currentBestPriceUsd != null
          ? " The dark marker shows the verified live eBay listing on its matching printing."
          : null}
      </p>

      <ul className="mt-5 space-y-6">
        {entries.map(([variant, price]) => {
          const isHighest = variant === highestVariant;
          return (
            <li
              key={variant}
              className="rounded-xl border border-foil-cream/10 bg-foil-night p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-foil-cream">{humanize(variant)}</p>
                <div className="flex items-baseline gap-2">
                  {isHighest && highestVariant && (
                    <span className="rounded-full border border-foil-accent/40 bg-foil-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foil-accent">
                      Highest value
                    </span>
                  )}
                  {price.market !== null && Number.isFinite(price.market) && (
                    <span className="font-mono text-sm tabular-nums text-foil-cream">
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
                currentPriceUsd={variant === currentBestVariantKey ? currentBestPriceUsd ?? null : null}
                updatedAt={card.tcgplayerUpdatedAt}
              />
            </li>
          );
        })}
      </ul>
    </DetailSection>
  );
}
