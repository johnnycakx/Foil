// Community-nickname alias layer for card search (quality-bar-fixes P0-1).
//
// The homepage TEACHES the query "moonbreon" ("How the chase works" step 01:
// moonbreon → Umbreon VMAX alt art · Evolving Skies) and the live search
// answered "Foil doesn't recognize that one yet" — the flagship marketing
// example was a dead end (2026-07-13 audit). The community vocabulary IS the
// register rule: a card-shop friend knows exactly which printing "moonbreon"
// means, so Foil must too.
//
// Design: normalized nickname → ORDERED pokemonTcgId list (the printing the
// community means first, siblings after). The search route checks the alias
// table BEFORE the upstream name search; alias hits render from the baked
// snapshot (no network — instant, which also serves the P0-4 latency budget).
//
// EVERY id here was verified against api.pokemontcg.io before seeding
// (null-over-guess applies to nicknames too — a wrong pinned printing is
// worse than no alias). When adding: verify the id, put the community's
// intended printing FIRST, and add the query to the marketing-query sweep in
// lib/__tests__/search-aliases.test.ts if any copy teaches it.

/** Lowercase, strip everything but letters/digits/spaces, collapse runs. */
export function normalizeAliasQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** normalized nickname → pokemonTcgIds, intended printing first. */
const ALIASES: Record<string, readonly string[]> = {
  // Umbreon VMAX Alternate Art, Evolving Skies #215 — THE moonbreon
  // (verified swsh7-215; the homepage's taught example).
  "moonbreon": ["swsh7-215"],
  "moon breon": ["swsh7-215"],
  "umbreon vmax alt": ["swsh7-215"],
  "umbreon vmax alt art": ["swsh7-215"],

  // Base Set Charizard #4 (verified base1-4).
  "zard": ["base1-4"],
  "base zard": ["base1-4"],
  "base set zard": ["base1-4"],
  "base set charizard": ["base1-4"],

  // Giratina V Alternate Art, Lost Origin #186 (verified swsh11-186). The
  // regular holo V (swsh11-130) is deliberately NOT listed: it isn't in the
  // catalog/bake, and every alias hit must render instantly from the
  // snapshot (P0-4 latency budget) — add it only after it's cataloged.
  "tina": ["swsh11-186"],
  "giratina alt": ["swsh11-186"],
  "giratina alt art": ["swsh11-186"],
  "giratina v alt": ["swsh11-186"],
  "lost origin giratina": ["swsh11-186"],

  // Rayquaza VMAX Alternate Art, Evolving Skies #218 (verified swsh7-218;
  // the set-numbered VMAX #111 rides second).
  "rayray": ["swsh7-218", "swsh7-111"],
  "ray ray": ["swsh7-218", "swsh7-111"],
  "rayquaza alt": ["swsh7-218", "swsh7-111"],
  "rayquaza vmax alt": ["swsh7-218", "swsh7-111"],
};

/**
 * Resolve a raw user query to pinned card ids, or null when the query isn't
 * a known nickname. Exact normalized match only — a nickname is a whole
 * query, not a substring ("moonbreon price" still resolves via the
 * leading-token pass; "umbreon" alone must NOT hijack to one printing).
 */
export function resolveAlias(rawQuery: string): readonly string[] | null {
  const q = normalizeAliasQuery(rawQuery);
  if (!q) return null;
  const direct = ALIASES[q];
  if (direct) return direct;
  // Tolerate trailing qualifier words a collector types after the nickname
  // ("moonbreon price", "zard psa 10"): longest alias prefix wins, but only
  // at a word boundary.
  for (const key of Object.keys(ALIASES).sort((a, b) => b.length - a.length)) {
    if (q === key || q.startsWith(`${key} `)) return ALIASES[key];
  }
  return null;
}

/** Every alias key (for the sweep test + future admin surfaces). */
export function aliasKeys(): string[] {
  return Object.keys(ALIASES);
}
