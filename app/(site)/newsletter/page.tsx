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
        <p className="text-xs font-medium uppercase tracking-widest text-[#FFC7BA]">
          The Foil newsletter
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Tell me a card → I email you when it drops.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-300 sm:text-lg">
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
        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          Recent issues
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Three excerpts so you can see what lands in your inbox before you commit.
        </p>

        <div className="mt-6 space-y-6">
          {SAMPLE_EXCERPTS.map((excerpt) => (
            <article
              key={excerpt.title}
              className="rounded-2xl border border-white/10 bg-[#101D38] p-6 sm:p-7"
            >
              <p className="text-xs font-medium uppercase tracking-widest text-[#FFC7BA]">
                {excerpt.week}
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-white sm:text-xl">
                {excerpt.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-base">
                {excerpt.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-12 text-center text-xs text-zinc-500 sm:text-sm">
        Privacy is in the{" "}
        <a
          href="/legal/privacy"
          className="underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300"
        >
          policy
        </a>
        . The short version: your email is used only for the alerts and the
        newsletter — never sold, shared, or used for AI training.
      </p>
    </main>
  );
}
