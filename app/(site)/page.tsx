import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmailCapture } from "@/components/email-capture";
import { CARD_CATALOG, setIdsInCatalog } from "@/lib/cards/catalog";
import { BackgroundGradientAnimation } from "@/components/aceternity/background-gradient-animation";
import { MagneticLink } from "@/components/aceternity/magnetic-button";
import { Card3D } from "@/components/aceternity/card-3d";

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
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    creator: "@foilcards",
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
      {/* Session 46 (ADR-036): light decorative peek bridging the
          How-it-works → What-you-see seam. ~15% opacity, desktop-only. */}
      <CardPeek id="swsh35/74" side="right" />
      <ExampleResult />
      {/* Second peek bridging What-you-see → footer/CTA. */}
      <CardPeek id="swsh4/188" side="left" />
      <FinalCTA />
    </>
  );
}

// Session 43 (ADR-033) — modern grail seed list. Seven modern alt-art /
// rainbow chase cards + one vintage anchor (Base Set Charizard) form
// the hero backdrop. Session 46 (ADR-036) reordered the array so the
// three signature grails (Giratina, Rayquaza, Moonbreon) sit at the END
// — in a centered flex-wrap that lands them on the RIGHT, where the
// asymmetric scrim leaves the cards unobscured and clearly readable.
// Image URLs hit the Pokemon TCG SDK CDN directly — same data the
// per-card pages load, so the browser cache wins on subsequent nav.
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
    <section className="relative isolate overflow-hidden">
      {/* ADR-029: restrained bottom-right shimmer instead of a full-page
          rainbow. Cards on the page are the visual interest. */}
      <div className="absolute inset-0 -z-10">
        <BackgroundGradientAnimation
          variant="corner-shimmer"
          interactive={false}
          className="h-full w-full"
        />
      </div>

      {/* Card grid backdrop — Session 46 (ADR-036) bumped opacity 0.28 →
          0.5 and softened the blur to 0.25px (saturation back up to 0.9)
          so the grail cards read as a real showcase, not a ghosted
          texture. The asymmetric scrim below keeps the headline legible
          on the left while the cards stay vivid on the right. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-5 pt-6 sm:px-8 sm:gap-4 sm:pt-10"
        style={{ opacity: 0.5, filter: "blur(0.25px) saturate(0.9)" }}
      >
        {HERO_CARDS.map((c) => (
          <div key={c.id} className={`shrink-0 ${c.tilt}`}>
            <Card3D>
              <div className="relative aspect-[5/7] w-20 overflow-hidden rounded-md shadow-xl shadow-foil-navy/30 ring-1 ring-foil-navy/15 sm:w-24 md:w-28">
                <Image
                  src={`https://images.pokemontcg.io/${c.id}_hires.png`}
                  alt={c.alt}
                  width={240}
                  height={336}
                  unoptimized
                  className="h-full w-full object-cover"
                  priority={false}
                />
              </div>
            </Card3D>
          </div>
        ))}
      </div>

      {/* Copy-area scrim — Session 46 (ADR-036) made it ASYMMETRIC.
          Mobile: top-down cream fade so the stacked headline/lead read
          over the cards. Desktop (sm:): a left→right linear cream wash —
          solid on the left ~40% (headline + lead + CTA zone), fading to
          fully transparent by ~82% so the right-hand grails (Giratina,
          Rayquaza, Moonbreon) showcase unobscured. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-[5] bg-gradient-to-b from-foil-cream via-foil-cream/88 to-foil-cream/45 sm:bg-none sm:[background:linear-gradient(to_right,var(--color-foil-cream)_0%,var(--color-foil-cream)_38%,color-mix(in_oklab,var(--color-foil-cream)_72%,transparent)_55%,color-mix(in_oklab,var(--color-foil-cream)_35%,transparent)_70%,transparent_82%)]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
        <p className="inline-flex items-center gap-2 rounded-full border border-foil-gold/40 bg-foil-cream/80 px-3 py-1 text-xs font-medium text-foil-navy backdrop-blur-sm">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foil-gold opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foil-gold" />
          </span>
          Live · tracking {cardCount} cards across {setCount} sets
        </p>

        {/* Headline — single-color navy, type-led (ADR-029). Display font
            is Fraunces (humanist serif) as of Session 46 / ADR-036:
            warm + considered, the "trusted concierge" voice. */}
        <h1 className="font-display mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.01em] text-foil-navy sm:text-5xl md:text-6xl">
          Tell me a Pokémon card. I&apos;ll find you the best live deal.
        </h1>

        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-foil-navy/10 bg-foil-cream/70 px-3 py-1 text-xs font-medium text-foil-navy backdrop-blur-sm">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-foil-gold" />
          Built by a Level-4 TCGplayer Verified Seller
        </p>

        <p className="mt-5 max-w-2xl text-lg text-foil-slate sm:text-xl">
          Foil scans eBay&apos;s live listings, filters out the keyword-stuffed
          junk, and surfaces the single best-value listing for the card you want.
          Want it cheaper? Set a target price and we&apos;ll email you the moment
          a real listing drops to it.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <MagneticLink
            href="/start"
            className="rounded-xl bg-foil-navy px-6 py-3.5 text-base font-semibold text-foil-cream hover:bg-foil-coral"
          >
            Start tracking cards →
          </MagneticLink>
          <Link
            href="/cards"
            className="text-sm text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
          >
            Browse the catalog →
          </Link>
        </div>

        <p className="mt-5 text-xs text-foil-slate">
          Free. No spam, ever. Prefer just the weekly best-deals digest?{" "}
          <a
            href="#waitlist"
            className="text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
          >
            Grab the newsletter below.
          </a>
        </p>
      </div>
    </section>
  );
}

// Session 46 (ADR-036) — light decorative card peek. A single catalog
// card at ~15% opacity, tilted ~6°, anchored to one edge of a
// zero-height seam between sections so it straddles the boundary as a
// faint watermark. Desktop-only, aria-hidden, pointer-events-none, no
// animation — moderate warmth, NOT a full-page background.
function CardPeek({ id, side = "right" }: { id: string; side?: "left" | "right" }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none relative z-0 mx-auto hidden h-0 max-w-6xl px-5 sm:block sm:px-8"
    >
      <div
        className={`absolute -top-20 ${side === "right" ? "right-2 rotate-6" : "left-2 -rotate-6"}`}
        style={{ opacity: 0.15 }}
      >
        <Image
          src={`https://images.pokemontcg.io/${id}_hires.png`}
          alt=""
          width={200}
          height={280}
          unoptimized
          className="w-28 rounded-lg md:w-32"
        />
      </div>
    </div>
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
    <section className="border-y border-foil-navy/10 bg-foil-cream">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
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
          Get on the waitlist and we&apos;ll email you the moment early access
          opens, plus the weekly best-deals digest in the meantime.
        </p>
        <div className="mt-6 max-w-xl">
          <EmailCapture source="homepage_final_cta" variant="inline" headline="Get the weekly best-deals newsletter." />
        </div>
      </div>
    </section>
  );
}
