// Price range bar — Server Component. Visualizes a TCGplayer
// low/mid/high range for one card variant, with an optional marker for
// the current best listing's price.
//
// Soft-fail: if low/high are missing or identical, returns null —
// callers can wrap this in their own grid without an empty-bar
// placeholder. Session 41 / ADR-030.

import type { TcgPlayerVariantPrice } from "@/lib/cards/sdk";

type Props = {
  /** The variant's TCGplayer price snapshot. */
  price: TcgPlayerVariantPrice;
  /** Optional — current best eBay listing price in USD. When provided,
   *  rendered as a vertical marker on the bar. */
  currentPriceUsd?: number | null;
  /** Optional ISO date the upstream range was refreshed (e.g.
   *  "2026/05/26"). Rendered as a caption when present. */
  updatedAt?: string;
};

function formatPrice(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export function PriceRangeBar({ price, currentPriceUsd, updatedAt }: Props) {
  if (price.low === null || price.high === null) return null;
  if (price.high <= price.low) return null;

  // Marker position: clamp currentPriceUsd into [low, high] visually.
  let markerPercent: number | null = null;
  if (currentPriceUsd !== undefined && currentPriceUsd !== null && Number.isFinite(currentPriceUsd)) {
    const clamped = Math.max(price.low, Math.min(price.high, currentPriceUsd));
    markerPercent = ((clamped - price.low) / (price.high - price.low)) * 100;
  }

  // Mid marker — only if present and inside the range. Same clamp logic.
  let midPercent: number | null = null;
  if (price.mid !== null && price.mid > price.low && price.mid < price.high) {
    midPercent = ((price.mid - price.low) / (price.high - price.low)) * 100;
  }

  return (
    <div className="mt-3">
      <div className="relative h-2 rounded-full bg-foil-navy/10">
        {/* The actual track gradient — gold/cream so the bar reads as
            "value spectrum" rather than "progress bar." */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-gradient-to-r from-foil-gold/30 via-foil-gold/50 to-foil-gold/70"
        />
        {/* Mid point dash, if any. */}
        {midPercent !== null && (
          <div
            aria-hidden
            className="absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-foil-navy/40"
            style={{ left: `${midPercent}%` }}
          />
        )}
        {/* Current-listing marker (the headline data point). */}
        {markerPercent !== null && (
          <div
            aria-hidden
            className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foil-navy"
            style={{ left: `${markerPercent}%` }}
          />
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-wider text-foil-slate">
        <span>
          Low <span className="ml-1 tabular-nums text-foil-navy">{formatPrice(price.low)}</span>
        </span>
        {price.mid !== null && (
          <span>
            Mid <span className="ml-1 tabular-nums text-foil-navy">{formatPrice(price.mid)}</span>
          </span>
        )}
        <span>
          High <span className="ml-1 tabular-nums text-foil-navy">{formatPrice(price.high)}</span>
        </span>
      </div>

      {currentPriceUsd !== undefined && currentPriceUsd !== null && Number.isFinite(currentPriceUsd) && (
        <p className="mt-2 text-xs text-foil-slate">
          Current eBay listing:{" "}
          <span className="font-semibold text-foil-navy">{formatPrice(currentPriceUsd)}</span>
          {price.high > price.low ? (
            <>
              {" "}
              ·{" "}
              <span>
                {Math.round(
                  ((Math.max(price.low, Math.min(price.high, currentPriceUsd)) - price.low) /
                    (price.high - price.low)) *
                    100,
                )}
                % within the TCGplayer range
              </span>
            </>
          ) : null}
        </p>
      )}

      {updatedAt && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-foil-slate">
          Range refreshed {updatedAt}
        </p>
      )}
    </div>
  );
}
