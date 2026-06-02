// EPN customid taxonomy + leak guard (ROADMAP #32.3 follow-up).
//
// Pins: per-tier codes, per-card slug encoding, per-creator `src` isolation,
// untrusted-`src` sanitization, the 256-char cap, and — the actual leak fix —
// that buildAffiliateUrl never emits an EMPTY customid (which is what shows in
// EPN as "No Custom ID"); a blank falls back to the visible `foil-untagged`.

import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomId, buildAffiliateUrl, CUSTOMID_FALLBACK, CUSTOMID_MAX_LENGTH } from "../affiliate/epn.ts";

test("buildCustomId: per-tier codes + slug encoding", () => {
  assert.equal(buildCustomId({ tier: "curated", slug: "base1-4-charizard" }), "cp-base1-4-charizard");
  assert.equal(buildCustomId({ tier: "longtail", slug: "base1-4-charizard" }), "lt-base1-4-charizard");
  assert.equal(buildCustomId({ tier: "metadata-only", slug: "base1-4-charizard" }), "mo-base1-4-charizard");
  assert.equal(buildCustomId({ tier: "wishlist", slug: "base1-4-charizard" }), "wl-base1-4-charizard");
});

test("buildCustomId: per-creator src tag isolates the pilot", () => {
  assert.equal(
    buildCustomId({ tier: "curated", slug: "base1-4-charizard", src: "PokeRev" }),
    "cp-base1-4-charizard-s-pokerev",
  );
});

test("buildCustomId: untrusted src is sanitized to [a-z0-9] (no &, =, spaces, punctuation)", () => {
  const out = buildCustomId({ tier: "curated", slug: "base1-4-charizard", src: "evil&campid=x drop;--" });
  assert.equal(out, "cp-base1-4-charizard-s-evilcampidxdrop");
  for (const bad of ["&", "=", " ", ";", "'", '"']) assert.ok(!out.includes(bad), `must not contain ${bad}`);
});

test("buildCustomId: only hyphens as separators (underscores never emitted — charset is unverified)", () => {
  const out = buildCustomId({ tier: "curated", slug: "swsh12pt5_18_charizard_v", src: "a_b" });
  assert.ok(!out.includes("_"), `no underscores in ${out}`);
});

test("buildCustomId: capped under eBay's 256-char limit and never empty", () => {
  const long = buildCustomId({ tier: "curated", slug: "x".repeat(500) });
  assert.ok(long.length <= CUSTOMID_MAX_LENGTH);
  assert.ok(long.length > 0);
  // A slug that sanitizes to nothing still yields a non-empty code.
  assert.equal(buildCustomId({ tier: "curated", slug: "!!!" }), "cp");
});

test("buildAffiliateUrl: an empty/whitespace customId becomes the visible sentinel, NEVER blank (the No-Custom-ID leak fix)", () => {
  const prev = process.env.EBAY_CAMPAIGN_ID;
  process.env.EBAY_CAMPAIGN_ID = "555555";
  try {
    for (const blank of ["", "   "]) {
      const url = buildAffiliateUrl("https://www.ebay.com/itm/1", blank);
      assert.ok(url.includes(`customid=${CUSTOMID_FALLBACK}`), `blank -> sentinel, got ${url}`);
      assert.doesNotMatch(url, /customid=(&|$)/, "must never emit an empty customid value");
    }
    const good = buildAffiliateUrl("https://www.ebay.com/itm/1", "cp-base1-4-charizard");
    assert.match(good, /customid=cp-base1-4-charizard/);
    assert.match(good, /campid=555555/);
  } finally {
    if (prev === undefined) delete process.env.EBAY_CAMPAIGN_ID;
    else process.env.EBAY_CAMPAIGN_ID = prev;
  }
});
