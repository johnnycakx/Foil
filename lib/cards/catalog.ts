// Curated catalog of 200 commercially-relevant Pokemon TCG cards for the V1
// deal-finder. Each entry maps a Foil page slug to a Pokemon TCG SDK id.
//
// Slug format: <set-id>-<number>-<kebab-name>
//   - Set-id and number match the Pokemon TCG SDK id ("base1-4")
//   - Name suffix is for SEO — keyword in the URL helps "charizard base set
//     for sale" rank against the long-tail query intent
//
// The catalog is hand-curated rather than fetched at build time on purpose:
//   1. Determinism — `generateStaticParams` returns the same 200 slugs every
//      build, no network dependency at build time.
//   2. SEO curation — these are the cards with high commercial-intent search
//      volume, not "every card the API knows about." Quality beats coverage.
//   3. Cheap to update — add an entry, redeploy. The 200-card pipeline scales
//      to 1000+ when Browse API approval lands (per ADR-021 amendment) by
//      shifting to a fetched seed.
//
// Composition (200 total):
//   - Vintage WotC holos: Base Set (16) + Jungle (16) + Fossil (15) + Base
//     Set 2 (5) + Team Rocket (14) + Gym Heroes (14) + Gym Challenge (16) +
//     Legendary Collection (19) + Neo era (56) = 171
//   - Modern chase: Hidden Fates GX (5) + Celebrations (5) + Evolving Skies
//     VMAX (5) + Brilliant Stars (4) + Crown Zenith (5) + 151 (5) = 29

export type CatalogEntry = {
  /** Pokemon TCG SDK id — e.g. "base1-4". */
  pokemonTcgId: string;
  /** Foil page slug — `<set-id>-<number>-<kebab-name>`. */
  slug: string;
};

