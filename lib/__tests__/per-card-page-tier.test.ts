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

test("/cards/[slug]: the live eBay resolve moved OFF the page render (ADR-047 v2); page still force-dynamic", () => {
  const src = read("app/(site)/cards/[slug]/page.tsx");
  assert.match(src, /const\s+tier\s*=\s*cardTier\(slug\)/);
  // ADR-047 v2 SEO fix: the page NO LONGER runs the live eBay resolve in its
  // server render (that ~38s blocking fetch throttled crawl). It hydrates
  // client-side via <LiveListingSection>. So the page must NOT call the resolver
  // or the unverified picker.
  assert.doesNotMatch(src, /resolveVerifiedListing\(/, "the live eBay resolve moved to /api/listing/[slug]");
  assert.doesNotMatch(src, /getBestListing/, "the unverified picker must not return to the page");
  assert.doesNotMatch(src, /getListingAspects/, "no getItem in the page render");
  assert.doesNotMatch(src, /inferConditionLabel/, "the third redundant title heuristic stays deleted");
  assert.match(src, /<LiveListingSection\b/, "curated live block hydrates client-side");
  // R-008: the page is still force-dynamic (searchParams read), and the live
  // eBay resolve now lives in the force-dynamic + no-store route handler.
  assert.match(src, /export const dynamic = "force-dynamic"/);
});

test("/api/listing/[slug]: the live resolve lives here, curated-gated, force-dynamic + no-store (R-008)", () => {
  const src = read("app/api/listing/[slug]/route.ts");
  // The eBay resolve + buy-signal moved here from the page.
  assert.match(src, /resolveVerifiedListing\(/);
  assert.match(src, /computeCardBuySignal\(/);
  // Curated-gated (the only tier with a live ask).
  assert.match(src, /if \(tier !== "curated"\)/);
  // R-008: force-dynamic + no-store; never persists the raw aspect map.
  assert.match(src, /export const dynamic = "force-dynamic"/);
  assert.match(src, /"Cache-Control":\s*"no-store"/);
  assert.doesNotMatch(src, /aspects:/, "the raw getItem aspect map is never returned to the client");
});

test("/cards/[slug]: longtail renders the fallback; curated renders the client live block", () => {
  const src = read("app/(site)/cards/[slug]/page.tsx");
  assert.match(src, /import \{ LongTailListingFallback \}/);
  assert.match(src, /import \{ LiveListingSection \}/);
  assert.match(src, /tier === "longtail" \? \(\s*<LongTailListingFallback/);
  // curated branch → the client-hydrated live section.
  assert.match(src, /<LiveListingSection\b/);
});

test("/cards/[slug]: server JSON-LD always uses the baked AggregateOffer (no volatile live Offer; ADR-047 v2)", () => {
  const src = read("app/(site)/cards/[slug]/page.tsx");
  // The live eBay Offer is gone from the crawled structured data; longtail +
  // curated both carry the STABLE baked TCGplayer AggregateOffer (design §4).
  assert.match(src, /if \(tier === "longtail" \|\| tier === "curated"\)/);
  assert.match(src, /aggregateOfferFromTcgplayer/);
  // The builder itself moved to lib/cards/aggregate-offer.ts (2026-07-01,
  // perf-and-data-foundation) so it's unit-testable against the committed
  // snapshot; the page imports it.
  assert.match(src, /import \{ aggregateOfferFromTcgplayer \} from "@\/lib\/cards\/aggregate-offer"/);
  assert.match(read("lib/cards/aggregate-offer.ts"), /"@type": "AggregateOffer"/);
  // No live eBay Offer in the server-rendered JSON-LD anymore.
  assert.doesNotMatch(src, /availability: "https:\/\/schema\.org\/InStock"/, "the volatile live Offer left the crawled DOM");
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
