import type { Metadata } from "next";
import Link from "next/link";
import { EmailCapture } from "@/components/email-capture";

const TITLE = "Pokémon Card Condition Guide: NM, LP, MP, HP & Graded Tiers Explained | Foil";
const DESCRIPTION =
  "How TCGplayer condition tiers actually work, the defects that drop a card's value, and when a card is a grading candidate vs a raw sell — calibrated against thousands of comparable sales.";
const URL_PATH = "/pokemon-card-condition-guide";
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
    q: "What's the difference between Near Mint and Lightly Played?",
    a: "Near Mint is the reference grade: sharp corners, no whitening visible to the eye, glossy and unscratched surface, and clean back edges. Lightly Played is a card that's been handled — there's whitening visible on at least one edge or corner when held under direct light, or a tiny surface scratch under glare, but nothing obvious from arm's length. The price gap between NM and LP is 10–20% for modern cards and can be 30–40% for vintage chase cards, because grading candidates have to be NM or better.",
  },
  {
    q: "Is a PSA 10 actually worth more than a PSA 9?",
    a: "For chase cards, yes — sometimes 5× to 50× more. For modern bulk and mid-tier cards, the gap is often only 1.5×–2×, which usually doesn't justify the grading fee plus turnaround risk. The rule of thumb: the PSA 10 / PSA 9 ratio scales with the card's raw value. A $5 raw card has a PSA 10 / PSA 9 ratio near 1.2×; a $300 raw card has a ratio of 5× or more. Always check the recent PSA 10 sold price (not population report) before sending a card to PSA.",
  },
  {
    q: "Can I grade a Pokémon card myself before sending it to PSA?",
    a: "You can pre-grade reliably enough to filter your submissions. Inspect under angled light for whitening on the four corners and the four edges, then surface-scan for scratches and print lines, then check centering by measuring the border on all four sides (PSA 10 requires roughly 55/45 or better front, 75/25 or better back). Cards with any visible whitening, any surface defect, or centering worse than 60/40 front are not PSA 10 candidates and likely cap at PSA 9. Pre-grading well saves the grading fee on cards that won't gem.",
  },
  {
    q: "Which grader is best for resale — PSA, BGS, CGC, or SGC?",
    a: "PSA still has the strongest resale premium for Pokémon — buyers default to PSA slabs and pay accordingly. BGS 10 Black Label commands a premium above PSA 10 for vintage, but BGS 9.5 generally underprices a PSA 10. CGC has gained ground on modern cards and sometimes matches PSA 10 prices on Japanese sets. SGC is the cheapest and fastest, but the resale haircut versus PSA is real. Default to PSA for anything you plan to sell within a year.",
  },
  {
    q: "Does centering really matter, or is that just a grader thing?",
    a: "It matters because graders enforce it. Two cards with identical surface and corners but different centering can land two grade tiers apart — a 55/45 PSA 10 and a 70/30 PSA 9. The PSA 9 sells for a fraction of the PSA 10. So while centering doesn't affect a card's playability or appearance from arm's length, it directly affects the slab grade and therefore the resale price. For grading-candidate cards, centering is the single most important defect to inspect.",
  },
  {
    q: "How much does a small crease or surface scratch cost a card?",
    a: "A surface scratch visible only under direct light drops a card from NM to LP — 10–20% off the price. A scratch visible from arm's length drops it to MP — 25–40% off. A crease that breaks the front surface drops the card to HP at best and often DMG, which is 45–80% off NM. The expensive part isn't the defect itself, it's that any of these knock the card out of grading candidacy entirely. A raw $50 NM card with one front crease is worth about $25 and is no longer a grading prospect.",
  },
];