export const CARD_CATALOG: readonly CatalogEntry[] = [
  // Base Set (base1) — the foundational holo lineup. Charizard is the most
  // searched Pokemon TCG single in history; the others are the "deck box of
  // a 90s kid" set.
  { pokemonTcgId: "base1-1",  slug: "base1-1-alakazam" },
  { pokemonTcgId: "base1-2",  slug: "base1-2-blastoise" },
  { pokemonTcgId: "base1-3",  slug: "base1-3-chansey" },
  { pokemonTcgId: "base1-4",  slug: "base1-4-charizard" },
  { pokemonTcgId: "base1-5",  slug: "base1-5-clefairy" },
  { pokemonTcgId: "base1-6",  slug: "base1-6-gyarados" },
  { pokemonTcgId: "base1-7",  slug: "base1-7-hitmonchan" },
  { pokemonTcgId: "base1-8",  slug: "base1-8-machamp" },
  { pokemonTcgId: "base1-9",  slug: "base1-9-magneton" },
  { pokemonTcgId: "base1-10", slug: "base1-10-mewtwo" },
  { pokemonTcgId: "base1-11", slug: "base1-11-nidoking" },
  { pokemonTcgId: "base1-12", slug: "base1-12-ninetales" },
  { pokemonTcgId: "base1-13", slug: "base1-13-poliwrath" },
  { pokemonTcgId: "base1-14", slug: "base1-14-raichu" },
  { pokemonTcgId: "base1-15", slug: "base1-15-venusaur" },
  { pokemonTcgId: "base1-16", slug: "base1-16-zapdos" },

  // Jungle (base2) — sealed Jungle booster boxes still trade actively.
  { pokemonTcgId: "base2-1",  slug: "base2-1-clefable" },
  { pokemonTcgId: "base2-2",  slug: "base2-2-electrode" },
  { pokemonTcgId: "base2-3",  slug: "base2-3-flareon" },
  { pokemonTcgId: "base2-4",  slug: "base2-4-jolteon" },
  { pokemonTcgId: "base2-5",  slug: "base2-5-kangaskhan" },
  { pokemonTcgId: "base2-6",  slug: "base2-6-mr-mime" },
  { pokemonTcgId: "base2-7",  slug: "base2-7-nidoqueen" },
  { pokemonTcgId: "base2-8",  slug: "base2-8-pidgeot" },
  { pokemonTcgId: "base2-9",  slug: "base2-9-pinsir" },
  { pokemonTcgId: "base2-10", slug: "base2-10-scyther" },
  { pokemonTcgId: "base2-11", slug: "base2-11-snorlax" },
  { pokemonTcgId: "base2-12", slug: "base2-12-vaporeon" },
  { pokemonTcgId: "base2-13", slug: "base2-13-venomoth" },
  { pokemonTcgId: "base2-14", slug: "base2-14-victreebel" },
  { pokemonTcgId: "base2-15", slug: "base2-15-vileplume" },
  { pokemonTcgId: "base2-16", slug: "base2-16-wigglytuff" },

  // Fossil (base3).
  { pokemonTcgId: "base3-1",  slug: "base3-1-aerodactyl" },
  { pokemonTcgId: "base3-2",  slug: "base3-2-articuno" },
  { pokemonTcgId: "base3-3",  slug: "base3-3-ditto" },
  { pokemonTcgId: "base3-4",  slug: "base3-4-dragonite" },
  { pokemonTcgId: "base3-5",  slug: "base3-5-gengar" },
  { pokemonTcgId: "base3-6",  slug: "base3-6-haunter" },
  { pokemonTcgId: "base3-7",  slug: "base3-7-hitmonlee" },
  { pokemonTcgId: "base3-8",  slug: "base3-8-hypno" },
  { pokemonTcgId: "base3-9",  slug: "base3-9-kabutops" },
  { pokemonTcgId: "base3-10", slug: "base3-10-lapras" },
  { pokemonTcgId: "base3-11", slug: "base3-11-magneton" },
  { pokemonTcgId: "base3-12", slug: "base3-12-moltres" },
  { pokemonTcgId: "base3-13", slug: "base3-13-muk" },
  { pokemonTcgId: "base3-14", slug: "base3-14-raichu" },
  { pokemonTcgId: "base3-15", slug: "base3-15-zapdos" },

  // Base Set 2 (base4) — mostly reprints but the iconic ones still earn
  // their own page. The Base Set 2 Charizard is its own collector market.
  { pokemonTcgId: "base4-1",  slug: "base4-1-alakazam" },
  { pokemonTcgId: "base4-2",  slug: "base4-2-blastoise" },
  { pokemonTcgId: "base4-4",  slug: "base4-4-charizard" },
  { pokemonTcgId: "base4-10", slug: "base4-10-mewtwo" },
  { pokemonTcgId: "base4-18", slug: "base4-18-venusaur" },

  // Team Rocket (base5) — Dark holos. Dark Charizard is the headliner.
  { pokemonTcgId: "base5-1",  slug: "base5-1-dark-alakazam" },
  { pokemonTcgId: "base5-2",  slug: "base5-2-dark-arbok" },
  { pokemonTcgId: "base5-3",  slug: "base5-3-dark-blastoise" },
  { pokemonTcgId: "base5-4",  slug: "base5-4-dark-charizard" },
  { pokemonTcgId: "base5-5",  slug: "base5-5-dark-dragonite" },
  { pokemonTcgId: "base5-6",  slug: "base5-6-dark-dugtrio" },
  { pokemonTcgId: "base5-7",  slug: "base5-7-dark-golbat" },
  { pokemonTcgId: "base5-8",  slug: "base5-8-dark-gyarados" },
  { pokemonTcgId: "base5-9",  slug: "base5-9-dark-hypno" },
  { pokemonTcgId: "base5-10", slug: "base5-10-dark-machamp" },
  { pokemonTcgId: "base5-11", slug: "base5-11-dark-magneton" },
  { pokemonTcgId: "base5-12", slug: "base5-12-dark-slowbro" },
  { pokemonTcgId: "base5-13", slug: "base5-13-dark-vileplume" },
  { pokemonTcgId: "base5-14", slug: "base5-14-dark-weezing" },

  // Gym Heroes (gym1) — themed gym leader cards.
  { pokemonTcgId: "gym1-1",  slug: "gym1-1-blaines-moltres" },
  { pokemonTcgId: "gym1-2",  slug: "gym1-2-brocks-rhydon" },
  { pokemonTcgId: "gym1-3",  slug: "gym1-3-erikas-clefable" },
  { pokemonTcgId: "gym1-4",  slug: "gym1-4-erikas-dragonair" },
  { pokemonTcgId: "gym1-5",  slug: "gym1-5-erikas-vileplume" },
  { pokemonTcgId: "gym1-6",  slug: "gym1-6-lt-surges-electabuzz" },
  { pokemonTcgId: "gym1-7",  slug: "gym1-7-lt-surges-fearow" },
  { pokemonTcgId: "gym1-8",  slug: "gym1-8-lt-surges-magneton" },
  { pokemonTcgId: "gym1-9",  slug: "gym1-9-mistys-seadra" },
  { pokemonTcgId: "gym1-10", slug: "gym1-10-mistys-tentacruel" },
  { pokemonTcgId: "gym1-11", slug: "gym1-11-rockets-hitmonchan" },
  { pokemonTcgId: "gym1-12", slug: "gym1-12-rockets-moltres" },
  { pokemonTcgId: "gym1-13", slug: "gym1-13-rockets-scyther" },
  { pokemonTcgId: "gym1-14", slug: "gym1-14-sabrinas-gengar" },

  // Gym Challenge (gym2) — Blaine's Charizard is one of the priciest gym
  // singles ever printed.
  { pokemonTcgId: "gym2-1",  slug: "gym2-1-blaines-arcanine" },
  { pokemonTcgId: "gym2-2",  slug: "gym2-2-blaines-charizard" },
  { pokemonTcgId: "gym2-3",  slug: "gym2-3-brocks-ninetales" },
  { pokemonTcgId: "gym2-4",  slug: "gym2-4-erikas-venusaur" },
  { pokemonTcgId: "gym2-5",  slug: "gym2-5-giovannis-gyarados" },
  { pokemonTcgId: "gym2-6",  slug: "gym2-6-giovannis-machamp" },
  { pokemonTcgId: "gym2-7",  slug: "gym2-7-giovannis-nidoking" },
  { pokemonTcgId: "gym2-8",  slug: "gym2-8-giovannis-persian" },
  { pokemonTcgId: "gym2-9",  slug: "gym2-9-kogas-beedrill" },
  { pokemonTcgId: "gym2-10", slug: "gym2-10-kogas-ditto" },
  { pokemonTcgId: "gym2-11", slug: "gym2-11-lt-surges-raichu" },
  { pokemonTcgId: "gym2-12", slug: "gym2-12-mistys-golduck" },
  { pokemonTcgId: "gym2-13", slug: "gym2-13-mistys-gyarados" },
  { pokemonTcgId: "gym2-14", slug: "gym2-14-rockets-mewtwo" },
  { pokemonTcgId: "gym2-15", slug: "gym2-15-rockets-zapdos" },
  { pokemonTcgId: "gym2-16", slug: "gym2-16-sabrinas-alakazam" },

  // Legendary Collection (base6) — first reverse-holo set, niche premium.
  { pokemonTcgId: "base6-1",  slug: "base6-1-alakazam" },
  { pokemonTcgId: "base6-2",  slug: "base6-2-articuno" },
  { pokemonTcgId: "base6-3",  slug: "base6-3-charizard" },
  { pokemonTcgId: "base6-4",  slug: "base6-4-dark-blastoise" },
  { pokemonTcgId: "base6-5",  slug: "base6-5-dark-dragonite" },
  { pokemonTcgId: "base6-6",  slug: "base6-6-dark-persian" },
  { pokemonTcgId: "base6-7",  slug: "base6-7-dark-raichu" },
  { pokemonTcgId: "base6-8",  slug: "base6-8-dark-slowbro" },
  { pokemonTcgId: "base6-9",  slug: "base6-9-dark-vaporeon" },
  { pokemonTcgId: "base6-10", slug: "base6-10-flareon" },
  { pokemonTcgId: "base6-11", slug: "base6-11-gengar" },
  { pokemonTcgId: "base6-12", slug: "base6-12-gyarados" },
  { pokemonTcgId: "base6-13", slug: "base6-13-hitmonlee" },
  { pokemonTcgId: "base6-14", slug: "base6-14-jolteon" },
  { pokemonTcgId: "base6-15", slug: "base6-15-machamp" },
  { pokemonTcgId: "base6-16", slug: "base6-16-muk" },
  { pokemonTcgId: "base6-17", slug: "base6-17-ninetales" },
  { pokemonTcgId: "base6-18", slug: "base6-18-venusaur" },
  { pokemonTcgId: "base6-19", slug: "base6-19-zapdos" },

  // Neo Genesis (neo1) — Lugia is THE Neo Genesis card. ~14 Pokemon holos.
  { pokemonTcgId: "neo1-1",  slug: "neo1-1-ampharos" },
  { pokemonTcgId: "neo1-2",  slug: "neo1-2-azumarill" },
  { pokemonTcgId: "neo1-3",  slug: "neo1-3-bellossom" },
  { pokemonTcgId: "neo1-4",  slug: "neo1-4-feraligatr" },
  { pokemonTcgId: "neo1-6",  slug: "neo1-6-heracross" },
  { pokemonTcgId: "neo1-7",  slug: "neo1-7-jumpluff" },
  { pokemonTcgId: "neo1-8",  slug: "neo1-8-kingdra" },
  { pokemonTcgId: "neo1-9",  slug: "neo1-9-lugia" },
  { pokemonTcgId: "neo1-10", slug: "neo1-10-meganium" },
  { pokemonTcgId: "neo1-12", slug: "neo1-12-pichu" },
  { pokemonTcgId: "neo1-13", slug: "neo1-13-skarmory" },
  { pokemonTcgId: "neo1-14", slug: "neo1-14-slowking" },
  { pokemonTcgId: "neo1-15", slug: "neo1-15-steelix" },
  { pokemonTcgId: "neo1-17", slug: "neo1-17-typhlosion" },

  // Neo Discovery (neo2) — Espeon, Umbreon, Tyranitar headline.
  { pokemonTcgId: "neo2-1",  slug: "neo2-1-espeon" },
  { pokemonTcgId: "neo2-2",  slug: "neo2-2-forretress" },
  { pokemonTcgId: "neo2-3",  slug: "neo2-3-hitmontop" },
  { pokemonTcgId: "neo2-4",  slug: "neo2-4-houndoom" },
  { pokemonTcgId: "neo2-5",  slug: "neo2-5-houndour" },
  { pokemonTcgId: "neo2-6",  slug: "neo2-6-kabutops" },
  { pokemonTcgId: "neo2-7",  slug: "neo2-7-magnemite" },
  { pokemonTcgId: "neo2-8",  slug: "neo2-8-politoed" },
  { pokemonTcgId: "neo2-9",  slug: "neo2-9-poliwrath" },
  { pokemonTcgId: "neo2-10", slug: "neo2-10-scizor" },
  { pokemonTcgId: "neo2-11", slug: "neo2-11-smeargle" },
  { pokemonTcgId: "neo2-12", slug: "neo2-12-tyranitar" },
  { pokemonTcgId: "neo2-13", slug: "neo2-13-umbreon" },
  { pokemonTcgId: "neo2-15", slug: "neo2-15-ursaring" },
  { pokemonTcgId: "neo2-16", slug: "neo2-16-wobbuffet" },
  { pokemonTcgId: "neo2-17", slug: "neo2-17-yanma" },

  // Neo Revelation (neo3) — Ho-oh, Suicune, Raikou, Entei.
  { pokemonTcgId: "neo3-1",  slug: "neo3-1-ampharos" },
  { pokemonTcgId: "neo3-2",  slug: "neo3-2-blissey" },
  { pokemonTcgId: "neo3-3",  slug: "neo3-3-celebi" },
  { pokemonTcgId: "neo3-4",  slug: "neo3-4-crobat" },
  { pokemonTcgId: "neo3-5",  slug: "neo3-5-delibird" },
  { pokemonTcgId: "neo3-6",  slug: "neo3-6-entei" },
  { pokemonTcgId: "neo3-7",  slug: "neo3-7-ho-oh" },
  { pokemonTcgId: "neo3-8",  slug: "neo3-8-houndoom" },
  { pokemonTcgId: "neo3-9",  slug: "neo3-9-jumpluff" },
  { pokemonTcgId: "neo3-10", slug: "neo3-10-magneton" },
  { pokemonTcgId: "neo3-11", slug: "neo3-11-misdreavus" },
  { pokemonTcgId: "neo3-12", slug: "neo3-12-porygon2" },
  { pokemonTcgId: "neo3-13", slug: "neo3-13-raikou" },
  { pokemonTcgId: "neo3-14", slug: "neo3-14-suicune" },

  // Neo Destiny (neo4) — Dark/Light variants.
  { pokemonTcgId: "neo4-1",  slug: "neo4-1-dark-ampharos" },
  { pokemonTcgId: "neo4-2",  slug: "neo4-2-dark-crobat" },
  { pokemonTcgId: "neo4-3",  slug: "neo4-3-dark-donphan" },
  { pokemonTcgId: "neo4-4",  slug: "neo4-4-dark-espeon" },
  { pokemonTcgId: "neo4-5",  slug: "neo4-5-dark-feraligatr" },
  { pokemonTcgId: "neo4-6",  slug: "neo4-6-dark-gengar" },
  { pokemonTcgId: "neo4-7",  slug: "neo4-7-dark-houndoom" },
  { pokemonTcgId: "neo4-10", slug: "neo4-10-dark-typhlosion" },
  { pokemonTcgId: "neo4-11", slug: "neo4-11-dark-tyranitar" },
  { pokemonTcgId: "neo4-12", slug: "neo4-12-light-arcanine" },
  { pokemonTcgId: "neo4-14", slug: "neo4-14-light-dragonite" },

  // Hidden Fates (sm115) — GX chase cards.
  { pokemonTcgId: "sm115-9",  slug: "sm115-9-charizard-gx" },
  { pokemonTcgId: "sm115-16", slug: "sm115-16-gyarados-gx" },
  { pokemonTcgId: "sm115-20", slug: "sm115-20-raichu-gx" },
  { pokemonTcgId: "sm115-31", slug: "sm115-31-mewtwo-gx" },
  { pokemonTcgId: "sm115-44", slug: "sm115-44-moltres-zapdos-articuno-gx" },

  // Celebrations (cel25) — 25th anniversary classic-art reprints.
  { pokemonTcgId: "cel25-6",  slug: "cel25-6-flying-pikachu-v" },
  { pokemonTcgId: "cel25-8",  slug: "cel25-8-surfing-pikachu-v" },
  { pokemonTcgId: "cel25-9",  slug: "cel25-9-surfing-pikachu-vmax" },
  { pokemonTcgId: "cel25-11", slug: "cel25-11-mew" },
  { pokemonTcgId: "cel25-16", slug: "cel25-16-zacian-v" },

  // Evolving Skies (swsh7) — VMAX Eeveelutions, all chase rares.
  { pokemonTcgId: "swsh7-8",  slug: "swsh7-8-leafeon-vmax" },
  { pokemonTcgId: "swsh7-18", slug: "swsh7-18-flareon-vmax" },
  { pokemonTcgId: "swsh7-29", slug: "swsh7-29-gyarados-vmax" },
  { pokemonTcgId: "swsh7-41", slug: "swsh7-41-glaceon-vmax" },
  { pokemonTcgId: "swsh7-51", slug: "swsh7-51-jolteon-vmax" },

  // Brilliant Stars (swsh9) — Charizard V/VSTAR + Whimsicott.
  { pokemonTcgId: "swsh9-17", slug: "swsh9-17-charizard-v" },
  { pokemonTcgId: "swsh9-18", slug: "swsh9-18-charizard-vstar" },
  { pokemonTcgId: "swsh9-65", slug: "swsh9-65-whimsicott-vstar" },
  { pokemonTcgId: "swsh9-13", slug: "swsh9-13-shaymin-v" },

  // Crown Zenith (swsh12pt5) — Charizard V/VSTAR + Mewtwo + Mew V.
  { pokemonTcgId: "swsh12pt5-18", slug: "swsh12pt5-18-charizard-v" },
  { pokemonTcgId: "swsh12pt5-19", slug: "swsh12pt5-19-charizard-vstar" },
  { pokemonTcgId: "swsh12pt5-37", slug: "swsh12pt5-37-kyogre-v" },
  { pokemonTcgId: "swsh12pt5-59", slug: "swsh12pt5-59-mewtwo" },
  { pokemonTcgId: "swsh12pt5-60", slug: "swsh12pt5-60-mew-v" },

  // Scarlet & Violet 151 (sv3pt5) — Special Illustration Rare ex cards and
  // the Pikachu IR. These are the modern chase cards driving 2025-26 demand.
  { pokemonTcgId: "sv3pt5-173", slug: "sv3pt5-173-pikachu" },
  { pokemonTcgId: "sv3pt5-198", slug: "sv3pt5-198-venusaur-ex" },
  { pokemonTcgId: "sv3pt5-199", slug: "sv3pt5-199-charizard-ex" },
  { pokemonTcgId: "sv3pt5-200", slug: "sv3pt5-200-blastoise-ex" },
  { pokemonTcgId: "sv3pt5-201", slug: "sv3pt5-201-alakazam-ex" },
  { pokemonTcgId: "sv3pt5-205", slug: "sv3pt5-205-mew-ex" },
];

