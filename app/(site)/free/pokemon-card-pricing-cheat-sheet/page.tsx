import type { Metadata } from "next";
import Link from "next/link";
import { LeadMagnetGate } from "@/components/lead-magnet-gate";
import { serializeJsonLd } from "@/lib/seo/schema-helpers";

// Foil's first lead magnet (ADR-068). The "overpay" concept needs clean live
// vs-sold data, which is unavailable now (PokeTrace cancelled 2026-06-16; the
// buy_signals cache is stale + only 5 usable ABOVE rows), so per the goal's
// fallback we ship the EVERGREEN pricing cheat sheet, distilled from the
// already-ranking pillar content (condition guide / value calculator / Japanese
// value). No live-pricing dependency, no fabricated figures: every number here
// is the same evergreen guidance Foil's pillars already publish. The page (this
// preview + the condition framing) is indexable; the full reference is the
// reward for subscribing, delivered ON-PAGE (no Beehiiv send dependency).

const TITLE = "The Pokémon Card Pricing Cheat Sheet (free) | Foil";
const DESCRIPTION =
  "A free one-page reference for pricing any Pokémon card: the three fields to read off the card, eBay sold vs TCGplayer market, the condition multipliers (NM through DMG), raw vs graded, and when grading is worth it.";
const URL_PATH = "/free/pokemon-card-pricing-cheat-sheet";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL_PATH },
  robots: { index: true, follow: true },
  openGraph: {
    type: "article",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Foil",
    url: URL_PATH,
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@foilcards",
    images: ["/opengraph-image"],
  },
};

const LINK = "font-medium text-foil-navy underline decoration-foil-gold underline-offset-4 hover:text-foil-coral";

// Condition multipliers — the headline artifact, shown free as the preview.
// These ranges are the same the condition-guide pillar publishes.
const CONDITION_ROWS: { tier: string; pct: string; note: string }[] = [
  { tier: "Near Mint (NM)", pct: "100%", note: "The reference. Sharp corners, clean glossy surface, no visible whitening." },
  { tier: "Lightly Played (LP)", pct: "80–90%", note: "Whitening on an edge or corner under direct light; nothing obvious from arm's length." },
  { tier: "Moderately Played (MP)", pct: "60–75%", note: "Obvious edge wear, minor surface scratches. Generally not a grading candidate." },
  { tier: "Heavily Played (HP)", pct: "40–55%", note: "Major whitening, surface scratches from arm's length, a possible soft bend." },
  { tier: "Damaged (DMG)", pct: "20–35%", note: "Tears, water damage, creases that break the front face, or ink." },
];

