// Catalog-QA invariants for the baked SDK snapshot (lib/cards/baked-metadata.json).
//
// WHY THIS EXISTS (2026-06-07): the verified-listing resolver calibration
// (docs/calibration-resolver-2026-06.md) flagged the 16 `base2-*` Base-era cards
// as "corrupted (Jungle metadata under Base-Set-2 ids)". The P0 premise check
// disproved that: in pokemontcg.io — the bake's own source — set id `base2` IS
// "Jungle" (and `base4` is "Base Set 2"). The baked metadata is faithful to the
// SDK; nothing was corrupt. The "+16 offset" the audit saw is the Jungle set's
// holo(#1-16)/non-holo(#17-32) structure (holo Clefable #1 vs non-holo #17), so
// the Number-gate rejects were CORRECT (a #17 listing is a different card from
// the #1 holo). See docs/calibration-resolver-2026-06.md "Correction addendum".
//
// These tests pin the catalog's structural health so a REAL future corruption
// (a card whose setName disagrees with its set, an id/setId desync, a Base-era
// id/name swap) fails the build — and so the base2=Jungle ground truth can never
// be silently "fixed" back into a wrong-print bug. Fully offline + deterministic:
// the baked `sets` map is the reference; no network.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

type BakedCard = { id: string; name: string; setName: string; setId: string; number: string };
type BakedSet = { id: string; name: string; total: number };
type Baked = { cards: Record<string, BakedCard>; sets: Record<string, BakedSet> };

const here = dirname(fileURLToPath(import.meta.url));
const baked = JSON.parse(readFileSync(join(here, "../cards/baked-metadata.json"), "utf8")) as Baked;
const cards = Object.values(baked.cards);
const sets = baked.sets;

test("baked snapshot is populated (cards + sets present)", () => {
  assert.ok(cards.length >= 1000, `expected ≥1000 baked cards, got ${cards.length}`);
  assert.ok(Object.keys(sets).length >= 100, `expected ≥100 baked sets, got ${Object.keys(sets).length}`);
});

test("every baked card's setId resolves to a baked set", () => {
  const orphans = cards.filter((c) => !sets[c.setId]).map((c) => `${c.id} (setId=${c.setId})`);
  assert.deepEqual(orphans, [], `cards with an unknown setId:\n  ${orphans.join("\n  ")}`);
});

test("every baked card's setName matches its set's name (setId↔setName consistency)", () => {
  // The core invariant. A card claiming setName "Jungle" must carry the setId
  // whose baked set name is "Jungle". This is what the calibration MISREAD as
  // corruption — pinned here as the CORRECT state so it can't regress either way.
  const mismatches = cards
    .filter((c) => sets[c.setId] && c.setName !== sets[c.setId].name)
    .map((c) => `${c.id}: card.setName="${c.setName}" but sets["${c.setId}"].name="${sets[c.setId].name}"`);
  assert.deepEqual(mismatches, [], `setId↔setName mismatches:\n  ${mismatches.join("\n  ")}`);
});

test("every baked card id is <setId>-<number> (id/setId/number consistency)", () => {
  const bad = cards
    .filter((c) => c.id !== `${c.setId}-${c.number}`)
    .map((c) => `${c.id}: setId="${c.setId}" number="${c.number}" → expected id "${c.setId}-${c.number}"`);
  assert.deepEqual(bad, [], `id/setId/number desync:\n  ${bad.join("\n  ")}`);
});

test("cards sharing a setId share one setName (no corrupt sibling)", () => {
  const bySet = new Map<string, Set<string>>();
  for (const c of cards) {
    if (!bySet.has(c.setId)) bySet.set(c.setId, new Set());
    bySet.get(c.setId)!.add(c.setName);
  }
  const split = [...bySet.entries()]
    .filter(([, names]) => names.size > 1)
    .map(([setId, names]) => `${setId}: ${[...names].map((n) => `"${n}"`).join(", ")}`);
  assert.deepEqual(split, [], `setIds with inconsistent setNames across cards:\n  ${split.join("\n  ")}`);
});

test("WOTC Base-era set ids map to the pokemontcg.io ground truth (calibration misread guard)", () => {
  // pokemontcg.io canonical WOTC mapping (verified live 2026-06-07 against
  // api.pokemontcg.io/v2/sets/*). `base2` is Jungle, NOT Base Set 2 (`base4`).
  // Pinning this stops any "reconcile base2 → Base Set 2" change from
  // reintroducing the wrong-print bug the resolver Number gate exists to prevent.
  assert.equal(sets["base1"]?.name, "Base");
  assert.equal(sets["base2"]?.name, "Jungle");
  assert.equal(sets["base3"]?.name, "Fossil");
  assert.equal(sets["base4"]?.name, "Base Set 2");
  assert.equal(sets["base5"]?.name, "Team Rocket");
});

test("base2-1 is Jungle Clefable #1 (the explicit calibration case)", () => {
  // The card the calibration named as "corrupted". It is CORRECT: Jungle #1 holo
  // Clefable. The cheapest eBay listings for it are the non-holo #17 (a DIFFERENT
  // card), which the resolver's Number gate correctly rejects — verified live
  // 2026-06-07 (the #17 listing verifies on base2-17-clefable, rejects here).
  const c = baked.cards["base2-1"];
  assert.ok(c, "base2-1 must exist in the baked snapshot");
  assert.equal(c.name, "Clefable");
  assert.equal(c.setName, "Jungle");
  assert.equal(c.setId, "base2");
  assert.equal(c.number, "1");
});
