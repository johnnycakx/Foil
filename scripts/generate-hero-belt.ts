// Hero-belt pool generator (hero-chase-belt, ADR-102). Selects the top ~200
// chase cards from the baked snapshot, arranges them so the wheel reads like
// the whole hobby drifting past (no same-Pokemon / same-set runs), and
// self-hosts every face under public/belt/ (ADR-056: the hero never depends
// on the flaky pokemontcg.io CDN at runtime).
//
// Ranking is MARKET VALUE from the bake (max variant market across
// tcgplayerPrices), config-driven below. Watch-count ranking (the goal's
// first-choice signal) is NOT bake-available — watchlists live in the DB —
// so the selector takes an optional watch-count map for the day a committed
// watch-count artifact exists (premise adjustment recorded in ADR-102).
//
// Usage: node --experimental-strip-types scripts/generate-hero-belt.ts
// Idempotent; re-run after each bake to refresh the pool (self-updating hero).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { CARD_CATALOG } from "../lib/cards/catalog.ts";

const ROOT = process.cwd();
const OUT_IMG_DIR = join(ROOT, "public", "belt");
const OUT_POOL = join(ROOT, "lib", "hero-belt", "pool.generated.json");

// --- Config (the tunable selector) -----------------------------------------
const POOL_TARGET = 200;
const CANDIDATE_OVERSAMPLE = 240; // extra headroom for download failures
const MIN_MARKET_USD = 15; // below this it's not a chase card
const IMG_WIDTH = 480; // uniform box; art fills it (5/7 aspect) — DPR2 of the 232px card
const IMG_WIDTH_SM = 300; // small srcset variant for low-DPR phones (homepage-mobile-perf)
const IMG_QUALITY = 80; // base stays crisp; the sm downscale hides its re-encode
const IMG_QUALITY_SM = 76;

type BakedCard = {
  id: string;
  name: string;
  setName: string;
  setId: string;
  image: string;
  rarity?: string;
  tcgplayerPrices?: Record<string, { market?: number | null } | null> | null;
};

type PoolEntry = {
  slug: string;
  name: string;
  setName: string;
  img: string;
  /** rank-driving market value in USD (kept for audits/tests) */
  usd: number;
};

function maxMarket(c: BakedCard): number {
  const prices = c.tcgplayerPrices ?? {};
  let max = 0;
  for (const v of Object.values(prices)) {
    if (v?.market && v.market > max) max = v.market;
  }
  return max;
}

/** Base Pokemon name for adjacency purposes: "Umbreon VMAX" -> "umbreon". */
function baseName(name: string): string {
  return (name.split(/[\s(]/)[0] ?? name).toLowerCase();
}

/** Arrange so no two adjacent entries (including the wrap-around pair) share
 *  a base Pokemon name or a set. Greedy: walk the value-ranked list, place
 *  each card at the first tail position that doesn't violate adjacency; if
 *  none fits (rare), append anyway and let the next pass smooth it. */
function adjacencyArrange(cards: (PoolEntry & { setId: string })[]): (PoolEntry & { setId: string })[] {
  const out: (PoolEntry & { setId: string })[] = [];
  const pending = [...cards];
  while (pending.length) {
    const tail = out[out.length - 1];
    const idx = pending.findIndex(
      (c) => !tail || (baseName(c.name) !== baseName(tail.name) && c.setId !== tail.setId),
    );
    out.push(...pending.splice(idx === -1 ? 0 : idx, 1));
  }
  // Fix the wrap-around seam by rotating if first/last collide.
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && (baseName(first.name) === baseName(last.name) || first.setId === last.setId)) {
    const cut = out.findIndex(
      (c, i) =>
        i > 0 &&
        baseName(c.name) !== baseName(last.name) &&
        c.setId !== last.setId &&
        baseName(out[i - 1].name) !== baseName(first.name) &&
        out[i - 1].setId !== first.setId,
    );
    if (cut > 0) out.push(...out.splice(0, cut));
  }
  return out;
}

async function fetchImage(url: string, attempt = 1): Promise<Buffer> {
  // Host allowlist: the bake's image URLs must be the official CDN — a
  // poisoned bake entry can't turn this script into an arbitrary fetcher.
  if (new URL(url).hostname !== "images.pokemontcg.io") {
    throw new Error(`refusing non-CDN image host: ${url}`);
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    if (attempt < 3 && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
      return fetchImage(url, attempt + 1);
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const baked = JSON.parse(readFileSync(join(ROOT, "lib", "cards", "baked-metadata.json"), "utf8")) as {
    cards?: Record<string, BakedCard>;
  } & Record<string, BakedCard>;
  const all: BakedCard[] = Object.values(baked.cards ?? baked);
  const bySlugId = new Map(CARD_CATALOG.map((e) => [e.pokemonTcgId, e.slug]));

  const candidates = all
    .map((c) => ({ card: c, slug: bySlugId.get(c.id), usd: maxMarket(c) }))
    .filter((x): x is { card: BakedCard; slug: string; usd: number } => Boolean(x.slug) && x.usd >= MIN_MARKET_USD && Boolean(x.card.image))
    .sort((a, b) => b.usd - a.usd)
    .slice(0, CANDIDATE_OVERSAMPLE);

  console.log(`candidates: ${candidates.length} (>= $${MIN_MARKET_USD}, value-ranked)`);
  mkdirSync(OUT_IMG_DIR, { recursive: true });
  mkdirSync(join(ROOT, "lib", "hero-belt"), { recursive: true });

  const got: (PoolEntry & { setId: string })[] = [];
  for (const { card, slug, usd } of candidates) {
    if (got.length >= POOL_TARGET) break;
    const file = join(OUT_IMG_DIR, `${slug}.webp`);
    const fileSm = join(OUT_IMG_DIR, `${slug}-sm.webp`);
    try {
      if (!existsSync(file)) {
        // The bake stores the full _hires.png URL; fall back to the standard
        // res if hires 404s (a handful of vintage scans only ship standard).
        const buf = await fetchImage(card.image).catch(() =>
          fetchImage(card.image.replace("_hires", "")),
        );
        // Base (crisp) + small srcset variant for low-DPR phones.
        await sharp(buf).resize({ width: IMG_WIDTH }).webp({ quality: IMG_QUALITY }).toFile(file);
        await sharp(buf).resize({ width: IMG_WIDTH_SM }).webp({ quality: IMG_QUALITY_SM }).toFile(fileSm);
        await new Promise((r) => setTimeout(r, 120)); // pace the CDN
      } else if (!existsSync(fileSm)) {
        // Base already downloaded — backfill just the small variant (no re-fetch).
        await sharp(readFileSync(file)).resize({ width: IMG_WIDTH_SM }).webp({ quality: IMG_QUALITY_SM }).toFile(fileSm);
      }
      got.push({ slug, name: card.name, setName: card.setName, setId: card.setId, img: `/belt/${slug}.webp`, usd: Math.round(usd) });
    } catch (err) {
      console.warn(`skip ${slug}: ${(err as Error).message}`);
    }
  }

  const arranged = adjacencyArrange(got).map(({ setId: _setId, ...entry }) => entry);
  writeFileSync(OUT_POOL, `${JSON.stringify({ generatedFrom: "baked-metadata.json", count: arranged.length, cards: arranged }, null, 1)}\n`);
  console.log(`pool: ${arranged.length} cards -> ${OUT_POOL}`);
}

await main();
