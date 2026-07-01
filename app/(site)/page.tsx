import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmailCapture } from "@/components/email-capture";
import { CARD_CATALOG, setIdsInCatalog } from "@/lib/cards/catalog";
import { FoilCornerMark } from "@/components/brand/logo";

const SITE_TITLE = "Foil: the best price on any Pokémon card";
const SITE_DESCRIPTION =
  "See what your Pokémon cards are really worth and stop overpaying on eBay. Foil emails you the best card deals and price moves every week. Free, no spam.";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  // Every peer page declares its canonical; the homepage's is the site root.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Foil",
    url: "/",
    // The homepage exports its own openGraph, which does NOT inherit the
    // file-based app/opengraph-image.tsx — so reference the dynamic OG (the
    // FoilTCG wordmark card, ADR-055) explicitly or the share card is blank.
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    creator: "@FoilTCG",
    images: ["/opengraph-image"],
  },
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/upload");

  return (
    <>
      <Hero />
      <HowItWorks />
    </>
  );
}

// Session 43 (ADR-033) — modern grail seed list. Seven modern alt-art /
// rainbow chase cards + one vintage anchor (Base Set Charizard). As of
// Session 47 (ADR-037) these are a full-opacity foreground showcase
// fanned across the top of the hero — no longer a ghosted backdrop. The
// array order is the left-to-right fan order; tilts give each card
// character. Images are SELF-HOSTED (ADR-056): downloaded once + resized to
// small local webp under public/hero/ so the hero never depends on the flaky
// images.pokemontcg.io CDN (which intermittently rendered the row as broken
// images in prod). `id.replace("/","-")` maps "swsh7/215" → "/hero/swsh7-215.webp".
const HERO_CARDS: { id: string; alt: string; tilt: string }[] = [
  { id: "base1/4",    alt: "Charizard, Base Set (vintage anchor)",             tilt: "rotate-[2deg]"  },
  { id: "swsh35/74",  alt: "Charizard VMAX Rainbow Rare, Champions Path",      tilt: "-rotate-[3deg]" },
  { id: "swsh12/186", alt: "Lugia V Alt Art, Silver Tempest",                  tilt: "-rotate-[2deg]" },
  { id: "swsh8/269",  alt: "Mew VMAX Alt Art, Fusion Strike",                  tilt: "rotate-[7deg]"  },
  { id: "swsh4/188",  alt: "Pikachu VMAX Rainbow, Vivid Voltage",              tilt: "-rotate-[5deg]" },
  { id: "swsh11/186", alt: "Giratina V Alt Art, Lost Origin",                  tilt: "rotate-[5deg]"  },
  { id: "swsh7/218",  alt: "Rayquaza VMAX Alt Art, Evolving Skies",            tilt: "rotate-[4deg]"  },
  { id: "swsh7/215",  alt: "Umbreon VMAX Alt Art (Moonbreon), Evolving Skies", tilt: "-rotate-[6deg]" },
];

