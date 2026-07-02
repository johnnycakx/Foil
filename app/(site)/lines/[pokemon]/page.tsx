// /lines/[pokemon] — the shareable line-tracker (eve-line-tracker, ADR-095).
// Every printing of a Pokémon in one place: art, set, current market, what it
// sold for recently, and a per-card Track action. Built as a REUSABLE product
// surface (config-driven; line #3 is a data entry in lib/lines/config.ts), not
// a one-off — the flop case leaves permanent SEO pages, the win case is a
// repeatable "collector with reach → their page → share" playbook.
//
// force-static: the page reads ONLY baked sources (baked snapshot + committed
// sold snapshot) — zero network at render, so it prerenders and feels instant.
// The live "cheapest right now" listing lives on each card's /cards/[slug] page
// (R-008 no-cache), linked per row; 44 live eBay fetches on the line page would
// break the speed + the quota (R-012). Sold figures are NULL-OVER-GUESS: a card
// with no real PokeTrace sold data renders "sold data pending," never a guess.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { schemaGraph, serializeJsonLd } from "@/lib/seo/schema-helpers";
import { siteUrl } from "@/lib/seo/site-url";
import { getLineConfig, LAUNCH_LINES } from "@/lib/lines/config";
import { getLineData, marketPhrase, soldPhrase, type LineCard } from "@/lib/lines/data";
import { SakuraPetals } from "@/components/lines/sakura-petals";
import { LineCardRail } from "@/components/lines/line-card-rail";
import { LineTrackForm } from "@/components/lines/line-track-form";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return LAUNCH_LINES.map((pokemon) => ({ pokemon }));
}

