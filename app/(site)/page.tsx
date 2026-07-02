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
    // DIVERGE leg 2 (overnight-design-loop): the evolved-warm register — the
    // dealer's daylight table. Cream page, navy ink, vermillion accents; the
    // binder proof shot is a navy dark-wall INSET so the card art still pops
    // on dark inside a warm page. (The dark direction lives at iter-01,
    // commit cfd3d1c — chrome stays cream here, no data-tone opt-in.)
    <main className="bg-foil-cream text-foil-navy">
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
const HERO_CARDS: {
  id: string;
  alt: string;
  tilt: string;
  arc: string;
  edge?: boolean;
}[] = [
  { id: "base1/4",    alt: "Charizard, Base Set (vintage anchor)",             tilt: "rotate-[-7deg]", arc: "translate-y-7", edge: true },
  { id: "swsh35/74",  alt: "Charizard VMAX Rainbow Rare, Champions Path",      tilt: "rotate-[-5deg]", arc: "translate-y-4" },
  { id: "swsh12/186", alt: "Lugia V Alt Art, Silver Tempest",                  tilt: "rotate-[-3deg]", arc: "translate-y-1.5" },
  { id: "swsh8/269",  alt: "Mew VMAX Alt Art, Fusion Strike",                  tilt: "rotate-[-1deg]", arc: "translate-y-0" },
  { id: "swsh7/215",  alt: "Umbreon VMAX Alt Art (Moonbreon), Evolving Skies", tilt: "rotate-[1deg]",  arc: "translate-y-0" },
  { id: "swsh11/186", alt: "Giratina V Alt Art, Lost Origin",                  tilt: "rotate-[3deg]",  arc: "translate-y-1.5" },
  { id: "swsh7/218",  alt: "Rayquaza VMAX Alt Art, Evolving Skies",            tilt: "rotate-[5deg]",  arc: "translate-y-4" },
  { id: "swsh4/188",  alt: "Pikachu VMAX Rainbow, Vivid Voltage",              tilt: "rotate-[7deg]",  arc: "translate-y-7", edge: true },
];

