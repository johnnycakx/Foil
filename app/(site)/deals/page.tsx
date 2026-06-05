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
import { DealsBoard } from "@/components/deals/deals-board";
import { EmailCapture } from "@/components/email-capture";
import { CARD_CATALOG } from "@/lib/cards/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TITLE = "Today's best Pokémon card deals | Foil";
const DESCRIPTION =
  "Live eBay listings priced below their recent condition-matched sold price, ranked daily. Built by a Level-4 TCGplayer seller. Free to use.";

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
  },
  twitter: {
    card: "summary_large_image",
    title: "Today's best Pokémon card deals",
    description: DESCRIPTION,
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
  const deals = await getLeaderboard(12);
  const boardDate = formatBoardDate(latestComputedAt(deals));
  const trackedCount = CARD_CATALOG.length;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-10 pb-20 sm:px-8 sm:pt-14">
      {/* Screenshot-friendly header band: title + date + foiltcg.com all in
          frame so every shared screenshot is self-branding. */}
      <header className="text-center">
        <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-foil-gold">
          <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foil-gold opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foil-gold" />
          </span>
          foiltcg.com · {boardDate}
        </p>
        <h1 className="font-display mt-3 text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-4xl">
          Today&apos;s best Pokémon deals
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-foil-slate">
          Ranked by how far below recent sold price each live listing is. We scan{" "}
          {trackedCount} cards against their condition-matched sold data and surface
          the real below-market listings. Updated daily.
        </p>
      </header>

      <div className="mt-8">
        <DealsBoard deals={deals} />
      </div>

      {/* Honest "curated, not exhaustive" note (copy doc). */}
      <p className="mt-5 text-center text-xs leading-relaxed text-foil-slate">
        We only list a card when we are confident the listing matches the sold data.
        We would rather show you fewer deals we trust than a long list we do not.
        That is why the board is curated, not exhaustive. eBay today, more
        marketplaces coming.
      </p>

      {/* Affiliate disclosure (copy doc; FTC + EPN requirement). */}
      <p className="mx-auto mt-4 max-w-xl rounded-xl border border-foil-navy/10 bg-foil-cream px-4 py-3 text-center text-xs text-foil-slate">
        Foil is free. When you buy through a link on Foil, eBay pays us a commission.
        It costs you nothing, and it does not change which deal we show you. We rank by
        the best deal, not the biggest payout.{" "}
        <Link
          href="/pricing-methodology"
          className="text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
        >
          See how we price.
        </Link>
      </p>

      <p className="mt-4 text-center text-[11px] text-foil-slate">
        Foil TCG, LLC · Built by a Level-4 TCGplayer seller
      </p>

      {/* Newsletter CTA (copy doc). */}
      <section className="mt-12 rounded-3xl border border-foil-gold/40 bg-foil-cream p-6 shadow-xl shadow-foil-navy/10 sm:p-8">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-foil-navy">
          Get the week&apos;s best deals, free.
        </h2>
        <p className="mt-2 text-sm text-foil-slate">
          One email a week. The biggest below-market listings we found. No spam,
          unsubscribe anytime.
        </p>
        <div className="mt-5 max-w-xl">
          <EmailCapture source="deals_board" variant="inline" headline="Get the weekly best-deals newsletter." />
        </div>
      </section>
    </main>
  );
}
