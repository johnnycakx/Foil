// Line-tracker configuration (eve-line-tracker, ADR-095). Each entry defines a
// `/lines/[pokemon]` page: which catalog cards it enumerates (name-match token),
// its copy, and an optional dedication. Adding line #3 is a DATA entry here, not
// a build — the route reads this config; the launch allowlist gates which are
// live. Pure data module (no Next imports) so scripts + the route both use it.

export type LineConfig = {
  /** Route param + slug, e.g. "umbreon". */
  slug: string;
  /** Display name, e.g. "Umbreon". */
  pokemon: string;
  /** Case-insensitive token matched against catalog slugs to enumerate every
   *  printing (e.g. "umbreon" → every `*-umbreon*` slug). */
  matchToken: string;
  /** Page <title>. */
  title: string;
  /** Meta description + OG description. */
  description: string;
  /** One human line under the hero — collector words, no jargon. */
  tagline: string;
  /** Optional dedication handle (e.g. "@possiblyeve"). Absent = no dedication
   *  line. Config-driven so a page is made FOR someone when it should be. */
  dedication?: string;
};

export const LINE_CONFIGS: Record<string, LineConfig> = {
  umbreon: {
    slug: "umbreon",
    pokemon: "Umbreon",
    matchToken: "umbreon",
    title: "Every Umbreon card, tracked — prices, sold data, and the grails | Foil",
    description:
      "Every English Umbreon printing in one place: current market price, what each one actually sold for recently, and the live listings — from Neo Discovery to the Moonbreon alt art. Track any of them free.",
    tagline: "Every Umbreon printing, newest grails to the classics — what it costs, what it sold for, and where to buy.",
    dedication: "@possiblyeve",
  },
  espeon: {
    slug: "espeon",
    pokemon: "Espeon",
    matchToken: "espeon",
    title: "Every Espeon card, tracked — prices, sold data, and the grails | Foil",
    description:
      "Every English Espeon printing in one place: current market price, what each one actually sold for recently, and the live listings — from Neo Discovery to the modern alt arts. Track any of them free.",
    tagline: "Every Espeon printing, newest grails to the classics — what it costs, what it sold for, and where to buy.",
    dedication: "@possiblyeve",
  },
};

/** The lines live in production. Line #3 goes live by adding its config above
 *  AND its slug here (a card-data decision, not a build). */
export const LAUNCH_LINES: readonly string[] = ["umbreon", "espeon"];

/** Name-match tokens for the seed/snapshot scripts (every launch line). */
export const LINE_POKEMON: readonly string[] = LAUNCH_LINES.map((s) => LINE_CONFIGS[s].matchToken);

export function getLineConfig(slug: string): LineConfig | null {
  if (!LAUNCH_LINES.includes(slug)) return null;
  return LINE_CONFIGS[slug] ?? null;
}
