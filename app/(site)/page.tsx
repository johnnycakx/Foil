import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmailCapture } from "@/components/email-capture";
import { CARD_CATALOG, setIdsInCatalog } from "@/lib/cards/catalog";
import { FoilCornerMark } from "@/components/brand/logo";

const SITE_TITLE = "Foil — The best price on any Pokémon card";
const SITE_DESCRIPTION =
  "Search any Pokémon card and instantly see the best live deal on eBay — curated by price, condition, and seller quality. Free wishlist alerts when your cards drop. Built by a Level-4 TCGplayer Verified Seller. TCGplayer coming soon.";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
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
    creator: "@foilcards",
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
      <ExampleResult />
      <FinalCTA />
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
                priority={false}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Pitch block — centered beneath the card fan. Email capture is the
          PRIMARY CTA (G-EMAIL / ADR-065): the owned newsletter list is the
          compounding moat (STRATEGY-AUDIENCE-MOAT). The deal-finder utility
          stays credible but is demoted to the secondary "reason to subscribe."
          No scrim needed: the cards no longer overlap the text. */}
      <div className="relative mx-auto w-full max-w-3xl px-5 pt-10 pb-20 text-center sm:px-8 sm:pt-12 sm:pb-28">
        <p className="inline-flex items-center gap-2 rounded-full border border-foil-gold/40 bg-foil-cream/80 px-3 py-1 text-xs font-medium text-foil-navy backdrop-blur-sm">
          <FoilCornerMark px={13} />
          Live · tracking {cardCount} cards across {setCount} sets
        </p>

        {/* Headline — single-color navy, Fraunces display (ADR-036). Leads with
            knowledge/value for the research-intent audience, then the drop. */}
        <h1 className="font-display mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.01em] text-foil-navy sm:text-5xl md:text-6xl">
          Know what any Pokémon card is really worth — and when it drops.
        </h1>

        <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-foil-navy/10 bg-foil-cream/70 px-3 py-1 text-xs font-medium text-foil-navy backdrop-blur-sm">
          <FoilCornerMark px={13} />
          Built by a Level-4 TCGplayer Verified Seller
        </p>

        <p className="mx-auto mt-5 max-w-xl text-lg text-foil-slate sm:text-xl">
          Foil scans eBay&apos;s live listings, filters out the keyword-stuffed
          junk, and tracks what every card is actually selling for. Get the
          weekly best-deals drop — real listings, real prices, one email a week
          from a Level-4 TCGplayer seller.
        </p>

        {/* Primary CTA: the newsletter. The email field sits in the hero,
            above the fold (source="homepage_hero"). The component's own mt-14
            provides the gap from the subcopy above. */}
        <div className="mx-auto max-w-xl text-left">
          <EmailCapture
            source="homepage_hero"
            variant="inline"
            headline="Get the weekly best-deals drop."
          />
        </div>

        {/* Secondary: the deal-finder utility is the reason to subscribe.
            Demoted to text links so the email field stays the primary action.
            All three utility entry points are kept (deals / catalog / watchlist). */}
        <div className="mt-6 flex flex-col items-center justify-center gap-x-5 gap-y-2 text-sm sm:flex-row sm:flex-wrap">
          <span className="text-foil-slate">Want to dive in now?</span>
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

function ExampleResult() {
  return (
    <section id="example" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foil-navy">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-foil-gold" />
            What you actually see
          </p>
          <h2 className="font-display mt-3 text-3xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-4xl">
            That Charizard you want? Currently $313 on eBay.
          </h2>
          <p className="mt-4 text-foil-slate">
            Foil doesn&apos;t dump you on a search page. It picks the single best
            live listing, shows what each condition and grade is worth, and tells
            you whether to buy now, lowball, or wait for a drop.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-foil-slate">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-foil-gold" />
              <span>
                <span className="font-medium text-foil-navy">One best deal, not 200 listings.</span>{" "}
                We score every active listing on price, shipping, condition, and
                seller rating, then show you the winner.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-foil-gold" />
              <span>
                <span className="font-medium text-foil-navy">Wishlist alerts that actually fire.</span>{" "}
                Tell Foil your target price and we email you the moment a matching
                listing appears.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-foil-gold" />
              <span>
                <span className="font-medium text-foil-navy">Graded vs raw, side by side.</span>{" "}
                The full grade ladder, raw NM through PSA 10, BGS, and CGC, so you
                can tell whether the raw is a steal or the slab is.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-foil-gold" />
              <span>
                <span className="font-medium text-foil-navy">Japanese and modern covered.</span>{" "}
                Vintage WOTC, modern Mega ex, Japanese-exclusive sets; if there&apos;s
                a listing, Foil finds it.
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-foil-gold/40 bg-foil-cream p-1 shadow-xl shadow-foil-navy/10">
          <div className="rounded-xl bg-foil-cream p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-foil-slate">
                  Best current deal
                </p>
                <p className="mt-1 text-4xl font-bold tabular-nums text-foil-navy">$313.51</p>
                <p className="mt-1 text-xs text-foil-slate">
                  9% below 30-day avg · top-rated seller · free ship
                </p>
              </div>
              <span className="rounded-full bg-foil-gold/15 px-2.5 py-1 text-xs font-medium text-foil-navy">
                Good deal
              </span>
            </div>

            <div className="mt-6 border-t border-foil-navy/10 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foil-navy">Charizard</p>
                  <p className="truncate text-sm text-foil-slate">
                    Base Set · #4/102 · Holo Rare (Unlimited)
                  </p>
                  <p className="mt-0.5 text-xs text-foil-slate">Lightly Played · NM verified by seller</p>
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-lg font-semibold tabular-nums text-foil-navy">$313.51</span>
                    <span className="text-xs text-foil-slate">+ free shipping</span>
                    <span className="text-xs text-foil-slate">·</span>
                    <span className="text-xs text-foil-slate">
                      PSA 10 currently:{" "}
                      <span className="font-semibold text-foil-navy">$30,100</span>
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-foil-navy px-2.5 py-1 text-xs font-medium text-foil-cream transition hover:bg-foil-coral">
                  Buy →
                </span>
              </div>
            </div>

            <p className="mt-5 rounded-lg border border-foil-gold/30 bg-foil-gold/5 px-3 py-2 text-xs text-foil-navy">
              Heads up: the raw is $313, but a PSA 10 of the same card recently sold
              for <span className="font-semibold">$30,100</span>. If the
              corners look mint, get it graded before reselling.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="waitlist" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="rounded-3xl border border-foil-gold/40 bg-foil-cream p-8 shadow-xl shadow-foil-navy/10 sm:p-12">
        <h2 className="font-display max-w-3xl text-3xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-4xl">
          Never overpay for a Pokémon card again.
        </h2>
        <p className="mt-3 max-w-2xl text-foil-slate">
          One email a week: the best live deals we found, the cards on the move,
          and one sharp valuation note. No spam, unsubscribe anytime.
        </p>
        <div className="mt-6 max-w-xl">
          <EmailCapture source="homepage_final_cta" variant="inline" headline="Get the weekly best-deals newsletter." />
        </div>
      </div>
    </section>
  );
}
