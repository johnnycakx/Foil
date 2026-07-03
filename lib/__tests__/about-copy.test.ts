// About-section listing copy — tier honesty (card-page-vault-first goal,
// Cowork live audit 2026-07-04).
//
// The defect: the old page promised "the Best Current Listing block above"
// on every tier, but longtail/metadata-only pages render the Browse-on-eBay
// fallback, not a verified block. These tests pin the fix: each tier's copy
// describes only the surface that tier actually renders, and the page routes
// through the one copy module.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { aboutListingCopy } from "../cards/about-copy.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

test("curated tier: the copy may promise the verified Best Current Listing block", () => {
  const copy = aboutListingCopy("curated");
  assert.match(copy.lead, /Best Current Listing block above/);
  assert.match(copy.verify, /verifies the lowest current eBay listing on every page load/);
});

test("fallback tiers: the copy NEVER promises a block the page doesn't render", () => {
  for (const tier of ["longtail", "metadata-only"] as const) {
    const copy = aboutListingCopy(tier);
    const all = `${copy.lead} ${copy.verify}`;
    assert.ok(!all.includes("block above"), `${tier}: no 'block above' promise`);
    assert.ok(!all.includes("Best Current Listing"), `${tier}: no Best Current Listing claim`);
    // The honest framing: we link to the live search and only curate what we
    // can verify.
    assert.match(copy.lead, /live eBay search/);
    assert.match(copy.lead, /only show a curated pick when we can verify/);
  }
});

test("voice: no em dashes in any tier's copy", () => {
  for (const tier of ["curated", "longtail", "metadata-only"] as const) {
    const copy = aboutListingCopy(tier);
    assert.ok(!copy.lead.includes("—") && !copy.verify.includes("—"), `${tier}: no em dash`);
  }
});

test("the page routes About copy through aboutListingCopy(tier) and drops the old hardcoded promise", () => {
  const src = readFileSync(join(ROOT, "app/(site)/cards/[slug]/page.tsx"), "utf8");
  assert.match(src, /aboutListingCopy\(tier\)/, "the page derives the copy from the render tier");
  assert.match(src, /\{aboutCopy\.lead\}/, "the lead paragraph renders the tier copy");
  assert.match(src, /\{aboutCopy\.verify\}/, "the verify paragraph renders the tier copy");
  assert.doesNotMatch(
    src,
    /Best Current Listing block above/,
    "no hardcoded cross-tier promise remains in the page",
  );
});