export default function PricingCheatSheetPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "The Pokémon Card Pricing Cheat Sheet",
    description: DESCRIPTION,
    inLanguage: "en-US",
    author: { "@type": "Organization", name: "Foil" },
    publisher: { "@type": "Organization", name: "Foil" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <article className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-wider text-foil-gold">Free cheat sheet</p>
        <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.1] tracking-[-0.01em] text-foil-navy sm:text-5xl">
          The Pokémon Card Pricing Cheat Sheet
        </h1>
        <p className="mt-6 text-lg text-foil-slate">
          Stop guessing what a card is worth and stop overpaying on eBay. This is the
          one-page reference for pricing any Pokémon card the way a dealer does: read
          three printed fields, check the right source, adjust for condition, and know
          when the graded comp is the only one that matters. Built by Foil, free.
        </p>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-3xl">
            What&apos;s inside
          </h2>
          <ul className="mt-4 space-y-2 text-foil-navy/85">
            {[
              "The three fields to read off any card (and why the name alone never prices it)",
              "Where to look up price: eBay sold vs TCGplayer market vs the graded ladder",
              "The condition multipliers, NM through DMG (free preview below)",
              "Raw vs graded, and the three-part test for when grading is worth the fee",
              "A quick note on pricing Japanese cards",
              "The five pricing mistakes that cost collectors the most",
              "A 60-second routine you can run on any card",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Free preview — the condition-multiplier table (the most-used artifact). */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-3xl">
            The condition multipliers
          </h2>
          <p className="mt-3 text-foil-navy/85">
            Every pricing source quotes a Near Mint price by default. If your card is
            not NM, adjust by these multipliers, the ones bulk buyers and TCGplayer
            sellers actually use:
          </p>
          <div className="mt-5 overflow-hidden rounded-2xl border border-foil-navy/10 shadow-sm shadow-foil-navy/5">
            <table className="w-full text-left text-sm">
              <thead className="bg-foil-navy/5 text-foil-navy">
                <tr>
                  <th className="px-4 py-3 font-semibold">Condition</th>
                  <th className="px-4 py-3 font-semibold tabular-nums">% of NM</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">What it means</th>
                </tr>
              </thead>
              <tbody className="text-foil-navy/85">
                {CONDITION_ROWS.map((r) => (
                  <tr key={r.tier} className="border-t border-foil-navy/10">
                    <td className="px-4 py-3 font-medium text-foil-navy">{r.tier}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-foil-navy">{r.pct}</td>
                    <td className="hidden px-4 py-3 sm:table-cell">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-foil-slate">
            Full breakdown of the defects that move a card down a tier is in the{" "}
            <Link href="/pokemon-card-condition-guide" className={LINK}>condition guide</Link>.
          </p>
        </section>

        {/* The gate: unlock the rest of the cheat sheet by subscribing. */}
        <div className="mt-14">
          <LeadMagnetGate source="lead_magnet_cheatsheet">
            <CheatSheetBody />
          </LeadMagnetGate>
        </div>
      </article>
    </>
  );
}

// The gated reward: the full reference, revealed in place on subscribe.
function CheatSheetBody() {
  return (
    <div className="space-y-12">
      <section>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-3xl">
          1. The three fields to read off any card
        </h2>
        <p className="mt-3 text-foil-navy/85">
          Pricing starts with three printed fields. Skip one and you price a different
          card than the one in your hand.
        </p>
        <ul className="mt-4 space-y-3 text-foil-navy/85">
          <li>
            <span className="font-medium text-foil-navy">Name and mechanic suffix.</span> A
            Charizard is not a Charizard ex, V, VMAX, or VSTAR. The suffix sets the price
            band more than the base name does. Read it verbatim.
          </li>
          <li>
            <span className="font-medium text-foil-navy">Set code.</span> The 2 to 4
            character code at the bottom (<code className="rounded bg-foil-navy/10 px-1.5 py-0.5 font-mono text-[0.92em] text-foil-navy">SVI</code>,{" "}
            <code className="rounded bg-foil-navy/10 px-1.5 py-0.5 font-mono text-[0.92em] text-foil-navy">MEW</code>,{" "}
            <code className="rounded bg-foil-navy/10 px-1.5 py-0.5 font-mono text-[0.92em] text-foil-navy">OBF</code>). Names
            repeat across dozens of sets; the set code is what disambiguates the print.
          </li>
          <li>
            <span className="font-medium text-foil-navy">Collector number (XXX/YYY).</span> The
            left number can legitimately exceed the right one. A card printed{" "}
            <code className="rounded bg-foil-navy/10 px-1.5 py-0.5 font-mono text-[0.92em] text-foil-navy">199/167</code> is a
            real secret or special illustration rare, not a typo.
          </li>
        </ul>
        <p className="mt-3 text-sm text-foil-slate">
          Walkthrough with examples:{" "}
          <Link href="/pokemon-card-value-calculator" className={LINK}>the value calculator guide</Link>.
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-3xl">
          2. Where to look up the price
        </h2>
        <ul className="mt-4 space-y-3 text-foil-navy/85">
          <li>
            <span className="font-medium text-foil-navy">eBay sold listings.</span> Ground
            truth for what a buyer actually paid. Filter to Sold, last 30 days, your
            condition, and take the median of 5 to 10. Active listings run 30 to 50%
            above sold, so never quote a value from an active listing.
          </li>
          <li>
            <span className="font-medium text-foil-navy">TCGplayer market price.</span> Most
            accurate for in-print, modern singles where daily volume smooths the noise.
          </li>
          <li>
            <span className="font-medium text-foil-navy">PriceCharting graded ladder.</span> The
            reference for any graded card or grading candidate (Ungraded, Grade 7, 8, 9,
            PSA 10, BGS 9.5, CGC 10).
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-3xl">
          3. Raw vs graded, and when grading is worth it
        </h2>
        <p className="mt-3 text-foil-navy/85">
          For any card worth more than ~$30 raw in NM, the graded comp is where the real
          money sits. PSA 10 is the ceiling; PSA 9 is often 20 to 40% of the PSA 10 price
          on chase cards. Grading makes sense only when all three are true:
        </p>
        <ul className="mt-4 space-y-2 text-foil-navy/85">
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
            <span>The raw card visibly grades NM or better (sharp corners, clean surface, centering ~60/40 or better front).</span>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
            <span>The PSA 10 comp is at least 5x the raw price after grading fees and the realistic chance of landing a 10.</span>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
            <span>There is recent (last 90 days) PSA 10 sold data, not just a population report.</span>
          </li>
        </ul>
        <p className="mt-3 text-sm text-foil-slate">
          The full defect taxonomy and grading ladder:{" "}
          <Link href="/pokemon-card-condition-guide" className={LINK}>the condition guide</Link>.
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-3xl">
          4. Japanese cards, quickly
        </h2>
        <p className="mt-3 text-foil-navy/85">
          Japanese SAR and SIR prints from sub-sets often sell for 1.5 to 3x their
          English counterparts; commons and uncommons usually trade below English. The
          set code prefix encodes the era (<code className="rounded bg-foil-navy/10 px-1.5 py-0.5 font-mono text-[0.92em] text-foil-navy">sv</code>,{" "}
          <code className="rounded bg-foil-navy/10 px-1.5 py-0.5 font-mono text-[0.92em] text-foil-navy">s</code>,{" "}
          <code className="rounded bg-foil-navy/10 px-1.5 py-0.5 font-mono text-[0.92em] text-foil-navy">sm</code>), and a
          trailing letter (a, b) marks the sub-sets where the chase cards live. Price
          against US eBay sold in USD, not the Japan-domestic listing.
        </p>
        <p className="mt-3 text-sm text-foil-slate">
          More:{" "}
          <Link href="/japanese-pokemon-cards-value" className={LINK}>the Japanese cards value guide</Link>.
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-3xl">
          5. The five mistakes that cost the most
        </h2>
        <ul className="mt-4 space-y-2 text-foil-navy/85">
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
            <span>Pricing off active listings instead of sold listings.</span>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
            <span>Ignoring the set code (a Base Set Charizard and an Evolutions Charizard share a name).</span>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
            <span>Quoting the NM price for a played card (apply the multiplier first).</span>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
            <span>Trusting a single sale (take the median of several recent ones).</span>
          </li>
          <li className="flex items-start gap-3">
            <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
            <span>Skipping the graded comp on a card that is NM or better.</span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-3xl">
          6. The 60-second routine
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-foil-navy/85">
          <li>Read the name and suffix, the set code, and the collector number.</li>
          <li>Search eBay sold, last 30 days, in your card&apos;s condition; take the median of 5 to 10.</li>
          <li>If the card is not NM, apply the condition multiplier above.</li>
          <li>If it grades NM or better and is valuable, check the PSA 10 comp before you sell or buy.</li>
          <li>Never quote a value from an active listing.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-foil-gold/40 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-7">
        <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          This is the static reference. The deals move daily.
        </h2>
        <p className="mt-2 text-foil-slate">
          The cheat sheet tells you what a card is worth. Foil&apos;s weekly drop applies
          it to live listings so you never overpay again: the best live card deals right
          now, the cards on the move, and one sharp valuation note. You&apos;re already
          subscribed, so it is on its way. In the meantime, see{" "}
          <Link href="/deals" className={LINK}>today&apos;s best deals</Link> or{" "}
          <Link href="/cards" className={LINK}>browse the catalog</Link>.
        </p>
      </section>
    </div>
  );
}
