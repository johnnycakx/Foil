// Watchlist submission validator (Session 49b / ADR-043).
//
// validateWatchlistSubmission is the security gate every write path runs before
// touching the DB. These tests pin: it rejects bad emails, slugs, prices, and —
// the new surface — variant tokens not in the card's real variant set and
// condition tokens outside the closed set, while defaulting the optional
// variant/condition to the sentinels.

import test from "node:test";
import assert from "node:assert/strict";
import { validateWatchlistSubmission } from "../wishlist/validate.ts";
import { deriveAvailableVariants } from "../poketrace/variant.ts";

// A card with two real baked variants (Charizard Base: unlimited + shadowless).
const CARD = {
  variants: [
    { variantKey: "holofoil", poketraceId: "x", variantLabel: "Holofoil", isHolo: true, isFirstEdition: false, isShadowless: false, isUnlimited: true },
    { variantKey: "shadowless-holofoil", poketraceId: "y", variantLabel: "Shadowless Holofoil", isHolo: true, isFirstEdition: false, isShadowless: true, isUnlimited: false },
  ],
};
const KEYS = deriveAvailableVariants(CARD); // ["default","holofoil","shadowless-holofoil"]

function base(over: Record<string, unknown> = {}) {
  return {
    email: "buyer@example.com",
    card_slug: "base1-4-charizard",
    variant: "holofoil",
    condition: "psa-10",
    target_price_cents: 400000,
    ...over,
  };
}

test("deriveAvailableVariants always includes the default sentinel + the card's keys", () => {
  assert.deepEqual(KEYS, ["default", "holofoil", "shadowless-holofoil"]);
  assert.deepEqual(deriveAvailableVariants({ variants: [] }), ["default"]);
  assert.deepEqual(deriveAvailableVariants(null), ["default"]);
});

test("accepts a fully valid submission and normalizes the email", () => {
  const r = validateWatchlistSubmission(base({ email: "  Buyer@Example.COM " }), KEYS);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.email, "buyer@example.com");
    assert.equal(r.value.variant, "holofoil");
    assert.equal(r.value.condition, "psa-10");
    assert.equal(r.value.target_price_cents, 400000);
  }
});

test("defaults variant→'default' and condition→'any-raw' when omitted", () => {
  const r = validateWatchlistSubmission(base({ variant: undefined, condition: undefined }), KEYS);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.variant, "default");
    assert.equal(r.value.condition, "any-raw");
  }
});

test("rejects a variant the card doesn't have", () => {
  const r = validateWatchlistSubmission(base({ variant: "1st-edition-holofoil" }), KEYS);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "invalid_variant");
});

test("rejects a condition token outside the closed set", () => {
  for (const bad of ["psa10", "near-mint", "PSA 10", "graded"]) {
    const r = validateWatchlistSubmission(base({ condition: bad }), KEYS);
    assert.equal(r.ok, false, `should reject condition ${bad}`);
    if (!r.ok) assert.equal(r.error, "invalid_condition");
  }
});

test("rejects malformed email / slug / price", () => {
  assert.equal(validateWatchlistSubmission(base({ email: "nope" }), KEYS).ok, false);
  assert.equal(validateWatchlistSubmission(base({ card_slug: "Has Spaces" }), KEYS).ok, false);
  assert.equal(validateWatchlistSubmission(base({ target_price_cents: 0 }), KEYS).ok, false);
  assert.equal(validateWatchlistSubmission(base({ target_price_cents: 1.5 }), KEYS).ok, false);
  assert.equal(validateWatchlistSubmission(base({ target_price_cents: 99_999_999 }), KEYS).ok, false);
});

test("'default' variant is always accepted (any printing)", () => {
  const r = validateWatchlistSubmission(base({ variant: "default", condition: "any-raw" }), KEYS);
  assert.ok(r.ok);
});

test("blank target is a VALID watch → null (market basis, ADR-091); garbage still rejects", () => {
  // Blank = "alert me at >=15% under the 30-day sold average." No sentinel.
  const blank = validateWatchlistSubmission(base({ target_price_cents: undefined }), KEYS);
  assert.ok(blank.ok);
  if (blank.ok) assert.equal(blank.value.target_price_cents, null);
  const empty = validateWatchlistSubmission(base({ target_price_cents: "" }), KEYS);
  assert.ok(empty.ok);
  if (empty.ok) assert.equal(empty.value.target_price_cents, null);
  // Supplied-but-invalid still rejects (not silently nulled).
  assert.equal(validateWatchlistSubmission(base({ target_price_cents: "abc" }), KEYS).ok, false);
});
