// Catalog invariants. The catalog is 207 hand-curated cards + a generated
// long-tail expansion (ADR-046). Tests pin the structural properties the page
// route + sitemap rely on:
//   1. Every slug is unique (no duplicate routes).
//   2. Every slug matches the documented format <set-id>-<number>-<kebab-name>.
//   3. Every pokemonTcgId is non-empty (slug → metadata lookup can't break).
//   4. Exactly 207 CURATED entries (tier undefined or "curated" — NOT
//      "longtail" or "metadata-only", the two scaled tiers per ADR-046/047);
//      the long-tail count is generated (Session 47.4) so we floor it, not pin.
//   5. getCatalogEntry(slug) round-trips.

import test from "node:test";
import assert from "node:assert/strict";
import {
  CARD_CATALOG,
  entriesForSet,
  getCatalogEntry,
  relatedCardsForSlug,
  setIdsInCatalog,
} from "../cards/catalog.ts";
import { TOP5_PER_SET_CATALOG } from "../cards/catalog-top5-per-set.generated.ts";

test("catalog has exactly 207 curated entries", () => {
  const curated = CARD_CATALOG.filter((e) => e.tier === undefined || e.tier === "curated");
  assert.equal(curated.length, 207);
});

test("long-tail entries (ADR-046) are tagged tier='longtail'", () => {
  const longtail = CARD_CATALOG.filter((e) => e.tier === "longtail");
  // The generated wave adds ~800; floor (not pin) since it's regenerated.
  assert.ok(longtail.length === 0 || longtail.length >= 100, `unexpected longtail count: ${longtail.length}`);
  for (const e of longtail) assert.equal(e.tier, "longtail");
});

test("top-5-per-set breadth expansion contributes ≤5 cards per set", () => {
  // The breadth-expansion invariant (top5-per-set goal, extends ADR-046): each
  // English set contributes at most its 5 most-valuable cards to THIS wave. A
  // set may still show >5 in CARD_CATALOG overall (the curated block + wave-1
  // long-tail add DEPTH to the 29 original sets) — this pins the WAVE, which is
  // the generated file we regenerate, in isolation.
  const bySet = new Map<string, number>();
  for (const e of TOP5_PER_SET_CATALOG) {
    const setId = e.pokemonTcgId.split("-")[0];
    bySet.set(setId, (bySet.get(setId) ?? 0) + 1);
  }
  for (const [setId, n] of bySet) {
    assert.ok(n <= 5, `set ${setId} contributes ${n} cards to the top-5-per-set wave (>5)`);
  }
});

test("top-5-per-set entries carry no fabricated fields (valid id + slug, tier longtail)", () => {
  // null-over-guess: every wave entry is a real SDK-shaped id + a
  // route-valid slug, tagged tier "longtail" (SDK price renders; PokeTrace lazy).
  const idRe = /^[a-z0-9]+(?:pt[0-9]+)?-[a-zA-Z0-9]+$/;
  const slugRe = /^[a-z0-9]+(?:pt[0-9]+)?-[a-z0-9]+-[a-z0-9-]+$/;
  for (const e of TOP5_PER_SET_CATALOG) {
    assert.match(e.pokemonTcgId, idRe, `bad id in top5 wave: ${e.pokemonTcgId}`);
    assert.match(e.slug, slugRe, `bad slug in top5 wave: ${e.slug}`);
    assert.equal(e.tier, "longtail", `top5 wave entry not tier longtail: ${e.slug}`);
    // The slug's set prefix must match the id's set prefix (no cross-set slug).
    assert.equal(
      e.slug.split("-")[0],
      e.pokemonTcgId.split("-")[0],
      `slug/id set mismatch: ${e.slug} vs ${e.pokemonTcgId}`,
    );
  }
});

test("every slug in the catalog is unique", () => {
  const seen = new Set<string>();
  for (const entry of CARD_CATALOG) {
    assert.ok(!seen.has(entry.slug), `duplicate slug: ${entry.slug}`);
    seen.add(entry.slug);
  }
});

test("every slug matches <set-id>-<number>-<kebab-name> format", () => {
  // set-id: lowercase alphanumeric (e.g. "base1", "sv3pt5", "swsh12pt5")
  // number: alphanumeric (mostly digits, sometimes "SWSH012" etc.)
  // kebab-name: lowercase hyphenated, may contain letters and digits
  const slugRegex = /^[a-z0-9]+(?:pt[0-9]+)?-[a-z0-9]+-[a-z0-9-]+$/;
  for (const entry of CARD_CATALOG) {
    assert.match(entry.slug, slugRegex, `bad slug shape: ${entry.slug}`);
  }
});

