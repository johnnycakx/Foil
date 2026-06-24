// Verifies the backlog parser extracts pillar topology + cluster candidates
// from the canonical seo-strategy.md format. Tests pin behavior of the
// pickNextCandidate ranker and the slugify edge cases (Pokémon accent, em-dash,
// long titles).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseStrategyDoc,
  pickNextCandidate,
  slugify,
} from "../seo/keyword-backlog.ts";

const STRATEGY_DOC = fs.readFileSync(
  path.join(process.cwd(), "docs", "seo-strategy.md"),
  "utf8",
);

test("parseStrategyDoc finds every pillar in the live strategy doc", () => {
  const candidates = parseStrategyDoc(STRATEGY_DOC);
  const pillarUrls = new Set(candidates.map((c) => c.pillar.url));
  assert.ok(pillarUrls.has("/japanese-pokemon-cards-value"));
  assert.ok(pillarUrls.has("/pokemon-card-value-calculator"));
  assert.ok(pillarUrls.has("/pokemon-card-condition-guide"));
});

test("parseStrategyDoc captures cluster bullets with title + long-tail keywords", () => {
  const candidates = parseStrategyDoc(STRATEGY_DOC);
  // Every pillar in the live doc has >=6 cluster posts per the cluster guideline
  for (const pillarUrl of [
    "/japanese-pokemon-cards-value",
    "/pokemon-card-value-calculator",
    "/pokemon-card-condition-guide",
  ]) {
    const forPillar = candidates.filter((c) => c.pillar.url === pillarUrl);
    assert.ok(
      forPillar.length >= 6,
      `expected ≥6 candidates for ${pillarUrl}, got ${forPillar.length}`,
    );
  }
  // Every candidate should have a non-empty title + slug
  for (const c of candidates) {
    assert.ok(c.title.length > 0, "title empty");
    assert.ok(c.slug.length > 0, "slug empty");
  }
});

test("parseStrategyDoc extracts long-tail keywords from each bullet", () => {
  const candidates = parseStrategyDoc(STRATEGY_DOC);
  // The first bullet under Pillar 1 includes "Long-tail: how to read japanese..."
  const psaBullet = candidates.find((c) =>
    c.title.toLowerCase().includes("how to read"),
  );
  assert.ok(psaBullet, "expected 'How to read a Japanese Pokémon card' bullet");
  assert.ok(psaBullet!.longTail.length > 0);
});

test("pickNextCandidate respects shippedSlugs and prefers lowest rank", () => {
  const candidates = parseStrategyDoc(STRATEGY_DOC);
  const shipped = new Set<string>(); // nothing shipped yet
  const next = pickNextCandidate(candidates, shipped);
  assert.ok(next);
  assert.equal(next!.rank, 1); // always the rank-1 of some pillar
});

test("pickNextCandidate skips slugs already in shippedSlugs", () => {
  const candidates = parseStrategyDoc(STRATEGY_DOC);
  // Mark all rank-1 candidates as shipped
  const shipped = new Set(
    candidates.filter((c) => c.rank === 1).map((c) => c.slug),
  );
  const next = pickNextCandidate(candidates, shipped);
  assert.ok(next);
  assert.notEqual(next!.rank, 1);
  assert.equal(shipped.has(next!.slug), false);
});

test("pickNextCandidate returns null when every candidate is shipped", () => {
  const candidates = parseStrategyDoc(STRATEGY_DOC);
  const shipped = new Set(candidates.map((c) => c.slug));
  assert.equal(pickNextCandidate(candidates, shipped), null);
});

test("slugify handles Pokémon accent, em-dash, and length cap", () => {
  assert.equal(
    slugify("Are Japanese Pokémon booster boxes a good investment?"),
    "are-japanese-pokemon-booster-boxes-a-good-investment",
  );
  assert.equal(
    slugify("PSA 9 vs PSA 10 — is the $200 grading jump worth it?"),
    "psa-9-vs-psa-10-is-the-200-grading-jump-worth-it",
  );
  // Cap at 80 chars — a ridiculously long title shouldn't blow out
  const long = slugify(
    "How to price a Pokémon card with no set symbol promo jumbo prerelease energy and other oddities",
  );
  assert.ok(long.length <= 80);
  assert.equal(long.startsWith("how-to-price-a-pokemon-card"), true);
  assert.equal(long.endsWith("-"), false); // never end with a hanging dash
});
