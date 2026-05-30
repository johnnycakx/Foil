// Rank long-tail catalog candidates (Session 47.4 / ADR-046).
//
// PIVOT from the original goal spec (documented in ADR-046): the spec ranked
// by PokeTrace `totalSaleCount × topPrice`, but PokeTrace's list endpoint
// exposes neither field nor a working sale-sort — scoring that way needs a
// per-card detail fetch across the whole ~20k-card catalog (hours). Instead we
// rank by the Pokemon TCG SDK's INLINE TCGplayer market price, scoped to the
// sets already in CARD_CATALOG (commercially proven). One cheap SDK query per
// set. Every ranked card therefore has a TCGplayer price by construction, so
// its /cards/[slug] page renders real pricing (AggregateOffer + variants) even
// before PokeTrace sold-history is baked — no thin pages.
//
// Output: docs/candidate-cards-ranked-YYYY-MM-DD.json, an array of
// { pokemonTcgId, slug, name, setId, number, rarity, score } sorted by score
// desc, excluding cards already in CARD_CATALOG.
//
// Usage: npx tsx scripts/rank-candidate-cards.ts [--sets a,b,c] [--top 2000]

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CARD_CATALOG, setIdsInCatalog } from "../lib/cards/catalog.ts";
import { slugifyName } from "../lib/poketrace/variant.ts";

const SDK_BASE = "https://api.pokemontcg.io/v2/cards";
const REQ_INTERVAL_MS = 250;
const PAGE_SIZE = 250;

const argv = process.argv.slice(2);
function arg(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const TOP = Number(arg("top") ?? 2000);
const SETS = arg("sets")?.split(",").map((s) => s.trim()).filter(Boolean) ?? setIdsInCatalog();

type SdkCard = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  tcgplayer?: { prices?: Record<string, { market?: number | null; high?: number | null }> };
};

type Candidate = {
  pokemonTcgId: string;
  slug: string;
  name: string;
  setId: string;
  number: string;
  rarity: string;
  score: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Best (max) TCGplayer market/high across a card's variants. 0 when absent. */
function priceScore(card: SdkCard): number {
  let best = 0;
  for (const p of Object.values(card.tcgplayer?.prices ?? {})) {
    const v = (typeof p.market === "number" ? p.market : null) ?? (typeof p.high === "number" ? p.high : null);
    if (typeof v === "number" && v > best) best = v;
  }
  return best;
}

async function fetchSetCards(setId: string): Promise<SdkCard[]> {
  const out: SdkCard[] = [];
  for (let page = 1; ; page++) {
    const url =
      `${SDK_BASE}?q=${encodeURIComponent(`set.id:${setId}`)}` +
      `&pageSize=${PAGE_SIZE}&page=${page}&select=id,name,number,rarity,tcgplayer`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.warn(`  [${setId}] SDK ${res.status} on page ${page} — stopping this set`);
      break;
    }
    const json = (await res.json()) as { data?: SdkCard[]; totalCount?: number };
    const data = json.data ?? [];
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
    await sleep(REQ_INTERVAL_MS);
  }
  return out;
}

async function main(): Promise<void> {
  const existing = new Set(CARD_CATALOG.map((c) => c.pokemonTcgId));
  console.log(`Ranking candidates across ${SETS.length} catalog sets (excluding ${existing.size} curated cards)…`);

  const candidates: Candidate[] = [];
  let scanned = 0;
  for (const setId of SETS) {
    const cards = await fetchSetCards(setId);
    scanned += cards.length;
    for (const c of cards) {
      if (existing.has(c.id)) continue;
      const score = priceScore(c);
      if (score <= 0) continue; // no TCGplayer price → low commercial intent + would be thin
      const numSlug = String(c.number).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      candidates.push({
        pokemonTcgId: c.id,
        slug: `${setId}-${numSlug}-${slugifyName(c.name)}`,
        name: c.name,
        setId,
        number: c.number,
        rarity: c.rarity ?? "",
        score: Math.round(score * 100) / 100,
      });
    }
    console.log(`  [${setId}] ${cards.length} cards → ${candidates.filter((x) => x.setId === setId).length} priced candidates`);
    await sleep(REQ_INTERVAL_MS);
  }

  candidates.sort((a, b) => b.score - a.score);
  const ranked = candidates.slice(0, TOP);

  const date = new Date().toISOString().slice(0, 10);
  const outPath = join("docs", `candidate-cards-ranked-${date}.json`);
  writeFileSync(join(process.cwd(), outPath), JSON.stringify(ranked, null, 2), "utf8");

  console.log("");
  console.log(`Wrote ${outPath}`);
  console.log(`  sets scanned:     ${SETS.length}`);
  console.log(`  cards considered: ${scanned}`);
  console.log(`  priced candidates: ${candidates.length} (kept top ${ranked.length})`);
  console.log(`  score range:      $${ranked[ranked.length - 1]?.score ?? 0} … $${ranked[0]?.score ?? 0}`);
}

main().catch((err) => {
  console.error("rank-candidate-cards failed:", err);
  process.exit(1);
});
