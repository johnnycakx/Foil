// /cards — era → set browse. Replaces the Session 23 flat-grouped index.
//
// The structural shift (Session 24): cards no longer live directly on the
// /cards root. /cards lists Pokemon TCG eras (Base, Neo, Sword & Shield,
// Scarlet & Violet, ...); inside each era are set tiles; a set tile links
// to /cards/sets/<set-id> which lists the actual cards. Three taps to a
// listing instead of one long scroll. Matches the pokescope.app browse
// pattern users coming from that surface expect.
//
// Design notes (frontend-design plugin guidance applied within brand):
//   - Era headings carry a small uppercase tracking-wide era marker + a
//     pill chip with the set-count. Hierarchy lets a scanning reader
//     navigate by era without reading every set name.
//   - Set tiles render the official set logo on a near-black inset
//     surface (logos are designed for white-or-black backdrops), with
//     name + release year + card count below. Hover lift via
//     `translate-y` + accent border halo conveys interactivity without a
//     pointer-tracking effect.
//   - Grid rhythm is 1/2/3-4 columns at sm/md/lg/xl with gap-4 → gap-5
//     scaling so dense vintage eras don't visually compete with sparse
//     modern ones.
//   - Search input filters across BOTH set names and the catalog's card
//     names, then hides era sections whose remaining set tiles are zero —
//     keeps the page coherent under a query.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CARD_CATALOG, setIdsInCatalog } from "@/lib/cards/catalog";
import { getAllSets, type SetMetadata } from "@/lib/cards/sdk";
import { CardsSearch, type SearchEntry } from "./cards-search";

export const dynamic = "force-static";
export const revalidate = 86_400;

const TITLE = "Browse Pokémon TCG cards by set — Foil";
const DESCRIPTION = `Find the best live eBay deal on any of ${CARD_CATALOG.length} curated Pokémon TCG cards. Browse vintage WotC holos, Neo era chase, modern V/VSTAR/ex — grouped by era and set.`;

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

// Era heading display + ordering. The Pokemon TCG SDK's `series` field is
// already era-shaped ("Base", "Neo", "Sword & Shield"); we add an explicit
// rank so historically-ordered eras render in 1996→present order rather
// than alphabetical.
const ERA_RANK: Record<string, number> = {
  Base: 10,
  Gym: 20,
  Neo: 30,
  "E-Card": 40,
  "EX": 50,
  "Diamond & Pearl": 60,
  Platinum: 70,
  "HeartGold & SoulSilver": 80,
  "Call of Legends": 85,
  "Black & White": 90,
  "XY": 100,
  "Sun & Moon": 110,
  "Sword & Shield": 120,
  "Scarlet & Violet": 130,
  Other: 999,
};

function eraRank(series: string): number {
  return ERA_RANK[series] ?? 500;
}

type EraGroup = {
  era: string;
  sets: SetMetadata[];
};

function groupByEra(sets: SetMetadata[]): EraGroup[] {
  const byEra = new Map<string, SetMetadata[]>();
  for (const s of sets) {
    const era = s.series || "Other";
    if (!byEra.has(era)) byEra.set(era, []);
    byEra.get(era)!.push(s);
  }
  // Sort sets within each era by release date ascending.
  for (const list of byEra.values()) {
    list.sort((a, b) => {
      const ad = a.releaseDate ?? "";
      const bd = b.releaseDate ?? "";
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    });
  }
  // Eras sorted by ERA_RANK so vintage comes first.
  return Array.from(byEra.entries())
    .map(([era, sets]) => ({ era, sets }))
    .sort((a, b) => eraRank(a.era) - eraRank(b.era));
}

function countsForSet(setId: string): number {
  let n = 0;
  for (const e of CARD_CATALOG) {
    if (e.pokemonTcgId.split("-")[0] === setId) n++;
  }
  return n;
}

function yearOf(set: SetMetadata): string | null {
  return set.releaseDate?.match(/^(\d{4})/)?.[1] ?? null;
}

