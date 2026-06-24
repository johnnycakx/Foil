// Newsletter landing — Twitter-CTA target. Server Component, force-static
// + 24h revalidate. Single email field via the existing EmailCapture
// component with source='newsletter-landing'.
//
// Per docs/STRATEGY-AUDIENCE-MOAT.md the value-prop framing is:
//   "Tell me a card → I email you when it drops; weekly market notes from
//    a Level-4 TCGplayer seller."
// Twitter bio compresses this; the page expands it with three concrete
// sample-newsletter excerpts so a Twitter visitor sees what they'll get.

import type { Metadata } from "next";
import { EmailCapture } from "@/components/email-capture";

export const dynamic = "force-static";
export const revalidate = 86400;

const PAGE_TITLE = "Subscribe to Foil — Pokémon TCG deal alerts + weekly market notes";

const PAGE_DESCRIPTION =
  "Tell us a card and we email you when it drops to your target price. Weekly market notes from a Level-4 TCGplayer seller. One email a week, unsubscribe anytime.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/newsletter" },
  robots: { index: true, follow: true },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/newsletter",
    type: "website",
  },
};

const SAMPLE_EXCERPTS: { week: string; title: string; body: string }[] = [
  {
    week: "Week of 2026-05-25",
    title: "Charizard ex 151 just dropped — what the market is telling us",
    body:
      "A near-mint Charizard ex 151/165 cleared at $32 this week — first time it's broken below $40 since the set's release. Three signals worth watching: (1) Pokémon Center restocks are catching up faster than they did with Obsidian Flames; (2) graded comps are holding steady, so this is supply-side, not demand-side; (3) reverse-holo variants are tracking 12% above non-holo, which is the widest spread we've seen on a modern ex card.",
  },
  {
    week: "Week of 2026-05-18",
    title: "Reverse-holo Scarlet & Violet — the quiet 30% gap",
    body:
      "Across the four base SV sets, reverse-holo variants are trading at an average 32% premium over their non-holo siblings. That's wider than reverse-holo premiums in Sword & Shield (typical 12-18%) and wider than the historic 10-15% you'd see in vintage. Two hypotheses worth testing: (a) collector demand is shifting toward aesthetic-rare variants now that ungraded vintage is so spendy, (b) print runs on reverse-holo were cut tighter this generation than the official disclosures suggest.",
  },
  {
    week: "Week of 2026-05-11",
    title: "Why eBay's 'lowest price' is a trap (and what we do instead)",
    body:
      "If you've ever clicked the cheapest 'Charizard NEAR MINT' on eBay and gotten a sleeve, you've met the keyword-stuffing problem. Sellers list accessories with the card's name in the title to ride the search. Foil's curation rejects price outliers (anything below 30% of the credible median), keyword-stuffed titles (lot, bulk, proxy, etc.), and damaged-condition signals — and then takes the cheapest credible survivor. Same logic runs on every per-card page; alerts use the same filter.",
  },
];

export default function NewsletterPage() {
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
          Weekly market notes from a Level-4 TCGplayer seller. Specific deals, specific data,
          zero spam. About one email a week. Unsubscribe in one click from any email.
        </p>
      </header>

      <EmailCapture
        source="newsletter-landing"
        variant="inline"
        headline="Subscribe to the Foil newsletter."
      />

      <section className="mt-14">
        <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          Recent issues
        </h2>
        <p className="mt-2 text-sm text-foil-slate">
          Three excerpts so you can see what lands in your inbox before you commit.
        </p>

        <div className="mt-6 space-y-6">
          {SAMPLE_EXCERPTS.map((excerpt) => (
            <article
              key={excerpt.title}
              className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-7"
            >
              <p className="text-xs font-medium uppercase tracking-widest text-foil-gold">
                {excerpt.week}
              </p>
              <h3 className="font-display mt-2 text-lg font-bold tracking-[-0.02em] text-foil-navy sm:text-xl">
                {excerpt.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-foil-slate sm:text-base">
                {excerpt.body}
              </p>
            </article>
          ))}
        </div>
      </section>

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