/** Quick lookup by slug. O(1) — built once at module load. */
const BY_SLUG: Map<string, CatalogEntry> = new Map(
  CARD_CATALOG.map((entry) => [entry.slug, entry]),
);

export function getCatalogEntry(slug: string): CatalogEntry | undefined {
  return BY_SLUG.get(slug);
}

/**
 * Return up to N other entries from the same set, prioritizing entries with
 * nearby collector numbers. Used to populate the "Related cards" block at
 * the bottom of each `/cards/[slug]` page.
 */
export function relatedCardsForSlug(slug: string, max = 6): CatalogEntry[] {
  const current = getCatalogEntry(slug);
  if (!current) return [];
  const currentSetId = current.pokemonTcgId.split("-")[0];
  const currentNumber = parseInt(current.pokemonTcgId.split("-").slice(1).join("-"), 10);

  const sameSet = CARD_CATALOG.filter((e) => {
    if (e.slug === slug) return false;
    return e.pokemonTcgId.split("-")[0] === currentSetId;
  });

  // Sort by absolute distance from the current collector number.
  sameSet.sort((a, b) => {
    const an = parseInt(a.pokemonTcgId.split("-").slice(1).join("-"), 10);
    const bn = parseInt(b.pokemonTcgId.split("-").slice(1).join("-"), 10);
    const ad = Number.isFinite(an) ? Math.abs(an - currentNumber) : 999;
    const bd = Number.isFinite(bn) ? Math.abs(bn - currentNumber) : 999;
    return ad - bd;
  });

  return sameSet.slice(0, max);
}
