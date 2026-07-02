// Add every English Umbreon + Espeon printing to the catalog (eve-line-tracker,
// ADR-095). The /lines/[pokemon] page renders every printing of a Pokémon, so
// the catalog must carry the full lineage. Additive only — no existing
// /cards/[slug] URL is dropped (the ADR-070 SEO-regression guard): entries
// already in the catalog are skipped; only the missing printings are written
// to a dedicated generated file (tier "longtail" — SDK price + variants, no
// bulk PokeTrace bake). Regenerate:
//   node --experimental-strip-types --no-warnings scripts/expand-eeveelutions.ts
//
// pokemontcg.io flaps under load; every fetch retries.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CARD_CATALOG } from "../lib/cards/catalog.ts";
import { slugifyName } from "../lib/poketrace/variant.ts";

const LINES = ["umbreon", "espeon"] as const;
const OUTPUT_PATH = "lib/cards/catalog-eeveelutions.generated.ts";
const SLUG_RE = /^[a-z0-9-]+$/;
const ID_RE = /^[a-z0-9]+(?:pt5|tg|c|p)?-[A-Za-z0-9]+$/i;

type SdkCard = { id: string; name: string; number: string; rarity?: string };

async function fetchLine(name: string): Promise<SdkCard[]> {
  const url = `https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(name)}&pageSize=250`;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20_000);
      const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`status ${r.status}`);
      const body = (await r.json()) as { data?: SdkCard[] };
      const data = Array.isArray(body.data) ? body.data : [];
      if (data.length > 0) return data;
      throw new Error("empty");
    } catch {
      await new Promise((res) => setTimeout(res, 2500));
    }
  }
  throw new Error(`failed to fetch ${name} after 6 attempts`);
}

function toEntry(card: SdkCard): { pokemonTcgId: string; slug: string } | null {
  if (!card.id.includes("-")) return null;
  const setId = card.id.slice(0, card.id.indexOf("-"));
  const numSlug = String(card.number ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const nameSlug = slugifyName(card.name);
  if (!numSlug || !nameSlug) return null;
  const slug = `${setId}-${numSlug}-${nameSlug}`;
  return SLUG_RE.test(slug) ? { pokemonTcgId: card.id, slug } : null;
}

async function main(): Promise<void> {
  const inCatalog = new Set(CARD_CATALOG.map((e) => e.pokemonTcgId));
  const catalogSlugs = new Set(CARD_CATALOG.map((e) => e.slug));
  const seenId = new Set<string>();
  const seenSlug = new Set<string>();
  const rows: { pokemonTcgId: string; slug: string }[] = [];
  let considered = 0;

  for (const name of LINES) {
    const cards = await fetchLine(name);
    // NAME must actually contain the eeveelution (the SDK name filter already
    // does this; belt-and-braces against attack-text matches).
    const rel = cards.filter((c) => new RegExp(name, "i").test(c.name));
    considered += rel.length;
    for (const c of rel) {
      if (inCatalog.has(c.id) || seenId.has(c.id)) continue;
      const entry = toEntry(c);
      if (!entry) continue;
      if (catalogSlugs.has(entry.slug) || seenSlug.has(entry.slug)) continue; // never shadow an existing URL
      seenId.add(c.id);
      seenSlug.add(entry.slug);
      rows.push(entry);
    }
    console.log(`  ${name}: ${rel.length} printings, ${rows.length} cumulative net-new`);
  }

  const header = `// GENERATED FILE — do not edit by hand.
// Written by scripts/expand-eeveelutions.ts (eve-line-tracker, ADR-095). Every
// English Umbreon + Espeon printing not already in the catalog — tier
// "longtail", spread into CARD_CATALOG in catalog.ts. Additive: no existing
// /cards/[slug] URL is dropped (ADR-070 guard). Regenerate:
//   node --experimental-strip-types --no-warnings scripts/expand-eeveelutions.ts
// Source: pokemontcg.io — ${rows.length} net-new entries of ${considered} printings considered.

import type { CatalogEntry } from "./catalog.ts";

export const EEVEELUTION_CATALOG: readonly CatalogEntry[] = [
${rows.map((r) => `  { pokemonTcgId: ${JSON.stringify(r.pokemonTcgId)}, slug: ${JSON.stringify(r.slug)}, tier: "longtail" },`).join("\n")}
];
`;
  writeFileSync(join(process.cwd(), OUTPUT_PATH), header, "utf8");
  console.log(`\nWrote ${OUTPUT_PATH} — ${rows.length} net-new eeveelution cards.`);
}

main().catch((err) => {
  console.error("expand-eeveelutions failed:", err);
  process.exit(1);
});
