// ADR-077: the movers-digest quality gate — the safety net before the approval
// card. Pins the honesty (figures trace to source), sample-size, brand-voice,
// and affiliate-integrity (the issue-#1 unwrapped-link bug) checks.

import test from "node:test";
import assert from "node:assert/strict";
import type { MarketMovers, MoverRow } from "../deals/market-movers-read.ts";
import { buildMoversDigestParts, type MoversDigestParts } from "../newsletter/movers-digest.ts";
import { renderDigestForSend } from "../newsletter/digest-html.ts";
import { runDigestQualityGates, MOVERS_DIGEST_MIN_SALES } from "../newsletter/digest-quality-gate.ts";

const CAMPID = "5339154326";

function mover(over: Partial<MoverRow> = {}): MoverRow {
  return {
    cardSlug: "sv10-243-jamming-tower",
    cardName: "Jamming Tower",
    setName: "Destined Rivals",
    imageUrl: "",
    direction: "down",
    momentumPct: -10.6,
    avg7d: 11.34,
    avg30d: 12.68,
    saleCount: 263,
    matchedTier: "NEAR_MINT",
    computedAt: "2026-06-28T09:03:13Z",
    soldAsOfIso: null,
    ...over,
  };
}

const GEN_AT = "2026-06-28T16:00:00Z";

function fullMovers(): MarketMovers {
  return {
    down: [
      mover(),
      mover({ cardSlug: "swsh7-18-flareon-vmax", cardName: "Flareon VMAX", setName: "Evolving Skies", momentumPct: -10.4, avg7d: 10.53, avg30d: 11.75, saleCount: 307 }),
    ],
    up: [
      mover({ direction: "up", cardSlug: "sv3pt5-173-pikachu", cardName: "Pikachu", setName: "151", momentumPct: 13.9, avg7d: 103.28, avg30d: 90.66, saleCount: 619 }),
    ],
  };
}

test("a clean digest passes every gate (affiliate links wrapped)", () => {
  process.env.EBAY_CAMPAIGN_ID = CAMPID;
  const movers = fullMovers();
  const rendered = renderDigestForSend({ movers, generatedAt: GEN_AT, siteUrl: "https://foiltcg.com" });
  const parts = buildMoversDigestParts({ movers, generatedAt: GEN_AT, siteUrl: "https://foiltcg.com" });
  const gate = runDigestQualityGates({ parts, movers, html: rendered.html });
  assert.deepEqual(gate.failures, []);
  assert.equal(gate.passed, true);
});

test("zero cooling-off candidates fails the non-empty gate (skip a thin week)", () => {
  const movers: MarketMovers = { down: [], up: [mover({ direction: "up" })] };
  const parts = buildMoversDigestParts({ movers, generatedAt: GEN_AT });
  const gate = runDigestQualityGates({ parts, movers, html: "<a href='x'>", requireAffiliate: false });
  assert.equal(gate.passed, false);
  assert.ok(gate.failures.some((f) => /cooling-off/i.test(f)));
});

test("a card below the sale-count minimum fails the sample-size gate", () => {
  const movers: MarketMovers = { down: [mover({ saleCount: MOVERS_DIGEST_MIN_SALES - 1 })], up: [] };
  const parts = buildMoversDigestParts({ movers, generatedAt: GEN_AT });
  const gate = runDigestQualityGates({ parts, movers, html: "<a href='x'>", requireAffiliate: false });
  assert.equal(gate.passed, false);
  assert.ok(gate.failures.some((f) => /minimum/i.test(f)));
});

test("a $ figure not present in the source movers fails the figures gate", () => {
  const movers = fullMovers();
  const tampered: MoversDigestParts = {
    subject: "x".repeat(10),
    previewText: "preview",
    // A planted figure ($999) that no source avg7d/avg30d backs.
    bodyMarkdown: "# Good buys this week\n\nSomeone paid $999 for it.",
    downCount: 2,
    upCount: 1,
  };
  const gate = runDigestQualityGates({ parts: tampered, movers, html: "<a href='x'>", requireAffiliate: false });
  assert.equal(gate.passed, false);
  assert.ok(gate.failures.some((f) => /\$999/.test(f)));
});

test("an em dash anywhere fails the brand-voice gate", () => {
  const movers = fullMovers();
  const parts = buildMoversDigestParts({ movers, generatedAt: GEN_AT });
  const withEmDash: MoversDigestParts = { ...parts, subject: parts.subject + " — really" };
  const gate = runDigestQualityGates({ parts: withEmDash, movers, html: "<a href='x'>", requireAffiliate: false });
  assert.equal(gate.passed, false);
  assert.ok(gate.failures.some((f) => /em dash/i.test(f)));
});

test("unwrapped eBay links (no campid) fail the affiliate-integrity gate (issue-#1 bug)", () => {
  delete process.env.EBAY_CAMPAIGN_ID;
  const movers = fullMovers();
  const rendered = renderDigestForSend({ movers, generatedAt: GEN_AT, siteUrl: "https://foiltcg.com" });
  const parts = buildMoversDigestParts({ movers, generatedAt: GEN_AT, siteUrl: "https://foiltcg.com" });
  // Sanity: the links really are unwrapped without the env var.
  assert.ok(!/campid=/.test(rendered.html), "links are unwrapped without EBAY_CAMPAIGN_ID");
  const gate = runDigestQualityGates({ parts, movers, html: rendered.html, requireAffiliate: true });
  assert.equal(gate.passed, false);
  assert.ok(gate.failures.some((f) => /campid|affiliate/i.test(f)));
});