function Hero() {
  const cardCount = CARD_CATALOG.length;
  const setCount = setIdsInCatalog().length;
  return (
    <section className="relative isolate overflow-hidden">
      {/* The morning wash — a faint warm light falling on the paper behind the
          fan (vermillion-tinted, barely-there). Pure CSS, aria-hidden, zero
          critical-path cost. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[540px] bg-[radial-gradient(ellipse_55%_45%_at_50%_18%,rgba(216,90,48,0.07),rgba(15,30,58,0.03)_45%,transparent_70%)]"
      />

      {/* The grail fan — full-opacity card art, arced like a hand of cards,
          each one holo-tilting under the pointer (the signature effect: a site
          about foil cards where the cards actually foil). Decorative → the row
          is aria-hidden so screen readers go straight to the pitch. */}
      <div
        aria-hidden
        className="mx-auto flex max-w-6xl items-start justify-center px-2 pt-10 sm:pt-14"
      >
        {HERO_CARDS.map((c, i) => (
          <div
            key={c.id}
            className={`relative ${c.tilt} ${c.arc} ${i > 0 ? "-ml-6 sm:-ml-8 md:-ml-9" : ""} ${
              c.edge ? "hidden sm:block" : ""
            } transition duration-200 ease-out hover:z-10`}
          >
            <HoloCard
              src={`/hero/${c.id.replace("/", "-")}.webp`}
              alt={c.alt}
              width={400}
              height={560}
              eager
              className="aspect-[5/7] w-24 overflow-hidden rounded-lg shadow-[0_18px_50px_-12px_rgba(15,30,58,0.45)] ring-1 ring-foil-navy/10 sm:w-32 md:w-36 lg:w-44"
            />
          </div>
        ))}
      </div>

      {/* The pitch — pull-model (fable-design-overhaul §1): the plain promise
          first, ONE primary action. "Vault" never leads; it charms in the CTA
          after the promise earns comprehension. */}
      <div className="relative mx-auto w-full max-w-3xl px-5 pt-12 pb-20 text-center sm:px-8 sm:pt-14 sm:pb-28">
        <p className="inline-flex items-center gap-2 rounded-full border border-foil-navy/15 bg-foil-cream/80 px-3 py-1 text-xs font-medium text-foil-navy backdrop-blur-sm">
          <SealMark px={13} />
          Live · watching {cardCount} cards across {setCount} sets
        </p>

        <h1 className="font-display mx-auto mt-6 max-w-3xl text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.015em] text-foil-navy sm:text-6xl md:text-7xl">
          Tell us the cards you&apos;re hunting.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-foil-slate sm:text-xl">
          Foil watches the market and emails you the moment one drops to your
          price — judged against what cards really sell for, not asking prices.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/start?src=home-hero"
            className="rounded-xl bg-foil-navy px-7 py-3.5 text-lg font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-vermillion hover:shadow-lg hover:shadow-foil-navy/30"
          >
            Start your vault
          </Link>
          <Link
            href="/deals?src=home-hero"
            className="text-sm text-foil-slate underline decoration-foil-navy/25 underline-offset-4 transition hover:text-foil-navy hover:decoration-foil-vermillion"
          >
            or see today&apos;s best drops →
          </Link>
        </div>

        <p className="mt-5 text-xs text-foil-slate/80">
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
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-foil-navy/10"
            // Above-the-fold + trust-critical. Eager-load so it never paints
            // blank (Next 16: loading="eager" + fetchPriority="high").
            loading="eager"
            fetchPriority="high"
          />
          <p className="text-sm text-foil-slate">
            <span className="font-medium text-foil-navy">Built by John Craig.</span>{" "}
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
    <section className="border-t border-foil-navy/10">
      <div className="reveal-rise mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs font-medium tracking-[0.08em] text-foil-vermillion uppercase">
              The vault
            </p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-4xl">
              Your binder, with a market brain.
            </h2>
            <p className="mt-4 max-w-md text-foil-slate">
              Every card you track gets a pocket. Foil fills in what each one
              really sells for, watches every live listing, and emails you when
              one lands under your number.
            </p>
            <Link
              href="/start?src=home-vault"
              className="mt-6 inline-block text-sm font-medium text-foil-navy underline decoration-foil-vermillion/50 underline-offset-4 transition hover:decoration-foil-vermillion"
            >
              Start filling yours →
            </Link>
          </div>

          {/* The binder spread — a 3×3 pocket page on a NAVY panel: the warm
              register's dark-wall moment, where holographic art gets the dark
              backdrop it pops on, inset in the daylight page. */}
          <div className="rounded-3xl bg-foil-navy p-4 shadow-[0_24px_60px_-24px_rgba(15,30,58,0.5)] sm:p-6">
            <ul className="grid grid-cols-3 gap-3 sm:gap-4">
              {VAULT_POCKETS.map((p) => (
                <li key={p.id} className="group">
                  <div className="aspect-[5/7] overflow-hidden rounded-lg ring-1 ring-foil-cream/10 transition group-hover:ring-foil-cream/30">
                    <Image
                      src={`/hero/${p.id.replace("/", "-")}.webp`}
                      alt={p.name}
                      width={280}
                      height={392}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="mt-1.5 truncate text-[11px] font-medium text-foil-cream/85">
                    {p.name}
                  </p>
                  <p className="truncate text-[11px] text-foil-cream/50">{p.target}</p>
                </li>
              ))}
              <li>
                <Link
                  href="/start?src=home-vault"
                  className="flex aspect-[5/7] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-foil-cream/30 text-center transition hover:border-foil-vermillion/70 hover:bg-foil-vermillion/10"
                >
                  <span className="text-2xl leading-none text-foil-cream/60">+</span>
                  <span className="px-2 text-[11px] text-foil-cream/70">
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
// email. Hairline columns, vermillion numerals — no boxes, no wallpaper.
function PullLoop() {
  const steps = [
    {
      num: "1",
      title: "Pick your cards",
      body: "Type a name — 'Moonbreon,' 'Base Set Charizard.' Foil knows every printing, from vintage to Japanese exclusives.",
    },
    {
      num: "2",
      title: "Set your price",
      body: "Name what you'd happily pay. No number in mind? We'll watch for a real dip below what it usually sells for.",
    },
    {
      num: "3",
      title: "We watch the market",
      body: "Foil checks live listings around the clock and judges every price against what the card actually sells for.",
    },
    {
      num: "4",
      title: "You get one email",
      body: "The moment a real listing hits your number. No feed to check, no tabs to scrub, no junk to wade through.",
    },
  ];

  return (
    <section className="border-t border-foil-navy/10">
      <div className="reveal-rise mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-4xl">
          How the hunt works
        </h2>
        <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.num} className="border-t border-foil-navy/15 pt-5">
              <span className="font-display text-sm font-semibold text-foil-vermillion">
                {s.num.padStart(2, "0")}
              </span>
              <h3 className="font-display mt-2 text-lg font-semibold text-foil-navy">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foil-slate">{s.body}</p>
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
    <section className="border-t border-foil-navy/10">
      <div className="reveal-rise mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="text-xs font-medium tracking-[0.08em] text-foil-vermillion uppercase">
            The alert
          </p>
          <h2 className="font-display mt-3 text-3xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-4xl">
            One email, when it matters.
          </h2>
          <p className="mt-4 max-w-md text-foil-slate">
            No dashboard to babysit. When a live listing for one of your cards
            drops under your price, this lands in your inbox — with the sold
            data to prove the deal is real.
          </p>
        </div>

        {/* The sample alert, styled as the artifact it is. */}
        <div aria-label="A sample Foil price alert email" className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-1 shadow-[0_20px_60px_-20px_rgba(15,30,58,0.3)]">
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
    <section className="border-t border-foil-navy/10">
      <div className="reveal-rise mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
        <EmailCapture
          source="homepage_hero"
          variant="inline"
          headline="Not hunting one card? Get the weekly drop."
          subtext="One email a week: the best live card deals right now, the cards on the move, and one sharp valuation note. No spam."
        />
      </div>
    </section>
  );
}
