// Structural guards for the Session 49 / ADR-042 sold-history panel +
// the baked PokeTrace variant data. The panel is an async Server Component
// (no React renderer in node:test), so we pin its source-level invariants —
// the same approach as visual-regression.test.ts.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

test("SoldHistoryPanel: server component on the cream/navy/gold palette with Pokeball bullet", () => {
  const src = read("components/cards/sold-history-panel.tsx");
  assert.doesNotMatch(src, /^"use client"/m, "must remain a Server Component (SSR-only)");
  assert.match(src, /PokeballMark/, "uses the Pokeball pill bullet (Session 47.3 pattern)");
  assert.match(src, /getSoldHistory/, "reads sold history via the by-uuid module");
  // Palette discipline — foil tokens only, no raw hex colors in the panel.
  assert.match(src, /text-foil-navy/);
  assert.match(src, /text-foil-gold/);
  assert.doesNotMatch(src, /#[0-9a-fA-F]{6}/, "no raw hex colors — DESIGN.md tokens only");
});

test("SoldHistoryPanel: variant selector + graceful degradation", () => {
  const src = read("components/cards/sold-history-panel.tsx");
  // SSR variant selector — chips are ?v= links re-rendering the page.
  assert.match(src, /role="radiogroup"/);
  assert.match(src, /\?v=\$\{encodeURIComponent\(variant\.variantKey\)\}/);
  // Graceful degradation copy for the no-variants case.
  assert.match(src, /Live sold data not yet available for this card/);
});

test("SoldHistoryPanel: falls back to the cardmarket AGGREGATED tier (Session 49.2)", () => {
  const src = read("components/cards/sold-history-panel.tsx");
  // EU-only cards have only cardmarket/AGGREGATED data; the panel must read
  // cardmarket and render an aggregated "Market average" row when no
  // per-condition tiers exist.
  assert.match(src, /"cardmarket"/, "cardmarket included as a source");
  assert.match(src, /AGGREGATED/, "AGGREGATED tier fallback present");
  assert.match(src, /Market average/, "aggregated row labelled");
});

test("/cards/[slug]: mounts SoldHistoryPanel between variants and the buy CTA", () => {
  const src = read("app/(site)/cards/[slug]/page.tsx");
  assert.match(src, /<SoldHistoryPanel\b/);
  assert.match(src, /variants=\{card\.variants\}/);
  assert.match(src, /selectedKey=\{selectedVariant\}/);
  // Order: CardVariantsSection appears before SoldHistoryPanel, which appears
  // before the best-listing (buy CTA) heading.
  const variantsIdx = src.indexOf("<CardVariantsSection");
  const panelIdx = src.indexOf("<SoldHistoryPanel");
  const buyIdx = src.indexOf("best-deal-heading");
  assert.ok(variantsIdx > -1 && panelIdx > -1 && buyIdx > -1);
  assert.ok(variantsIdx < panelIdx && panelIdx < buyIdx, "panel must sit between variants and the buy CTA");
});

test("baked-metadata: PokeTrace variants are populated with UUIDs", () => {
  const baked = JSON.parse(read("lib/cards/baked-metadata.json")) as {
    cards: Record<string, { variants?: Array<{ variantKey: string; poketraceId: string }> }>;
  };
  // Charizard Base Set has at least the Unlimited + Shadowless printings.
  const charizard = baked.cards["base1-4"]?.variants ?? [];
  assert.ok(charizard.length >= 2, "base1-4 should have >=2 variants (holofoil + shadowless)");
  assert.ok(charizard.some((v) => v.variantKey === "shadowless-holofoil"), "shadowless variant present");
  // UUIDs look like UUIDs (not Pokemon TCG SDK ids).
  for (const v of charizard) {
    assert.match(v.poketraceId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, `poketraceId is a UUID: ${v.poketraceId}`);
  }
  // Coverage: Session 49.2 closed the gap to 207/207 (EU-market fallback).
  const withVariants = Object.values(baked.cards).filter((c) => (c.variants?.length ?? 0) > 0).length;
  assert.ok(withVariants >= 207, `expected all 207 cards with variants, got ${withVariants}`);
  // The 2 EU-only cards now carry their cardmarket UUID.
  assert.ok((baked.cards["base6-16"]?.variants?.length ?? 0) > 0, "LC Muk (EU) has a variant");
  assert.ok((baked.cards["cel25-11"]?.variants?.length ?? 0) > 0, "Celebrations Mew (EU) has a variant");
});
