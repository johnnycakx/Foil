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

test("SoldHistoryPanel: server component on the night-register palette, mark-free heading", () => {
  const src = read("components/cards/sold-history-panel.tsx");
  assert.doesNotMatch(src, /^"use client"/m, "must remain a Server Component (SSR-only)");
  // hero-polish-followups retired the seal across ALL UI (the ADR-094 bullet
  // included) — the visual-regression tripwire owns the repo-wide ban; this
  // pins the heading stays glyph-free.
  assert.doesNotMatch(src, /SealMark/, "the hanko seal bullet is retired (extends ADR-099)");
  assert.doesNotMatch(src, /PokeballMark/, "the Pokeball bullet is retired (ADR-055)");
  assert.match(src, /getSoldHistory/, "reads sold history via the by-uuid module");
  // Palette discipline — foil tokens only, no raw hex colors in the panel.
  assert.match(src, /text-foil-cream/); // design-loop-round2 §3 (night register)
  assert.match(src, /text-foil-accent/); // design-loop-round2 §3 (night register)
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
  // EU-only cards have only cardmarket/AGGREGATED data; the resolver reads
  // cardmarket (SOLD_SOURCES) and the panel renders the aggregated
  // "Market average" row when no per-condition tiers exist.
  const coherence = read("lib/cards/sold-coherence.ts");
  assert.match(coherence, /"cardmarket"/, "cardmarket included as a SOLD_SOURCE");
  assert.match(src, /aggregatedRow/, "AGGREGATED tier fallback rendered");
  assert.match(src, /Market average/, "aggregated row labelled");
});

test("SoldHistoryPanel: honesty contract — resolver-gated figures, no pooled blends, no fabricated windowed n (sold-data-integrity)", () => {
  const src = read("components/cards/sold-history-panel.tsx");
  // Every figure flows through the one coherence resolver.
  assert.match(src, /resolveSoldPanel/, "figures resolve through lib/cards/sold-coherence");
  // The pooled mixed-condition aggregate (the $391 xy4-122 headline) is dead.
  assert.doesNotMatch(src, /aggregateStat|wavg\(/, "no pooled cross-tier aggregation in the panel");
  // Sale counts are labeled as what they are: all-time counts on record.
  assert.match(src, /sales on record/i, "counts labeled all-time, never a windowed n");
  assert.match(src, /Sales on record/, "table column header labeled honestly");
  // Stale tiers render as dated last sales, never as current 30-day figures.
  assert.match(src, /last\s*\{money\(row\.display\.value\)\}|last-sale/, "dated last-sale rendering present");
  // Suppression: the honest empty state + the #errors ping.
  assert.match(src, /Sold data pending/, "honest empty state copy");
  assert.match(src, /sold-data-suppressed/, "#errors suppression ping wired");
  assert.match(src, /postError/, "routes through lib/notifications/discord (ADR-014)");
});

test("SoldHistoryPanel: headline reacts to the selected condition (Session 49c bug fix)", () => {
  const src = read("components/cards/sold-history-panel.tsx");
  // The panel must accept the condition + resolve it to a tier/aggregate
  // rather than locking the headline to NM.
  assert.match(src, /selectedCondition/, "accepts the ?c= condition");
  assert.match(src, /conditionToTier|resolveHeadline/, "resolves the condition to a tier/aggregate");
  // Headline label appends the condition suffix ("· PSA 10").
  assert.match(src, /conditionSuffix/);
  // Old static-NM headline bug is gone: the headline tier is no longer the
  // hard-coded "first raw tier" pick.
  assert.doesNotMatch(src, /headlineTierKey\s*=\s*RAW_TIERS\.find/, "must not relock headline to first raw tier");
});

test("SoldHistoryPanel: mounts the chart with the selected-condition daily series; table is condition-independent", () => {
  const src = read("components/cards/sold-history-panel.tsx");
  assert.match(src, /<SoldHistoryChart\b/, "mounts the line chart");
  assert.match(src, /series=\{chartSeries\}/, "passes the selected condition's daily series");
  // Real daily history via the tier-scoped endpoint (ADR-044), tier resolved
  // from the selected condition.
  assert.match(src, /getPriceHistory/);
  assert.match(src, /chartTierForCondition/);
  // The static "↑ 7d" arrow render-ternary is replaced by the chart.
  assert.doesNotMatch(src, /trend === "up" \? "↑"/, "static trend-arrow ternary removed");
  // Table renders whenever the variant has ANY data (not gated on the selected
  // condition having a headline) so picking an empty grade can't hide it.
  assert.match(src, /anyData/);
});

test("page passes selectedCondition (?c) into the panel", () => {
  const src = read("app/(site)/cards/[slug]/page.tsx");
  assert.match(src, /selectedCondition=\{selectedCondition\}/);
  assert.match(src, /c:\s*selectedCondition/);
});

test("/cards/[slug]: mounts SoldHistoryPanel between variants and the buy CTA", () => {
  const src = read("app/(site)/cards/[slug]/page.tsx");
  assert.match(src, /<SoldHistoryPanel\b/);
  // ADR-092: the page passes the MERGED variants (baked → hydrated fallback),
  // not the raw baked field.
  assert.match(src, /variants=\{variants\}/);
  assert.match(src, /selectedKey=\{selectedVariant\}/);
  // Order: CardVariantsSection before SoldHistoryPanel, before the curated buy
  // CTA — now the client-hydrated <LiveListingSection> (ADR-047 v2; the
  // best-listing markup + its `best-deal-heading` moved into that component).
  const variantsIdx = src.indexOf("<CardVariantsSection");
  const panelIdx = src.indexOf("<SoldHistoryPanel");
  const buyIdx = src.indexOf("<LiveListingSection");
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
