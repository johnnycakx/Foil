// ADR-077: the digest HTML render path (Beehiiv paste body). Pins that the
// deterministic markdown -> HTML conversion produces the expected structure +
// clickable affiliate links, and that the parts builder feeds it.

import test from "node:test";
import assert from "node:assert/strict";
import type { MarketMovers, MoverRow } from "../deals/market-movers-read.ts";
import { renderDigestForSend, digestBodyToHtml } from "../newsletter/digest-html.ts";

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

const movers: MarketMovers = {
  down: [mover()],
  up: [mover({ direction: "up", cardName: "Pikachu", setName: "151", momentumPct: 13.9, avg7d: 103.28, avg30d: 90.66, saleCount: 619 })],
};

test("renderDigestForSend returns subject, preview, body markdown + HTML", () => {
  const r = renderDigestForSend({ movers, generatedAt: "2026-06-28T16:00:00Z", siteUrl: "https://foiltcg.com" });
  assert.match(r.subject, /trading below their 30-day average/);
  assert.ok(r.previewText.length > 0);
  assert.ok(r.bodyMarkdown.startsWith("# Good buys this week"), "body markdown is the email body (no review header)");
  assert.equal(r.downCount, 1);
  assert.equal(r.upCount, 1);
});

test("the HTML has the heading structure + a clickable browse link + the card name", () => {
  const r = renderDigestForSend({ movers, generatedAt: "2026-06-28T16:00:00Z", siteUrl: "https://foiltcg.com" });
  assert.match(r.html, /<h1[^>]*>Good buys this week<\/h1>/);
  assert.match(r.html, /<h2[^>]*>Cooling off/);
  assert.match(r.html, /Jamming Tower/);
  assert.match(r.html, /<a href="https:\/\/www\.ebay\.com\/sch\//, "browse links render as anchors");
  // The exact source averages survive into the HTML (deterministic honesty).
  assert.match(r.html, /\$11\.34/);
  assert.match(r.html, /\$12\.68/);
});

test("digestBodyToHtml converts the markdown surface marked is given", () => {
  const html = digestBodyToHtml("# Title\n\n**Bold** and a [link](https://x.test).\n\n- item one");
  assert.match(html, /<h1[^>]*>Title<\/h1>/);
  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /<a href="https:\/\/x\.test">link<\/a>/);
  assert.match(html, /<li>item one<\/li>/);
});
