// Market-movers board (ADR-069; reworked by the blackout-brand goal). Server
// component. The insight-led LEAD surface on /deals: "Cooling off" (cards
// whose Near Mint copies trade below their 30-day sold average) + "Heating
// up" (the same signal, upward) at FULL row parity — thumbnail, name + set,
// plain-words stats sentence, drawn delta, CTA. The heating section's missing
// card images were a component gap (the payload always carried imageUrl);
// both sections now render through the same row.
//
// Every figure is a real PokeTrace aggregate (avg7d / avg30d / saleCount). A
// market aggregate cannot break the way a single mispriced listing can (the
// Moonbreon false deal) — that is the whole point of the reframe. Each card
// links to a CARD-LEVEL eBay BROWSE (affiliate search) link, never a single
// listing, so there is no eBay payload to persist or republish (R-008 N/A
// here). Card name + thumbnail link to our /cards/[slug] page (the vault
// loop); the affiliate CTA is untouched.
//
// Delta colors are token-based: sakura (foil-accent) marks the below-average
// buy signal; the up delta renders in luminous cream — vermillion is
// hanko-ink only, coral is hover-only, and gold is wordmark-only (scarce-gold
// absolute), so "warm" is carried by direction + label, not a new color.

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

/** Thumbnail with a DESIGNED null state: a card-back pocket glyph, never a
 *  blank box (blackout-brand Workstream C). */
function CardThumb({ imageUrl }: { imageUrl: string }) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={64}
        height={89}
        unoptimized
        className="h-16 w-auto shrink-0 rounded-lg border border-foil-cream/12 shadow-[0_4px_14px_rgba(4,9,18,0.6)]"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-16 w-[46px] shrink-0 items-center justify-center rounded-lg border border-foil-cream/12 bg-foil-night"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-foil-cream/25">
        <rect x="5" y="3.5" width="14" height="17" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

/** One mover row — IDENTICAL anatomy for both directions. The delta dumbbell
 *  draws this week's dot left of the baseline (below average, sakura) or
 *  right of it (above average, cream). Two real aggregates, never a curve. */
function MoverRowItem({ m, direction }: { m: MoverRow; direction: "down" | "up" }) {
  const isDown = direction === "down";
  const pct = Math.abs(m.momentumPct);
  const reach = `${Math.min(85, pct * 2.4)}%`;
  return (
    <li className="grid grid-cols-[1fr_5.5rem] items-center gap-3 px-4 py-4 sm:grid-cols-[1fr_9rem_7rem] sm:gap-4 sm:px-5">
      {/* Card identity → our card page (the vault loop). */}
      <Link
        href={`/cards/${m.cardSlug}`}
        className="flex min-w-0 items-center gap-3 transition hover:text-foil-accent"
      >
        <CardThumb imageUrl={m.imageUrl} />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-foil-cream">{m.cardName}</span>
          <span className="block truncate text-xs text-foil-cream/60">{m.setName}</span>
          {/* Plain-language stats line (fable-design-overhaul): collector
              words a 15-year-old parses, readable size (13px, not 11px). */}
          <span className="mt-1 block text-[13px] leading-snug text-foil-cream/70">
            {m.avg7d != null && m.avg30d != null ? (
              <>
                Near Mint copies: ~{formatUsd(m.avg7d)} this week, usually {formatUsd(m.avg30d)}
                {" "}· {m.saleCount} recent sales
              </>
            ) : (
              <>Near Mint · {m.saleCount} recent sales</>
            )}
          </span>
        </span>
      </Link>

      {/* The hook — how far off the 30-day average, DRAWN as well as written
          (design-round3-fixes §2): a two-point dumbbell from the two real
          aggregates. Down: this week's sakura dot sits LEFT of the cream
          baseline dot. Up: it sits RIGHT, in cream. */}
      <span className="text-right">
        <span className="font-display block text-2xl font-bold tabular-nums leading-none text-foil-cream sm:text-3xl">
          {isDown ? "" : "+"}
          {pct}%
        </span>
        <span
          className={`block text-[11px] uppercase tracking-wider ${
            isDown ? "text-foil-accent" : "text-foil-cream/70"
          }`}
        >
          {isDown ? "below its average" : "above its average"}
        </span>
        {m.avg7d != null && m.avg30d != null ? (
          <span aria-hidden className="relative mt-2 ml-auto block h-2 w-24">
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 rounded bg-foil-cream/15" />
            {isDown ? (
              <>
                <span
                  className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-foil-accent/50"
                  style={{ right: "3px", width: reach }}
                />
                <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-foil-cream/45" />
                <span
                  className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-foil-accent"
                  style={{ right: reach }}
                />
              </>
            ) : (
              <>
                <span
                  className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-foil-cream/40"
                  style={{ left: "3px", width: reach }}
                />
                <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-foil-cream/45" />
                <span
                  className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-foil-cream"
                  style={{ left: reach }}
                />
              </>
            )}
          </span>
        ) : null}
      </span>

      {/* Card-level eBay browse (affiliate search) — never a listing. */}
      <a
        href={browseHref(m)}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className={`col-span-2 mt-1 inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition-all hover:-translate-y-0.5 sm:col-span-1 sm:mt-0 ${
          isDown
            ? "border-foil-accent/40 text-foil-accent hover:bg-foil-accent/10"
            : "border-foil-cream/25 text-foil-cream hover:border-foil-accent/50 hover:text-foil-accent"
        }`}
      >
        Browse on eBay →
      </a>
    </li>
  );
}

export function MoversBoard({ movers }: { movers: MarketMovers }) {
  const { down, up } = movers;

  if (down.length === 0 && up.length === 0) {
    return (
      <div className="rounded-2xl border border-foil-cream/12 bg-foil-night-2 p-8 text-center shadow-sm shadow-foil-navy/5">
        <p className="text-foil-cream">The market is quiet this week.</p>
        <p className="mt-2 text-sm text-foil-cream/60">
          Foil only flags a card when its recent average has moved enough to matter. Nothing cleared the bar
          right now. Check back tomorrow, or get the weekly digest by email below.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {down.length > 0 ? (
        <section id="cooling-off" aria-labelledby="cooling-off-heading" className="scroll-mt-24">
          <h3 id="cooling-off-heading" className="font-display text-lg font-bold text-foil-cream">
            Cooling off
          </h3>
          <p className="mt-1 text-sm text-foil-cream/60">
            Trading below what they usually go for. A buying window, or softening demand: the numbers
            are below, the call is yours.
          </p>
          <ol className="mt-3 divide-y divide-foil-cream/10 overflow-hidden rounded-2xl border border-foil-cream/12 bg-foil-night-2">
            {down.map((m) => (
              <MoverRowItem key={m.cardSlug} m={m} direction="down" />
            ))}
          </ol>
        </section>
      ) : null}

      {up.length > 0 ? (
        <section id="heating-up" aria-labelledby="heating-up-heading" className="scroll-mt-24">
          <h3 id="heating-up-heading" className="font-display text-lg font-bold text-foil-cream">
            Heating up
          </h3>
          <p className="mt-1 text-sm text-foil-cream/60">
            The other side of the same signal: cards selling above what they usually go for.
          </p>
          <ol className="mt-3 divide-y divide-foil-cream/10 overflow-hidden rounded-2xl border border-foil-cream/12 bg-foil-night-2">
            {up.map((m) => (
              <MoverRowItem key={m.cardSlug} m={m} direction="up" />
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