export default function PokemonCardConditionGuidePage() {
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
          Pokémon Card Condition Guide: NM, LP, MP, HP, and the Graded Ladder
        </h1>
        <p className="mt-6 text-lg text-zinc-300">
          Condition is the variable that turns a $5 Pokémon card into a $500 card. This guide breaks
          down the TCGplayer raw-condition tiers as they&apos;re actually applied in the market, the
          defects that move a card down a tier, and the graded ladder from PSA 7 to PSA 10 — plus
          when grading is worth the fee and when the card stays raw.
        </p>

        <Prose>
          <h2>The five raw condition tiers, calibrated to real sale prices</h2>
          <p>
            TCGplayer publishes a five-tier raw condition scale. The same scale is used by virtually
            every English-language buyer, so the multipliers below are what bulk buyers and graded
            sellers actually apply — not theoretical ratios.
          </p>

          <h3>Near Mint (NM)</h3>
          <p>
            The reference grade — 100% of the published market price. Sharp, square corners. No
            visible whitening on the front or back edges, even under angled light. Glossy, clean
            surface with no scratches or print lines visible. Back design clean with no
            indentations. Roughly equivalent to a PSA 8 floor, though many NM cards grade higher.
          </p>

          <h3>Lightly Played (LP)</h3>
          <p>
            80–90% of NM. Whitening visible on at least one edge or corner under direct light, but
            nothing obvious from arm&apos;s length. May have a single small surface defect — a tiny
            scratch visible only under glare, or a faint print line. Still presents well in a
            sleeve. Roughly a PSA 7 floor.
          </p>

          <h3>Moderately Played (MP)</h3>
          <p>
            60–75% of NM. Obvious edge wear visible without close inspection. May have minor surface
            scratches across the artwork, light whitening on multiple corners, or small dings on the
            edges. Generally not a grading candidate. Plays well in a deck but doesn&apos;t hold a
            premium.
          </p>

          <h3>Heavily Played (HP)</h3>
          <p>
            40–55% of NM. Major whitening on multiple edges and corners. Surface scratches visible
            from arm&apos;s length. Possible small bend or crease that doesn&apos;t break through
            the front face. Often sold for play use only.
          </p>

          <h3>Damaged (DMG)</h3>
          <p>
            20–35% of NM. Tears, water damage, deep creases that break the front face, ink markings,
            or significant pieces missing. Effectively unsellable above bulk prices unless the card
            is itself rare enough that condition is secondary — a damaged Base Set Charizard still
            commands $40–$60 because the floor demand is non-zero.
          </p>

          <h2>The defects that actually move a card down a tier</h2>
          <p>
            Four categories of defect drive virtually every condition downgrade. Inspect for them
            in this order:
          </p>

          <h3>1. Whitening</h3>
          <p>
            Whitening is the lightening of the dark card edge, caused by friction with sleeves,
            other cards, or handling. It&apos;s the single most common reason an otherwise clean
            card grades below PSA 10. Hold the card under angled overhead light and look at all
            eight edge-corner intersections. Any whitening visible without straining your eyes
            knocks the card to LP at minimum.
          </p>

          <h3>2. Surface defects (scratches, print lines, indentations)</h3>
          <p>
            Tilt the card under a single direct light source and look across the holo and the
            artwork. Hairline scratches that only show under glare are LP-tier. Scratches visible
            without glare are MP. Indentations (often from being stacked under heavier cards) are
            usually visible as faint depressions in the artwork — these are LP at best and
            disqualify the card from PSA 10 entirely.
          </p>

          <h3>3. Edgewear and corner damage</h3>
          <p>
            Look at each corner from the side — a perfect corner has a clean 90° point. Any
            rounding, fraying, or chipping is a tier drop. A single rounded corner with no other
            defects is LP; two or more rounded corners is MP.
          </p>

          <h3>4. Centering</h3>
          <p>
            Measure the border on all four sides of the front and back. PSA 10 generally requires
            roughly 55/45 or better front and 75/25 or better back. PSA 9 caps at roughly 65/35
            front and 90/10 back. Centering doesn&apos;t change the raw TCGplayer tier — a
            70/30-centered card with no other defects is still NM — but it caps the graded ceiling
            at PSA 9, which often halves the resale value of a chase card.
          </p>

          <h2>The graded ladder: PSA 7 to PSA 10 (and BGS, CGC, SGC equivalents)</h2>
          <p>
            For any card worth more than ~$30 raw in NM, the graded comp is where the real money
            sits. Each tier on the PSA ladder corresponds to a published condition standard, and
            each tier has its own market price.
          </p>
          <ul>
            <li>
              <strong>PSA 10 (Gem Mint):</strong> The grading ceiling. Roughly 55/45 centering or
              better front, no visible defects under direct light. Commands the highest comp by a
              wide margin on chase cards.
            </li>
            <li>
              <strong>PSA 9 (Mint):</strong> One minor flaw allowed — slight centering, a single
              tiny corner softness, a faint surface mark. Usually 20–40% of PSA 10 price on chase
              cards; 60–80% on modern bulk.
            </li>
            <li>
              <strong>PSA 8 (Near Mint–Mint):</strong> Two or three minor flaws. Roughly 10–25% of
              PSA 10 on chase cards.
            </li>
            <li>
              <strong>PSA 7 (Near Mint):</strong> Light, even wear visible on inspection. The
              minimum grade that still commands a noticeable premium over raw NM for vintage.
            </li>
            <li>
              <strong>PSA 6 and below:</strong> Mostly relevant for vintage. Played-grade slabs that
              authenticate the card but command minimal premium over raw.
            </li>
          </ul>
          <p>
            BGS uses a similar 1–10 scale with half-grades; BGS 9.5 is roughly equivalent to PSA 10
            but historically sells below it for Pokémon. BGS 10 (Pristine) and BGS 10 Black Label
            (all four subgrades 10) sit above PSA 10 on vintage. CGC uses a 1–10 scale with the
            same gem floor as PSA 10; CGC 10 prices have closed the gap to PSA 10 on modern
            Japanese sets but still trail on English vintage. SGC is the cheapest, fastest grader
            and underprices the rest by 15–25%.
          </p>

          <h2>When grading is worth it</h2>
          <p>
            Grading isn&apos;t free. PSA&apos;s standard tier runs ~$25 per card and 30–45 days
            turnaround as of 2026; bulk tiers are cheaper per card but cap the declared value.
            Grading makes sense when all three of these are true:
          </p>
          <ul>
            <li>
              The raw card visibly grades NM or better — sharp corners, clean surface, centering
              60/40 or better front under inspection.
            </li>
            <li>
              The PSA 10 comp is at least 5× the raw price after subtracting grading fees and
              accounting for the realistic probability of landing a PSA 10 (often 30–60%, not 100%).
            </li>
            <li>
              There is recent PSA 10 sold data — last 90 days, multiple sales, not just a
              population report or a single old auction result.
            </li>
          </ul>
          <p>
            If any one of those is false, the card stays raw. The most common mistake is grading on
            population-report optimism — &quot;there are only 50 PSA 10s of this card!&quot; — without
            checking whether anyone&apos;s actually paying the listed price in 2026.
          </p>

          <h2>How to grade your own card before submitting</h2>
          <p>
            Pre-grading well filters your submissions and saves the fee on cards that won&apos;t
            gem. The workflow:
          </p>
          <ul>
            <li>
              <strong>Whitening pass:</strong> Hold under angled overhead light. Inspect all eight
              edge-corner intersections. Any whitening — even faint — caps the card at PSA 9.
            </li>
            <li>
              <strong>Surface pass:</strong> Tilt under a single direct light source. Scan the
              holo, artwork, and text box for scratches, print lines, and indentations.
            </li>
            <li>
              <strong>Corner pass:</strong> Examine each corner from the side. Sharp 90° points
              only — any rounding caps at PSA 9.
            </li>
            <li>
              <strong>Centering pass:</strong> Measure the borders with calipers or a centering
              tool. Front roughly 55/45 or better is PSA 10 candidacy; 60/40–65/35 is PSA 9 cap;
              worse than 70/30 is below PSA 9.
            </li>
            <li>
              <strong>Back inspection:</strong> Flip and repeat the surface and centering passes on
              the back. Back centering 75/25 or better is PSA 10 candidacy.
            </li>
          </ul>
          <p>
            Cards that clear all five passes are PSA 10 candidates. Cards with one minor defect
            cap at PSA 9. Anything with multiple defects stays raw unless the floor PSA value still
            beats the raw price.
          </p>

          <h2>How Foil surfaces condition in pricing</h2>
          <p>
            Foil&apos;s scanner returns the best raw NM price from eBay sold and the highest
            graded comp from PriceCharting on every card, and flags the gap on screen. That way you
            see immediately when a $30 raw card has a $1,500 PSA 10 comp behind it — which is the
            moment to slow down, inspect for grading defects, and decide whether to keep it raw or
            submit.{" "}
            <Link
              href="#waitlist"
              className="text-[#FFB6A8] underline decoration-[#FF6B5C]/40 underline-offset-4 hover:text-[#FF6B5C]"
            >
              Join the waitlist
            </Link>{" "}
            to be notified when early access opens.
          </p>

          <h2>Related guides</h2>
          <ul>
            <li>
              <Link href="/pokemon-card-value-calculator" className="text-[#FF6B5C] underline decoration-[#FF6B5C]/40 underline-offset-4 hover:decoration-[#FF6B5C]">
                Pokémon card value calculator
              </Link>{" "}
              — the three printed fields you have to read off any card to price it correctly.
            </li>
            <li>
              <Link href="/japanese-pokemon-cards-value" className="text-[#FF6B5C] underline decoration-[#FF6B5C]/40 underline-offset-4 hover:decoration-[#FF6B5C]">
                Japanese Pokémon cards value
              </Link>{" "}
              — why Japanese SARs grade higher on average and when JP prints command a premium.
            </li>
            <li>
              <Link href="/blog" className="text-[#FF6B5C] underline decoration-[#FF6B5C]/40 underline-offset-4 hover:decoration-[#FF6B5C]">
                Foil blog
              </Link>{" "}
              — field notes on Pokémon card valuation, scanning, and grading.
            </li>
          </ul>

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

        <div
          id="waitlist"
          className="mt-16 rounded-3xl border border-[#FF6B5C]/30 bg-gradient-to-br from-[#101D38] via-[#0B1428] to-[#101D38] p-8 sm:p-12"
        >
          <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            Spot the next grading candidate before someone else does.
          </h2>
          <p className="mt-3 max-w-2xl text-zinc-300">
            Foil shows the raw NM price <em className="not-italic font-medium text-white">and</em>{" "}
            the highest graded comp on every card you scan — so the moment you see a $30 card with a
            $1,500 PSA 10 behind it, you know to slow down and inspect.{" "}
            <Link
              href="/upload"
              className="text-[#FFB6A8] underline decoration-[#FF6B5C]/40 underline-offset-4 hover:text-[#FF6B5C]"
            >
              Try the scanner
            </Link>{" "}
            once you&apos;re in.
          </p>
          <div className="mt-6 max-w-xl">
            <EmailCapture source="condition_guide" variant="inline" headline="Get the weekly best-deals newsletter." />
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

