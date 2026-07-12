// /deals — "Today's best deals" public leaderboard (ROADMAP B.4 / ADR-054).
//
// The screenshot surface for the X content bot: a daily, ranked board of the
// curated cards whose best live eBay listing is meaningfully BELOW the
// same-condition 30-day sold average. Free, affiliate, no paywall.
//
// R-008 / R-012: renders ENTIRELY from the buy_signals cache (one DB read, no
// eBay Browse call at page-view time). The cache is precomputed once daily by
// /api/cron/deals-refresh. The live listing resolves only on a "See it on eBay"
// click. No eBay listing data is persisted or republished (ADR-054).

import type { Metadata } from "next";
import Link from "next/link";
import { getLeaderboard, latestComputedAt } from "@/lib/deals/leaderboard";
import { getMarketMovers } from "@/lib/deals/market-movers-read";
import { getMarketTemperature, temperatureSentence } from "@/lib/deals/market-temperature";
import { DealsBoard } from "@/components/deals/deals-board";
import { MoversBoard } from "@/components/deals/movers-board";
import { EmailCapture } from "@/components/email-capture";
import { SakuraAmbience } from "@/components/sakura-ambience";
import { CARD_CATALOG } from "@/lib/cards/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TITLE = "Pokémon card deals & good buys this week";
const DESCRIPTION =
  "Pokémon cards trading below their 30-day sold average, computed from recent market data and ranked weekly. Plus live below-sold listings. Free to use.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/deals" },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Foil",
    url: "/deals",
    // A page that exports its own openGraph does NOT inherit the file-based
    // app/opengraph-image.tsx, so reference the dynamic OG (the FoilTCG
    // wordmark card, ADR-055) explicitly or the share card is blank.
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Today's best Pokémon card deals",
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

