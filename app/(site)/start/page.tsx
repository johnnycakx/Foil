// /start — multi-card onboarding (Task #20 / Session 38).
//
// Twitter-CTA target: a single page where a visitor types a few card names,
// each becomes a chip with an optional price target, picks newsletter opt-in,
// and submits — N watchlist rows + Beehiiv subscriber in one shot. Replaces
// the per-card "search for the card → land on its page → fill the watchlist
// form" friction with a single multi-add flow.
//
// Server Component shell + Client component for the interactive form. The
// shell provides the brand chrome via (site) layout + passes the set of
// catalogued card IDs to the client so the search results know which cards
// are actually trackable today (vs "we'll add it soon — drop your email
// for newsletter and we'll let you know" for non-catalogued hits).

import type { Metadata } from "next";
import { CARD_CATALOG } from "@/lib/cards/catalog";
import { StartPageForm } from "@/components/start-page-form";

export const dynamic = "force-static";
export const revalidate = 86400;

const TITLE = "Start tracking cards — Foil";
const DESCRIPTION =
  "Tell us the Pokémon TCG cards you want. We email when each one drops to your target price. Built by a Level-4 TCGplayer Verified Seller.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/start" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Foil",
    url: "/start",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function StartPage() {
  // Pass the catalog's ID set to the client so the search UI can mark
  // which hits are actually watchable today. Plain string[] over the
  // wire — the client builds the Set itself for O(1) lookup.
  const cataloguedIds = CARD_CATALOG.map((e) => e.pokemonTcgId);

  return (
    <main className="relative mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <header className="mb-10 text-center sm:text-left">
        <p className="text-xs font-medium uppercase tracking-widest text-foil-gold">
          Get started
        </p>
        <h1 className="font-display mt-3 text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-4xl md:text-5xl">
          Tell me what cards you want.
        </h1>
        <p className="mt-3 text-base text-foil-slate sm:text-lg">
          I&apos;ll email you the moment each one drops to a price worth buying. Track
          up to 50 at once.
        </p>
      </header>

      <StartPageForm cataloguedIds={cataloguedIds} />

      <p className="mt-10 text-center text-xs text-foil-slate">
        Privacy is in the{" "}
        <a
          href="/legal/privacy"
          className="underline decoration-foil-navy/20 underline-offset-4 transition hover:text-foil-navy hover:decoration-foil-gold"
        >
          policy
        </a>
        . Your email is used for the alerts and (optionally) the weekly newsletter — never sold, shared, or used for AI training.
      </p>
    </main>
  );
}
