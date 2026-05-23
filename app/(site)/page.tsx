import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmailCapture } from "@/components/email-capture";

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

function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-12 pb-16 sm:px-8 sm:pt-20 sm:pb-24">
      <p className="inline-flex items-center gap-2 rounded-full border border-[#FF6B5C]/30 bg-[#FF6B5C]/10 px-3 py-1 text-xs font-medium text-[#FFC7BA]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B5C]" />
        Pre-launch · early access opening Oct 7
      </p>
      <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
        The best price on any Pokémon card.{" "}
        <span className="text-[#FF6B5C]">Right now.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-zinc-300 sm:text-xl">
        Foil searches eBay&apos;s live listings the moment you ask and surfaces the
        single highest-value deal for the exact card you want — judged by price,
        shipping, condition, and seller reputation.{" "}
        <span className="text-zinc-400">
          Built by a Level-4 TCGplayer Verified Seller who got tired of comparing
          20 listings to find one good one.
        </span>
      </p>

      <div className="mt-8 max-w-xl">
        <EmailCapture source="homepage_hero" variant="inline" headline="Get the weekly best-deals newsletter." />
        <p className="mt-3 text-xs text-zinc-500">
          Free at launch. No spam — we email when your wishlisted cards drop in price.{" "}
          <a
            href="#example"
            className="underline decoration-zinc-600 underline-offset-4 transition hover:text-zinc-300 hover:decoration-zinc-400"
          >
            See an example ↓
          </a>
        </p>
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
    <section className="border-y border-white/5 bg-[#101D38]">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Three steps. No comparing tabs, no scrolling endless listings, no
          wondering whether a seller is legit.
        </p>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <li
              key={s.num}
              className="rounded-2xl border border-white/10 bg-[#0B1428] p-6"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#FF6B5C]/40 bg-[#FF6B5C]/10 text-sm font-semibold text-[#FF6B5C]">
                {s.num}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{s.body}</p>
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
          <p className="text-xs font-medium uppercase tracking-wider text-[#FF6B5C]">
            What you actually see
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            That Charizard you want?{" "}
            <span className="text-[#FF6B5C]">Currently $313 on eBay.</span>
          </h2>
          <p className="mt-4 text-zinc-300">
            Foil doesn&apos;t just dump you on a search page. It picks the single
            best live listing, shows you what each condition and grade is currently
            worth, and tells you whether to buy now, lowball, or wait for a drop.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-zinc-400">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#FF6B5C]" />
              <span>
                <span className="font-medium text-white">One best deal, not 200 listings.</span>{" "}
                We score every active listing on price + shipping + condition + seller
                rating and show you the winner.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#FF6B5C]" />
              <span>
                <span className="font-medium text-white">Wishlist alerts that actually fire.</span>{" "}
                Tell Foil your target price; we email you the second a matching
                listing appears. Hourly checks on free, sub-minute on Founding.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#FF6B5C]" />
              <span>
                <span className="font-medium text-white">Graded vs raw, side by side.</span>{" "}
                Foil shows the full grade ladder — raw NM, PSA 7 through 10, BGS,
                CGC — so you can decide whether the raw is a steal or the slab is.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#FF6B5C]" />
              <span>
                <span className="font-medium text-white">Japanese and modern covered.</span>{" "}
                Vintage WOTC, modern Mega ex, Japanese-exclusive sets — if there&apos;s
                a listing, Foil finds it.
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#101D38] p-1 shadow-2xl shadow-[#FF6B5C]/5">
          <div className="rounded-[14px] bg-[#0B1428] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Best current deal
                </p>
                <p className="mt-1 text-4xl font-bold tabular-nums text-white">$313.51</p>
                <p className="mt-1 text-xs text-zinc-500">
                  9% below 30-day avg · top-rated seller · free ship
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                Good deal
              </span>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">Charizard</p>
                  <p className="truncate text-sm text-zinc-400">
                    Base Set · #4/102 · Holo Rare (Unlimited)
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">Lightly Played · NM verified by seller</p>
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-lg font-semibold tabular-nums text-white">$313.51</span>
                    <span className="text-xs text-zinc-400">+ free shipping</span>
                    <span className="text-xs text-zinc-500">·</span>
                    <span className="text-xs text-[#FFB6A8]">
                      PSA 10 currently:{" "}
                      <span className="font-semibold text-[#FF6B5C]">$30,100</span>
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                  Buy →
                </span>
              </div>
            </div>

            <p className="mt-5 rounded-lg bg-[#FF6B5C]/10 px-3 py-2 text-xs text-[#FFC7BA]">
              Heads up: the raw is $313, but a PSA 10 of the same card recently sold
              for <span className="font-semibold text-white">$30,100</span>. If the
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
    <section className="border-y border-white/5 bg-[#101D38]">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Free forever. Or $59 once to lock in everything.
          </h2>
          <p className="mt-3 text-zinc-400">
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

        <p className="mt-6 text-xs text-zinc-500">
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
        isPro ? "border-[#FF6B5C]/40 bg-[#0B1428] ring-1 ring-[#FF6B5C]/20" : "border-white/10 bg-[#0B1428]"
      }`}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-xl font-semibold">{name}</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            isPro ? "bg-[#FF6B5C]/15 text-[#FFC7BA]" : "bg-white/5 text-zinc-400"
          }`}
        >
          {tag}
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-4xl font-bold tabular-nums">{price}</span>
        <span className="text-sm text-zinc-400">{pricePer}</span>
      </div>

      <ul className="mt-6 flex-1 space-y-3 text-sm">
        {features.map((f) => (
          <li key={f.label} className="flex items-start gap-3">
            <FeatureIcon enabled={f.value !== false && f.value !== "—"} />
            <span className="min-w-0">
              <span className="text-zinc-300">{f.label}</span>
              {typeof f.value === "string" && (
                <span className="block text-xs text-zinc-500">{f.value}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <a
        href={cta.href}
        className={`mt-7 block rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
          isPro
            ? "bg-[#FF6B5C] text-[#0B1428] hover:bg-[#FF8775]"
            : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
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
      <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-500">
        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" aria-hidden="true">
          <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF6B5C]/20 text-[#FF6B5C]">
      <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" aria-hidden="true">
        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </span>
  );
}

function FinalCTA() {
  return (
    <section id="waitlist" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="rounded-3xl border border-[#FF6B5C]/30 bg-gradient-to-br from-[#101D38] via-[#0B1428] to-[#101D38] p-8 sm:p-12">
        <h2 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
          Never overpay for a Pokémon card again.
        </h2>
        <p className="mt-3 max-w-2xl text-zinc-300">
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