export async function generateMetadata({ params }: { params: Promise<{ pokemon: string }> }): Promise<Metadata> {
  const { pokemon } = await params;
  const config = getLineConfig(pokemon);
  if (!config) return {};
  return {
    title: config.title,
    description: config.description,
    alternates: { canonical: `/lines/${pokemon}` },
    openGraph: {
      type: "website",
      title: config.title,
      description: config.description,
      siteName: "Foil",
      url: `/lines/${pokemon}`,
      images: [`/lines/${pokemon}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title: config.title,
      description: config.description,
      images: [`/lines/${pokemon}/opengraph-image`],
    },
  };
}

/** The persistent "we'll watch YOUR cards too" CTA target — UTM-tagged. */
function startHref(pokemon: string): string {
  return `/start?utm_source=x&utm_medium=line_page&utm_campaign=eve&src=line-${pokemon}`;
}

export default async function LinePage({ params }: { params: Promise<{ pokemon: string }> }) {
  const { pokemon } = await params;
  const config = getLineConfig(pokemon);
  if (!config) notFound();

  const { cards, soldAsOf, soldCount } = getLineData(config);
  const base = siteUrl();

  const soldAsOfDate = soldAsOf
    ? new Date(soldAsOf).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;

  // JSON-LD ItemList — every printing, price-high order preserved.
  const itemList = {
    "@type": "ItemList",
    name: `Every ${config.pokemon} card`,
    numberOfItems: cards.length,
    itemListElement: cards.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${base}/cards/${c.slug}`,
      name: `${c.name} (${c.setName})`,
    })),
  };

  return (
    <main className="flex-1">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schemaGraph(itemList)) }} />

      {/* HERO — sakura register accent over the Foil base. */}
      <section className="relative isolate overflow-hidden border-b border-foil-navy/10 bg-foil-cream">
        <SakuraPetals />
        <div className="relative mx-auto w-full max-w-5xl px-5 pt-10 pb-8 sm:px-8 sm:pt-14">
          {config.dedication && (
            <p className="inline-flex items-center gap-2 rounded-full border border-foil-sakura/40 bg-foil-sakura-wash px-3 py-1 text-xs font-medium text-foil-navy">
              <span aria-hidden>🌸</span> Made for {config.dedication}
            </p>
          )}
          <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.01em] text-foil-navy sm:text-5xl">
            Every {config.pokemon} card, tracked.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-foil-slate sm:text-lg">{config.tagline}</p>
          <p className="mt-2 text-sm text-foil-slate">
            {cards.length} printings
            {soldCount > 0 ? (
              <> · real recent-sale data on {soldCount}{soldAsOfDate ? ` (as of ${soldAsOfDate})` : ""}</>
            ) : null}
            . Grouped by era — within each, most valuable first.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={startHref(pokemon)}
              className="inline-flex items-center justify-center rounded-xl bg-foil-navy px-5 py-2.5 text-sm font-semibold text-foil-cream transition hover:bg-foil-sakura"
            >
              Watch your own cards, free →
            </Link>
            <span className="text-xs text-foil-slate">No account. We email you when a card hits a good buy.</span>
          </div>

          {/* The card-art scroll rail — the signature interaction. */}
          <div className="mt-7">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foil-slate">Swipe the lineup</p>
            <LineCardRail
              pokemon={config.pokemon}
              cards={cards.map((c) => ({ slug: c.slug, name: c.name, setName: c.setName, image: c.image }))}
            />
          </div>
        </div>
      </section>

      {/* THE LIST — grouped into labeled eras (design-round3-fixes §6);
          within each era the price-high order is preserved, Moonbreon on top. */}
      <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
        {groupByEra(cards).map((era, i) => (
          <div key={era.label} className={i === 0 ? undefined : "mt-12"}>
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-foil-slate">{era.label}</h2>
              <span aria-hidden className="h-px flex-1 bg-foil-navy/10" />
              <span className="text-[11px] tabular-nums text-foil-slate">{era.cards.length}</span>
            </div>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {era.cards.map((c) => (
                <LineCardTile key={c.slug} card={c} pokemon={pokemon} />
              ))}
            </ul>
          </div>
        ))}

        {/* Persistent bottom CTA. */}
        <div className="mt-12 rounded-3xl border border-foil-sakura/30 bg-foil-sakura-wash p-8 text-center">
          <p className="font-display text-2xl font-semibold text-foil-navy">Hunting a specific one?</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-foil-slate">
            Foil watches eBay every hour and emails you the moment any card hits a price worth buying —
            {config.pokemon} or anything else. Free, no account.
          </p>
          <Link
            href={startHref(pokemon)}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-foil-navy px-6 py-3 text-sm font-semibold text-foil-cream transition hover:bg-foil-sakura"
          >
            Start your watchlist →
          </Link>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-foil-slate">
          <Logo size="sm" />
          <span>· Every figure is real market data. When there&apos;s none yet, we say so.</span>
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Era grouping (design-round3-fixes §6) — PRESENTATION ONLY. Buckets the
// already-sorted list by set-id prefix; order within each bucket is untouched,
// so "within each era, most valuable first" stays literally true. Verified
// against the live catalog set ids: promos are the all-letter ids ending in
// `p` (smp, bwp, xyp, swshp); modern = Sword/Shield + Scarlet/Violet + the
// Celebrations reprints (sv*/swsh*/cel*); everything else (base/neo/ecard/ex/
// dp/pl/hgss/bw/xy/sm/col/pop) is vintage & classics.
// ---------------------------------------------------------------------------

function eraOf(card: LineCard): "modern" | "vintage" | "promo" {
  const setId = card.pokemonTcgId.slice(0, card.pokemonTcgId.indexOf("-")).toLowerCase();
  if (/^[a-z]+p$/.test(setId)) return "promo";
  if (/^(sv|swsh|cel)/.test(setId)) return "modern";
  return "vintage";
}

function groupByEra(cards: LineCard[]): { label: string; cards: LineCard[] }[] {
  return [
    { label: "Modern grails", cards: cards.filter((c) => eraOf(c) === "modern") },
    { label: "Vintage & classics", cards: cards.filter((c) => eraOf(c) === "vintage") },
    { label: "Promos", cards: cards.filter((c) => eraOf(c) === "promo") },
  ].filter((era) => era.cards.length > 0);
}

