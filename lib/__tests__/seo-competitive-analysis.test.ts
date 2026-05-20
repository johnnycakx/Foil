// Offline tests for the competitive-gap analyzer. We inject HTML fixtures
// rather than hitting the network — the network path is exercised by the
// script wrapper, not the unit test.

import test from "node:test";
import assert from "node:assert/strict";
import {
  extractCompetitorPage,
  findTopicGaps,
  normalizeTopic,
  renderGapReport,
  scrapeCompetitorContent,
} from "../seo/competitive-analysis.ts";

const SAMPLE_HTML = `
<html>
  <head><title>How to Price Pokemon Cards | PokeScope</title></head>
  <body>
    <h1>How to Price Pokemon Cards</h1>
    <h2>Reading the set symbol</h2>
    <h2>eBay sold averages vs market price</h2>
    <h3>The "active listing" trap</h3>
    <h2>When to grade your card</h2>
  </body>
</html>`;

test("extractCompetitorPage pulls title and H1/H2/H3 in document order", () => {
  const page = extractCompetitorPage("https://example.com/pricing", SAMPLE_HTML);
  assert.equal(page.url, "https://example.com/pricing");
  assert.equal(page.title, "How to Price Pokemon Cards | PokeScope");
  assert.deepEqual(
    page.headings.map((h) => `${h.level}:${h.text}`),
    [
      "1:How to Price Pokemon Cards",
      "2:Reading the set symbol",
      "2:eBay sold averages vs market price",
      `3:The "active listing" trap`,
      "2:When to grade your card",
    ],
  );
});

test("extractCompetitorPage handles missing title gracefully", () => {
  const page = extractCompetitorPage("https://example.com/x", "<h2>Only this</h2>");
  assert.equal(page.title, "");
  assert.equal(page.headings.length, 1);
});

test("extractCompetitorPage skips empty headings", () => {
  const page = extractCompetitorPage("https://example.com/x", "<h2></h2><h2>Real</h2>");
  assert.equal(page.headings.length, 1);
});

test("normalizeTopic strips filler words and punctuation deterministically", () => {
  // Both inputs should collapse to the same canonical form.
  assert.equal(
    normalizeTopic("How to price a Pokémon card"),
    normalizeTopic("HOW TO PRICE A POKÉMON CARD!?"),
  );
  assert.equal(
    normalizeTopic("eBay sold averages vs market price"),
    "ebay sold averages vs market price",
  );
});

test("findTopicGaps returns competitor headings absent from own topics", () => {
  const page = extractCompetitorPage("https://example.com/x", SAMPLE_HTML);
  const gaps = findTopicGaps([page], [
    "When to grade your card",       // covered
    "PSA vs BGS vs CGC pokemon",     // covered, different phrasing
  ]);
  const topics = gaps.map((g) => g.topic);
  assert.ok(topics.includes("Reading the set symbol"));
  assert.ok(topics.includes("eBay sold averages vs market price"));
  // "When to grade your card" is covered — should NOT be a gap
  assert.equal(topics.includes("When to grade your card"), false);
});

test("findTopicGaps skips H1 (page-title noise) and dedupes across pages", () => {
  const html1 = `<h1>Pricing</h1><h2>Reading the set symbol</h2>`;
  const html2 = `<h1>Grading</h1><h2>Reading the set symbol</h2>`; // duplicate
  const pages = [
    extractCompetitorPage("https://x.com/a", html1),
    extractCompetitorPage("https://x.com/b", html2),
  ];
  const gaps = findTopicGaps(pages, []);
  // Both H1s skipped; only one "Reading the set symbol" gap despite appearing
  // on both pages.
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].topic, "Reading the set symbol");
});

test("findTopicGaps drops trivially-short headings like 'Pricing' or 'FAQ'", () => {
  const html = `<h2>FAQ</h2><h2>Pricing</h2><h2>How to grade a card before submitting</h2>`;
  const page = extractCompetitorPage("https://x.com/x", html);
  const gaps = findTopicGaps([page], []);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].topic, "How to grade a card before submitting");
});

test("renderGapReport groups gaps under their source URL", () => {
  const gaps = [
    { topic: "Topic A", source: "https://x.com/1", normalized: "topic a" },
    { topic: "Topic B", source: "https://x.com/1", normalized: "topic b" },
    { topic: "Topic C", source: "https://x.com/2", normalized: "topic c" },
  ];
  const md = renderGapReport(gaps, ["existing topic"]);
  assert.ok(md.includes("## https://x.com/1"));
  assert.ok(md.includes("## https://x.com/2"));
  assert.ok(md.includes("- Topic A"));
});

test("renderGapReport handles the no-gaps case with positive copy", () => {
  const md = renderGapReport([], ["something"]);
  assert.ok(md.includes("No new gaps found"));
});

test("scrapeCompetitorContent uses the injected fetcher (no network in tests)", async () => {
  const page = await scrapeCompetitorContent(
    "https://example.com/x",
    async () => SAMPLE_HTML,
  );
  assert.equal(page.title, "How to Price Pokemon Cards | PokeScope");
  assert.equal(page.headings.length, 5);
});
