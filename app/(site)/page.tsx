import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmailCapture } from "@/components/email-capture";
import { HoloCard } from "@/components/cards/holo-card";
import { CARD_CATALOG, setIdsInCatalog } from "@/lib/cards/catalog";
import { SealMark } from "@/components/brand/logo";

const SITE_TITLE = "Foil: the best price on any Pokémon card";
const SITE_DESCRIPTION =
  "Tell Foil the cards you're hunting. We watch the market and email you the moment one drops to your price — judged against what cards really sell for, not asking prices. Free.";

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
    // file-based app/opengraph-image.tsx — so reference the dynamic OG
    // explicitly or the share card is blank.
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
    // data-tone="night" flips the shared chrome dark via body:has() (globals.css).
    // The night register is homepage-scoped: the dark direction of the
    // overnight-design-loop, where the card art is the light source of the page.
    <main data-tone="night" className="bg-foil-night text-foil-cream">
      <Hero />
      <VaultMoment />
      <PullLoop />
      <SampleAlert />
      <NewsletterBand />
    </main>
  );
}

// Session 43 (ADR-033) — modern grail seed list: seven modern alt-art/rainbow
// chase cards + one vintage anchor (Base Set Charizard). In the night register
// they are the LIGHT SOURCES of the hero — full-opacity, arced, holo-tilted
// (components/cards/holo-card.tsx), with a warm light-spill behind the fan.
// Images are SELF-HOSTED (ADR-056): local webp under public/hero/ so the hero
// never depends on the flaky images.pokemontcg.io CDN.
// `arc` composes the fan's curve (middle cards ride high, edges settle low);
// `edge` cards hide on mobile so the fan breathes at 390px.
// Round-3 fix 1: the fan is a REAL fan, not a pasted row — per-card depth
// slots. `depth` 0 = the focal Moonbreon (largest, sharpest, teal rim-glow —
// the light source); 1–3 step progressively smaller, more rotated, dimmer and
// softer toward the edges (depth of field), with z-order stacking down from
// the center. Widths are per-slot so the silhouette curves.
const DEPTH_SLOTS: Record<number, { size: string; z: string; fx: string }> = {
  0: {
    size: "w-32 sm:w-40 md:w-48 lg:w-[15rem]",
    z: "z-40",
    fx: "",
  },
  1: {
    size: "w-[6.5rem] sm:w-32 md:w-[9.5rem] lg:w-44",
    z: "z-30",
    fx: "brightness-[0.92]",
  },
  2: {
    size: "w-24 sm:w-28 md:w-32 lg:w-40",
    z: "z-20",
    fx: "brightness-[0.8] blur-[0.6px]",
  },
  3: {
    size: "w-20 sm:w-24 md:w-28 lg:w-[8.5rem]",
    z: "z-10",
    fx: "brightness-[0.65] blur-[1.2px]",
  },
};

const HERO_CARDS: {
  id: string;
  alt: string;
  tilt: string;
  arc: string;
  depth: 0 | 1 | 2 | 3;
  edge?: boolean;
}[] = [
  { id: "base1/4",    alt: "Charizard, Base Set (vintage anchor)",             tilt: "rotate-[-11deg]", arc: "translate-y-10", depth: 3, edge: true },
  { id: "swsh35/74",  alt: "Charizard VMAX Rainbow Rare, Champions Path",      tilt: "rotate-[-8deg]",  arc: "translate-y-6",  depth: 2 },
  { id: "swsh12/186", alt: "Lugia V Alt Art, Silver Tempest",                  tilt: "rotate-[-4deg]",  arc: "translate-y-2",  depth: 1 },
  // Moonbreon is the FOCAL card — the community's grail leads the fan at
  // ~1.35x its neighbors with the teal rim-glow (the "whoa" of the fold).
  { id: "swsh7/215",  alt: "Umbreon VMAX Alt Art (Moonbreon), Evolving Skies", tilt: "rotate-[0.5deg]", arc: "-translate-y-1", depth: 0 },
  { id: "swsh8/269",  alt: "Mew VMAX Alt Art, Fusion Strike",                  tilt: "rotate-[4deg]",   arc: "translate-y-2",  depth: 1 },
  { id: "swsh11/186", alt: "Giratina V Alt Art, Lost Origin",                  tilt: "rotate-[8deg]",   arc: "translate-y-6",  depth: 2 },
  { id: "swsh7/218",  alt: "Rayquaza VMAX Alt Art, Evolving Skies",            tilt: "rotate-[11deg]",  arc: "translate-y-10", depth: 3 },
  { id: "swsh4/188",  alt: "Pikachu VMAX Rainbow, Vivid Voltage",              tilt: "rotate-[14deg]",  arc: "translate-y-14", depth: 3, edge: true },
];

