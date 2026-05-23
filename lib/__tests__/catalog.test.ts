// Catalog invariants. The 200 entries are hand-curated; tests pin the
// structural properties the page route + sitemap rely on:
//   1. Every slug is unique (no duplicate routes).
//   2. Every slug matches the documented format <set-id>-<number>-<kebab-name>.
//   3. Every pokemonTcgId is non-empty (slug → metadata lookup can't break).
//   4. The catalog has exactly 200 entries (changes are deliberate).
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

test("catalog has exactly 200 entries", () => {
  assert.equal(CARD_CATALOG.length, 200);
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

test("setIdsInCatalog returns 18 distinct ids in catalog source order (Base first, modern last)", () => {
  const ids = setIdsInCatalog();
  assert.equal(ids.length, 18);
  // First and last positions are deterministic per the curated CARD_CATALOG
  // ordering: vintage WotC opens; Scarlet & Violet 151 closes.
  assert.equal(ids[0], "base1");
  assert.equal(ids[ids.length - 1], "sv3pt5");
  // No duplicates.
  assert.equal(new Set(ids).size, ids.length);
});

test("entriesForSet returns same-set entries ordered by collector number", () => {
  const base1 = entriesForSet("base1");
  assert.equal(base1.length, 16);
  const numbers = base1.map((e) => parseInt(e.pokemonTcgId.split("-")[1], 10));
  // Strictly ascending.
  for (let i = 1; i < numbers.length; i++) {
    assert.ok(numbers[i] > numbers[i - 1], `not sorted at index ${i}: ${numbers.join(",")}`);
  }
});

test("entriesForSet returns [] for a set not represented in the catalog", () => {
  assert.deepEqual(entriesForSet("not-a-real-set"), []);
});
