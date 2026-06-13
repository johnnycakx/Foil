import type { Metadata } from "next";
import Link from "next/link";
import { EmailCapture } from "@/components/email-capture";

const TITLE = "Japanese Pokémon Cards Value: 2026 Guide | Foil";
const DESCRIPTION =
  "See what Japanese Pokémon cards are actually worth in USD — sv3a, s4 set codes, SAR rarity, and when Japanese prints out-price English.";
const URL_PATH = "/japanese-pokemon-cards-value";
const PUBLISHED_AT = "2026-05-19";
const MODIFIED_AT = "2026-05-19";

export const metadata: Metadata = {
  // Dormant under the vending pivot (docs/vending Goal A §3): deal-finder
  // marketing pillar, de-indexed + off the sitemap. Code preserved in-tree.
  robots: { index: false, follow: false },
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL_PATH },
  openGraph: {
    type: "article",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Foil",
    url: URL_PATH,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@foilcards",
  },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "Are Japanese Pokémon cards worth more than English?",
    a: "Sometimes — and only for specific cards. Japanese SAR (Special Art Rare) and SIR (Special Illustration Rare) prints from sets like sv3a Raging Surf, sv4a Shiny Treasure, and sv6a Night Wanderer often sell for 1.5× to 3× their English counterparts because the print runs are smaller and the print quality is widely considered superior. Common and uncommon Japanese cards usually trade for less than English, because there is no competitive Play! Pokémon demand for them in the US.",
  },
  {
    q: "How do I read a Japanese Pokémon card if I don't read Japanese?",
    a: "Three fields matter and all three are language-agnostic. The set code is the 2–4 character string at the bottom-left (sv3a, s4, sv6a, sm12a). The collector number is the XXX/YYY pair next to it. The rarity symbol is the small icon at the bottom-right. With those three pieces you can look up any Japanese card on PriceCharting, TCGplayer, or Yuyu-tei — you do not need to translate the name.",
  },
  {
    q: "What does sv3a, s4, or sm12a mean on a Japanese Pokémon card?",
    a: "Those are Japanese set codes. The prefix encodes the era — 'sv' is Scarlet & Violet, 's' is Sword & Shield, 'sm' is Sun & Moon, 'xy' is XY. The number is the set order within that era. The lowercase letter (a, b, c) marks a sub-set or high-class set — typically smaller, premium releases like sv3a Raging Surf or sv4a Shiny Treasure ex. Sub-set codes ending in 'a' or 'b' are usually where the chase cards live.",
  },
  {
    q: "What's the difference between a Japanese SAR and an English Special Illustration Rare?",
    a: "They are the same rarity tier, but the Japanese SAR (Special Art Rare) was the original print and usually came out first. English Special Illustration Rares are reprinted from the Japanese set when the equivalent English set drops three to six months later. Because Japanese SARs hit the market earlier and in smaller quantities, they often retain a price premium even after the English version exists.",
  },
  {
    q: "Can a card scanner identify Japanese Pokémon cards?",
    a: "Foil's scanner reads Japanese cards by treating the set code, collector number, and rarity symbol as the source of truth — not the Pokémon's name. That means it identifies sv3a 071/062 Charizard ex SAR just as reliably as the English equivalent, because the printed metadata is universal. Japanese card scanning is supported at launch.",
  },
  {
    q: "Should I buy Japanese Pokémon cards to flip in the US market?",
    a: "Be selective. The flippable Japanese cards are SARs, SIRs, full-art trainers from sub-sets, and sealed booster boxes of high-demand sets (sv4a Shiny Treasure, s8b VMAX Climax, s11a Incandescent Arcana). Avoid bulk Japanese commons and uncommons — shipping and exchange-rate friction wipe out the margin. Always check the eBay sold price in your currency before importing, not the Yuyu-tei or Mercari Japan listing price.",
  },
];