function LineCardTile({ card, pokemon }: { card: LineCard; pokemon: string }) {
  const market = marketPhrase(card);
  const hasSold = card.soldCents != null;
  // Spread chip (design-round3-fixes §2) — presentation math only, from the two
  // figures already on the tile. Renders ONLY when buy < sold (a good buy);
  // buy >= sold or missing data = no chip, neutral.
  const spreadPct =
    card.soldCents != null && card.marketCents != null && card.marketCents < card.soldCents
      ? Math.round(((card.soldCents - card.marketCents) / card.soldCents) * 100)
      : null;
  return (
    <li
      id={`card-${card.slug}`}
      className="flex scroll-mt-24 flex-col rounded-2xl border border-foil-navy/10 bg-foil-cream p-4 shadow-sm shadow-foil-navy/5"
    >
      <div className="flex gap-4">
        <Link href={`/cards/${card.slug}`} className="shrink-0">
          <div className="w-24 overflow-hidden rounded-xl bg-foil-navy/5 ring-1 ring-foil-navy/10 transition hover:ring-foil-sakura/50">
            {card.image ? (
              <Image
                src={card.image}
                alt={`${card.name} (${card.setName}) #${card.number}`}
                width={245}
                height={342}
                sizes="6rem"
                className="aspect-[245/342] w-full"
              />
            ) : (
              // Designed placeholder — never a blank box (design-round3-fixes §6).
              <div className="flex aspect-[245/342] w-full flex-col items-center justify-center gap-1 bg-foil-navy/5 p-2 text-center">
                <span className="text-[10px] font-medium leading-tight text-foil-slate">{card.setName}</span>
                <span className="font-mono text-[10px] text-foil-slate">#{card.number}</span>
              </div>
            )}
          </div>
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/cards/${card.slug}`} className="block">
            <p className="truncate text-sm font-semibold text-foil-navy hover:text-foil-sakura">{card.name}</p>
            <p className="truncate font-mono text-[11px] uppercase tracking-wider text-foil-slate">
              {card.setName} · #{card.number}
              {card.releaseYear ? ` · ${card.releaseYear}` : ""}
            </p>
            {card.rarity ? <p className="mt-0.5 truncate text-[11px] text-foil-slate">{card.rarity}</p> : null}
          </Link>

          {/* The market brain, in collector words — the sold-vs-ask pair gets
              DRAWN, not just written (design-round3-fixes §2). */}
          {hasSold ? (
            <p className="mt-2 text-xs font-medium tabular-nums text-foil-navy">{soldPhrase(card)}</p>
          ) : (
            <p className="mt-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-foil-navy/5 px-2 py-0.5 text-[11px] font-medium text-foil-slate">
                <span aria-hidden className="size-1 rounded-full bg-foil-slate/60" />
                Sold data pending
              </span>
            </p>
          )}
          {market ? <p className="text-xs tabular-nums text-foil-slate">{market} to buy right now</p> : null}
          {spreadPct != null && spreadPct >= 1 ? (
            <p className="mt-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-foil-sakura/40 bg-foil-sakura-wash px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foil-navy">
                <svg
                  aria-hidden
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 2 2 8M2 3.5V8h4.5" />
                </svg>
                {spreadPct}% under recent sales
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <LineTrackForm
        card={{
          pokemon_tcg_id: card.pokemonTcgId,
          name: card.name,
          set_name: card.setName,
          set_id: card.pokemonTcgId.slice(0, card.pokemonTcgId.indexOf("-")),
          number: card.number,
        }}
        src={`line-${pokemon}`}
      />
      <Link
        href={`/cards/${card.slug}`}
        className="mt-2 text-[11px] font-medium text-foil-navy underline decoration-foil-navy/20 underline-offset-2 transition hover:decoration-foil-sakura"
      >
        See live listings on eBay →
      </Link>
    </li>
  );
}
