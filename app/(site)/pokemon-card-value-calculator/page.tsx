import type { Metadata } from "next";
import Link from "next/link";
import { LeadMagnetCTA } from "@/components/lead-magnet-cta";

const TITLE = "Pokémon Card Value Calculator: Price Any Card (2026)";
const DESCRIPTION =
  "How to find what a Pokémon card is really worth: eBay sold averages vs TCGplayer market, condition adjustments, and graded comps.";
const URL_PATH = "/pokemon-card-value-calculator";
const PUBLISHED_AT = "2026-05-20";
const MODIFIED_AT = "2026-05-20";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL_PATH },
  openGraph: {
    type: "article",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Foil",
    url: URL_PATH,
    // A page that exports its own openGraph does NOT inherit the file-based
    // app/opengraph-image.tsx, so reference the dynamic OG explicitly or the
    // share card renders blank (see /deals for the canonical pattern).
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@FoilTCG",
    images: ["/opengraph-image"],
  },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I find out what my Pokémon card is worth?",
    a: "Read three fields off the card — name, set code, and collector number — then look those three values up against eBay sold listings (not active listings) in Near Mint condition. The active listing price is what sellers hope to get; the sold price is what buyers actually paid in the last 30 days. Adjust down for condition: Lightly Played is usually 80–90% of NM, Moderately Played 60–75%, and Heavily Played 40–55%. For graded cards (PSA, BGS, CGC), use PriceCharting's graded ladder instead, because eBay's mix of slabs and raws makes the average misleading.",
  },
  {
    q: "Is eBay sold price or TCGplayer market price more accurate?",
    a: "Both, for different cards. TCGplayer market price is more accurate for in-print, current-set singles where there is constant turnover — daily transactions smooth out outliers. eBay sold averages are more accurate for older cards, graded slabs, and anything with low TCGplayer volume, because eBay aggregates a wider buyer pool and shows recent comparable sales individually. The pragmatic rule: cross-check both. If they disagree by more than 20%, trust eBay sold for vintage and graded, and TCGplayer market for modern raws.",
  },
  {
    q: "What is a Pokémon card's collector number, and why does it matter for pricing?",
    a: "The collector number is the XXX/YYY pair printed at the bottom of the card — the card's index within the set out of the total card count. It matters because Pokémon set names are reused (there are dozens of Charizards from dozens of sets), and the collector number plus set code is the only way to disambiguate which specific print you have. A Base Set Charizard 4/102 sells for hundreds; a 2016 Evolutions Charizard 11/108 sells for under twenty. Same artwork, same Pokémon, different number — different price.",
  },
  {
    q: "Does a Pokémon card's condition really change the price that much?",
    a: "Yes — especially at the extremes. For modern bulk, condition barely matters; the card is worth pennies either way. For chase cards and vintage, condition is the dominant variable. A 1999 Base Set Charizard in NM sells for ~$300; the same card in HP sells for ~$60. A PSA 9 of that same card sells for ~$1,200; a PSA 10 sells for $20,000+. The 'is it worth grading' question lives entirely inside the condition gap.",
  },
  {
    q: "What's the difference between a card's market price and its book value?",
    a: "Book value is a historical reference — what the card was worth when a price guide was last updated. Market price is what buyers will pay today. For Pokémon, book value (the kind printed in Beckett magazines) is functionally obsolete; the market moves too fast and is too thin in places for a static guide to track. Use real, recent sold data — eBay sold listings filtered to the last 30 days, TCGplayer market price, or an aggregator like PriceCharting that combines both.",
  },
  {
    q: "Can a Pokémon card value calculator price every card automatically?",
    a: "It can, if it reads the printed metadata correctly. Foil's calculator works by reading the name, set code, and collector number directly off the card photo — the same three fields a human pricer reads — and then pulling live eBay sold and TCGplayer market data for that exact print. The hard part is the read, not the lookup. Cards with worn edges, glare, or low-resolution photos are where automatic pricing breaks down; that's why Foil returns a confidence score per card and flags low-confidence reads for manual review instead of guessing.",
  },
];

