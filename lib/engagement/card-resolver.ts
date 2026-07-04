// Deterministic exact-card resolution for the engagement engine (ADR-086
// hardening). The card-ID framework applied (docs/foil-card-id-framework.md):
// resolve a post to a SPECIFIC card — the catalog slug IS the identity (set +
// collector number + name) — NEVER a name-only fuzzy match, and NULL OVER GUESS
// when the text is ambiguous. This is the brand-critical fix for the live bug
// where "Moonbreon" (Umbreon VMAX Alt Art, swsh7-215) was fuzzy-matched to a
// DIFFERENT row (Umbreon ex, sv8pt5-161) and cited its $1,347 figure.
//
// The engine then cites ONLY the market_movers row whose slug equals this — so a
// reply can never carry another printing's price. A bare/ambiguous Pokemon name
// resolves to null, and the engine skips the numbered claim rather than guess.

export type KnownCard = {
  /** The exact catalog slug = the card's identity (set + collector# + name). */
  slug: string;
  /** Human label for the brief. */
  displayName: string;
  /** SPECIFIC phrases that unambiguously name THIS exact printing. A bare
   *  Pokemon name (just "umbreon", "charizard") is intentionally NOT an alias —
   *  it's the weakest signal and would resolve to the wrong printing. */
  aliases: string[];
};

