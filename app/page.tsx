import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WaitlistForm } from "./landing/waitlist-form";

const SITE_TITLE = "Foil — Scan any Pokémon card in 10 seconds (including Japanese)";
const SITE_DESCRIPTION =
  "Snap one card, get a real market valuation in 10 seconds. eBay sold averages, TCGplayer market, PriceCharting graded comps — across English, Japanese, and modern Mega ex printings. Binder-page mode for power users.";

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
    <div className="flex min-h-dvh flex-1 flex-col bg-[#0B1428] text-white antialiased">
      <Header />
      <Hero />
      <HowItWorks />
      <ExampleResult />
      <PricingCompare />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0B1428]/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="inline-block h-2 w-2 rounded-full bg-[#FF6B5C]" />
          Foil
        </span>
        <Link
          href="/login"
          className="text-sm text-zinc-300 transition hover:text-white"
        >
          Sign in
        </Link>
      </div>
    </header>
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
        Scan any Pokémon card —{" "}
        <span className="text-[#FF6B5C]">including Japanese</span> —
        in 10 seconds.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-zinc-300 sm:text-xl">
        Snap one card. Foil reads the printed name, set code, and collector number,
        cross-references eBay sold averages, TCGplayer market, and graded comps from
        PSA to BGS 10, and tells you what the card is actually worth. Got a binder page?{" "}
        <span className="text-zinc-400">Advanced mode prices the whole stack at once.</span>
      </p>

      <div className="mt-8 max-w-xl">
        <WaitlistForm source="homepage_hero" variant="hero" />
        <p className="mt-3 text-xs text-zinc-500">
          No spam, one email when early access opens.{" "}
          <a
            href="#example"
            className="underline decoration-zinc-600 underline-offset-4 transition hover:text-zinc-300 hover:decoration-zinc-400"
          >
            Watch demo ↓
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
      title: "Snap a single card",
      body: "Hold the card flat, fill the frame. One card per photo is the default — fastest and most accurate. Binder pages are an advanced toggle for power users.",
    },
    {
      num: "2",
      title: "AI reads the printed text",
      body: "Claude Vision parses the name, set code, collector number, and regulation mark — English, Japanese, modern Mega ex, all of it. No artwork guessing — only what's actually printed.",
    },
    {
      num: "3",
      title: "Real comps across 4 sources",
      body: "Ungraded NM from eBay, TCGplayer, Cardmarket. Graded ladder (PSA 7/8/9/9.5/10, BGS 10, CGC 10, SGC 10) from PriceCharting. Best-of pick on the headline; full breakdown one tap away.",
    },
  ];

  return (
    <section className="border-y border-white/5 bg-[#101D38]">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Three steps, under 10 seconds end-to-end. No typing card names, no scrolling TCGplayer tabs.
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
            That one card buried in a binder?{" "}
            <span className="text-[#FF6B5C]">$30,100.</span>
          </h2>
          <p className="mt-4 text-zinc-300">
            Foil doesn&apos;t just show you a single price. It pulls eBay sold averages
            <em className="not-italic font-medium text-white"> and</em> the best graded comp
            — so you know whether to walk away, lowball, or sprint to PayPal.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-zinc-400">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#FF6B5C]" />
              <span>
                <span className="font-medium text-white">One card, ten seconds.</span> Single-card scans
                skip the detect pass and go straight to identify + pricing. Sub-8s end-to-end.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#FF6B5C]" />
              <span>
                <span className="font-medium text-white">Japanese + Mega ex covered.</span> Reads the
                printed text, not the artwork — Japanese sets and brand-new Mega Evolution cards work
                from day one.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#FF6B5C]" />
              <span>
                <span className="font-medium text-white">Binder mode for power users.</span> Advanced
                toggle scans up to 50 cards in one photo. Slower, but no per-card retyping.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#FF6B5C]" />
              <span>
                <span className="font-medium text-white">Honest about misses.</span> If a card&apos;s
                set can&apos;t be confirmed, we say so — no inflated totals.
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#101D38] p-1 shadow-2xl shadow-[#FF6B5C]/5">
          <div className="rounded-[14px] bg-[#0B1428] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Estimated value</p>
                <p className="mt-1 text-4xl font-bold tabular-nums text-white">$313.51</p>
                <p className="mt-1 text-xs text-zinc-500">1 of 1 priced · 6.6s vision · 0.5s prices</p>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                99% confident
              </span>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">Charizard</p>
                  <p className="truncate text-sm text-zinc-400">
                    Base Set · #4/102 · Holo Rare (1st Edition)
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">Lightly Played</p>
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-lg font-semibold tabular-nums text-white">$313.51</span>
                    <span className="text-xs text-zinc-400">eBay sold (NM)</span>
                    <span className="text-xs text-zinc-500">·</span>
                    <span className="text-xs text-[#FFB6A8]">
                      graded PSA 10:{" "}
                      <span className="font-semibold text-[#FF6B5C]">$30,100</span>
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                  99%
                </span>
              </div>
            </div>

            <p className="mt-5 rounded-lg bg-[#FF6B5C]/10 px-3 py-2 text-xs text-[#FFC7BA]">
              Heads up: the raw card is $313 — but a PSA 10 version of this card sold for{" "}
              <span className="font-semibold text-white">$30,100</span> recently. If the corners
              look mint, get it graded.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingCompare() {
  const features: { label: string; free: string | boolean; pro: string | boolean }[] = [
    { label: "Scans per day", free: "1", pro: "Unlimited" },
    { label: "Real market prices (eBay + TCGplayer)", free: true, pro: true },
    { label: "Full per-card breakdown", free: "Top card only", pro: "All cards" },
    { label: "Graded comp values (PSA / BGS / CGC)", free: false, pro: true },
    { label: "Scan history", free: "—", pro: "90 days" },
    { label: "Shareable image", free: "With watermark", pro: "Clean" },
  ];

  return (
    <section className="border-y border-white/5 bg-[#101D38]">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Free to try, $14.99 to live in it.</h2>
          <p className="mt-3 text-zinc-400">
            One free scan a day is plenty if you check Marketplace once in a while. If you&apos;re
            sourcing daily, Pro pays for itself the first time you catch an underpriced Charizard.
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
            features={features.map((f) => ({ label: f.label, value: f.free }))}
          />
          <PlanCard
            tone="pro"
            name="Pro"
            price="$14.99"
            pricePer="/ month"
            tag="Most popular"
            cta={{ label: "Get early access", href: "#waitlist" }}
            features={features.map((f) => ({ label: f.label, value: f.pro }))}
          />
        </div>

        <p className="mt-6 text-xs text-zinc-500">
          Cancel anytime in one click. Pricing locks in at $14.99/mo if you join the waitlist now.
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
          Stop second-guessing Marketplace listings.
        </h2>
        <p className="mt-3 max-w-2xl text-zinc-300">
          Get on the waitlist. We&apos;ll email you the moment early access opens — and the first
          1,000 signups get an extended free trial of Pro.
        </p>
        <div className="mt-6 max-w-xl">
          <WaitlistForm source="homepage_final_cta" variant="hero" />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0B1428]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 px-5 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:px-8">
        <p>© {new Date().getFullYear()} Foil. Pokémon TCG card valuation, in seconds.</p>
        <p>
          Already have access?{" "}
          <Link href="/login" className="text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-400">
            Sign in
          </Link>
        </p>
      </div>
    </footer>
  );
}