export default function PokemonCardValueCalculatorPage() {
  const schemaGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: TITLE,
        description: DESCRIPTION,
        datePublished: PUBLISHED_AT,
        dateModified: MODIFIED_AT,
        author: { "@type": "Organization", name: "Foil" },
        publisher: { "@type": "Organization", name: "Foil" },
        inLanguage: "en-US",
      },
      {
        "@type": "FAQPage",
        inLanguage: "en-US",
        mainEntity: FAQ.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaGraph) }}
      />
      <article className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-wider text-foil-gold">
          Guide · Updated May 2026
        </p>
        <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.1] tracking-[-0.01em] text-foil-navy sm:text-5xl">
          Pokémon Card Value Calculator: How to Price Any Card Without Guessing
        </h1>
        <p className="mt-6 text-lg text-foil-slate">
          You&apos;re looking at a Pokémon card and want to know what it&apos;s actually worth — not
          what someone is asking, what it really sells for. This guide walks through the three fields
          you have to read off the card, where to look up the price, how condition adjusts the
          number, and when the graded comp is the only one that matters.
        </p>

        <Prose>
          <h2>The three fields that determine a Pokémon card&apos;s value</h2>
          <p>
            Every Pokémon card valuation starts with reading three printed fields. Skip any one of
            them and you will price a different card than the one in your hand.
          </p>

          <h3>1. The Pokémon name</h3>
          <p>
            The most obvious field, and the easiest to misread. A &quot;Charizard&quot; is not the
            same card as a &quot;Charizard ex&quot;, a &quot;Charizard V&quot;, a &quot;Charizard
            VMAX&quot;, or a &quot;Charizard VSTAR&quot;. The mechanic suffix matters more than the
            base name — a Charizard ex sells in a different price band than a base Charizard from
            the same set. Read the full printed name verbatim, including the suffix.
          </p>

          <h3>2. The set code</h3>
          <p>
            The two-to-four-character abbreviation printed at the bottom of the card identifies the
            set. Modern English sets use codes like <code>SVI</code> (Scarlet &amp; Violet base),{" "}
            <code>MEW</code> (151), <code>OBF</code> (Obsidian Flames), <code>PAR</code>{" "}
            (Paradox Rift), <code>SSP</code> (Surging Sparks). Older cards may not have a set code
            printed at all — instead they have a set symbol next to the rarity icon, and you
            identify the set from the symbol. Set name and set code disambiguate which specific
            release you&apos;re holding, because Pokémon names repeat across sets constantly.
          </p>

          <h3>3. The collector number</h3>
          <p>
            The <code>XXX/YYY</code> pair next to the set code — your card&apos;s index out of the
            total card count. The left number can legitimately exceed the right number; those are
            secret rares or special illustration rares printed beyond the official set count. A
            modern Charizard ex SIR printed as <code>199/167</code> is a real card, not a typo.
          </p>
          <p>
            The set code and collector number together uniquely identify a print. The name alone is
            not enough — there have been over 100 distinct Charizard cards printed since 1999.
          </p>

          <h2>Where to look up the price</h2>
          <p>
            Once you have name + set code + collector number, you need real, recent sales data — not
            a static price guide. Use these three sources to triangulate.
          </p>

          <h3>eBay sold listings</h3>
          <p>
            The closest thing to ground truth for what an English-speaking buyer will pay today.
            Search the card name, set code, and collector number; filter to <strong>Sold
            Listings</strong>, last 30 days. Skip the high and low outliers and take a median of
            five to ten recent sales in your card&apos;s condition. Active listings are what sellers
            hope to get and are routinely 30–50% above sold — never quote a card&apos;s value from
            an active eBay listing.
          </p>

          <h3>TCGplayer market price</h3>
          <p>
            TCGplayer publishes a market price for every English single it sells, calculated as a
            weighted average of recent transactions on the platform. For in-print, modern singles
            (Surging Sparks, Prismatic Evolutions, Stellar Crown), TCGplayer market is usually the
            most accurate single number because daily volume smooths out the noise. For vintage and
            graded slabs, TCGplayer is less reliable — eBay&apos;s wider buyer pool gives a better
            number.
          </p>

          <h3>PriceCharting graded ladder</h3>
          <p>
            PriceCharting aggregates eBay sold data into a ladder — Ungraded, Grade 7, Grade 8,
            Grade 9, PSA 10, BGS 9.5, CGC 10. For any graded card or any card you&apos;re thinking
            about grading, this ladder is the only sane reference. The gap between a PSA 9 and PSA
            10 is the only price gap that justifies sending a card to a grader, and PriceCharting
            shows you that gap on every card it covers.
          </p>

          <h2>How condition adjusts the price</h2>
          <p>
            All three pricing sources above quote a Near Mint price by default. If your card is not
            NM, you have to adjust. The rough multipliers below are what bulk buyers and TCGplayer
            sellers actually use, calibrated against thousands of comparable sales:
          </p>
          <ul>
            <li>
              <strong>Near Mint (NM):</strong> 100% — the reference. Sharp corners, glossy surface,
              no visible whitening on the back edges.
            </li>
            <li>
              <strong>Lightly Played (LP):</strong> 80–90% of NM. Slight edge wear or whitening
              visible only on close inspection.
            </li>
            <li>
              <strong>Moderately Played (MP):</strong> 60–75% of NM. Obvious edge wear, minor
              surface scratches, possible small dings.
            </li>
            <li>
              <strong>Heavily Played (HP):</strong> 40–55% of NM. Major whitening, creases, surface
              scratches across the artwork.
            </li>
            <li>
              <strong>Damaged (DMG):</strong> 20–35% of NM. Tears, water damage, or creases that
              break the front face.
            </li>
          </ul>
          <p>
            For chase cards ($100+ NM) the condition gap widens — buyers chasing graded potential
            pay almost exclusively for NM and reject anything below LP. For bulk cards (under $5
            NM), condition compresses; nearly all bulk sells at a flat rate per pound regardless of
            grade.
          </p>

          <h2>When to use the graded comp instead of the raw price</h2>
          <p>
            If a raw NM card is worth $30 and the PSA 10 of that same card sells for $1,800, the
            raw price is no longer the right valuation — the card is a grading candidate. Use the
            graded comp when all three of these are true:
          </p>
          <ul>
            <li>
              The raw card visibly grades NM or better on quick inspection (corners sharp, surface
              clean, centering looks 60/40 or better front).
            </li>
            <li>
              The PSA 10 comp is at least 5× the raw price after subtracting $25–$50 in grading
              fees and turnaround time.
            </li>
            <li>
              There is recent (last 90 days) PSA 10 sold data, not just a stale population report.
            </li>
          </ul>
          <p>
            Foil shows both numbers on every card, the raw NM price from eBay sold and the highest
            graded comp from PriceCharting, and flags the gap on screen so you can make the grading
            call instantly instead of opening two tabs.
          </p>

          <h2>Common Pokémon card valuation mistakes</h2>
          <ul>
            <li>
              <strong>Pricing off active listings.</strong> Active listings are seller hopes. Always
              filter eBay to Sold Listings.
            </li>
            <li>
              <strong>Ignoring the set code.</strong> A Base Set Charizard and an Evolutions
              Charizard share the same name and artwork. The set code is the only field that tells
              them apart.
            </li>
            <li>
              <strong>Quoting NM price for a played card.</strong> Apply the condition multiplier
              before quoting a buy or sell price.
            </li>
            <li>
              <strong>Trusting a single sale.</strong> One $500 eBay sale doesn&apos;t set a market.
              Take the median of five to ten recent sales.
            </li>
            <li>
              <strong>Skipping the graded comp on potential grades.</strong> A card might be worth
              $30 raw and $1,500 in a PSA 10 slab. Always check both for cards in NM or better.
            </li>
          </ul>

          <h2>How Foil&apos;s value calculator works</h2>
          <p>
            Foil reads the printed name, set code, and collector number directly off the photo —
            the same three fields a human pricer reads — and pulls live eBay sold data, TCGplayer
            market price, and the PriceCharting graded ladder for that exact print. The result
            screen shows the best ungraded comp on the headline and the full per-source breakdown
            one tap away. If we can&apos;t identify a card confidently, we tell you instead of
            guessing.{" "}
            <Link
              href="#waitlist"
              className="font-medium text-foil-navy underline decoration-foil-gold underline-offset-4 hover:text-foil-coral"
            >
              Join the waitlist
            </Link>{" "}
            to be notified when early access opens.
          </p>

          <h2>Related guides</h2>
          <ul>
            <li>
              <Link href="/japanese-pokemon-cards-value" className="font-medium text-foil-navy underline decoration-foil-gold underline-offset-4 hover:text-foil-coral">
                Japanese Pokémon cards value
              </Link>{" "}
              — pricing Japanese sets in USD and reading sv-era set codes.
            </li>
            <li>
              <Link href="/pokemon-card-condition-guide" className="font-medium text-foil-navy underline decoration-foil-gold underline-offset-4 hover:text-foil-coral">
                Pokémon card condition guide
              </Link>{" "}
              — NM vs LP vs MP grading, defect taxonomy, and when grading is worth it.
            </li>
            <li>
              <Link href="/blog" className="font-medium text-foil-navy underline decoration-foil-gold underline-offset-4 hover:text-foil-coral">
                Foil blog
              </Link>{" "}
              — field notes on Pokémon card prices, deals, and grading.
            </li>
          </ul>

          <h2>FAQ</h2>
          <div className="mt-6 space-y-6">
            {FAQ.map(({ q, a }) => (
              <div key={q}>
                <h3 className="font-display text-lg font-semibold text-foil-navy">{q}</h3>
                <p className="mt-2 text-foil-navy/85">{a}</p>
              </div>
            ))}
          </div>
        </Prose>

        <LeadMagnetCTA id="waitlist" />
      </article>
    </>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 max-w-none text-foil-navy/85 [&_code]:rounded [&_code]:bg-foil-navy/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:text-foil-navy [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-foil-navy sm:[&_h2]:text-3xl [&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foil-navy [&_p]:mt-4 [&_p]:leading-relaxed [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:leading-relaxed [&_strong]:text-foil-navy">
      {children}
    </div>
  );
}

