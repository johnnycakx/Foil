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
 * Resolve a post's text to ONE specific card, or null. Matches the longest /
 * most-specific alias as a word-bounded phrase; an ambiguous bare name matches
 * no alias and returns null (null over guess). The returned slug is the identity
 * the engine matches the data row against — never the Pokemon name.
 */
export function resolveCardSlug(text: string): ResolvedCard | null {
  const t = ` ${norm(text)} `;
  let best: { card: KnownCard; aliasLen: number } | null = null;
  for (const card of KNOWN_CARDS) {
    for (const alias of card.aliases) {
      const a = norm(alias);
      if (new RegExp(`(^| )${escapeRe(a)}( |$)`).test(t)) {
        if (!best || a.length > best.aliasLen) best = { card, aliasLen: a.length };
      }
    }
  }
  return best ? { slug: best.card.slug, displayName: best.card.displayName } : null;
}
