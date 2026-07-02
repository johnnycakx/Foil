// Market-movers board (ADR-069). Server component. The insight-led LEAD surface
// on /deals: "Good buys this week" (cards whose Near Mint copies trade below
// their 30-day sold average) + a secondary "Heating up" list.
//
// Every figure is a real PokeTrace aggregate (avg7d / avg30d / saleCount). A
// market aggregate cannot break the way a single mispriced listing can (the
// Moonbreon false deal) — that is the whole point of the reframe. Each card
// links to a CARD-LEVEL eBay BROWSE (affiliate search) link, never a single
// listing, so there is no eBay payload to persist or republish (R-008 N/A here).
// Brand tokens; mobile-first; calm/analytical voice (no "steal", no urgency).

import Link from "next/link";
import Image from "next/image";
import type { MarketMovers, MoverRow } from "@/lib/deals/market-movers-read";
import { affiliateSearchUrl, buildCustomId } from "@/lib/affiliate/epn";

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

/** Card-level eBay BROWSE affiliate search link for a Near-Mint copy. */
function browseHref(m: MoverRow): string {
  const query = `${m.cardName} ${m.setName} Near Mint`.trim();
  return affiliateSearchUrl(query, buildCustomId({ tier: "deals", slug: m.cardSlug, src: "movers" }));
}

export function MoversBoard({ movers }: { movers: MarketMovers }) {
  const { down, up } = movers;

  if (down.length === 0 && up.length === 0) {
    return (
      <div className="rounded-2xl border border-foil-cream/12 bg-foil-night-2 p-8 text-center shadow-sm shadow-foil-navy/5">
        <p className="text-foil-cream">The market is quiet this week.</p>
        <p className="mt-2 text-sm text-foil-cream/60">
          We only flag a card when its recent average has moved enough to matter. Nothing cleared the bar
          right now. Check back tomorrow, or get the weekly digest by email below.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {down.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-foil-cream/12 bg-foil-night-2">
          <ol className="divide-y divide-foil-cream/10">
            {down.map((m) => (
              <li
                key={m.cardSlug}
                className="grid grid-cols-[1fr_5rem] items-center gap-3 px-4 py-4 sm:grid-cols-[1fr_9rem_7rem] sm:gap-4 sm:px-5"
              >
                {/* Card identity */}
                <Link
                  href={`/cards/${m.cardSlug}`}
                  className="flex min-w-0 items-center gap-3 transition hover:text-foil-accent"
                >
                  {m.imageUrl ? (
                    <Image
                      src={m.imageUrl}
                      alt=""
                      width={64}
                      height={89}
                      unoptimized
                      className="h-16 w-auto shrink-0 rounded-lg border border-foil-cream/12 shadow-[0_4px_14px_rgba(4,9,18,0.6)]"
                    />
                  ) : (
                    <span aria-hidden className="h-12 w-9 shrink-0 rounded-md border border-foil-cream/12 bg-foil-night" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foil-cream">{m.cardName}</span>
                    <span className="block truncate text-xs text-foil-cream/60">{m.setName}</span>
                    {/* Plain-language sweep (fable-design-overhaul): collector
                        words, never ticker jargon — "NM $16.71 (7d) vs $19.19
                        (30d)" becomes a sentence a 15-year-old parses. */}
                    <span className="mt-1 block text-xs text-foil-cream/60">
                      {m.avg7d != null && m.avg30d != null ? (
                        <>
                          Near Mint copies: ~{formatUsd(m.avg7d)} this week, usually{" "}
                          {formatUsd(m.avg30d)} · {m.saleCount} recent sales
                        </>
                      ) : (
                        <>Near Mint · {m.saleCount} recent sales</>
                      )}
                    </span>
                  </span>
                </Link>

                {/* The hook — how far below the 30-day average, DRAWN as well
                    as written (design-round3-fixes §2): a two-point dumbbell —
                    the cream dot is the usual (30-day) price, the teal dot is
                    this week, sitting left by the % below. A real two-point
                    delta from the two real aggregates — never a fake curve. */}
                <span className="text-right">
                  <span className="font-display block text-2xl font-bold tabular-nums leading-none text-foil-cream sm:text-3xl">
                    {Math.abs(m.momentumPct)}%
                  </span>
                  <span className="block text-[11px] uppercase tracking-wider text-foil-accent">
                    below its average
                  </span>
                  {m.avg7d != null && m.avg30d != null ? (
                    <span aria-hidden className="relative mt-2 ml-auto block h-2 w-24">
                      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 rounded bg-foil-cream/15" />
                      <span
                        className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-foil-accent/50"
                        style={{ right: "3px", width: `${Math.min(85, Math.abs(m.momentumPct) * 2.4)}%` }}
                      />
                      <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-foil-cream/45" />
                      <span
                        className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-foil-accent"
                        style={{ right: `${Math.min(85, Math.abs(m.momentumPct) * 2.4)}%` }}
                      />
                    </span>
                  ) : null}
                </span>

                {/* Card-level eBay browse (affiliate search) — never a listing. */}
                <a
                  href={browseHref(m)}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="col-span-2 mt-1 inline-flex items-center justify-center rounded-full border border-foil-accent/40 px-4 py-2 text-xs font-semibold text-foil-accent transition-all hover:-translate-y-0.5 hover:bg-foil-accent/10 sm:col-span-1 sm:mt-0"
                >
                  Browse on eBay →
                </a>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {up.length > 0 ? (
        <div>
          <h3 className="font-display text-lg font-bold text-foil-cream">Heating up</h3>
          <p className="mt-1 text-sm text-foil-cream/60">
            The other side of the same signal: cards selling above what they
            usually go for.
          </p>
          <ul className="mt-3 divide-y divide-foil-cream/10 overflow-hidden rounded-2xl border border-foil-cream/12 bg-foil-night-2">
            {up.map((m) => (
              <li key={m.cardSlug} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <Link
                  href={`/cards/${m.cardSlug}`}
                  className="min-w-0 transition hover:text-foil-accent"
                >
                  <span className="block truncate font-semibold text-foil-cream">{m.cardName}</span>
                  <span className="block truncate text-xs text-foil-cream/60">
                    {m.setName} · {m.saleCount} sales
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-right">
                    <span className="font-display block text-lg font-bold tabular-nums leading-none text-foil-cream">
                      +{m.momentumPct}%
                    </span>
                    <span className="block text-[10px] uppercase tracking-wider text-foil-cream/60">
                      vs its average
                    </span>
                  </span>
                  <a
                    href={browseHref(m)}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-foil-cream/25 px-3 py-1.5 text-xs font-semibold text-foil-cream transition-all hover:border-foil-accent/50 hover:text-foil-accent"
                  >
                    Browse →
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
