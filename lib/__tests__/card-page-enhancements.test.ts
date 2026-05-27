// Drift guards for the Session 41 / ADR-030 per-card reference-data
// layer. Four invariants pinned at the source-text level (the components
// are pure rendering — no data flow worth simulating in node:test), one
// behavioral pin for the BreadcrumbList JSON-LD helper.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

// ---------------------------------------------------------------------------
// CardMetadataBlock — renders the 6 reference-data field families.
// ---------------------------------------------------------------------------

test("CardMetadataBlock: renders Type, Series, Artist, Release year, Rarity, HP rows", () => {
  const src = readFile("components/card-metadata-block.tsx");
  // Each label string is a literal in the source so a refactor that
  // accidentally drops a field is caught here.
  assert.match(src, /label:\s*["']Type["']/);
  assert.match(src, /label:\s*["']Series["']/);
  assert.match(src, /label:\s*["']Artist["']/);
  assert.match(src, /label:\s*["']Release year["']/);
  assert.match(src, /label:\s*["']Rarity["']/);
  assert.match(src, /label:\s*["']HP["']/);
});

test("CardMetadataBlock: renders Attacks + Weaknesses sections", () => {
  const src = readFile("components/card-metadata-block.tsx");
  assert.match(src, />\s*Attacks\s*</);
  assert.match(src, />\s*Weaknesses\s*</);
});

test("CardMetadataBlock: returns null when card has no reference data (graceful degrade)", () => {
  const src = readFile("components/card-metadata-block.tsx");
  // The empty-state guard — if no rows + no attacks + no weaknesses,
  // skip rendering altogether (no orphan section heading on minimal-
  // record fallback cards).
  assert.match(src, /if\s*\(rows\.length\s*===\s*0\s*&&\s*!hasAttacks\s*&&\s*!hasWeaknesses\)/);
  assert.match(src, /return null/);
});

// ---------------------------------------------------------------------------
// PriceRangeBar — missing-data null-safety.
// ---------------------------------------------------------------------------

test("PriceRangeBar: returns null when low/high are missing or degenerate", () => {
  const src = readFile("components/price-range-bar.tsx");
  // Two early returns: null low/high → null; high <= low → null.
  assert.match(src, /if\s*\(price\.low\s*===\s*null\s*\|\|\s*price\.high\s*===\s*null\)\s*return null/);
  assert.match(src, /if\s*\(price\.high\s*<=\s*price\.low\)\s*return null/);
});

test("PriceRangeBar: clamps current-listing marker into [low, high]", () => {
  const src = readFile("components/price-range-bar.tsx");
  // The clamp protects against eBay listings outliers that would push
  // the marker off the bar visually. Math.max(low, Math.min(high, x)).
  assert.match(src, /Math\.max\(price\.low,\s*Math\.min\(price\.high,/);
});

// ---------------------------------------------------------------------------
// CardVariantsSection — soft-fail when no upstream pricing data.
// ---------------------------------------------------------------------------

test("CardVariantsSection: returns null when tcgplayerPrices is empty", () => {
  const src = readFile("components/card-variants-section.tsx");
  assert.match(src, /if\s*\(entries\.length\s*===\s*0\)\s*return null/);
});

test("CardVariantsSection: humanizes the upstream variant slugs", () => {
  const src = readFile("components/card-variants-section.tsx");
  // The label map must include the common variants the SDK exposes.
  // Object-literal keys may be quoted or unquoted in TypeScript — match both.
  assert.match(src, /(?:["']normal["']|\bnormal)\s*:\s*["']Normal["']/);
  assert.match(src, /(?:["']holofoil["']|\bholofoil)\s*:\s*["']Holofoil["']/);
  assert.match(src, /(?:["']reverseHolofoil["']|\breverseHolofoil)\s*:\s*["']Reverse Holo["']/);
});

// ---------------------------------------------------------------------------
// Breadcrumb — visual + schema parity.
// ---------------------------------------------------------------------------

test("Breadcrumb: renders <nav aria-label=\"Breadcrumb\"> with <ol>", () => {
  const src = readFile("components/breadcrumb.tsx");
  assert.match(src, /aria-label="Breadcrumb"/);
  assert.match(src, /<ol\b/);
  // Last item rendered as plain text with aria-current="page" (not a link).
  assert.match(src, /aria-current="page"/);
});

test("breadcrumbListSchema: produces a 1-indexed BreadcrumbList JSON-LD shape", async () => {
  const { breadcrumbListSchema } = await import("../seo/schema-helpers.ts");
  const out = breadcrumbListSchema([
    { name: "Home", url: "https://foiltcg.com/" },
    { name: "Cards", url: "https://foiltcg.com/cards" },
    { name: "Base", url: "https://foiltcg.com/cards/sets/base1" },
    { name: "Charizard", url: "https://foiltcg.com/cards/base1-4-charizard" },
  ]);
  assert.ok(out, "expected schema output for non-empty input");
  assert.equal(out!["@type"], "BreadcrumbList");
  assert.equal(out!.itemListElement.length, 4);
  // 1-indexed per spec — position 1 = Home, position 4 = Charizard.
  assert.equal(out!.itemListElement[0].position, 1);
  assert.equal(out!.itemListElement[0].name, "Home");
  assert.equal(out!.itemListElement[3].position, 4);
  assert.equal(out!.itemListElement[3].item, "https://foiltcg.com/cards/base1-4-charizard");
});

test("breadcrumbListSchema: returns null on empty input", async () => {
  const { breadcrumbListSchema } = await import("../seo/schema-helpers.ts");
  assert.equal(breadcrumbListSchema([]), null);
});

// ---------------------------------------------------------------------------
// LiveTimestamp — aria-live for assistive tech + foil-gold pulse dot.
// ---------------------------------------------------------------------------

test("LiveTimestamp: ships aria-live + foil-gold pulse dot", () => {
  const src = readFile("components/live-timestamp.tsx");
  assert.match(src, /aria-live="polite"/);
  // The pulse dot uses the same affordance pattern as the layout's
  // wordmark and the best-listing block (gold, ping animation).
  assert.match(src, /animate-ping[^"]*rounded-full[^"]*bg-foil-gold/);
});

test("LiveTimestamp: refreshes via setInterval (not a one-shot)", () => {
  const src = readFile("components/live-timestamp.tsx");
  assert.match(src, /setInterval/);
  assert.match(src, /clearInterval/);
});

// ---------------------------------------------------------------------------
// Page composition — /cards/[slug] mounts the new layer in the right slots.
// ---------------------------------------------------------------------------

test("/cards/[slug]: composes Breadcrumb + CardVariantsSection + LiveTimestamp + CardMetadataBlock", () => {
  const src = readFile("app/(site)/cards/[slug]/page.tsx");
  assert.match(src, /<Breadcrumb\b/);
  assert.match(src, /<CardVariantsSection\b/);
  assert.match(src, /<LiveTimestamp\b/);
  assert.match(src, /<CardMetadataBlock\b/);
});

test("/cards/[slug]: BreadcrumbList schema is included in schemaGraph", () => {
  const src = readFile("app/(site)/cards/[slug]/page.tsx");
  assert.match(src, /breadcrumbListSchema/);
  // The schema should be passed to schemaGraph as a sibling of productSchema.
  assert.match(src, /schemaGraph\(productSchema,\s*breadcrumbSchema\)/);
});