export default function JapanesePokemonCardsValuePage() {
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
        <p className="text-xs font-medium uppercase tracking-wider text-[#FF6B5C]">
          Guide · Updated May 2026
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
          Japanese Pokémon Cards: A Complete Value Guide for English-Speaking Collectors
        </h1>
        <p className="mt-6 text-lg text-zinc-300">
          You spotted a Japanese Charizard ex on Mercari for ¥4,800 and the equivalent English print
          is $80 on TCGplayer. Is the Japanese version worth more, less, or roughly the same? This
          guide walks through how Japanese Pokémon cards are priced, how to read them without
          knowing the language, and which categories actually justify importing.
        </p>

        <Prose>
          <h2>Why Japanese Pokémon cards value diverges from English</h2>
          <p>
            Japanese Pokémon cards are printed first — every modern set drops in Japan three to six
            months before the English version. That head start matters for two reasons. The print
            runs are typically smaller relative to long-term demand, and Japanese card stock,
            centering tolerances, and holo application are widely considered the benchmark for the
            hobby. PSA gem-rate data backs this up: Japanese submissions consistently grade higher
            on average than English submissions of the same Pokémon.
          </p>
          <p>
            The catch is that this premium only applies to specific cards. A Japanese set is a
            slimmer release than an English set — usually 60–110 cards versus 200+ — so the
            chase-card ratio is denser. The cards that hold or grow value are the Special Art Rares
            (SAR), Special Illustration Rares (SIR), full-art trainers, and sealed product from
            sub-sets. Japanese commons and uncommons of the same Pokémon almost always trade below
            English because there is no Play! Pokémon competitive demand pulling them up in the US
            and UK markets.
          </p>

          <h2>How to read Japanese Pokémon cards (without speaking Japanese)</h2>
          <p>
            Identification comes down to three printed fields. None of them require Japanese
            literacy.
          </p>

          <h3>1. The set code</h3>
          <p>
            The set code is the short alphanumeric string at the bottom-left of the card. It tells
            you which release the card belongs to. The prefix encodes the era — <code>sv</code>{" "}
            for Scarlet &amp; Violet, <code>s</code> for Sword &amp; Shield, <code>sm</code> for
            Sun &amp; Moon, <code>xy</code> for XY. The number is the set order within that era,
            and a lowercase letter (<code>a</code>, <code>b</code>) marks a sub-set or high-class
            set. Examples:
          </p>
          <ul>
            <li>
              <strong>sv3a</strong> — Raging Surf (Scarlet &amp; Violet sub-set, home of the
              Charizard ex SAR)
            </li>
            <li>
              <strong>sv4a</strong> — Shiny Treasure ex (sub-set built around shiny variants)
            </li>
            <li>
              <strong>sv6a</strong> — Night Wanderer
            </li>
            <li>
              <strong>s4</strong> — Astonishing Volt Tackle
            </li>
            <li>
              <strong>s11a</strong> — Incandescent Arcana (Sword &amp; Shield sub-set, contains
              the Lugia and Charizard alt-arts)
            </li>
          </ul>
          <p>
            Sub-sets ending in <code>a</code> or <code>b</code> are where the chase cards almost
            always live. They are smaller, premium releases sold in slimmer boxes (10–11 packs
            instead of 30).
          </p>

          <h3>2. The collector number</h3>
          <p>
            Next to the set code you&apos;ll see <code>XXX/YYY</code> — the card&apos;s position
            in the set out of the total card count. <strong>The left number can exceed the right
            number</strong>, and when it does, the card is a secret rare or special illustration
            rare from beyond the official set count. A Japanese Charizard ex printed as{" "}
            <code>201/108</code> is a real, legitimate secret rare — not a typo and not a fake.
            English sets follow the same convention (e.g. <code>199/167</code>), so the rule
            transfers directly.
          </p>

          <h3>3. The rarity symbol</h3>
          <p>
            The icon in the bottom-right corner. The modern Japanese hierarchy from most common to
            rarest: ● (common), ◆ (uncommon), ★ (rare), ★★ (double rare / ex), AR (Art Rare), SR
            (Super Rare), SAR (Special Art Rare), UR (Ultra Rare, gold). For pricing purposes,
            anything from AR upward is where the money is — SAR and UR carry the highest premiums
            and are typically the only Japanese-exclusive prints worth importing to flip.
          </p>

          <h2>Japanese vs English Pokémon cards: a head-to-head</h2>
          <p>
            Beyond the price gap, the two markets differ in ways that affect how you buy, sell,
            and grade:
          </p>
          <ul>
            <li>
              <strong>Print quality:</strong> Japanese cards have a glossy, more saturated finish
              and tighter centering tolerances. PSA 10 rates are measurably higher.
            </li>
            <li>
              <strong>Card stock:</strong> Japanese stock is slightly thinner and stiffer.
              Whitening on edges is rarer.
            </li>
            <li>
              <strong>Back design:</strong> The Japanese back is a different blue pattern. PSA and
              CGC slab Japanese cards in the same case format, but the back is how you tell them
              apart instantly through a sleeve.
            </li>
            <li>
              <strong>Release timing:</strong> Japanese first, English ~4 months later. If you buy
              a Japanese SAR at release, you have a four-month window before the English version
              floods the market.
            </li>
            <li>
              <strong>Booster box ratios:</strong> Japanese boxes pull SARs and URs at a lower rate
              per box, but the box itself is cheaper (¥5,000–¥7,500 retail). EV math frequently
              favors Japanese boxes for sub-sets.
            </li>
          </ul>

          <h2>Where Japanese Pokémon cards are actually priced (and how a scanner reads them)</h2>
          <p>
            Skip the temptation to use the Mercari Japan or Yuyu-tei listing price as your number.
            That&apos;s the Japan-domestic price before shipping, exchange-rate spread, and US
            buyer demand. The realistic comparison is whatever the card sells for on US eBay in
            USD. Three sources to triangulate:
          </p>
          <ul>
            <li>
              <strong>eBay sold listings (US/UK):</strong> The ground truth for what an
              English-speaking buyer will pay today.
            </li>
            <li>
              <strong>TCGplayer:</strong> Lists many Japanese SARs and SIRs with separate SKUs.
              Lower volume than English, but useful for floor pricing.
            </li>
            <li>
              <strong>PriceCharting:</strong> Aggregates eBay sold data with a graded ladder
              (Ungraded, Grade 7, 8, 9, PSA 10, BGS 9.5, CGC 10). Strongest for graded comps.
            </li>
          </ul>

          <h2>How to identify a Japanese card without a translation app</h2>
          <p>
            The trustworthy approach: read the set code and collector number, then look it up. Do
            not try to translate the Pokémon name from the artwork — it&apos;s ambiguous (Vulpix
            vs Alolan Vulpix, Mr. Mime vs Galarian Mr. Mime) and that ambiguity is exactly where
            fake listings hide. Foil&apos;s identification pipeline follows the same rule for both
            English and Japanese prints: the printed set code and number are the source of truth,
            and the name is only a confirmation signal. If the set code reads <code>sv3a</code>{" "}
            and the number reads <code>071/062</code>, the card is the Charizard ex SAR from
            Raging Surf regardless of which language the name is printed in.{" "}
            <Link href="#waitlist" className="text-[#FFB6A8] underline decoration-[#FF6B5C]/40 underline-offset-4 hover:text-[#FF6B5C]">
              Join the waitlist
            </Link>{" "}
            to be notified when Japanese card scanning ships.
          </p>

          <h2>FAQ</h2>
          <div className="mt-6 space-y-6">
            {FAQ.map(({ q, a }) => (
              <div key={q}>
                <h3 className="text-lg font-semibold text-white">{q}</h3>
                <p className="mt-2 text-zinc-300">{a}</p>
              </div>
            ))}
          </div>
        </Prose>

        <div id="waitlist" className="mt-16 rounded-3xl border border-[#FF6B5C]/30 bg-gradient-to-br from-[#101D38] via-[#0B1428] to-[#101D38] p-8 sm:p-12">
          <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            Join the waitlist — Foil supports Japanese card scanning
          </h2>
          <p className="mt-3 max-w-2xl text-zinc-300">
            Snap one photo of a Japanese binder page or a Mercari listing screenshot. Foil reads the
            set code, collector number, and rarity symbol on every card and prices each one in USD
            using live eBay sold data.{" "}
            <Link href="/upload" className="text-[#FFB6A8] underline decoration-[#FF6B5C]/40 underline-offset-4 hover:text-[#FF6B5C]">
              Try the Japanese card scanner
            </Link>{" "}
            once you&apos;re in.
          </p>
          <div className="mt-6 max-w-xl">
            <EmailCapture source="japanese_guide" variant="inline" headline="Get the weekly best-deals newsletter." />
          </div>
        </div>
      </article>
    </>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="prose-foil mt-10 max-w-none text-zinc-300 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:text-[#FFC7BA] [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-white sm:[&_h2]:text-3xl [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_p]:mt-4 [&_p]:leading-relaxed [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:leading-relaxed [&_strong]:text-white">
      {children}
    </div>
  );
}