export default async function CardsIndexPage() {
  // Pokemon TCG SDK has ~150 sets; we render only the ones present in our
  // catalog. The SDK fetch is cached 24h.
  const allSets = await getAllSets();
  const catalogSetIds = new Set(setIdsInCatalog());
  const setsInCatalog = allSets.filter((s) => catalogSetIds.has(s.id));
  // Defensive: if the SDK omits a set we expect, synthesize a minimal
  // placeholder so the tile still renders (the per-set page will fill in
  // the gaps at render time).
  for (const id of catalogSetIds) {
    if (!setsInCatalog.some((s) => s.id === id)) {
      setsInCatalog.push({
        id,
        name: id,
        series: "Other",
        releaseDate: null,
        total: 0,
        logoUrl: `https://images.pokemontcg.io/${id}/logo.png`,
      });
    }
  }
  const eraGroups = groupByEra(setsInCatalog);

  // Search index spans both card names and set names — a query for
  // "Charizard" matches every set containing a tracked Charizard, and a
  // query for "Base" matches the Base-era sets directly.
  const searchIndex: SearchEntry[] = [];
  for (const set of setsInCatalog) {
    searchIndex.push({ slug: set.id, name: set.name, setName: set.name });
  }
  for (const entry of CARD_CATALOG) {
    const setId = entry.pokemonTcgId.split("-")[0];
    const set = setsInCatalog.find((s) => s.id === setId);
    // Card-name hits route through the set tile that contains them — keep
    // the index entry's `slug` pointing at the set id so the client filter
    // can toggle the right tile.
    searchIndex.push({
      slug: setId,
      name: kebabToTitle(entry.slug.split("-").slice(2).join("-")),
      setName: set?.name ?? setId,
    });
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-12 pb-20 sm:px-8 sm:pt-16">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wider text-[#FF6B5C]">
          Catalog · {CARD_CATALOG.length} cards
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Browse Pokémon cards by set
        </h1>
        <p className="mt-4 text-lg text-zinc-300">
          Pick an era, then a set. Each set lists the cards Foil tracks
          live across eBay — best current deal, watchlist alerts, real prices.
        </p>
      </header>

      <CardsSearch index={searchIndex} />

      <div className="mt-12 space-y-16">
        {eraGroups.map((group) => (
          <section
            key={group.era}
            aria-labelledby={`era-${slugifyEra(group.era)}`}
            data-era
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2
                id={`era-${slugifyEra(group.era)}`}
                className="text-xl font-bold tracking-tight text-white sm:text-2xl"
              >
                {group.era === "Other" ? "Special sets" : `${group.era} era`}
              </h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-zinc-300">
                {group.sets.length} set{group.sets.length === 1 ? "" : "s"}
              </span>
            </div>

            <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5">
              {group.sets.map((set) => {
                const count = countsForSet(set.id);
                const year = yearOf(set);
                return (
                  <li
                    key={set.id}
                    data-card-slug={set.id}
                    data-card-name={set.name.toLowerCase()}
                  >
                    <Link
                      href={`/cards/sets/${set.id}`}
                      className="group block h-full rounded-2xl border border-white/8 bg-[#101D38] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#FF6B5C]/40 hover:bg-[#152549] hover:shadow-xl hover:shadow-[#FF6B5C]/5"
                    >
                      <div className="flex h-24 items-center justify-center rounded-xl bg-[#0B1428] px-3 py-2">
                        {set.logoUrl ? (
                          <Image
                            src={set.logoUrl}
                            alt={`${set.name} set logo`}
                            width={320}
                            height={120}
                            sizes="(min-width: 1280px) 14rem, (min-width: 1024px) 20vw, (min-width: 640px) 35vw, 80vw"
                            className="max-h-20 w-auto opacity-90 transition group-hover:opacity-100"
                          />
                        ) : (
                          <span className="text-xs uppercase tracking-wider text-zinc-500">
                            {set.id}
                          </span>
                        )}
                      </div>
                      <div className="mt-4 flex items-baseline justify-between gap-3">
                        <p className="truncate text-base font-semibold text-white group-hover:text-[#FF8775]">
                          {set.name}
                        </p>
                        {year ? (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                            {year}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">
                        {count} card{count === 1 ? "" : "s"} tracked
                        {set.total > 0 && set.total !== count ? <> · of {set.total} in set</> : null}
                      </p>
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

function slugifyEra(era: string): string {
  return era.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function kebabToTitle(kebab: string): string {
  return kebab.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
