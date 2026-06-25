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
      <div className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-8 text-center shadow-sm shadow-foil-navy/5">
        <p className="text-foil-navy">The market is quiet this week.</p>
        <p className="mt-2 text-sm text-foil-slate">
          We only flag a card when its recent average has moved enough to matter. Nothing cleared the bar
          right now. Check back tomorrow, or get the weekly digest by email below.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {down.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-foil-navy/10 bg-foil-cream shadow-sm shadow-foil-navy/5">
          <ol className="divide-y divide-foil-navy/10">
            {down.map((m) => (
              <li
                key={m.cardSlug}
                className="grid grid-cols-[1fr_5rem] items-center gap-3 px-4 py-4 sm:grid-cols-[1fr_9rem_7rem] sm:gap-4 sm:px-5"
              >
                {/* Card identity */}
                <Link
                  href={`/cards/${m.cardSlug}`}
                  className="flex min-w-0 items-center gap-3 transition hover:text-foil-coral"
                >
                  {m.imageUrl ? (
                    <Image
                      src={m.imageUrl}
                      alt=""
                      width={48}
                      height={67}
                      unoptimized
                      className="h-12 w-auto shrink-0 rounded-md border border-foil-navy/10 shadow-sm shadow-foil-navy/10"
                    />
                  ) : (
                    <span aria-hidden className="h-12 w-9 shrink-0 rounded-md border border-foil-navy/10 bg-foil-cream" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foil-navy">{m.cardName}</span>
                    <span className="block truncate text-xs text-foil-slate">{m.setName}</span>
                    <span className="mt-1 block text-xs text-foil-slate">
                      {m.avg7d != null && m.avg30d != null ? (
                        <>
                          NM {formatUsd(m.avg7d)} (7d) vs {formatUsd(m.avg30d)} (30d) · {m.saleCount} sales
                        </>
                      ) : (
                        <>Near Mint · {m.saleCount} sales</>
                      )}
                    </span>
                  </span>
                </Link>

                {/* The hook — how far below the 30-day average. */}
                <span className="text-right">
                  <span className="font-display block text-2xl font-bold tabular-nums leading-none text-foil-navy sm:text-3xl">
                    {Math.abs(m.momentumPct)}%
                  </span>
                  <span className="block text-[11px] uppercase tracking-wider text-foil-gold">
                    below 30-day avg
                  </span>
                </span>

                {/* Card-level eBay browse (affiliate search) — never a listing. */}
                <a
                  href={browseHref(m)}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="col-span-2 mt-1 inline-flex items-center justify-center rounded-full bg-foil-navy px-4 py-2 text-xs font-semibold text-foil-cream shadow-sm shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:ring-2 hover:ring-foil-gold/40 sm:col-span-1 sm:mt-0"
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
          <h3 className="font-display text-lg font-bold text-foil-navy">Heating up</h3>
          <p className="mt-1 text-sm text-foil-slate">
            The other side of the same signal: cards trading above their 30-day average.
          </p>
          <ul className="mt-3 divide-y divide-foil-navy/10 overflow-hidden rounded-2xl border border-foil-navy/10 bg-foil-cream shadow-sm shadow-foil-navy/5">
            {up.map((m) => (
              <li key={m.cardSlug} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <Link
                  href={`/cards/${m.cardSlug}`}
                  className="min-w-0 transition hover:text-foil-coral"
                >
                  <span className="block truncate font-semibold text-foil-navy">{m.cardName}</span>
                  <span className="block truncate text-xs text-foil-slate">
                    {m.setName} · {m.saleCount} sales
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-right">
                    <span className="font-display block text-lg font-bold tabular-nums leading-none text-foil-navy">
                      +{m.momentumPct}%
                    </span>
                    <span className="block text-[10px] uppercase tracking-wider text-foil-slate">
                      vs 30-day
                    </span>
                  </span>
                  <a
                    href={browseHref(m)}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-foil-navy/20 px-3 py-1.5 text-xs font-semibold text-foil-navy transition-all hover:border-foil-gold/50 hover:text-foil-coral"
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