function formatBoardDate(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function DealsPage() {
  // Insight-led LEAD: market movers (PokeTrace aggregates — can't break on one
  // mispriced listing). Demoted secondary: the single-listing below-sold board.
  const [movers, deals, temperature] = await Promise.all([
    getMarketMovers(12),
    getLeaderboard(12),
    getMarketTemperature(),
  ]);
  const boardDate = formatBoardDate(latestComputedAt(deals));
  const trackedCount = CARD_CATALOG.length;

  return (
    // Night register (design-loop-round2 §3) — full-bleed dark surface, content
    // constrained inside; the chrome flips via body:has().
    <main data-tone="night" className="relative flex-1 bg-foil-night text-foil-cream">
      {/* Sparse far-layer hanami over the header band (binder-aesthetic-pass)
          — atmosphere only, never competing with the data rows below. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[380px] overflow-hidden">
        <SakuraAmbience mode="header" />
      </div>
      <div className="relative mx-auto w-full max-w-3xl px-5 pt-10 pb-20 sm:px-8 sm:pt-14">
      {/* Screenshot-friendly header band: title + date + foiltcg.com all in
          frame so every shared screenshot is self-branding. */}
      <header className="text-center">
        <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-foil-accent">
          <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foil-accent opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foil-accent" />
          </span>
          foiltcg.com · {boardDate}
        </p>
        <h1 className="font-display mt-3 text-3xl font-bold tracking-[-0.02em] text-foil-cream sm:text-4xl">
          Good buys this week
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-foil-cream/60">
          Cards going for less than they usually sell for. Each is a candidate worth a look, not a
          guarantee. Every figure is a real recent sold average, and we only show a price when
          enough copies actually sold, so thin or noisy cards never make the list.
        </p>
        {temperature ? (
          <p className="mx-auto mt-3 max-w-xl text-sm text-foil-accent/90">
            {temperatureSentence(temperature)}
          </p>
        ) : null}
      </header>

      {/* Section jump links (blackout-brand Workstream C readability pass):
          the board is three scannable sections; say so up top. */}
      <nav aria-label="Board sections" className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {movers.down.length > 0 ? (
          <a
            href="#cooling-off"
            className="rounded-full border border-foil-cream/15 px-3.5 py-1.5 text-xs font-medium text-foil-cream/80 transition hover:border-foil-accent/50 hover:text-foil-accent"
          >
            Cooling off
          </a>
        ) : null}
        {movers.up.length > 0 ? (
          <a
            href="#heating-up"
            className="rounded-full border border-foil-cream/15 px-3.5 py-1.5 text-xs font-medium text-foil-cream/80 transition hover:border-foil-accent/50 hover:text-foil-accent"
          >
            Heating up
          </a>
        ) : null}
        <a
          href="#below-sold"
          className="rounded-full border border-foil-cream/15 px-3.5 py-1.5 text-xs font-medium text-foil-cream/80 transition hover:border-foil-accent/50 hover:text-foil-accent"
        >
          Below sold right now
        </a>
      </nav>

      <div className="mt-8">
        <MoversBoard movers={movers} />
      </div>

      {/* Honest framing of the aggregate signal — a proper footnote block, not
          floating text (Workstream C readability pass). */}
      <aside className="mt-6 rounded-xl border border-foil-cream/12 bg-foil-night-2 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foil-cream/60">
          How to read this board
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-foil-cream/70">
          Down versus a card&apos;s 30-day average means it has cooled off lately, which can be a buying
          window or a sign demand is softening. We surface the move and the numbers behind it. The call is
          yours. Every row shows its recent-sale count; built from recent sold data, refreshed daily.
        </p>
      </aside>

      {/* Demoted secondary: the single-listing below-sold board. */}
      <section id="below-sold" className="mt-14 scroll-mt-24">
        <h2 className="font-display text-xl font-bold text-foil-cream">Below sold right now</h2>
        <p className="mt-1 text-sm text-foil-cream/60">
          Individual live listings priced under their condition-matched recent sold price. We check{" "}
          {trackedCount} cards and only list one when we are confident the listing matches the sold data,
          on the same condition and currency. Fewer deals we trust beats a long list we do not.
        </p>
        <div className="mt-5">
          <DealsBoard deals={deals} />
        </div>
      </section>

      {/* Affiliate disclosure (copy doc; FTC + EPN requirement). */}
      <p className="mx-auto mt-4 max-w-xl rounded-xl border border-foil-cream/12 bg-foil-night-2 px-4 py-3 text-center text-xs text-foil-cream/60">
        Foil is free. When you buy through a link on Foil, eBay pays us a commission.
        It costs you nothing, and it does not change which deal we show you. We rank by
        the best deal, not the biggest payout.{" "}
        <Link
          href="/pricing-methodology"
          className="text-foil-cream underline decoration-foil-cream/25 underline-offset-4 transition hover:decoration-foil-accent"
        >
          See how we price.
        </Link>
      </p>

      {/* The pull promise (fable-design-overhaul §4): this board is everyone's
          drops — the product is YOUR cards' drops. */}
      <p className="mt-8 text-center text-sm text-foil-cream/60">
        These are this week&apos;s drops across the whole market.{" "}
        <Link
          href="/start?src=deals"
          className="font-medium text-foil-cream underline decoration-foil-accent/50 underline-offset-4 transition hover:decoration-foil-accent"
        >
          Want them for your cards? Start your vault →
        </Link>
      </p>

      <p className="mt-4 text-center text-[11px] text-foil-cream/60">
        Foil TCG, LLC · Built by John Craig
      </p>

      {/* Newsletter CTA — ONE ask (email-ask-cleanup, ADR-066). The EmailCapture
          is already a styled gold card, so there is no outer slab wrapper
          (card-in-card) and no second competing heading. */}
      <div className="mx-auto max-w-xl">
        <EmailCapture
          source="deals_board"
          variant="inline"
          tone="night"
          headline="Get the weekly drop, free."
          subtext="One email a week: the best live card deals right now, the cards on the move, and one sharp valuation note. No spam."
        />
      </div>
      </div>
    </main>
  );
}
