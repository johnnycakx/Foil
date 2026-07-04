// Hero chase belt guards (hero-chase-belt, ADR-102).
//
// Three layers: DATA-level invariants on the committed pool artifact (I-010
// discipline — a regressed regeneration fails before commit), STRUCTURAL pins
// on the belt component's motion/a11y/perf contract, and the request widget's
// copy + intent-link contract (voice rules: "chasing", no em dashes).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CARD_CATALOG } from "../cards/catalog.ts";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

type PoolEntry = { slug: string; name: string; setName: string; img: string; usd: number };
const pool = (JSON.parse(read("lib/hero-belt/pool.generated.json")) as { cards: PoolEntry[] }).cards;

const baseName = (n: string) => (n.split(/[\s(]/)[0] ?? n).toLowerCase();

test("belt pool: ~200 unique catalog-backed chase cards, every face self-hosted", () => {
  assert.ok(pool.length >= 150 && pool.length <= 220, `pool size ${pool.length} out of range`);
  const slugs = new Set(pool.map((c) => c.slug));
  assert.equal(slugs.size, pool.length, "no duplicate slugs");
  const catalog = new Set(CARD_CATALOG.map((e) => e.slug));
  for (const c of pool) {
    assert.ok(catalog.has(c.slug), `${c.slug}: not in CARD_CATALOG (would link an empty room)`);
    assert.match(c.img, /^\/belt\/.+\.webp$/, `${c.slug}: face must be self-hosted under /belt/`);
    assert.ok(existsSync(join(ROOT, "public", c.img)), `${c.slug}: missing face file ${c.img}`);
    assert.ok(c.usd >= 15, `${c.slug}: below the chase-card value floor`);
  }
});

test("belt pool: adjacency — the wheel never runs same-Pokemon neighbors (wrap included)", () => {
  for (let i = 0; i < pool.length; i++) {
    const a = pool[i];
    const b = pool[(i + 1) % pool.length];
    assert.notEqual(baseName(a.name), baseName(b.name), `adjacent same Pokemon at ${i}: ${a.name} | ${b.name}`);
  }
});

test("belt component: motion contract — linear drift, decelerating pause, offscreen/hidden gating, reduced-motion checked", () => {
  const src = read("components/hero-belt.tsx");
  assert.match(src, /^"use client"/m);
  // Gallery walk speed in the goal's 40-60px/s band; drift itself is linear
  // (constant motion), pause/resume is a tweened deceleration (emil).
  const speed = Number(src.match(/DRIFT_PX_S = (\d+)/)?.[1]);
  assert.ok(speed >= 40 && speed <= 60, `drift ${speed}px/s outside the gallery-walk band`);
  assert.match(src, /ease: "power2\.out"/, "pause/resume decelerates, never hard-stops");
  assert.doesNotMatch(src, /ease-in[^-]/, "no ease-in anywhere in the motion path");
  assert.match(src, /IntersectionObserver/, "offscreen belts must not burn frames");
  assert.match(src, /visibilitychange/, "hidden tabs pause the belt");
  assert.match(src, /prefers-reduced-motion/, "the belt itself re-checks reduced motion");
  // Virtualization budget: fixed node count, <= 30.
  const nodes = Number(src.match(/NODE_COUNT = (\d+)/)?.[1]);
  assert.ok(nodes > 0 && nodes <= 30, `NODE_COUNT ${nodes} exceeds the 30-node DOM budget`);
  // Uniform card box (the loop math depends on it) + zero-CLS image sizing.
  assert.match(src, /aspect-\[5\/7\]/);
  assert.match(src, /width=\{480\}/);
  assert.match(src, /height=\{672\}/);
  // LCP (homepage-mobile-perf): only the ~visible window (3) loads eager, the
  // rest lazy — never a 200-image waterfall, and never the old 8-eager mobile
  // LCP killer. Only node 0 (the LCP element) is fetchpriority high.
  assert.match(src, /loading=\{i < 3 \? "eager" : "lazy"\}/);
  assert.match(src, /fetchPriority=\{i === 0 \? "high" : "auto"\}/);
  // Responsive srcset: a 300px variant for low-DPR phones, 480 for DPR2.
  assert.match(src, /srcSet=/);
  assert.match(src, /-sm\.webp"\)\} 300w, \$\{card\.img\} 480w/);
  // Every face is a real crawlable market-page link with the a11y contract.
  assert.match(src, /href=\{`\/cards\/\$\{card\.slug\}`\}/);
  assert.match(src, /sold prices and live listings/);
  // Self-hosted faces only.
  assert.doesNotMatch(src, /images\.pokemontcg\.io/);
});

test("hero: belt is motion-safe, the composed fan survives as the reduced-motion fallback", () => {
  const src = read("app/(site)/page.tsx");
  assert.match(src, /hidden max-w-\[110rem\] pt-10 sm:pt-14 motion-safe:block/, "belt renders only under motion-safe");
  assert.match(src, /beltPool\.length > 0 \? "motion-safe:hidden" : ""/, "fan hides under motion-safe when the pool exists");
  assert.match(src, /getHeroBeltPool\(\)/, "pool comes from the reader (honest empty fallback)");
});

test("request widget: the site-to-X intake loop — copy, intent link, voice", () => {
  const src = read("app/(site)/page.tsx");
  const block = src.slice(src.indexOf("function RequestCard"), src.indexOf("function NewsletterBand"));
  assert.ok(block.length > 0, "RequestCard must exist");
  assert.match(block, /Chasing a card we don(&apos;|')t have data on yet\?/);
  assert.match(block, /front of\s+the queue/, "the queue promise is verbatim (it binds the human contract)");
  assert.match(src, /https:\/\/x\.com\/intent\/post\?text=/, "one-tap prefilled composer");
  assert.match(block, /x\.com\/FoilTCG/, "the plain handle link for manual mentions");
  // The ban is on RENDERED copy — strip code comments first.
  const copyOnly = block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
  assert.doesNotMatch(copyOnly, /—/, "no em dashes in the widget copy");
  assert.doesNotMatch(copyOnly, /hunt/i, "voice: chasing, never hunting");
});

test("belt shine: original implementation, hover-gated to real pointers", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.belt-shine \{/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  const shineIdx = css.indexOf(".belt-shine");
  assert.match(css.slice(shineIdx - 400, shineIdx), /no code from simeydotme/, "GPL provenance note stays");
});
