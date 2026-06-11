// Tiered per-card rendering guards (Session 47.4 / ADR-046).
//
// `curated` cards fetch a live eBay best-listing every render; `longtail`
// cards skip that Browse call (to bound the quota at 1,000+ routes) and render
// the PokeTrace sold-history + an affiliate search CTA. These pin the tier
// plumbing (catalog field + helper) and the page's tier branch structurally
// (the page is an async Server Component — same source-assertion approach as
// sold-history-panel.test.ts).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cardTier, CARD_CATALOG, getCatalogEntry } from "../cards/catalog.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

test("cardTier: defaults to 'curated' for unset entries + unknown slugs", () => {
  // The hand-curated 208 have no explicit tier → all curated by default.
  assert.equal(cardTier("base1-4-charizard"), "curated");
  assert.equal(cardTier("totally-unknown-slug"), "curated");
  // Every catalog entry resolves to a valid tier (ADR-047 added metadata-only).
  for (const e of CARD_CATALOG) {
    const t = cardTier(e.slug);
    assert.ok(t === "curated" || t === "longtail" || t === "metadata-only", `bad tier for ${e.slug}: ${t}`);
  }
});

test("cardTier: honors an explicit longtail tier when present", () => {
  // Find any longtail entry (present after the expansion wave); if none yet,
  // the default-curated invariant above is the live guard.
  const longtail = CARD_CATALOG.find((e) => e.tier === "longtail");
  if (longtail) {
    assert.equal(cardTier(longtail.slug), "longtail");
    assert.ok(getCatalogEntry(longtail.slug)?.tier === "longtail");
  }
});

test("/cards/[slug]: Browse call gated to the curated tier; page forced dynamic (ADR-047)", () => {
  const src = read("app/(site)/cards/[slug]/page.tsx");
  assert.match(src, /const\s+tier\s*=\s*cardTier\(slug\)/);
  // The VERIFIED resolver only inside the curated branch (not longtail/
  // metadata-only) — Tranche A #2: the page never calls the title-only picker.
  assert.match(src, /if \(tier === "curated"\) \{/);
  assert.match(src, /resolveVerifiedListing\(/);
  assert.doesNotMatch(src, /getBestListing/, "the unverified picker must not return to the page");
  assert.doesNotMatch(src, /getListingAspects/, "badge reads the resolver's verdict — no second getItem");
  assert.doesNotMatch(src, /inferConditionLabel/, "the third redundant title heuristic stays deleted");
  // R-008: the page is force-dynamic (ISR is incompatible with its searchParams
  // read — DYNAMIC_SERVER_USAGE), so the live eBay listing is never cached.
  assert.match(src, /export const dynamic = "force-dynamic"/);
});

test("/cards/[slug]: longtail renders the fallback; curated renders the live block", () => {
  const src = read("app/(site)/cards/[slug]/page.tsx");
  assert.match(src, /import \{ LongTailListingFallback \}/);
  assert.match(src, /tier === "longtail" \? \(\s*<LongTailListingFallback/);
});

test("/cards/[slug]: no live Offer without a verified listing — AggregateOffer fallback when priced", () => {
  const src = read("app/(site)/cards/[slug]/page.tsx");
  // Live Offer ONLY from the verified resolve; longtail + curated-null fall
  // back to the baked TCGplayer AggregateOffer (zero eBay calls, design §4).
  assert.match(src, /if \(verified\) \{/);
  assert.match(src, /else if \(tier === "longtail" \|\| tier === "curated"\)/);
  assert.match(src, /aggregateOfferFromTcgplayer/);
  assert.match(src, /"@type": "AggregateOffer"/);
});

test("LongTailListingFallback: server component, affiliate search CTA, palette-clean", () => {
  const src = read("components/cards/long-tail-listing-fallback.tsx");
  assert.doesNotMatch(src, /^"use client"/m, "server component (no Browse, no client JS)");
  assert.match(src, /searchUrl/, "takes an affiliate search URL (no Browse call)");
  assert.match(src, /rel="sponsored noopener noreferrer"/);
  assert.match(src, /text-foil-navy/);
  assert.doesNotMatch(src, /#[0-9a-fA-F]{6}/, "no raw hex — DESIGN.md tokens only");
  // Coral never rests (DESIGN.md): only as a hover, if at all.
  assert.doesNotMatch(src, /(?<!hover:)(bg|text|border)-foil-coral\b/);
});
