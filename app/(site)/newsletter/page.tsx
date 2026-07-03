// Newsletter landing — Twitter-CTA target. Server Component, force-static
// + 24h revalidate (the movers proof is baked at build/revalidate from the
// daily-refreshed market_movers cache). Single email field via the existing
// EmailCapture component with source='newsletter-landing'.
//
// Per docs/STRATEGY-AUDIENCE-MOAT.md the value-prop framing is:
//   "Tell me a card → I email you when it drops; weekly market notes from
//    John Craig, who runs a Pokémon card store."
// Twitter bio compresses this; the page expands it with a REAL "recent read"
// snippet (RecentReadSnippet) drawn from the same market_movers data that powers
// /deals, so a visitor sees actual numbers, never fabricated sample issues.

import type { Metadata } from "next";
import { EmailCapture } from "@/components/email-capture";
import { RecentReadSnippet } from "@/components/newsletter/recent-read-snippet";
import { getMarketMovers } from "@/lib/deals/market-movers-read";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const revalidate = 86400;

const PAGE_TITLE = "Pokémon card deal alerts + weekly market notes";

const PAGE_DESCRIPTION =
  "Tell me a card; we email you when it drops to your target price. Weekly market notes from John Craig, who runs a Pokémon card store. One email a week.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/newsletter" },
  robots: { index: true, follow: true },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/newsletter",
    siteName: "Foil",
    type: "website",
    // A page that exports its own openGraph does NOT inherit the file-based
    // app/opengraph-image.tsx, so reference the dynamic OG (the FoilTCG
    // wordmark card, ADR-055) explicitly or the share card is blank.
    images: ["/opengraph-image"],
  },
  // /newsletter is the X-link target. Without this block it inherits the generic
  // site twitter card ("Search any Pokémon card…"), which undersells the
  // subscribe ask. Match the card to the subscribe value-prop instead.
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default async function NewsletterPage() {
  // Real "recent read" proof — baked at build/revalidate from the daily
  // market_movers cache (zero PokeTrace calls at view time). Soft-fails to empty,
  // in which case RecentReadSnippet renders the honest format-description block.
  const movers = await getMarketMovers(12);
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <header className="mb-12 text-center sm:text-left">
        <p className="text-xs font-medium uppercase tracking-widest text-foil-gold">
          The Foil newsletter
        </p>
        <h1 className="font-display mt-3 text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-4xl">
          Tell me a card → I email you when it drops.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-foil-slate sm:text-lg">
          Weekly market notes from John Craig, who runs a Pokémon card store. Specific deals,
          specific data, zero spam. About one email a week. Unsubscribe in one click from any email.
        </p>
      </header>

      <EmailCapture
        source="newsletter-landing"
        variant="inline"
        headline="Subscribe to the Foil newsletter."
        subtext="One email a week: the best live card deals right now, the cards on the move, and one sharp valuation note. No spam."
      />

      <p className="mt-4 text-center text-sm text-foil-slate sm:text-left">
        Want a head start?{" "}
        <a
          href="/free/pokemon-card-pricing-cheat-sheet"
          className="font-medium text-foil-navy underline decoration-foil-gold underline-offset-4 transition hover:text-foil-coral"
        >
          Get the free Pokémon Card Pricing Cheat Sheet
        </a>
        .
      </p>

      <RecentReadSnippet movers={movers} />

      <p className="mt-12 text-center text-xs text-foil-slate sm:text-sm">
        Privacy is in the{" "}
        <a
          href="/legal/privacy"
          className="underline decoration-foil-navy/20 underline-offset-4 transition hover:text-foil-navy hover:decoration-foil-gold"
        >
          policy
        </a>
        . The short version: your email is used only for the alerts and the
        newsletter — never sold, shared, or used for AI training.
      </p>
    </main>
  );
}
