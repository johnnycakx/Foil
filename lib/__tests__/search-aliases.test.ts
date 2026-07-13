// P0-1 pins (quality-bar-fixes, 2026-07-13): the community-nickname alias
// layer + the marketing-query sweep. The failure this kills: the homepage
// TEACHES "moonbreon" and the live search answered "Foil doesn't recognize
// that one yet" — the flagship example was a dead end on a product whose
// promise is "Foil knows every printing."

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveAlias,
  normalizeAliasQuery,
  aliasKeys,
} from "../cards/search-aliases.ts";
import { getCatalogEntry, CARD_CATALOG } from "../cards/catalog.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const BAKED = JSON.parse(read("lib/cards/baked-metadata.json")) as {
  cards: Record<string, { name?: string }>;
};

test("THE acceptance test: moonbreon resolves to the exact printing the homepage teaches", () => {
  const ids = resolveAlias("moonbreon");
  assert.ok(ids, "moonbreon must resolve");
  assert.equal(ids![0], "swsh7-215", "first hit is Umbreon VMAX Alt Art, Evolving Skies");
  // And that printing is a real catalog + baked card (renders instantly).
  const entry = CARD_CATALOG.find((e) => e.pokemonTcgId === "swsh7-215");
  assert.ok(entry, "swsh7-215 is in the catalog");
  assert.ok(BAKED.cards["swsh7-215"]?.name, "swsh7-215 is baked (alias hits render with zero network)");
});

test("normalization: case, punctuation, and spacing never break a nickname", () => {
  assert.deepEqual(resolveAlias("MoonBreon"), resolveAlias("moonbreon"));
  assert.deepEqual(resolveAlias("  moonbreon!! "), resolveAlias("moonbreon"));
  assert.equal(normalizeAliasQuery("Moon-Breon's"), "moon breon s");
});

test("trailing qualifiers keep resolving; bare species names never hijack", () => {
  assert.ok(resolveAlias("moonbreon price"), "'moonbreon price' still resolves");
  assert.ok(resolveAlias("zard psa 10"), "'zard psa 10' still resolves");
  assert.equal(resolveAlias("umbreon"), null, "'umbreon' alone is a normal name search, not one printing");
  assert.equal(resolveAlias("charizard"), null, "'charizard' alone is a normal name search");
  assert.equal(resolveAlias("zardiness"), null, "prefix match only at a word boundary");
});

test("every alias id is a real baked card (a typo'd id would be a NEW dead end)", () => {
  for (const key of aliasKeys()) {
    const ids = resolveAlias(key);
    assert.ok(ids && ids.length > 0, `alias '${key}' resolves`);
    for (const id of ids!) {
      assert.ok(BAKED.cards[id]?.name, `alias '${key}' → ${id} must exist in the baked snapshot`);
    }
  }
});

test("marketing-query sweep: every query the homepage teaches resolves through the search path", () => {
  const home = read("app/(site)/page.tsx");
  // The step-01 artifact literally renders the query "moonbreon" and the body
  // copy teaches 'Moonbreon,' 'Base Set Charizard.' — extract, don't assume.
  assert.match(home, /moonbreon/, "the homepage still teaches the moonbreon query");
  const taught: string[] = ["moonbreon"];
  if (/Base Set Charizard/i.test(home)) taught.push("base set charizard");
  for (const q of taught) {
    const ids = resolveAlias(q);
    assert.ok(ids && ids.length > 0, `taught query '${q}' must resolve via the alias layer`);
    for (const id of ids!) {
      assert.ok(BAKED.cards[id]?.name, `taught query '${q}' → ${id} must be baked`);
    }
  }
});

test("the search route checks aliases BEFORE the upstream name search", () => {
  const src = read("app/api/cards/search/route.ts");
  const aliasIdx = src.indexOf("resolveAlias(");
  const searchIdx = src.indexOf("searchCards({");
  assert.ok(aliasIdx > -1, "route resolves aliases");
  assert.ok(searchIdx > -1, "route keeps the name search");
  assert.ok(aliasIdx < searchIdx, "alias check precedes the upstream search");
  assert.match(src, /getCardMetadata/, "alias hits render from metadata (baked-first)");
});

test("moonbreon's catalog slug round-trips (the /cards page behind the search hit)", () => {
  const entry = getCatalogEntry("swsh7-215-umbreon-vmax-alt-art");
  assert.ok(entry, "the slug exists");
  assert.equal(entry!.pokemonTcgId, "swsh7-215");
});