function Hero() {
  const cardCount = CARD_CATALOG.length;
  const setCount = setIdsInCatalog().length;
  return (
    <section className="relative isolate overflow-hidden">
      {/* The light spill — a warm glow rising from behind the card fan, as if
          the cards themselves light the room. Pure CSS, aria-hidden, zero
          critical-path cost. */}
      {/* Round-2 restraint (John: Linear register — matte, deep, quiet; the
          CARDS may glow, the PAGE may not). The spill is a whisper now, the
          vermillion tint is gone, and depth comes from layering. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(ellipse_58%_46%_at_50%_16%,rgba(248,245,240,0.07),transparent_62%)]"
      />
      {/* The grail fan — a real lit fan (round-3 fix 1): the focal Moonbreon
          leads at ~1.35x with a teal rim-glow; neighbors step down in size,
          rotate away, and soften into the dark (depth of field); the whole
          hand fades at the edges instead of hard-cropping. Each card still
          holo-tilts under the pointer. Decorative → aria-hidden. */}
      <div
        aria-hidden
        className="relative mx-auto max-w-6xl [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]"
      >
        <div className="flex items-start justify-center px-2 pt-10 sm:pt-14">
          {HERO_CARDS.map((c, i) => {
            const slot = DEPTH_SLOTS[c.depth];
            return (
              <div
                key={c.id}
                className={`relative ${c.tilt} ${c.arc} ${slot.z} ${i > 0 ? "-ml-9 sm:-ml-10 md:-ml-12" : ""} ${
                  c.edge ? "hidden sm:block" : ""
                } transition duration-200 ease-out hover:z-50`}
              >
                <HoloCard
                  src={`/hero/${c.id.replace("/", "-")}.webp`}
                  alt={c.alt}
                  width={400}
                  height={560}
                  eager
                  className={`aspect-[5/7] overflow-hidden rounded-lg ring-1 ${slot.size} ${slot.fx} ${
                    c.depth === 0
                      ? "shadow-[0_16px_60px_-12px_rgba(111,216,197,0.35),0_12px_40px_-10px_rgba(248,245,240,0.3)] ring-foil-accent/40"
                      : "shadow-[0_10px_30px_-14px_rgba(248,245,240,0.18)] ring-foil-cream/12"
                  }`}
                />
              </div>
            );
          })}
        </div>
        {/* THE FLOOR (round-3): a visible contact shadow directly under the
            hand + a faint cool reflection pool — the cards STAND on something. */}
        <div
          aria-hidden
          className="pointer-events-none mx-auto -mt-4 h-10 w-[68%] rounded-[100%] bg-[radial-gradient(ellipse_at_center,rgba(3,7,15,0.9),rgba(3,7,15,0.35)_55%,transparent_75%)] blur-[6px]"
        />
        <div
          aria-hidden
          className="pointer-events-none mx-auto -mt-8 h-16 w-[46%] rounded-[100%] bg-[radial-gradient(ellipse_at_center,rgba(111,216,197,0.10),rgba(248,245,240,0.05)_45%,transparent_72%)] blur-[10px]"
        />
      </div>

      {/* The pitch — pull-model (fable-design-overhaul §1): the plain promise
          first, ONE primary action. "Vault" never leads; it charms in the CTA
          after the promise earns comprehension. */}
      {/* Round-3 fix 4: tightened tail padding — the vault section enters
          before the viewport empties (no dead black band after the founder
          note). */}
      <div className="relative mx-auto w-full max-w-3xl px-5 pt-6 pb-12 text-center sm:px-8 sm:pt-8 sm:pb-16">
        <p className="inline-flex items-center gap-2 rounded-full border border-foil-cream/15 bg-foil-night-2/80 px-3 py-1 text-xs font-medium text-foil-cream/80 backdrop-blur-sm">
          <SealMark px={13} />
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-foil-accent opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foil-accent" />
          </span>
          Live · watching {cardCount} cards across {setCount} sets
        </p>

        <h1 className="font-display mx-auto mt-6 max-w-3xl text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.015em] text-foil-cream [text-wrap:balance] sm:text-6xl md:text-7xl">
          Tell us the cards you&apos;re hunting.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-xl text-foil-cream/70 sm:text-2xl sm:leading-snug">
          Foil watches the market and emails you the moment one drops to your
          price — judged against what cards really sell for, not asking prices.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/start?src=home-hero"
            className="rounded-xl bg-foil-cream px-7 py-3.5 text-lg font-semibold text-foil-navy transition-all hover:-translate-y-0.5 hover:ring-2 hover:ring-foil-accent/60"
          >
            Start your vault
          </Link>
          <Link
            href="/deals?src=home-hero"
            className="text-base text-foil-cream/60 underline decoration-foil-cream/25 underline-offset-4 transition hover:text-foil-cream hover:decoration-foil-accent"
          >
            or see today&apos;s best drops →
          </Link>
        </div>

        <p className="mt-5 text-sm text-foil-cream/45">
          Free · no account needed · one email when it matters, not a feed to check
        </p>

        {/* Founder presence: a face + a plain byline (ADR-065) — trust signal,
            not a credential badge. */}
        <div className="mx-auto mt-12 flex max-w-xl items-center gap-3 text-left">
          <Image
            src="/founder/john-craig.webp"
            alt="John Craig, founder of Foil"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-foil-cream/20"
            // Above-the-fold + trust-critical. Eager-load so it never paints
            // blank (Next 16: loading="eager" + fetchPriority="high").
            loading="eager"
            fetchPriority="high"
          />
          <p className="text-base text-foil-cream/60">
            <span className="font-medium text-foil-cream">Built by John Craig.</span>{" "}
            I run a Pokémon card store and got tired of digging through eBay junk
            to find the real deals, so I built Foil to do it for me.
          </p>
        </div>
      </div>
    </section>
  );
}