function Hero() {
  const cardCount = CARD_CATALOG.length;
  const setCount = setIdsInCatalog().length;
  return (
    <section className="relative isolate overflow-hidden bg-foil-cream">
      {/* ADR-038 (Session 47.1): the hero is solid cream. The decorative
          bottom-right gradient glow was removed (it read as a stray amber
          tint). No overlays, no glows. */}

      {/* Hero showcase — Session 47 (ADR-037). The grail row moved ABOVE
          the headline as a full-opacity fanned showcase: real cards, no
          blur, no desaturation, no scrim, no Card3D. The modern-grail seed
          list finally reads as the showcase it was meant to be. Static
          (subtle hover lift only); the globals.css reduced-motion reset
          collapses the lift for users who ask for it. Decorative → the
          row is aria-hidden so screen readers go straight to the pitch. */}
      <div
        aria-hidden
        className="mx-auto flex max-w-6xl items-center justify-center px-2 pt-8 sm:pt-12"
      >
        {HERO_CARDS.map((c, i) => (
          <div
            key={c.id}
            className={`relative ${c.tilt} ${i > 0 ? "-ml-6 sm:-ml-7 md:-ml-8" : ""} transition duration-200 ease-out hover:z-10 hover:-translate-y-2`}
          >
            <div className="relative aspect-[5/7] w-24 overflow-hidden rounded-lg bg-foil-cream shadow-lg shadow-foil-navy/25 ring-1 ring-foil-navy/10 sm:w-28 md:w-32 lg:w-40">
              <Image
                src={`/hero/${c.id.replace("/", "-")}.webp`}
                alt={c.alt}
                width={400}
                height={560}
                className="h-full w-full object-cover"
                // Above-the-fold hero showcase: load EAGERLY so the fanned row
                // never paints blank. The previous lazy default deferred all 8
                // fetches in prod, leaving empty rectangles on first paint.
                // Next 16 deprecated the old eager flag in favour of
                // `loading="eager"` + `fetchPriority="high"` (the documented
                // above-the-fold pattern); eager fetches on paint without the
                // "too many preloaded images" warning 8 `priority` flags trip.
                loading="eager"
                fetchPriority="high"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Pitch block — ONE message (homepage-v2 distill, G-EMAIL / ADR-065):
          subscribe to get the best deals + price moves by email. The deal-finder
          is the proof, demoted to secondary links below. The founder credit (a
          face + a plain byline) replaces the old seller-credential jargon badge:
          a face beats a credential nobody parses, and it seeds the X content
          pipeline. No scrim needed: the cards no longer overlap the text. */}
      <div className="relative mx-auto w-full max-w-3xl px-5 pt-10 pb-20 text-center sm:px-8 sm:pt-12 sm:pb-28">
        <p className="inline-flex items-center gap-2 rounded-full border border-foil-gold/40 bg-foil-cream/80 px-3 py-1 text-xs font-medium text-foil-navy backdrop-blur-sm">
          <FoilCornerMark px={13} />
          Live · tracking {cardCount} cards across {setCount} sets
        </p>

        {/* Headline — single-color navy, Fraunces display (ADR-036). The promise:
            stop guessing / stop overpaying. */}
        <h1 className="font-display mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.01em] text-foil-navy sm:text-5xl md:text-6xl">
          Stop guessing what your cards are worth and overpaying on eBay.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg text-foil-slate sm:text-xl">
          Foil watches the market and emails you the best deals and price moves
          every week.
        </p>

        {/* Primary action: subscribe. The concrete email promise (exactly what
            lands in the inbox) sits at the field (source="homepage_hero"). The
            component's own mt-14 provides the gap from the subhead above. */}
        <div className="mx-auto max-w-xl text-left">
          <EmailCapture
            source="homepage_hero"
            variant="inline"
            headline="Get the weekly drop, free."
            subtext="One email a week: the best live card deals right now, the cards on the move, and one sharp valuation note. No spam."
          />
        </div>

        {/* Founder presence: replaces the old seller-credential jargon badge.
            Slim credit (avatar + plain byline), not a card. */}
        <div className="mx-auto mt-6 flex max-w-xl items-center gap-3 text-left">
          <Image
            src="/founder/john-craig.webp"
            alt="John Craig, founder of Foil"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-foil-navy/10"
            // Above-the-fold + trust-critical (the face that replaces a
            // credential). Eager-load so it never paints blank (Next 16:
            // `loading="eager"` + `fetchPriority="high"`, the post-`priority`
            // pattern). The DUPLICATE footer avatar stays lazy — it's below the fold.
            loading="eager"
            fetchPriority="high"
          />
          <p className="text-sm text-foil-slate">
            <span className="font-medium text-foil-navy">Built by John Craig.</span>{" "}
            I run a Pokémon card store and got tired of digging through eBay junk
            to find the real deals, so I built Foil to do it for me.
          </p>
        </div>

        {/* Secondary: the deal-finder is the proof, and the reason to subscribe.
            It stays free + indexable; demoted to text links so the email field
            stays the primary action. All three entry points kept. */}
        <div className="mt-8 flex flex-col items-center justify-center gap-x-5 gap-y-2 text-sm sm:flex-row sm:flex-wrap">
          <span className="text-foil-slate">Want to look right now?</span>
          <Link
            href="/deals"
            className="font-medium text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
          >
            See today&apos;s best deals →
          </Link>
          <Link
            href="/cards"
            className="text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
          >
            Browse the catalog →
          </Link>
          <Link
            href="/start"
            className="text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
          >
            Start tracking cards →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ADR-055 — foil-corner card watermark marking the "How it works" band as the
// one distinct textured section (replaces the retired Pokeball pixel pattern).
// The brand's foil-corner glyph (navy card + folded gold corner) tiled in a
// half-drop stagger, in-palette. Wrapper opacity keeps it a faint watermark so
// text on top holds AA contrast.
function FoilCornerPattern() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06] sm:opacity-[0.08]"
    >
      <defs>
        {/* One foil-corner card glyph on a 32-unit grid (matches FoilCornerMark). */}
        <g id="foil-card">
          <path
            d="M 9.5 4 H 17 L 26 13 V 24.5 A 3.5 3.5 0 0 1 22.5 28 H 9.5 A 3.5 3.5 0 0 1 6 24.5 V 7.5 A 3.5 3.5 0 0 1 9.5 4 Z"
            fill="#0f1e3a"
          />
          <path d="M 17 4 H 26 V 13 Z" fill="#a8842f" />
          <path d="M 17 4 L 26 13 H 17 Z" fill="#c9a24b" />
        </g>
        {/* Half-drop stagger: card ~32 units on a 72px pitch so the marks breathe. */}
        <pattern id="foil-card-pattern" patternUnits="userSpaceOnUse" width="72" height="144">
          <use href="#foil-card" transform="translate(8 12) scale(1.4)" />
          <use href="#foil-card" transform="translate(-28 84) scale(1.4)" />
          <use href="#foil-card" transform="translate(44 84) scale(1.4)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#foil-card-pattern)" />
    </svg>
  );
}

function HowItWorks() {
  const steps = [
    {
      num: "1",
      title: "Search any Pokémon card",
      body: "Type a name, a set, or just 'Charizard Base Set.' Foil handles set codes, Japanese printings, and graded slabs.",
    },
    {
      num: "2",
      title: "Foil finds the best live deal",
      body: "We check eBay in real time and surface the most credible best-value listing. Price, shipping, condition, and seller rating, weighted into one pick, not a wall of 200 results.",
    },
    {
      num: "3",
      title: "Buy now or set a price alert",
      body: "Buy through to eBay and you support Foil at no extra cost. Or set a target price and we'll email you the second a matching listing appears.",
    },
  ];

  return (
    <section className="relative isolate overflow-hidden border-y border-foil-navy/10 bg-foil-cream">
      <FoilCornerPattern />
      <div className="relative mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-4xl">How it works</h2>
        <p className="mt-3 max-w-2xl text-foil-slate">
          Three steps. No comparing tabs, no scrolling endless listings, no
          wondering whether a seller is legit.
        </p>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <li
              key={s.num}
              className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 transition hover:shadow-md hover:shadow-foil-navy/10"
            >
              <span className="font-display inline-flex h-9 w-9 items-center justify-center rounded-full border border-foil-gold/40 bg-foil-gold/10 text-sm font-bold text-foil-navy">
                {s.num}
              </span>
              <h3 className="font-display mt-4 text-lg font-semibold text-foil-navy">{s.title}</h3>
              <p className="mt-2 text-sm text-foil-slate">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ExampleResult + FinalCTA removed (email-ask-cleanup, ADR-066): the homepage
// now makes exactly ONE email ask (the hero). HowItWorks remains as the
// indexable content body beneath the hero.