// Curated chase cards (the famous ones people tweet about + where wrong-card
// risk is highest). Slugs verified against lib/cards/catalog.ts. Extend as new
// chase cards appear; every alias must be specific to ONE printing.
export const KNOWN_CARDS: readonly KnownCard[] = [
  {
    slug: "swsh7-215-umbreon-vmax-alt-art",
    displayName: 'Umbreon VMAX Alt Art (Evolving Skies, 215/203 — "Moonbreon")',
    aliases: ["moonbreon", "umbreon vmax alt", "umbreon vmax alt art", "umbreon alt art", "umbreon vmax secret", "umbreon vmax 215", "215/203 umbreon"],
  },
  {
    slug: "swsh7-218-rayquaza-vmax-alt-art",
    displayName: "Rayquaza VMAX Alt Art (Evolving Skies, 218/203)",
    aliases: ["rayquaza vmax alt", "rayquaza vmax alt art", "rayquaza alt art", "rayquaza vmax 218"],
  },
  {
    slug: "swsh11-186-giratina-v-alt-art",
    displayName: "Giratina V Alt Art (Lost Origin, 186/196)",
    aliases: ["giratina v alt", "giratina v alt art", "giratina alt art", "giratina v 186"],
  },
  {
    slug: "swsh12-186-lugia-v-alt-art",
    displayName: "Lugia V Alt Art (Silver Tempest, 186/195)",
    aliases: ["lugia v alt", "lugia v alt art", "lugia alt art", "lugia v 186"],
  },
  {
    slug: "swsh35-74-charizard-vmax-rainbow-rare",
    displayName: "Charizard VMAX Rainbow Rare (Champion's Path, 074/073)",
    aliases: ["champions path charizard", "champion's path charizard", "charizard vmax rainbow", "charizard vmax champions path"],
  },
  {
    slug: "swsh4-188-pikachu-vmax-rainbow",
    displayName: "Pikachu VMAX Rainbow Rare (Vivid Voltage, 188/185)",
    aliases: ["pikachu vmax rainbow", "rainbow pikachu vmax", "vivid voltage pikachu vmax", "pikachu vmax 188"],
  },
  {
    slug: "swsh8-269-mew-vmax-alt-art",
    displayName: "Mew VMAX Alt Art (Fusion Strike, 269/264)",
    // bare "mew vmax" is ambiguous with the regular VMAX — require "alt".
    aliases: ["mew vmax alt", "mew vmax alt art", "mew vmax 269"],
  },
  // Prismatic Evolutions eeveelution-ex SIRs (sv8pt5). The bare "<eeveelution>
  // ex" alias was STRIPPED (x-reply-desk 3a): the 1,840-card catalog has
  // same-name regular arts (e.g. sv8pt5-60 regular Umbreon ex vs -161 SIR), so a
  // $5-pull question about the regular art would get the four-figure SIR answer.
  // Require a "prismatic"/number/SIR qualifier — same discipline as charizard ex
  // (below). NULL over guess when only the bare name is present.
  {
    slug: "sv8pt5-161-umbreon-ex",
    displayName: "Umbreon ex SIR (Prismatic Evolutions, 161/131)",
    aliases: ["umbreon ex prismatic", "prismatic umbreon ex", "umbreon ex 161", "umbreon ex sir"],
  },
  {
    slug: "sv8pt5-156-sylveon-ex",
    displayName: "Sylveon ex SIR (Prismatic Evolutions, 156/131)",
    aliases: ["sylveon ex prismatic", "prismatic sylveon ex", "sylveon ex 156", "sylveon ex sir"],
  },
  {
    slug: "sv8pt5-144-leafeon-ex",
    displayName: "Leafeon ex SIR (Prismatic Evolutions, 144/131)",
    aliases: ["leafeon ex prismatic", "prismatic leafeon ex", "leafeon ex 144", "leafeon ex sir"],
  },
  {
    slug: "sv8pt5-149-vaporeon-ex",
    displayName: "Vaporeon ex SIR (Prismatic Evolutions, 149/131)",
    aliases: ["vaporeon ex prismatic", "prismatic vaporeon ex", "vaporeon ex 149", "vaporeon ex sir"],
  },
  {
    slug: "sv8pt5-146-flareon-ex",
    displayName: "Flareon ex SIR (Prismatic Evolutions, 146/131)",
    aliases: ["flareon ex prismatic", "prismatic flareon ex", "flareon ex 146", "flareon ex sir"],
  },
  // Destined Rivals trainer-ex (sv10) — the character name + "ex" is unique.
  {
    slug: "sv10-231-team-rocket-s-mewtwo-ex",
    displayName: "Team Rocket's Mewtwo ex (Destined Rivals, 231/182)",
    // "team rocket's" distinguishes from the vintage gym2-14 "Rocket's Mewtwo".
    aliases: ["team rocket's mewtwo ex", "team rockets mewtwo ex"],
  },
  {
    slug: "sv10-232-cynthia-s-garchomp-ex",
    displayName: "Cynthia's Garchomp ex (Destined Rivals, 232/182)",
    aliases: ["cynthia's garchomp ex", "cynthias garchomp ex"],
  },
  {
    slug: "sv10-230-ethan-s-ho-oh-ex",
    displayName: "Ethan's Ho-Oh ex (Destined Rivals, 230/182)",
    aliases: ["ethan's ho-oh ex", "ethans ho oh ex"],
  },
  {
    slug: "me1-187-mega-gardevoir-ex",
    displayName: "Mega Gardevoir ex (Mega Evolution, 187/132)",
    aliases: ["mega gardevoir ex"],
  },
  {
    slug: "sv8-238-pikachu-ex",
    displayName: "Pikachu ex SIR (Surging Sparks, 238/191)",
    // bare "pikachu ex" spans many sets — require the set/number.
    aliases: ["pikachu ex surging sparks", "surging sparks pikachu ex", "pikachu ex 238"],
  },
  {
    slug: "sv3pt5-199-charizard-ex",
    displayName: "Charizard ex SIR (151, 199/165)",
    // bare "charizard ex" / "151 charizard" are ambiguous — require the number.
    aliases: ["charizard ex 199", "151 charizard ex 199"],
  },
];
// Recall lever (ADR-086): this map is intentionally conservative — every alias
// names ONE printing unambiguously, so accuracy never trades for coverage. To
// surface more posts, ADD chase cards here with specific aliases (never a bare
// Pokemon name). A post about a card not in this map resolves to null → skipped,
// not mis-cited. Quality over quantity.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 /]+/g, " ").replace(/\s+/g, " ").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type ResolvedCard = { slug: string; displayName: string };

/**
 * Resolve a post's text to ONE specific card, or null. Each alias is matched as a
 * word-bounded phrase. NULL OVER GUESS in both directions: 0 cards match (a bare
 * or unknown name) → null; MORE THAN ONE distinct card matches (the post names
 * two cards) → null, since which one to cite is ambiguous. Only an unambiguous
 * single-card match resolves. The returned slug is the identity the engine
 * matches the data row against — never the Pokemon name.
 */
export function resolveCardSlug(text: string): ResolvedCard | null {
  const t = ` ${norm(text)} `;
  const matched = new Map<string, KnownCard>(); // distinct slug -> card
  for (const card of KNOWN_CARDS) {
    for (const alias of card.aliases) {
      if (new RegExp(`(^| )${escapeRe(norm(alias))}( |$)`).test(t)) {
        matched.set(card.slug, card);
        break; // one alias hit is enough to mark this card
      }
    }
  }
  if (matched.size !== 1) return null; // 0 = none; >1 = ambiguous → null over guess
  const card = [...matched.values()][0];
  return { slug: card.slug, displayName: card.displayName };
}
