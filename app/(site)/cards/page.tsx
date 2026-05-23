// /cards — browsable index of every per-card landing page Foil tracks.
//
// Server component for the grouped catalog render (SEO-friendly: every
// card link is in the initial HTML). The search input on top is the only
// client-interactive piece — extracted into a small client component that
// filters the rendered grid in-place via DOM `hidden` toggles. That keeps
// the SSR tree complete while still giving live autocomplete-style filter.
//
// The catalog is grouped by set; sets are ordered by their earliest
// catalog entry so vintage WotC (Base/Jungle/Fossil) lands first.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CARD_CATALOG, type CatalogEntry } from "@/lib/cards/catalog";
import { getCardMetadata, type CardMetadata } from "@/lib/cards/sdk";
import { CardsSearch } from "./cards-search";

export const dynamic = "force-static";
export const revalidate = 86_400;

const TITLE = "Browse Pokémon TCG cards — Foil";
const DESCRIPTION = `Find the best live eBay deal on any of the ${CARD_CATALOG.length} most-collected Pokémon TCG cards. Vintage WotC holos, Neo era chase, modern V/VSTAR/ex — all in one searchable index.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/cards" },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Foil",
    url: "/cards",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Display names for the set ids in the catalog. Pulled from the Pokemon TCG
// SDK conventions; anything not listed here falls back to the set id raw,
// which is acceptable but uglier ("base1" instead of "Base Set").
const SET_DISPLAY_NAMES: Record<string, string> = {
  base1: "Base Set",
  base2: "Jungle",
  base3: "Fossil",
  base4: "Base Set 2",
  base5: "Team Rocket",
  base6: "Legendary Collection",
  gym1: "Gym Heroes",
  gym2: "Gym Challenge",
  neo1: "Neo Genesis",
  neo2: "Neo Discovery",
  neo3: "Neo Revelation",
  neo4: "Neo Destiny",
  sm115: "Hidden Fates",
  cel25: "Celebrations",
  swsh7: "Evolving Skies",
  swsh9: "Brilliant Stars",
  swsh12pt5: "Crown Zenith",
  sv3pt5: "Scarlet & Violet 151",
};

type Group = {
  setId: string;
  setName: string;
  entries: Array<CatalogEntry & { meta: CardMetadata }>;
};

function groupCatalog(entriesWithMeta: Array<CatalogEntry & { meta: CardMetadata }>): Group[] {
  const order: string[] = [];
  const buckets = new Map<string, Group>();
  for (const entry of entriesWithMeta) {
    const setId = entry.pokemonTcgId.split("-")[0];
    if (!buckets.has(setId)) {
      order.push(setId);
      buckets.set(setId, {
        setId,
        setName: SET_DISPLAY_NAMES[setId] ?? entry.meta.setName ?? setId,
        entries: [],
      });
    }
    buckets.get(setId)!.entries.push(entry);
  }
  // Sort entries within a set by collector number.
  for (const g of buckets.values()) {
    g.entries.sort((a, b) => {
      const an = parseInt(a.pokemonTcgId.split("-").slice(1).join("-"), 10);
      const bn = parseInt(b.pokemonTcgId.split("-").slice(1).join("-"), 10);
      const safe = (n: number) => (Number.isFinite(n) ? n : 999_999);
      return safe(an) - safe(bn);
    });
  }
  return order.map((id) => buckets.get(id)!);
}

export default async function CardsIndexPage() {
  // Build-time fetch of all 200 metadata records. Pokemon TCG SDK caches at
  // 24h revalidate per call (see lib/cards/sdk.ts); plus this page itself
  // is `dynamic = "force-static"` + `revalidate = 86400`, so the network
  // cost is amortized across a day of traffic.
  const entriesWithMeta = await Promise.all(
    CARD_CATALOG.map(async (entry) => ({
      ...entry,
      meta: await getCardMetadata({ id: entry.pokemonTcgId }),
    })),
  );

  const groups = groupCatalog(entriesWithMeta);

  // Flat searchable list — passed to the client filter component as JSON.
  const searchIndex = entriesWithMeta.map((e) => ({
    slug: e.slug,
    name: e.meta.name,
    setName: SET_DISPLAY_NAMES[e.pokemonTcgId.split("-")[0]] ?? e.meta.setName ?? "",
  }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-12 pb-20 sm:px-8 sm:pt-16">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-[#FF6B5C]">
          Catalog
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Browse Pokémon cards
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-300">
          {CARD_CATALOG.length} cards Foil tracks live across eBay. Vintage
          WotC holos, Neo era chase, modern V/VSTAR/ex. Pick one, see the best
          current listing.
        </p>
      </header>

      <CardsSearch index={searchIndex} />

      <div className="mt-10 space-y-14">
        {groups.map((group) => (
          <section key={group.setId} aria-labelledby={`group-${group.setId}`}>
            <div className="flex items-baseline justify-between gap-4">
              <h2
                id={`group-${group.setId}`}
                className="text-xl font-bold tracking-tight text-white sm:text-2xl"
              >
                {group.setName}
              </h2>
              <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                {group.entries.length} cards
              </p>
            </div>
            <ul
              className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
              data-set-group
            >
              {group.entries.map((entry) => {
                const number = entry.pokemonTcgId.split("-").slice(1).join("-");
                return (
                  <li
                    key={entry.slug}
                    data-card-slug={entry.slug}
                    data-card-name={entry.meta.name.toLowerCase()}
                  >
                    <Link
                      href={`/cards/${entry.slug}`}
                      className="group block rounded-2xl border border-white/5 bg-[#101D38] p-3 transition hover:border-[#FF6B5C]/30 hover:bg-[#152549]"
                    >
                      <div className="overflow-hidden rounded-xl bg-[#0B1428]">
                        {entry.meta.image ? (
                          <Image
                            src={entry.meta.image}
                            alt={`${entry.meta.name} (${group.setName}) #${number}`}
                            width={245}
                            height={342}
                            sizes="(min-width: 1024px) 14rem, (min-width: 640px) 18vw, 40vw"
                            className="aspect-[245/342] w-full transition group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div
                            aria-hidden
                            className="w-full bg-[#0B1428]"
                            style={{ aspectRatio: "245 / 342" }}
                          />
                        )}
                      </div>
                      <div className="mt-3 px-1 pb-1">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                          #{number}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-white group-hover:text-[#FF8775]">
                          {entry.meta.name}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
