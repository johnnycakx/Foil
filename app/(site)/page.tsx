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
      <ExampleResult />
      <FoundingMember />
      <FinalCTA />
    </>
  );
}

// Session 43 (ADR-033) — modern grail seed list. Seven modern alt-art /
// rainbow chase cards + one vintage anchor (Base Set Charizard) form
// the hero backdrop. These ARE the cards collectors search for; the
// row reads as "these are the grails Foil watches" rather than "these
// are vintage cards from someone's binder." Image URLs hit the Pokemon
// TCG SDK CDN directly — same data the per-card pages load, so the
// browser cache wins on subsequent navigation.
const HERO_CARDS: { id: string; alt: string; tilt: string }[] = [
  { id: "swsh7/215",  alt: "Umbreon VMAX Alt Art (Moonbreon), Evolving Skies", tilt: "-rotate-[6deg]" },
  { id: "swsh7/218",  alt: "Rayquaza VMAX Alt Art, Evolving Skies",            tilt: "rotate-[4deg]"  },
  { id: "swsh35/74",  alt: "Charizard VMAX Rainbow Rare, Champions Path",      tilt: "-rotate-[3deg]" },
  { id: "swsh11/186", alt: "Giratina V Alt Art, Lost Origin",                  tilt: "rotate-[5deg]"  },
  { id: "swsh12/186", alt: "Lugia V Alt Art, Silver Tempest",                  tilt: "-rotate-[2deg]" },
  { id: "swsh8/269",  alt: "Mew VMAX Alt Art, Fusion Strike",                  tilt: "rotate-[7deg]"  },
  { id: "swsh4/188",  alt: "Pikachu VMAX Rainbow, Vivid Voltage",              tilt: "-rotate-[5deg]" },
  { id: "base1/4",    alt: "Charizard, Base Set (vintage anchor)",             tilt: "rotate-[2deg]"  },
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

      {/* Card grid backdrop — Session 43 (ADR-033): cards drop to 0.28
          opacity + a slight blur + reduced saturation so they read as
          an atmospheric "binder behind frosted glass" rather than the
          page's primary visual. The copy in front is the hero now; the
          cards are the texture. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-5 pt-6 sm:px-8 sm:gap-4 sm:pt-10"
        style={{ opacity: 0.28, filter: "blur(0.5px) saturate(0.65)" }}
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

      {/* Copy-area scrim — Session 43 (ADR-033). Sits ABOVE the cards
          (their wrapper is -z-10; this is -z-[5]) but BELOW the headline
          container (default stack). Mobile uses a top-down linear cream
          fade so the H1+lead paragraph sit on a clean cream slab; the
          desktop breakpoint replaces it with a radial-from-top-left
          gradient so the cards remain visible bottom-right while the
          headline zone (top-left) is fully scrimmed. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-[5] bg-gradient-to-b from-foil-cream via-foil-cream/85 to-foil-cream/40 sm:bg-none sm:[background:radial-gradient(ellipse_at_top_left,var(--color-foil-cream)_0%,color-mix(in_oklab,var(--color-foil-cream)_92%,transparent)_28%,color-mix(in_oklab,var(--color-foil-cream)_55%,transparent)_55%,transparent_85%)]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
        <p className="inline-flex items-center gap-2 rounded-full border border-foil-gold/40 bg-foil-cream/80 px-3 py-1 text-xs font-medium text-foil-navy backdrop-blur-sm">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foil-gold opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foil-gold" />
          </span>
          Live · tracking {cardCount} cards across {setCount} sets
        </p>

        {/* Headline — single-color navy. Type-led, no Sparkles overlay
            (ADR-029). Bricolage Grotesque variable weight at 700 with
            tight tracking to read as "editorial" rather than "SaaS". */}
        <h1 className="font-display mt-6 max-w-3xl text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-foil-navy sm:text-5xl md:text-6xl">
          Tell me a Pokémon card. I&apos;ll email you when it drops.
        </h1>

        <p className="mt-5 max-w-2xl text-lg text-foil-slate sm:text-xl">
          Foil watches eBay&apos;s live listings, filters the keyword-stuffed
          junk, and emails you the moment a real listing drops to your target
          price.{" "}
          <span className="text-foil-slate/80">
            Built by a Level-4 TCGplayer Verified Seller who got tired of
            comparing 20 listings to find one good one.
          </span>
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <MagneticLink
            href="/start"
            className="rounded-xl bg-foil-navy px-6 py-3.5 text-base font-semibold text-foil-cream"
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

        <div className="mt-10 max-w-xl">
          <EmailCapture source="homepage_hero" variant="inline" headline="Or just get the weekly newsletter." />
          <p className="mt-3 text-xs text-foil-slate">
            Free. No spam — about one email a week, unsubscribe anytime.
          </p>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      num: "1",
      title: "Search any Pokémon card",
      body: "Type the name, set, or just 'Charizard Base Set.' Foil handles set codes, foreign printings, Japanese sets, and graded slabs — autocomplete keeps it fast.",
    },
    {
      num: "2",
      title: "Foil finds the best live deal",
      body: "We check eBay's marketplace in real time and surface the most credible best-value listing. Price + shipping + condition + seller rating, weighted into one recommendation — not a wall of 200 search results.",
    },
    {
      num: "3",
      title: "Buy now or set a price alert",
      body: "Click through to buy on eBay — you support Foil at no extra cost. Or tell us your target price and we'll email you the second a matching listing appears, sometimes within minutes.",
    },
  ];

  return (
    <section className="border-y border-foil-navy/10 bg-foil-cream">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-4xl">How it works</h2>
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
              <h3 className="font-display mt-4 text-lg font-bold text-foil-navy">{s.title}</h3>
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
          <p className="text-xs font-medium uppercase tracking-wider text-foil-gold">
            What you actually see
          </p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-4xl">
            That Charizard you want? Currently $313 on eBay.
          </h2>
          <p className="mt-4 text-foil-slate">
            Foil doesn&apos;t just dump you on a search page. It picks the single
            best live listing, shows you what each condition and grade is currently
            worth, and tells you whether to buy now, lowball, or wait for a drop.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-foil-slate">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-foil-gold" />
              <span>
                <span className="font-medium text-foil-navy">One best deal, not 200 listings.</span>{" "}
                We score every active listing on price + shipping + condition + seller
                rating and show you the winner.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-foil-gold" />
              <span>
                <span className="font-medium text-foil-navy">Wishlist alerts that actually fire.</span>{" "}
                Tell Foil your target price; we email you the second a matching
                listing appears. Hourly checks on free, sub-minute on Founding.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-foil-gold" />
              <span>
                <span className="font-medium text-foil-navy">Graded vs raw, side by side.</span>{" "}
                Foil shows the full grade ladder — raw NM, PSA 7 through 10, BGS,
                CGC — so you can decide whether the raw is a steal or the slab is.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-foil-gold" />
              <span>
                <span className="font-medium text-foil-navy">Japanese and modern covered.</span>{" "}
                Vintage WOTC, modern Mega ex, Japanese-exclusive sets — if there&apos;s
                a listing, Foil finds it.
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-foil-gold/40 bg-foil-cream p-1 shadow-xl shadow-foil-navy/10">
          <div className="rounded-[14px] bg-foil-cream p-5">
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

function FoundingMember() {
  const freeFeatures = [
    { label: "Search any Pokémon card", value: true as const },
    { label: "Best live deal across eBay", value: true as const },
    { label: "Wishlist + price alerts", value: "Hourly checks" },
    { label: "Weekly best-deals newsletter", value: true as const },
    { label: "Advanced filters (grade, seller rating)", value: false as const },
    { label: "Multi-marketplace (TCGplayer, Mercari)", value: false as const },
    { label: "Ad-free experience", value: false as const },
  ];

  const foundingFeatures = [
    { label: "Everything in Free", value: true as const },
    { label: "Instant alerts (sub-minute push)", value: true as const },
    { label: "Advanced filters (grade, seller rating)", value: true as const },
    { label: "Multi-marketplace (TCGplayer, Mercari)", value: "As they ship" },
    { label: "Ad-free experience", value: "Permanent" },
    { label: "Priority on new card additions", value: true as const },
    { label: "Founding Member badge", value: true as const },
  ];

  return (
    <section className="border-y border-foil-navy/10 bg-foil-cream">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-4xl">
            Free forever. Or $59 once to lock in everything.
          </h2>
          <p className="mt-3 text-foil-slate">
            Foil&apos;s deal-finder is free for everyone. Founding Member is for
            early supporters who want every premium feature we&apos;ll ever ship —
            locked in at launch price, one charge, no recurring. We&apos;d build
            those features anyway; this just gets you in on day one.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <PlanCard
            tone="free"
            name="Free"
            price="$0"
            pricePer=""
            tag="Forever"
            cta={{ label: "Get early access", href: "#waitlist" }}
            features={freeFeatures}
          />
          <PlanCard
            tone="pro"
            name="Founding Member"
            price="$59"
            pricePer="once"
            tag="First 100 signups: $39"
            cta={{ label: "Lock in lifetime", href: "#waitlist" }}
            features={foundingFeatures}
          />
        </div>

        <p className="mt-6 text-xs text-foil-slate">
          Founding Member is a one-time charge — no subscription, no auto-renewal.
          Price climbs to $79 at public launch.
        </p>
      </div>
    </section>
  );
}

function PlanCard({
  tone,
  name,
  price,
  pricePer,
  tag,
  cta,
  features,
}: {
  tone: "free" | "pro";
  name: string;
  price: string;
  pricePer: string;
  tag: string;
  cta: { label: string; href: string };
  features: { label: string; value: string | boolean }[];
}) {
  const isPro = tone === "pro";
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 sm:p-8 ${
        isPro
          ? "border-foil-gold/50 bg-foil-cream ring-1 ring-foil-gold/30 shadow-lg shadow-foil-navy/10"
          : "border-foil-navy/10 bg-foil-cream shadow-sm shadow-foil-navy/5"
      }`}
    >
      <div className="flex items-start justify-between">
        <h3 className="font-display text-xl font-bold text-foil-navy">{name}</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            isPro ? "bg-foil-gold/15 text-foil-navy" : "bg-foil-navy/5 text-foil-slate"
          }`}
        >
          {tag}
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-bold tabular-nums text-foil-navy">{price}</span>
        <span className="text-sm text-foil-slate">{pricePer}</span>
      </div>

      <ul className="mt-6 flex-1 space-y-3 text-sm">
        {features.map((f) => (
          <li key={f.label} className="flex items-start gap-3">
            <FeatureIcon enabled={f.value !== false && f.value !== "—"} />
            <span className="min-w-0">
              <span className="text-foil-navy">{f.label}</span>
              {typeof f.value === "string" && (
                <span className="block text-xs text-foil-slate">{f.value}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <a
        href={cta.href}
        className={`mt-7 block rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
          isPro
            ? "bg-foil-navy text-foil-cream hover:bg-foil-coral"
            : "border border-foil-navy/15 bg-foil-cream text-foil-navy hover:border-foil-gold/40 hover:bg-foil-gold/5"
        }`}
      >
        {cta.label}
      </a>
    </div>
  );
}

function FeatureIcon({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-foil-navy/5 text-foil-slate">
        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" aria-hidden="true">
          <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-foil-gold/20 text-foil-gold">
      <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" aria-hidden="true">
        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </span>
  );
}

function FinalCTA() {
  return (
    <section id="waitlist" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="rounded-3xl border border-foil-gold/40 bg-foil-cream p-8 shadow-xl shadow-foil-navy/10 sm:p-12">
        <h2 className="font-display max-w-3xl text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-4xl">
          Never overpay for a Pokémon card again.
        </h2>
        <p className="mt-3 max-w-2xl text-foil-slate">
          Get on the waitlist. We&apos;ll email you the moment early access opens —
          and the first 100 signups get Founding Member at $39 instead of $59.
        </p>
        <div className="mt-6 max-w-xl">
          <EmailCapture source="homepage_final_cta" variant="inline" headline="Get the weekly best-deals newsletter." />
        </div>
      </div>
    </section>
  );
}