test("every catalog entry has a non-empty pokemonTcgId", () => {
  for (const entry of CARD_CATALOG) {
    assert.ok(entry.pokemonTcgId && entry.pokemonTcgId.length > 0, `empty id at slug ${entry.slug}`);
    // pokemonTcgId format: <set-id>-<number>
    assert.match(entry.pokemonTcgId, /^[a-z0-9]+(?:pt[0-9]+)?-[a-zA-Z0-9]+$/, `bad id shape: ${entry.pokemonTcgId}`);
  }
});

test("getCatalogEntry round-trips by slug", () => {
  for (const entry of CARD_CATALOG.slice(0, 10)) {
    const hit = getCatalogEntry(entry.slug);
    assert.ok(hit, `lookup missed slug ${entry.slug}`);
    assert.equal(hit!.pokemonTcgId, entry.pokemonTcgId);
  }
  assert.equal(getCatalogEntry("not-a-real-slug"), undefined);
});

test("relatedCardsForSlug returns same-set entries sorted by collector-number proximity", () => {
  // base1-4 charizard → expect base1 siblings nearest #4 first.
  const related = relatedCardsForSlug("base1-4-charizard", 6);
  assert.equal(related.length, 6);
  // Every returned entry is from the same set ("base1").
  for (const r of related) {
    assert.match(r.pokemonTcgId, /^base1-/, `wrong-set related: ${r.pokemonTcgId}`);
  }
  // Nearest collector numbers to 4 in the base1 catalog are 3, 5, 2, 6, 1, 7.
  // Order should put closer numbers first.
  const numbers = related.map((r) => parseInt(r.pokemonTcgId.split("-")[1], 10));
  // First two should be the immediate neighbors (3 and 5, in some order).
  assert.ok(
    (numbers[0] === 3 && numbers[1] === 5) || (numbers[0] === 5 && numbers[1] === 3),
    `expected base1-3 and base1-5 first, got ${numbers.join(", ")}`,
  );
});

test("relatedCardsForSlug returns [] for an unknown slug — defensive", () => {
  assert.deepEqual(relatedCardsForSlug("not-real-slug"), []);
});

test("setIdsInCatalog spans every English set after the top-5-per-set breadth expansion (ADR-088)", () => {
  const ids = setIdsInCatalog();
  // Breadth expansion (ADR-088): the catalog went 29 → ~159 distinct sets when
  // every English set's top-5-by-value cards were added. Floored (not pinned) —
  // the set count is generated and grows as new sets release + get TCGplayer
  // prices. Pre-expansion the catalog covered 29 sets; the floor guards the
  // breadth win without pinning a regenerated count.
  assert.ok(ids.length >= 150, `expected ≥150 distinct sets after breadth expansion, got ${ids.length}`);
  // The curated block is unchanged and still leads: vintage WotC opens (base1);
  // the Session 43 grail-seed block closes the curated sets with swsh35 at index 22.
  assert.equal(ids[0], "base1");
  assert.equal(ids[22], "swsh35");
  // The 6 modern mover sets (ADR-070) are still present.
  for (const m of ["sv8pt5", "sv8", "me1", "sv9", "sv10", "sv7"]) {
    assert.ok(ids.includes(m), `missing modern set ${m}`);
  }
  // Spot-check a few sets that were MISSING before the breadth expansion now
  // resolve (previously-absent eras: e-Card, EX, Diamond & Pearl, XY, Sun & Moon).
  for (const s of ["ecard1", "ex1", "dp1", "xy1", "sm1"]) {
    assert.ok(ids.includes(s), `breadth expansion missing previously-absent set ${s}`);
  }
  // No duplicates.
  assert.equal(new Set(ids).size, ids.length);
});

test("entriesForSet returns same-set entries ordered by collector number", () => {
  const base1 = entriesForSet("base1");
  // ≥16: the 16 curated Base Set holos plus any long-tail base1 cards the
  // ADR-046 expansion added (the count is generated, so floor not pin).
  assert.ok(base1.length >= 16, `expected ≥16 base1 entries, got ${base1.length}`);
  const numbers = base1.map((e) => parseInt(e.pokemonTcgId.split("-")[1], 10));
  // Strictly ascending (Base Set collector numbers are distinct).
  for (let i = 1; i < numbers.length; i++) {
    assert.ok(numbers[i] > numbers[i - 1], `not sorted at index ${i}: ${numbers.join(",")}`);
  }
});

test("entriesForSet returns [] for a set not represented in the catalog", () => {
  assert.deepEqual(entriesForSet("not-a-real-set"), []);
});
