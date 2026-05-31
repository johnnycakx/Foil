// Expand the catalog with long-tail cards (Session 47.4 / ADR-046).
//
// Reads the newest docs/candidate-cards-ranked-*.json (or --file <path>), takes
// the top --n candidates that aren't already in CARD_CATALOG, validates the
// slug shape, and OVERWRITES lib/cards/catalog-longtail.generated.ts with the
// entries (tier: "longtail"). catalog.ts spreads that file into CARD_CATALOG.
// Idempotent — re-running regenerates the file from scratch.
//
// Usage: npx tsx scripts/expand-catalog.ts [--n 800] [--file <ranked.json>]

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CARD_CATALOG } from "../lib/cards/catalog.ts";

const argv = process.argv.slice(2);
function arg(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const N = Number(arg("n") ?? 800);
const SLUG_RE = /^[a-z0-9-]+$/;
const OUT = "lib/cards/catalog-longtail.generated.ts";

type Candidate = { pokemonTcgId: string; slug: string; name?: string; score?: number };

function newestRankedFile(): string {
  const explicit = arg("file");
  if (explicit) return explicit;
  const dir = join(process.cwd(), "docs");
  const files = readdirSync(dir)
    .filter((f) => /^candidate-cards-ranked-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (files.length === 0) throw new Error("No docs/candidate-cards-ranked-*.json found — run rank-candidate-cards.ts first.");
  return join("docs", files[files.length - 1]);
}

function main(): void {
  const rankedPath = newestRankedFile();
  const candidates = JSON.parse(readFileSync(join(process.cwd(), rankedPath), "utf8")) as Candidate[];

  // Dedupe against the CURATED catalog only — NOT the existing long-tail,
  // which this run is about to overwrite. (Otherwise a prior expansion's
  // entries get treated as "taken" and the top-ranked cards drop out.)
  const curated = CARD_CATALOG.filter((c) => c.tier !== "longtail");
  const existingSlugs = new Set(curated.map((c) => c.slug));
  const existingIds = new Set(curated.map((c) => c.pokemonTcgId));
  const seenSlug = new Set<string>();
  const seenId = new Set<string>();

  const picked: Candidate[] = [];
  let skippedDup = 0;
  let skippedBadSlug = 0;
  for (const c of candidates) {
    if (picked.length >= N) break;
    if (!c.slug || !SLUG_RE.test(c.slug)) { skippedBadSlug++; continue; }
    if (existingSlugs.has(c.slug) || existingIds.has(c.pokemonTcgId)) { skippedDup++; continue; }
    if (seenSlug.has(c.slug) || seenId.has(c.pokemonTcgId)) { skippedDup++; continue; }
    seenSlug.add(c.slug);
    seenId.add(c.pokemonTcgId);
    picked.push(c);
  }

  const body =
    `// GENERATED FILE — do not edit by hand.\n` +
    `// Written by scripts/expand-catalog.ts (Session 47.4 / ADR-046). Holds the\n` +
    `// long-tail catalog expansion (tier: "longtail") spread into CARD_CATALOG in\n` +
    `// catalog.ts. Regenerate with: npx tsx scripts/expand-catalog.ts --n <count>\n` +
    `// Source: ${rankedPath} — ${picked.length} entries, generated ${new Date().toISOString()}.\n\n` +
    `import type { CatalogEntry } from "./catalog.ts";\n\n` +
    `export const LONGTAIL_CATALOG: readonly CatalogEntry[] = [\n` +
    picked
      .map((c) => `  { pokemonTcgId: ${JSON.stringify(c.pokemonTcgId)}, slug: ${JSON.stringify(c.slug)}, tier: "longtail" },`)
      .join("\n") +
    `\n];\n`;

  writeFileSync(join(process.cwd(), OUT), body, "utf8");

  console.log(`Wrote ${OUT}`);
  console.log(`  source:        ${rankedPath} (${candidates.length} candidates)`);
  console.log(`  appended:      ${picked.length} long-tail entries (requested ${N})`);
  console.log(`  skipped dupes: ${skippedDup}`);
  console.log(`  skipped bad slug: ${skippedBadSlug}`);
  console.log(`  catalog total: ${curated.length} curated + ${picked.length} long-tail = ${curated.length + picked.length}`);
}

main();