// The vault moment (fable-design-overhaul §1): show-don't-tell — a binder
// spread with tracked cards, the product's proof shot. Targets are
// illustrative but PLAUSIBLE against real sold data (a collector smells a fake
// number instantly); the ninth pocket is the invitation.
const VAULT_POCKETS: { id: string; name: string; target: string }[] = [
  { id: "swsh7/215",  name: "Umbreon VMAX alt", target: "emails you at $1,900" },
  { id: "swsh7/218",  name: "Rayquaza VMAX alt", target: "emails you at $400" },
  { id: "base1/4",    name: "Charizard, Base Set", target: "emails you at $450" },
  { id: "swsh11/186", name: "Giratina V alt", target: "emails you at $170" },
  { id: "swsh12/186", name: "Lugia V alt", target: "emails you at $110" },
  { id: "swsh35/74",  name: "Charizard VMAX rainbow", target: "emails you at $210" },
  { id: "swsh8/269",  name: "Mew VMAX alt", target: "emails you at $95" },
  { id: "swsh4/188",  name: "Pikachu VMAX rainbow", target: "emails you at $75" },
];

function VaultMoment() {
  return (
    <section className="relative border-t border-foil-cream/10">
      {/* Round-2 restraint: the section glow is gone — the raised night-2
          panel + its dark drop shadow do the depth work (layering, not
          luminescence). */}
      <div className="reveal-rise relative mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs font-medium tracking-[0.08em] text-foil-accent uppercase">
              The vault
            </p>
            <h2 className="font-display mt-3 text-4xl font-semibold tracking-[-0.01em] text-foil-cream sm:text-5xl">
              Your binder, with a market brain.
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-foil-cream/70">
              Every card you track gets a pocket. Foil fills in what each one
              really sells for, watches every live listing, and emails you when
              one lands under your number.
            </p>
            <ul className="mt-6 max-w-md space-y-2.5 text-base text-foil-cream/60">
              <li className="flex items-start gap-2.5">
                <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foil-accent" />
                Every pocket shows what the card really sells for.
              </li>
              <li className="flex items-start gap-2.5">
                <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foil-accent" />
                Your targets are checked against live listings around the clock.
              </li>
            </ul>
            <Link
              href="/start?src=home-vault"
              className="mt-8 inline-block text-sm font-medium text-foil-cream underline decoration-foil-accent/50 underline-offset-4 transition hover:decoration-foil-accent"
            >
              Start filling yours →
            </Link>
          </div>

          {/* The binder spread — a 3×3 pocket page, plastic-sleeve insets. */}
          <div className="rounded-3xl border border-foil-cream/10 bg-foil-night-2 p-4 shadow-[0_24px_60px_-28px_rgba(4,9,18,0.85)] sm:p-6">
            <ul className="grid grid-cols-3 gap-3 sm:gap-4">
              {VAULT_POCKETS.map((p) => (
                <li key={p.id} className="group">
                  <div className="aspect-[5/7] overflow-hidden rounded-lg ring-1 ring-foil-cream/10 transition group-hover:-translate-y-0.5 group-hover:ring-foil-cream/30">
                    <Image
                      src={`/hero/${p.id.replace("/", "-")}.webp`}
                      alt={p.name}
                      width={280}
                      height={392}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="mt-1.5 truncate text-[11px] font-medium text-foil-cream/80">
                    {p.name}
                  </p>
                  <p className="truncate text-[11px] text-foil-cream/45">{p.target}</p>
                </li>
              ))}
              <li>
                <Link
                  href="/start?src=home-vault"
                  className="flex aspect-[5/7] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-foil-cream/25 text-center transition hover:border-foil-accent/60 hover:bg-foil-accent/5"
                >
                  <span className="text-2xl leading-none text-foil-cream/50">+</span>
                  <span className="px-2 text-[11px] text-foil-cream/60">
                    Your first card goes here
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// How it works, reordered around the pull loop (fable-design-overhaul §1):
// pick cards → set your price → we watch sold-backed listings → you get the
// email. Each step carries a MINIATURE PRODUCT ARTIFACT — one continuous
// Moonbreon hunt told in real UI fragments (typeahead → target → judged
// listing → the email subject), never an icon grid. Numbers stay internally
// consistent: target $1,900, sold avg ~$2,214, listing $1,845 ≈ 17% under.
function PullLoop() {
  const steps = [
    {
      num: "1",
      title: "Pick your cards",
      body: "Type a name — 'Moonbreon,' 'Base Set Charizard.' Foil knows every printing, from vintage to Japanese exclusives.",
      artifact: (
        <div className="rounded-lg border border-foil-cream/12 bg-foil-night-2 px-3 py-2">
          <p className="flex items-center gap-2 text-xs text-foil-cream/80">
            <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3 text-foil-cream/50">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4 4" strokeLinecap="round" />
            </svg>
            moonbreon
          </p>
          <p className="mt-1.5 border-t border-foil-cream/10 pt-1.5 text-[11px] text-foil-cream/55">
            Umbreon VMAX alt art · Evolving Skies
          </p>
        </div>
      ),
    },
    {
      num: "2",
      title: "Set your price",
      body: "Name what you'd happily pay. No number in mind? We'll watch for a real dip below what it usually sells for.",
      artifact: (
        <div className="flex items-center justify-between rounded-lg border border-foil-cream/12 bg-foil-night-2 px-3 py-2">
          <span className="text-[11px] text-foil-cream/55">your price</span>
          <span className="font-mono text-xs tabular-nums text-foil-cream/90">$1,900</span>
        </div>
      ),
    },
    {
      num: "3",
      title: "We watch the market",
      body: "Foil checks live listings around the clock and judges every price against what the card actually sells for.",
      artifact: (
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-foil-cream/12 bg-foil-night-2 px-3 py-2">
          <span className="font-mono text-xs tabular-nums text-foil-cream/90">$1,845</span>
          <span className="rounded-full bg-foil-accent/15 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-foil-accent">
            17% under sold avg
          </span>
        </div>
      ),
    },
    {
      num: "4",
      title: "You get one email",
      body: "The moment a real listing hits your number. No feed to check, no tabs to scrub, no junk to wade through.",
      artifact: (
        <div className="flex items-center gap-2 rounded-lg border border-foil-cream/12 bg-foil-night-2 px-3 py-2">
          <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3 w-3 shrink-0 text-foil-accent">
            <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
            <path d="m3 6 7 5 7-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="truncate text-[11px] text-foil-cream/80">
            Moonbreon just hit $1,845
          </span>
        </div>
      ),
    },
  ];

  return (
    <section className="border-t border-foil-cream/10">
      <div className="reveal-rise mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="font-display text-4xl font-semibold tracking-[-0.01em] text-foil-cream sm:text-5xl">
          How the hunt works
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-foil-cream/60">
          One hunt, start to finish — here&apos;s Moonbreon&apos;s.
        </p>
        <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.num} className="flex flex-col border-t border-foil-cream/15 pt-5">
              <span className="font-display text-sm font-semibold text-foil-accent">
                {s.num.padStart(2, "0")}
              </span>
              <h3 className="font-display mt-2 text-xl font-semibold text-foil-cream">
                {s.title}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-foil-cream/60">{s.body}</p>
              <div className="mt-4 sm:mt-auto sm:pt-4">{s.artifact}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// The email IS the product — render one, honestly labeled as a sample, with
// internally consistent numbers (a $162 listing against a $189 30-day sold
// average is 14% under; a collector checks the math).
function SampleAlert() {
  return (
    <section className="relative border-t border-foil-cream/10">
      {/* The cream email is the one light object in this section — a faint
          halo only (round-2 restraint), no section-wide glow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(ellipse_45%_45%_at_65%_50%,rgba(248,245,240,0.04),transparent_65%)]"
      />
      <div className="reveal-rise relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="text-xs font-medium tracking-[0.08em] text-foil-accent uppercase">
            The alert
          </p>
          <h2 className="font-display mt-3 text-4xl font-semibold tracking-[-0.01em] text-foil-cream sm:text-5xl">
            One email, when it matters.
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-foil-cream/70">
            No dashboard to babysit. When a live listing for one of your cards
            drops under your price, this lands in your inbox — with the sold
            data to prove the deal is real.
          </p>
          <ul className="mt-6 max-w-md space-y-2.5 text-base text-foil-cream/60">
            <li className="flex items-start gap-2.5">
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foil-accent" />
              Real listings only — seller, condition, and sold history checked
              before we bother you.
            </li>
            <li className="flex items-start gap-2.5">
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foil-accent" />
              One click to stop watching any card, any time.
            </li>
          </ul>
        </div>

        {/* The sample alert, styled as the artifact it is. */}
        <div aria-label="A sample Foil price alert email" className="rounded-2xl border border-foil-cream/12 bg-foil-cream p-1 shadow-[0_20px_60px_-20px_rgba(248,245,240,0.10)]">
          <div className="rounded-xl p-5 sm:p-6">
            <div className="flex items-center gap-2 border-b border-foil-navy/10 pb-3">
              <SealMark px={16} />
              <span className="text-sm font-semibold text-foil-navy">Foil</span>
              <span className="ml-auto text-xs text-foil-slate">to: you</span>
            </div>
            <p className="mt-4 text-base font-semibold text-foil-navy">
              Giratina V (alt art) just hit $162 — 14% under what it usually
              sells for
            </p>
            <div className="mt-4 flex items-center gap-4">
              <Image
                src="/hero/swsh11-186.webp"
                alt="Giratina V Alt Art, Lost Origin"
                width={72}
                height={101}
                className="w-[72px] shrink-0 rounded-md ring-1 ring-foil-navy/10"
              />
              <div className="min-w-0 text-sm text-foil-slate">
                <p className="text-foil-navy">
                  Live listing: <span className="font-semibold">$162</span> · near mint
                </p>
                <p className="mt-1">Sold for ~$189 on average this month</p>
                <p className="mt-3 inline-block rounded-lg bg-foil-navy px-3 py-1.5 text-xs font-semibold text-foil-cream">
                  See the listing →
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// The secondary capture (fable-design-overhaul §1): newsletter demoted from
// the hero — the ONE email ask on the page (ADR-066), now the closing band.
function NewsletterBand() {
  return (
    <section className="border-t border-foil-cream/10">
      <div className="reveal-rise mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
        <EmailCapture
          source="homepage_hero"
          variant="inline"
          tone="night"
          headline="Not hunting one card? Get the weekly drop."
          subtext="One email a week: the best live card deals right now, the cards on the move, and one sharp valuation note. No spam."
        />
      </div>
    </section>
  );
}
