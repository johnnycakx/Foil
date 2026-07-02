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
            . Sorted by price, most valuable first.
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

      {/* THE LIST — price high → low; Moonbreon on top. */}
      <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <LineCardTile key={c.slug} card={c} pokemon={pokemon} />
          ))}
        </ul>

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

function LineCardTile({ card, pokemon }: { card: LineCard; pokemon: string }) {
  const market = marketPhrase(card);
  const hasSold = card.soldCents != null;
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
              <div aria-hidden className="aspect-[245/342] w-full bg-foil-navy/5" />
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

          {/* The market brain, in collector words. */}
          <p
            className={`mt-2 text-xs ${hasSold ? "font-medium text-foil-navy" : "italic text-foil-slate"}`}
          >
            {soldPhrase(card)}
          </p>
          {market ? <p className="text-xs text-foil-slate">{market} to buy right now</p> : null}
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
