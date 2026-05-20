// Quality-gates contract tests. These are the only safety net between
// Claude's output and a publish-to-main commit in autonomy mode, so every
// gate gets a positive AND negative case.

import test from "node:test";
import assert from "node:assert/strict";
import {
  BANNED_PHRASES,
  bannedPhraseMatches,
  countInternalLinks,
  foilDataCitationCount,
  recentDateMatches,
  runQualityGates,
  uniqueDollarFigures,
} from "../seo/quality-gates.ts";
import type { GeneratedDraft } from "../seo/content-engine-types.ts";

// A draft that passes every gate. Tests mutate copies of this to exercise
// one gate at a time.
function passingDraft(): GeneratedDraft {
  // ~1500 words packed with every signal the gates look for.
  // Build to ~1500 words: filler at ~20 words/repeat × 70 repeats = ~1400
  // words, plus the data-rich postscript below adds ~120 more.
  const filler =
    "This section walks through pricing dynamics, condition impact, grading thresholds, and the buyer psychology behind each price tier. " .repeat(70);

  const body =
    filler +
    "\n\nIn 2026 the market shifted noticeably from 2025 norms. " +
    "A PSA 10 Charizard from Base Set sold for $30,100 on eBay last quarter. " +
    "The raw NM equivalent traded around $1,200. With $25 grading fees per card and a ~40% PSA 10 strike rate, the EV math heavily favors submitting clean copies. " +
    "Foil's scan data across cards processed in the last 30 days shows the median raw grade is roughly PSA 9. " +
    "Across our scans, the typical chase card pulls a $200-$5,400 comp range depending on centering and surface. " +
    "Compare with [Pokémon card condition guide](/pokemon-card-condition-guide) for the full grading walkthrough. " +
    "Also see [Pokémon card value calculator](/pokemon-card-value-calculator) for live prices. " +
    "The 2025 release of Surging Sparks shifted the modern set EV — and the 2026 reprint of Prismatic Evolutions doubled the supply at retail.";

  return {
    candidate: null as unknown as GeneratedDraft["candidate"],
    slug: "test-slug",
    frontmatter: {
      title: "Test Title",
      description: "Test description.",
      date: "2026-05-20",
      tags: ["test"],
      pillar: "pokemon-card-value-calculator",
      primaryKeyword: "test",
    },
    body,
    faq: [
      {
        question: "What is a PSA 10?",
        answer:
          "A PSA 10 is the highest grade — Gem Mint — assigned by Professional Sports Authenticator. Cards in PSA 10 slabs have no visible defects to the eye, centering of roughly 55/45 or better, and crisp corners. The PSA 10 grade commands a steep premium over PSA 9 on chase cards, sometimes 5x to 50x the lower-grade price. The grading service inspects centering, corners, edges, and surface independently before assigning the headline grade.",
      },
      {
        question: "How long does PSA grading take?",
        answer:
          "Standard tier turnaround is roughly 30-45 days, costing about $25 per card. Express tiers cut turnaround to under two weeks for $75 per card. Bulk submissions through a TCGplayer or eBay seller account can drop the per-card fee but require batching 20+ cards at once. Walk-through service at PSA events runs another tier above express.",
      },
      {
        question: "Is BGS better than PSA for Pokemon?",
        answer:
          "PSA still commands the strongest resale premium for Pokémon — buyers default to PSA slabs and pay accordingly. BGS 10 Black Label sits above PSA 10 on vintage but BGS 9.5 generally underprices a PSA 10. CGC has closed the gap on Japanese sets but trails on English vintage. Default to PSA for anything you plan to sell within twelve months.",
      },
    ],
    wordCount: 1500,
  };
}

test("a clean draft passes every gate", () => {
  const result = runQualityGates(passingDraft(), "/blog/test-slug");
  assert.deepEqual(result.failures, []);
  assert.equal(result.passed, true);
});

test("gate (a): rejects under-length body with a specific count", () => {
  const draft = passingDraft();
  draft.body = "short body. ".repeat(50); // ~100 words
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.includes("too short")));
});

test("gate (a): rejects over-length body", () => {
  const draft = passingDraft();
  draft.body = "extra word ".repeat(2500); // 5000 words
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(result.failures.some((f) => f.includes("too long")));
});

test("gate (b): rejects under 5 unique dollar figures", () => {
  const draft = passingDraft();
  // Body with only 2 dollar figures
  draft.body =
    "The card sells for $50. " .repeat(60) +
    "\n\nFoil's scan data covers 30 days. The 2025 set had a PSA 10 worth $200. " +
    "Compare 2026 prices with [the condition guide](/pokemon-card-condition-guide) and [pillar](/pokemon-card-value-calculator).";
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.includes("dollar figures")),
    `failures: ${result.failures.join(" | ")}`,
  );
});

