// Variant + condition eBay query augmentation + the 5th picker gate
// (Session 49b / ADR-043).
//
// buildEbayQuery merges variant.ts + conditions.ts keyword maps into the
// Browse `q` string (include phrases appended) + the include/exclude sets the
// picker gate enforces post-fetch. pickBestListing(hits, {include, exclude})
// keeps a hit only when its title has ≥1 include AND no exclude. Each rejected
// listing below is cheaper than the intended winner, so a passing test proves
// the GATE (not the price sort) did the filtering.

import test from "node:test";
import assert from "node:assert/strict";
import { buildEbayQuery } from "../affiliate/ebay-browse.ts";
import { pickBestListing } from "../affiliate/listing-picker.ts";
import type { EpnProductHit } from "../affiliate/epn.ts";

function hit(title: string, price: number): EpnProductHit {
  return { title, itemUrl: `https://ebay.com/itm/${price}`, image: null, price, currency: "USD" };
}

/** Run buildEbayQuery + pickBestListing end to end and return the winner. */
function pick(
  args: { cardName: string; setName?: string; variant?: string; condition?: string },
  hits: EpnProductHit[],
) {
  const { include, exclude } = buildEbayQuery(args);
  return pickBestListing(hits, { include, exclude });
}

test("buildEbayQuery: bare card query when no variant/condition (page-render path unchanged)", () => {
  const { query, include, exclude } = buildEbayQuery({ cardName: "Charizard", setName: "Base" });
  assert.equal(query, "Charizard Base");
  assert.deepEqual(include, []);
  assert.deepEqual(exclude, []);
});

test("buildEbayQuery: appends quoted include phrases; excludes stay out of the q string", () => {
  const { query, include, exclude } = buildEbayQuery({
    cardName: "Charizard",
    setName: "Base",
    variant: "1st-edition-holofoil",
    condition: "nm",
  });
  assert.match(query, /^Charizard Base /);
  assert.ok(query.includes('"1st Edition"'));
  assert.ok(query.includes('"Holo"'));
  assert.ok(include.includes("1st Edition") && include.includes("Holo") && include.includes("Near Mint"));
  // Graded exclusions are enforced by the gate, NOT injected into q.
  assert.ok(exclude.includes("PSA"));
  assert.ok(!query.includes("PSA"));
});

// --- The 6 scenarios -------------------------------------------------------

test("scenario 1 — 1st Ed Holo NM: keeps the 1st-edition holo, drops the graded slab", () => {
  const winner = pick(
    { cardName: "Charizard", setName: "Base", variant: "1st-edition-holofoil", condition: "nm" },
    [
      hit("Charizard 1st Edition Base Set Holo NM", 800),
      hit("Charizard Base Set Holo PSA 10", 500), // graded → excluded
    ],
  );
  assert.equal(winner?.title, "Charizard 1st Edition Base Set Holo NM");
});

test("scenario 2 — Unlimited Holo any-raw: excludes the 1st-edition + shadowless printings", () => {
  const winner = pick(
    { cardName: "Charizard", setName: "Base", variant: "unlimited-holofoil", condition: "any-raw" },
    [
      hit("Charizard Base Set Unlimited Holo", 90),
      hit("Charizard 1st Edition Holo", 60), // excluded by variant
      hit("Charizard Shadowless Holo", 70), // excluded by variant
    ],
  );
  assert.equal(winner?.title, "Charizard Base Set Unlimited Holo");
});

test("scenario 3 — PSA 10: keeps PSA 10, drops PSA 9 and a BGS slab", () => {
  const winner = pick(
    { cardName: "Charizard", setName: "Base", condition: "psa-10" },
    [
      hit("Charizard Base Set PSA 10 Gem Mint", 4000),
      hit("Charizard Base Set PSA 9", 1200), // wrong grade
      hit("Charizard Base Set BGS 9.5", 1500), // wrong authority
    ],
  );
  assert.equal(winner?.title, "Charizard Base Set PSA 10 Gem Mint");
});

test("scenario 4 — BGS 10 Black Label: requires the Black Label phrase", () => {
  const winner = pick(
    { cardName: "Charizard", setName: "Base", condition: "bgs-10-bl" },
    [
      hit("Charizard Base Set BGS 10 Black Label Pristine", 9000),
      hit("Charizard Base Set BGS 10", 5000), // plain BGS 10, no Black Label → no include
      hit("Charizard Base Set PSA 10", 4000), // wrong authority
    ],
  );
  assert.equal(winner?.title, "Charizard Base Set BGS 10 Black Label Pristine");
});

test("scenario 5 — CGC 9.5: keeps 9.5, drops CGC 10 and bare CGC 9", () => {
  const winner = pick(
    { cardName: "Charizard", setName: "Base", condition: "cgc-9-5" },
    [
      hit("Charizard Base Set CGC 9.5 Gem Mint", 1200),
      hit("Charizard Base Set CGC 10", 2000), // excluded
      hit("Charizard Base Set CGC 9", 800), // no "CGC 9.5" include → dropped
    ],
  );
  assert.equal(winner?.title, "Charizard Base Set CGC 9.5 Gem Mint");
});

test("scenario 6 — mixed-condition exclusion: an exclude keyword beats a matching include", () => {
  // Title carries BOTH "PSA 10" (include) and "BGS" (exclude) → rejected, even
  // though it's the cheapest hit. The remaining clean PSA 10 wins.
  const winner = pick(
    { cardName: "Charizard", setName: "Base", condition: "psa-10" },
    [
      hit("Charizard PSA 10 — also have BGS 9.5 copy", 1000), // exclude BGS → rejected
      hit("Charizard Base Set PSA 10", 4000),
    ],
  );
  assert.equal(winner?.title, "Charizard Base Set PSA 10");

  // And when EVERY hit is filtered out, the picker soft-fails to null.
  const none = pick({ cardName: "Charizard", condition: "psa-10" }, [
    hit("Charizard Base Set PSA 9", 1200),
    hit("Charizard Base Set BGS 10", 5000),
  ]);
  assert.equal(none, null);
});
