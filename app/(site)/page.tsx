import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { EmailCapture } from "@/components/email-capture";
import { CtaPendingLabel } from "@/components/home/cta-pending-label";
import { HoloCard } from "@/components/cards/holo-card";
import { SakuraAmbience } from "@/components/sakura-ambience";
import { CARD_CATALOG } from "@/lib/cards/catalog";
import { getSnapshotSold } from "@/lib/vault-seeds";
import { getHeroBeltPool } from "@/lib/hero-belt/pool";
import { HeroBelt } from "@/components/hero-belt";

const SITE_TITLE = "Foil: the best price on any Pokémon card";
const SITE_DESCRIPTION =
  "Tell Foil the cards you're chasing. It watches the market and emails you when one drops to your price. Judged against what cards really sell for, not asking prices. Free.";

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

// Static, anonymous-first marketing homepage (ADR-020): no server-side auth read
// — that forced a per-request dynamic render + a Supabase getUser() round-trip on
// every (99%+ anonymous) visitor just to auto-redirect the rare logged-in user to
// /upload. Removed for TTFB/LCP (homepage-perf / mobile-static-hero); logged-in
// users see the marketing page and navigate to the app via the header Account link.
export default function Home() {
  return (
    // data-tone="night" flips the shared chrome dark via body:has() (globals.css).
    // The night register is homepage-scoped: the dark direction of the
    // overnight-design-loop, where the card art is the light source of the page.
    <main data-tone="night" className="bg-foil-night text-foil-cream">
      <Hero />
      <VaultMoment />
      <PullLoop />
      <SampleAlert />
      <RequestCard />
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
// hero-fan-widescreen-fix: at lg+ every composition dimension derives from the
// fluid scale vars defined on the fan container (see FAN_FLUID_VARS) —
// `--fan-s` (card scale + overlap + floor), `--fan-w` (wing spread: arc
// amplitude), `--fan-r` (rotation cadence, damped off --fan-w). All three
// clamp to 1 at ≤1440px, so 1024–1440 renders byte-identical to the tuned
// composition and everything below lg is untouched. Above 1440 the fan grows
// and OPENS continuously, capped where the composition stops improving.
const DEPTH_SLOTS: Record<number, { size: string; z: string; fx: string }> = {
  0: {
    size: "w-32 sm:w-40 md:w-48 lg:w-[calc(15rem*var(--fan-s,1))]",
    z: "z-40",
    fx: "",
  },
  1: {
    size: "w-[6.5rem] sm:w-32 md:w-[9.5rem] lg:w-[calc(11rem*var(--fan-s,1))]",
    z: "z-30",
    fx: "brightness-[0.92]",
  },
  2: {
    size: "w-24 sm:w-28 md:w-32 lg:w-[calc(10rem*var(--fan-s,1))]",
    z: "z-20",
    fx: "brightness-[0.8] blur-[0.6px]",
  },
  3: {
    size: "w-20 sm:w-24 md:w-28 lg:w-[calc(8.5rem*var(--fan-s,1))]",
    z: "z-10",
    fx: "brightness-[0.65] blur-[1.2px]",
  },
};

// The fluid composition vars (hero-fan-widescreen-fix). Continuous, no
// breakpoints: ≤1440px all three resolve to 1 (sub-1440 pinned identical);
// above, the fan scales and the wings spread slightly faster so the hand
// OPENS as it grows — capped at 1.34 / 1.45 around ~2200px, the width where
// the composition stops improving (judged on the shot matrix, not guessed).
// Rotation rides --fan-w damped to 55% so edge cards lean without tipping.
//
// tan(atan2(a, b)) is exactly a/b as a unitless NUMBER — the only way CSS
// lets two lengths divide into a number factor (naive `1 + (100vw - X)/N`
// is type-invalid: number + length nukes every dependent declaration to
// unset, which rendered the fan as giant flat naturals). Baseline-2023
// functions; every consumer carries a `var(--fan-*, 1)` fallback so an old
// browser that drops these declarations gets today's 1440 composition, not
// a broken one.
const FAN_FLUID_VARS = {
  "--fan-s": "calc(1 + 0.34 * clamp(0, tan(atan2(100vw - 1440px, 884px)), 1))",
  "--fan-w": "calc(1 + 0.45 * clamp(0, tan(atan2(100vw - 1440px, 765px)), 1))",
  "--fan-r": "calc(1 + (var(--fan-w, 1) - 1) * 0.55)",
} as CSSProperties;

// Pre-send-coherence §3+§4: the fan is SYMMETRIC (three cards per wing,
// mirrored tilt/arc cadence, edges dimmed EQUALLY) and every card is a real
// link to its /cards/[slug] page. `gap` overrides the overlap for the cards
// flanking the focal so no card is ever crushed to a sliver behind Moonbreon.
// `fx` overrides equalize edge brightness (the Base Charizard + Pikachu
// artworks differ wildly in luminance; the treatment compensates per-card so
// both edges READ equally dim). Pikachu mirrors the Base Charizard as the
// far-right edge of the 7-card hand — it keeps the deepest treatment so the
// visual mass balances around the focal.
const HERO_CARDS: {
  id: string;
  alt: string;
  tilt: string;
  arc: string;
  depth: 0 | 1 | 2 | 3;
  edge?: boolean;
  gap?: string;
  fx?: string;
}[] = [
  { id: "base1/4",    alt: "Charizard, Base Set (vintage anchor)",             tilt: "rotate-[-12deg] lg:rotate-[calc(-12deg*var(--fan-r,1))]", arc: "translate-y-10 lg:translate-y-[calc(2.5rem*var(--fan-w,1))]", depth: 3, edge: true },
  { id: "swsh35/74",  alt: "Charizard VMAX Rainbow Rare, Champions Path",      tilt: "rotate-[-8deg] lg:rotate-[calc(-8deg*var(--fan-r,1))]",   arc: "translate-y-6 lg:translate-y-[calc(1.5rem*var(--fan-w,1))]",  depth: 2 },
  { id: "swsh12/186", alt: "Lugia V Alt Art, Silver Tempest",                  tilt: "rotate-[-4deg] lg:rotate-[calc(-4deg*var(--fan-r,1))]",   arc: "translate-y-2 lg:translate-y-[calc(0.5rem*var(--fan-w,1))]",  depth: 1 },
  // Moonbreon is the FOCAL card — the community's grail leads the fan at
  // ~1.35x its neighbors with the sakura rim-glow (the "whoa" of the fold).
  { id: "swsh7/215",  alt: "Umbreon VMAX Alt Art (Moonbreon), Evolving Skies", tilt: "rotate-[0.5deg]", arc: "-translate-y-1 lg:translate-y-[calc(-0.25rem*var(--fan-w,1))]", depth: 0 },
  // Right of the focal: extra clearance so Mew is a legible fan member, never
  // a sliver peeking out from behind Moonbreon's edge.
  { id: "swsh8/269",  alt: "Mew VMAX Alt Art, Fusion Strike",                  tilt: "rotate-[4deg] lg:rotate-[calc(4deg*var(--fan-r,1))]",     arc: "translate-y-2 lg:translate-y-[calc(0.5rem*var(--fan-w,1))]",  depth: 1, gap: "-ml-3 sm:-ml-4 md:-ml-5 lg:ml-[calc(-1.25rem*var(--fan-s,1))]" },
  { id: "swsh11/186", alt: "Giratina V Alt Art, Lost Origin",                  tilt: "rotate-[8deg] lg:rotate-[calc(8deg*var(--fan-r,1))]",     arc: "translate-y-6 lg:translate-y-[calc(1.5rem*var(--fan-w,1))]",  depth: 2 },
  // hero-polish-followups: Rayquaza VMAX removed — as the 4th right-wing card
  // it rendered almost fully occluded (a sliver, not a fan member; John's
  // live verdict at ~2100px). Seven cards compose: 3 per wing, mirrored
  // depth/tilt/arc cadence, no card below the ~40%-visible invariant.
  { id: "swsh4/188",  alt: "Pikachu VMAX Rainbow, Vivid Voltage",              tilt: "rotate-[12deg] lg:rotate-[calc(12deg*var(--fan-r,1))]",   arc: "translate-y-10 lg:translate-y-[calc(2.5rem*var(--fan-w,1))]", depth: 3, edge: true, fx: "brightness-[0.45] blur-[1.6px]" },
];

/** Resolve a HERO_CARDS/VAULT_POCKETS id ("swsh7/215") to its catalog slug.
 *  Null over guess: a card without a catalog entry renders unlinked rather
 *  than pointing a visitor at a 404. */
function cardSlug(id: string): string | null {
  const tcgId = id.replace("/", "-");
  return CARD_CATALOG.find((e) => e.pokemonTcgId === tcgId)?.slug ?? null;
}

// Option (b) of the follow widget (homepage-hero-simplify): true prepends
// "Built by a card-store seller." inside the widget. John picks by eye from
// the shots; (a) = false is his stated directive and the default.
const FOLLOW_TRUST_LINE = false;

/** The official X logo mark, monochrome (currentColor) per X brand rules —
 *  never blue, never gold. Standard 24x24 brand path, aria-hidden (the link
 *  text carries the meaning). */
function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden className="shrink-0 fill-current">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// The mobile still-strip grails (mobile-hero-redesign Direction A): iconic,
// instantly-recognizable chase cards — a still frame of the belt. Light `-sm`
// (240px) variants under public/hero/ keep it fast; the H1, not these, is the LCP.
const STRIP_CARDS: { id: string; alt: string }[] = [
  { id: "base1/4", alt: "Charizard, Base Set" },
  { id: "swsh7/215", alt: "Umbreon VMAX Alt Art (Moonbreon), Evolving Skies" },
  { id: "swsh12/186", alt: "Lugia V Alt Art, Silver Tempest" },
  { id: "swsh4/188", alt: "Pikachu VMAX Rainbow, Vivid Voltage" },
];

function Hero() {
  // hero-chase-belt (ADR-102): the motion hero is the chase wheel — the top
  // ~200 chase cards drifting past, each a real market-page link. The
  // composed fan below survives as the prefers-reduced-motion fallback (and
  // the honest degradation when the pool artifact is missing). Both are
  // server-rendered; CSS motion variants pick one — no hydration swap.
  const beltPool = getHeroBeltPool();
  return (
    <section className="relative isolate overflow-hidden">
      {/* Hanami comes home (binder-aesthetic-pass): the /lines petal physics
          at ambient density on the charcoal — atmosphere, not weather. Sits
          under all content; static scatter under reduced-motion. */}
      <SakuraAmbience mode="night" desktopOnly />
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
      {/* MOBILE HERO (mobile-hero-redesign, Direction A — John's pick): a STATIC
          strip of grails, a still frame of the desktop belt. SERVER-ONLY (plain
          <img> + <Link>, NO client component / GSAP), so it paints from SSR HTML
          with zero hydration wait — the H1 below is the LCP. This is what drops
          the mobile LCP toward FCP (the 2,297ms hydration render-delay is gone
          from the above-the-fold). Desktop (lg) hides it: the animated belt +
          reduced-motion fan own the hero there. */}
      <div className="lg:hidden mx-auto max-w-[30rem] overflow-hidden pt-9 sm:pt-12 [mask-image:linear-gradient(90deg,transparent,black_11%,black_89%,transparent)]">
        <div className="flex justify-center gap-2.5 px-3">
          {STRIP_CARDS.map((c) => {
            const slug = cardSlug(c.id);
            const img = (
              <img
                src={`/hero/${c.id.replace("/", "-")}-sm.webp`}
                alt={c.alt}
                width={240}
                height={336}
                loading="eager"
                decoding="async"
                className="aspect-[5/7] w-full rounded-[10px] object-cover shadow-[0_12px_28px_-12px_rgba(0,0,0,0.9)] ring-1 ring-foil-cream/12"
              />
            );
            return slug ? (
              <Link
                key={c.id}
                href={`/cards/${slug}`}
                aria-label={`${c.alt} — sold prices and live listings`}
                className="block w-[6.6rem] shrink-0 rounded-[10px] transition focus-visible:ring-2 focus-visible:ring-foil-accent focus-visible:outline-none active:scale-[0.98]"
              >
                {img}
              </Link>
            ) : (
              <span key={c.id} className="block w-[6.6rem] shrink-0" aria-hidden>
                {img}
              </span>
            );
          })}
        </div>
        {/* The floor: the strip stands on the same grounded shadow as the fan. */}
        <div
          aria-hidden
          className="pointer-events-none mx-auto -mt-2 h-6 w-[64%] rounded-[100%] bg-[radial-gradient(ellipse_at_center,rgba(4,4,5,0.85),rgba(4,4,5,0.3)_55%,transparent_75%)] blur-[6px]"
        />
      </div>
      {/* THE CHASE WHEEL (hero-chase-belt): the top ~200 chase cards drifting
          past at gallery-walk speed, every face a real link. Motion-safe
          only; hidden entirely under prefers-reduced-motion. */}
      {beltPool.length > 0 && (
        <div className="relative mx-auto hidden max-w-[110rem] pt-10 sm:pt-14 lg:motion-safe:block">
          <HeroBelt pool={beltPool} />
          {/* The floor: the wheel stands on the same grounded shadow language
              as the fan it succeeds. */}
          <div
            aria-hidden
            className="pointer-events-none mx-auto -mt-4 h-8 w-[72%] rounded-[100%] bg-[radial-gradient(ellipse_at_center,rgba(4,4,5,0.9),rgba(4,4,5,0.35)_55%,transparent_75%)] blur-[6px]"
          />
        </div>
      )}
      {/* The composed grail fan — now the prefers-reduced-motion fallback
          (and the no-pool degradation). Same links, no belt, no drift. */}
      <div
        style={FAN_FLUID_VARS}
        className={`relative mx-auto max-w-[calc(72rem*var(--fan-s,1))] [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)] ${
          // The composed fan is now the DESKTOP reduced-motion fallback ONLY
          // (mobile-hero-redesign): hidden on mobile (the server-only still-strip
          // is the mobile hero) and on lg-motion-safe (the animated belt owns it);
          // shows only on lg + reduced-motion.
          beltPool.length > 0 ? "hidden lg:block lg:motion-safe:hidden" : ""
        }`}
      >
        <div className="flex items-start justify-center px-2 pt-10 sm:pt-14 lg:pt-[calc(3.5rem*var(--fan-s,1))]">
          {HERO_CARDS.map((c, i) => {
            const slot = DEPTH_SLOTS[c.depth];
            const slug = cardSlug(c.id);
            const card = (
              <HoloCard
                src={`/hero/${c.id.replace("/", "-")}.webp`}
                alt={c.alt}
                width={400}
                height={560}
                sizes="(max-width: 768px) 40vw, 240px"
                /* mobile-hero-redesign: the fan is now the DESKTOP reduced-motion
                   fallback only (the server-only still-strip is the mobile hero),
                   so NO fan card is eager — on mobile the fan is display:none and
                   eager would still fetch it (the 43KB /_next/image waste); on lg
                   reduced-motion the whole fan is in the initial viewport, so lazy
                   loads promptly with no blank paint. */
                eager={false}
                className={`aspect-[5/7] overflow-hidden rounded-lg ring-1 ${slot.size} ${c.fx ?? slot.fx} ${
                  c.depth === 0
                    ? "shadow-[0_16px_60px_-12px_rgba(217,138,160,0.32),0_12px_40px_-10px_rgba(248,245,240,0.3)] ring-foil-accent/40"
                    : "shadow-[0_10px_30px_-14px_rgba(248,245,240,0.18)] ring-foil-cream/12"
                }`}
              />
            );
            return (
              <div
                key={c.id}
                className={`relative ${c.tilt} ${c.arc} ${slot.z} ${i > 0 ? (c.gap ?? "-ml-9 sm:-ml-10 md:-ml-12 lg:ml-[calc(-3rem*var(--fan-s,1))]") : ""} ${
                  // The fan is desktop-only now (mobile-hero-redesign), so it
                  // renders the FULL composition on lg reduced-motion; the edge
                  // cards keep their sm+ reveal for the fan's own breathing.
                  c.edge ? "hidden sm:block" : ""
                } transition duration-200 ease-out hover:z-50 focus-within:z-50`}
              >
                {slug ? (
                  <Link
                    href={`/cards/${slug}`}
                    aria-label={`${c.alt} — sold prices and live listings`}
                    className="block rounded-lg focus-visible:ring-2 focus-visible:ring-foil-accent focus-visible:outline-none"
                  >
                    {card}
                  </Link>
                ) : (
                  <span aria-hidden>{card}</span>
                )}
              </div>
            );
          })}
        </div>
        {/* THE FLOOR (round-3): a visible contact shadow directly under the
            hand + a faint cool reflection pool — the cards STAND on something. */}
        {/* Pre-send-coherence §3: the floor reads at a glance — a firmer
            contact shadow hugging the hand + a visible sakura-warmed
            reflection pool beneath it. */}
        <div
          aria-hidden
          className="pointer-events-none mx-auto -mt-5 h-10 w-[58%] rounded-[100%] bg-[radial-gradient(ellipse_at_center,rgba(4,4,5,0.95),rgba(4,4,5,0.4)_55%,transparent_75%)] blur-[5px] lg:mt-[calc(-1.25rem*var(--fan-s,1))] lg:h-[calc(2.5rem*var(--fan-s,1))]"
        />
        <div
          aria-hidden
          className="pointer-events-none mx-auto -mt-7 h-16 w-[44%] rounded-[100%] bg-[radial-gradient(ellipse_at_center,rgba(217,138,160,0.13),rgba(248,245,240,0.06)_45%,transparent_72%)] blur-[10px] lg:mt-[calc(-1.75rem*var(--fan-s,1))] lg:h-[calc(4rem*var(--fan-s,1))]"
        />
      </div>

      {/* The pitch (homepage-hero-simplify): one calm decisive moment — the
          belt is the proof of coverage, the headline is the promise, ONE
          action. The stats chip and the hedging secondary CTA are gone (the
          deals page keeps its nav entry); the founder byline is succeeded by
          the quiet X follow widget below (the footer keeps the face). */}
      <div className="relative mx-auto w-full max-w-3xl px-5 pt-8 pb-12 text-center sm:px-8 sm:pt-12 sm:pb-16">
        <h1 className="font-display mx-auto max-w-3xl text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.015em] text-foil-cream [text-wrap:balance] sm:text-6xl md:text-7xl">
          Tell Foil the cards you&apos;re chasing.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-xl text-foil-cream/70 sm:text-2xl sm:leading-snug">
          Foil watches the market and emails you when one drops to your price.
          Judged against what cards really sell for, not asking prices.
        </p>

        <div className="mt-10 flex justify-center">
          {/* The tap must answer (round-2 fix): pressed state on the button,
              working label while the /start render is in flight. */}
          <Link
            href="/start?src=home-hero"
            className="rounded-xl bg-foil-cream px-9 py-4 text-lg font-semibold text-foil-navy transition-all hover:-translate-y-0.5 hover:ring-2 hover:ring-foil-accent/60 active:translate-y-0 active:scale-[0.97]"
          >
            <CtaPendingLabel label="Start your vault" pendingLabel="Opening the binder…" />
          </Link>
        </div>

        <p className="mt-5 text-sm text-foil-cream/60">
          Free · no account needed · Foil checks your cards daily, every hour on Pro
        </p>

        {/* The follow loop (homepage-hero-simplify): a quiet one-tap X follow
            where the founder byline sat. Monochrome X glyph per X brand rules
            (never blue, never gold). FOLLOW_TRUST_LINE = option (b): keeps a
            thread of the founder trust signal inside the widget — John picks
            by eye; (a) is the default directive. */}
        <div className="mt-12 flex justify-center">
          <a
            href="https://x.com/intent/follow?screen_name=FoilTCG"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2.5 rounded-xl border border-foil-cream/12 bg-foil-night-2/70 px-5 py-2.5 text-sm text-foil-cream/70 transition hover:border-foil-accent/40 hover:text-foil-cream"
          >
            {FOLLOW_TRUST_LINE && (
              <span className="text-foil-cream/55">Built by a card-store seller.</span>
            )}
            <XGlyph />
            <span className="font-medium">Follow along on X</span>
          </a>
        </div>
      </div>
    </section>
  );
}

// The vault moment (fable-design-overhaul §1): show-don't-tell — a binder
// spread with tracked cards, the product's proof shot. Binder-aesthetic-pass
// (John's reference photo): the Gen 1 STARTER EVOLUTION LINES from SV-151,
// Illustration Rare printings, in evolution order — the sequencing IS the
// aesthetic, and the painterly IR register reads as one curated page instead
// of clashing rainbow chase cards. Targets are illustrative but PLAUSIBLE
// against the baked market data (holofoil market as of the 2026-07-01 bake:
// Bulbasaur $87.90 · Ivysaur $52.69 · Venusaur ex $124.60 · Charmander
// $112.03 · Charmeleon $77.94 · Charizard ex $420.01 · Squirtle $110.59 ·
// Wartortle $72.30 · Blastoise ex $158.06) — each target sits ~10-12% under.
// Art is SELF-HOSTED under public/binder/ (ADR-056 rationale). The tenth
// pocket is the invitation.
const VAULT_POCKETS: { id: string; name: string; target: string }[] = [
  { id: "sv3pt5/166", name: "Bulbasaur", target: "emails you at $78" },
  { id: "sv3pt5/167", name: "Ivysaur", target: "emails you at $46" },
  { id: "sv3pt5/198", name: "Venusaur ex", target: "emails you at $110" },
  { id: "sv3pt5/168", name: "Charmander", target: "emails you at $99" },
  { id: "sv3pt5/169", name: "Charmeleon", target: "emails you at $69" },
  { id: "sv3pt5/199", name: "Charizard ex", target: "emails you at $375" },
  { id: "sv3pt5/170", name: "Squirtle", target: "emails you at $98" },
  { id: "sv3pt5/171", name: "Wartortle", target: "emails you at $64" },
  { id: "sv3pt5/200", name: "Blastoise ex", target: "emails you at $140" },
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
              {VAULT_POCKETS.map((p) => {
                const slug = cardSlug(p.id);
                const pocket = (
                  <>
                    <div className="aspect-[5/7] overflow-hidden rounded-lg ring-1 ring-foil-cream/10 transition group-hover:-translate-y-0.5 group-hover:ring-foil-cream/30">
                      <Image
                        src={`/binder/${p.id.replace("/", "-")}.webp`}
                        alt={p.name}
                        width={280}
                        height={392}
                        sizes="(max-width: 768px) 30vw, 200px"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="mt-1.5 truncate text-[11px] font-medium text-foil-cream/80">
                      {p.name}
                    </p>
                    <p className="truncate text-[11px] text-foil-cream/60">{p.target}</p>
                  </>
                );
                return (
                  <li key={p.id} className="group">
                    {/* Pre-send-coherence §4: pockets link to their card pages
                        (same slug lookup as the fan; unlinked if uncatalogued). */}
                    {slug ? (
                      <Link
                        href={`/cards/${slug}`}
                        aria-label={`${p.name} — sold prices and live listings`}
                        className="block rounded-lg focus-visible:ring-2 focus-visible:ring-foil-accent focus-visible:outline-none"
                      >
                        {pocket}
                      </Link>
                    ) : (
                      pocket
                    )}
                  </li>
                );
              })}
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
      body: "Type a name: 'Moonbreon,' 'Base Set Charizard.' Foil knows every printing, from vintage to Japanese exclusives.",
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
      body: "Name what you'd happily pay. No number in mind? Foil watches for a real dip below what it usually sells for.",
      artifact: (
        <div className="flex items-center justify-between rounded-lg border border-foil-cream/12 bg-foil-night-2 px-3 py-2">
          <span className="text-[11px] text-foil-cream/55">your price</span>
          <span className="font-mono text-xs tabular-nums text-foil-cream/90">$1,900</span>
        </div>
      ),
    },
    {
      num: "3",
      title: "Foil watches the market",
      body: "Foil checks live listings and judges every price against what the card actually sells for. Free checks once a day. Pro checks every hour.",
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
      body: "When a real listing hits your number. No feed to check, no tabs to scrub, no junk to wade through.",
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
          How the chase works
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-foil-cream/60">
          One chase, start to finish. Here&apos;s Moonbreon&apos;s.
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
// hero-polish-followups: the mock mirrors what an alert ACTUALLY looks like
// now (ADR-091 evidence-line shape, ADR-079 text-forward: no logo image, no
// button — one quiet link), and its dollar figures DERIVE from the committed
// sold snapshot (the same honest basis the vault/lines surfaces read) — never
// hand-written literals. Moonbreon is the featured card: it's the fan's focal,
// and the snapshot guarantees it a real outlier-suppressed sold basis (pinned
// by the vault-seeds navigation-promise test). The example listing price is
// computed at the ADR-091 market floor (15% under the 30-day sold average) —
// the exact threshold a real market-basis alert fires at.
const MOCK_ALERT_SLUG = "swsh7-215-umbreon-vmax-alt-art";

function usd(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function SampleAlert() {
  const sold = getSnapshotSold(MOCK_ALERT_SLUG);
  const soldLine = sold ? usd(sold.soldCents) : null;
  const listingLine = sold ? usd(sold.soldCents * 0.85) : null;
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
            drops under your price, this lands in your inbox, with the sold
            data to prove the deal is real.
          </p>
          <ul className="mt-6 max-w-md space-y-2.5 text-base text-foil-cream/60">
            <li className="flex items-start gap-2.5">
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foil-accent" />
              Real listings only. Seller, condition, and sold history checked
              before Foil bothers you.
            </li>
            <li className="flex items-start gap-2.5">
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foil-accent" />
              One click to stop watching any card, any time.
            </li>
          </ul>
        </div>

        {/* The sample alert, styled as the artifact it is: text-forward like
            the real thing — plain wordmark from-row, evidence line, one quiet
            link. Figures derive from the committed sold snapshot (soft-fail:
            no snapshot → the copy stays honest without inventing numbers). */}
        <div aria-label="A sample Foil price alert email" className="rounded-2xl border border-foil-cream/12 bg-foil-cream p-1 shadow-[0_20px_60px_-20px_rgba(248,245,240,0.10)]">
          <div className="rounded-xl p-5 sm:p-6">
            <div className="flex items-center gap-2 border-b border-foil-navy/10 pb-3">
              <span className="font-wordmark text-sm font-semibold text-foil-navy">Foil</span>
              <span className="ml-auto text-xs text-foil-slate">to: you</span>
            </div>
            <p className="mt-4 text-base font-semibold text-foil-navy">
              {listingLine
                ? `Umbreon VMAX (alt art) dropped to ${listingLine}, 15% under what it usually sells for`
                : "Umbreon VMAX (alt art) just dipped below what it usually sells for"}
            </p>
            <div className="mt-4 flex items-center gap-4">
              <Image
                src="/hero/swsh7-215.webp"
                alt="Umbreon VMAX Alt Art (Moonbreon), Evolving Skies"
                width={72}
                height={101}
                className="w-[72px] shrink-0 rounded-md ring-1 ring-foil-navy/10"
              />
              <div className="min-w-0 text-sm text-foil-slate">
                <p className="text-foil-navy">
                  Live listing:{" "}
                  <span className="font-semibold">{listingLine ?? "a verified price"}</span> · near
                  mint
                </p>
                <p className="mt-1">
                  {soldLine
                    ? `Sold for ~${soldLine} on average over the last 30 days`
                    : "Judged against what it really sells for, not asking prices"}
                </p>
                <p className="mt-3 text-xs font-semibold text-foil-navy underline decoration-foil-navy/40 underline-offset-4">
                  See the live listing →
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// The request widget (hero-chase-belt, ADR-102): the site-to-X intake loop.
// A quiet service promise, not a promo — missing data becomes a public
// @FoilTCG mention, which becomes demand-hydration, which becomes data the
// visitor watches land. The "front of the queue" line is a HUMAN CONTRACT:
// front-of-queue requests get same-day-ish hydration via the demand pipeline
// (the x-reply-desk goal triages the mentions). Voice: no em dashes.
const REQUEST_INTENT_URL = `https://x.com/intent/post?text=${encodeURIComponent(
  "@FoilTCG chasing this card, can you get data on it?",
)}`;

function RequestCard() {
  return (
    <section className="relative border-t border-foil-cream/10">
      <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
        <div className="rounded-2xl border border-foil-cream/12 bg-foil-night-2/70 p-7 sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-foil-cream sm:text-3xl">
            Chasing a card Foil doesn&apos;t have data on yet?
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-foil-cream/70">
            Post it at{" "}
            <a
              href="https://x.com/FoilTCG"
              className="text-foil-cream underline decoration-foil-accent/50 underline-offset-4 transition hover:decoration-foil-accent"
            >
              @FoilTCG
            </a>{" "}
            on X with a pic of the card and Foil moves it to the front of
            the queue.
          </p>
          <a
            href={REQUEST_INTENT_URL}
            className="mt-5 inline-block rounded-xl border border-foil-accent/40 px-5 py-2.5 text-sm font-semibold text-foil-cream transition hover:border-foil-accent hover:bg-foil-accent/10"
          >
            Post your card 🌸
          </a>
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
          headline="Not chasing one card? Get the weekly digest."
          subtext="One email a week: the best live card deals right now, the cards on the move, and one sharp valuation note. No spam."
        />
      </div>
    </section>
  );
}