test("uniqueDollarFigures dedupes — $30 mentioned 5 times counts once", () => {
  assert.equal(uniqueDollarFigures("$30 and $30 and $30 and $40").size, 2);
});

test("gate (c): rejects under 2 recent-date citations", () => {
  const draft = passingDraft();
  // Strip out the 2025/2026 mentions
  draft.body =
    "Body text with prices $1, $2, $3, $4, $5. Foil's scan data here. " +
    "[Link1](/a) [Link2](/b)";
  // No 2025/2026 anywhere
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(result.failures.some((f) => f.includes("recent date")));
});

test("recentDateMatches ignores 2025/2026 inside URLs", () => {
  const matches = recentDateMatches(
    "See https://example.com/2026-pricing — current year is mentioned here: 2026",
  );
  // Only the bare "2026" outside the URL should count, but our regex now
  // strips URLs entirely, so 1 match.
  assert.equal(matches.length, 1);
});

test("gate (d): rejects when no Foil-data citation present", () => {
  const draft = passingDraft();
  // Strip every known Foil-data trigger phrase
  draft.body = draft.body
    .replace(/foil's scan data/gi, "industry data")
    .replace(/across our scans/gi, "across the market")
    .replace(/cards processed/gi, "cards reviewed");
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.toLowerCase().includes("foil")),
    `failures: ${result.failures.join(" | ")}`,
  );
});

test("foilDataCitationCount finds all known trigger phrases", () => {
  assert.equal(
    foilDataCitationCount(
      "Foil's scan data shows X. Across our scans, Y. Cards processed last month numbered 500.",
    ),
    3,
  );
});

test("gate (e): rejects when ANY banned phrase appears (case-insensitive)", () => {
  const draft = passingDraft();
  draft.body += "\n\nIN CONCLUSION, this is the summary.";
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.toLowerCase().includes("banned")),
    `failures: ${result.failures.join(" | ")}`,
  );
});

test("bannedPhraseMatches returns every offender so the retry prompt is exhaustive", () => {
  const text = "In conclusion, the world of pokemon is changing. As a collector, you know.";
  const hits = bannedPhraseMatches(text);
  assert.ok(hits.includes("in conclusion"));
  assert.ok(hits.includes("the world of pokemon"));
  assert.ok(hits.includes("as a collector"));
});

test("BANNED_PHRASES list includes every phrase the goal spec names", () => {
  // Pin the exact list so a future refactor can't silently drop one.
  assert.deepEqual([...BANNED_PHRASES], [
    "in conclusion",
    "in summary",
    "as we've seen",
    "in today's digital world",
    "the world of pokemon",
    "as a collector",
  ]);
});

test("gate (g): rejects when FAQ section is under 200 words", () => {
  const draft = passingDraft();
  draft.faq = [{ question: "Q?", answer: "Short." }];
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(result.failures.some((f) => f.includes("FAQ section is too short")));
});

test("gate (h): rejects under 2 internal links", () => {
  const draft = passingDraft();
  // Strip all internal links — replace with external ones (don't count)
  draft.body = draft.body
    .replace(/\[Pokémon card condition guide\]\(\/pokemon-card-condition-guide\)/g, "[external](https://wikipedia.org/Pokemon)")
    .replace(/\[Pokémon card value calculator\]\(\/pokemon-card-value-calculator\)/g, "[external2](https://example.com/x)");
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(result.failures.some((f) => f.includes("internal links")));
});

test("countInternalLinks recognizes markdown, MDX href, and full foiltcg URLs", () => {
  const body = `
[md link](/path-a)
<a href="/path-b">html</a>
<TopicLink href="https://foiltcg.com/path-c">topic</TopicLink>
[external](https://wikipedia.org/x)
[anchor only](#section)
`;
  assert.equal(countInternalLinks(body), 3);
});

test("countInternalLinks dedupes — same href twice counts once", () => {
  const body = `[a](/same) [b](/same) [c](/different)`;
  assert.equal(countInternalLinks(body), 2);
});

test("gate (f): rejects draft with empty headline (schema validation)", () => {
  const draft = passingDraft();
  draft.frontmatter.title = "";
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.toLowerCase().includes("headline")),
    `failures: ${result.failures.join(" | ")}`,
  );
});

test("multiple gate failures all surface in one report (no early-exit)", () => {
  const draft = passingDraft();
  draft.body = "tiny body in conclusion."; // fails word count + banned phrase + dollar figures + ...
  draft.faq = [];
  const result = runQualityGates(draft, "/blog/test-slug");
  // Expect ALL the major gate violations, not just the first one — that's
  // what lets the retry prompt fix everything in one round-trip.
  assert.ok(result.failures.length >= 4);
});
