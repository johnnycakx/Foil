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
  "Tell me the Pokémon TCG cards you want. We email when each one drops to your target price.";

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
    // Overriding openGraph suppresses the file-based app/opengraph-image.tsx,
    // so reference the dynamic OG explicitly or the share card is blank.
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
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
        <p className="text-xs font-medium uppercase tracking-widest text-foil-accent-deep">
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

      {/* No-JS fallback (fable-design-overhaul §2 / audit 🟡): the form above
          is a client component; without JavaScript a visitor still gets a
          working path — the newsletter form is a plain POST away, and email
          works everywhere. */}
      <noscript>
        <p className="mt-6 rounded-xl border border-foil-navy/15 bg-foil-cream p-4 text-sm text-foil-navy">
          This form needs JavaScript. Without it, you can still get the weekly
          deals email at{" "}
          <a href="/newsletter" className="underline underline-offset-4">
            foiltcg.com/newsletter
          </a>{" "}
          — or email{" "}
          <a href="mailto:john.c.craig24@gmail.com" className="underline underline-offset-4">
            john.c.craig24@gmail.com
          </a>{" "}
          with the cards you want watched and we&apos;ll set it up by hand.
        </p>
      </noscript>

      <p className="mt-10 text-center text-xs text-foil-slate">
        Privacy is in the{" "}
        <a
          href="/legal/privacy"
          className="underline decoration-foil-navy/20 underline-offset-4 transition hover:text-foil-navy hover:decoration-foil-accent-deep"
        >
          policy
        </a>
        . Your email is used for the alerts and (optionally) the weekly newsletter — never sold, shared, or used for AI training.
      </p>
    </main>
  );
}
