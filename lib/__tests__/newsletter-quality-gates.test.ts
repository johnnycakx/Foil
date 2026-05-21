// Newsletter quality-gates contract tests. These gates are the explicit guard
// against R-001 amplification in the email channel — a positive AND negative
// case per gate so a regression at any one of them fails this file.

import test from "node:test";
import assert from "node:assert/strict";
import {
  extractDollarFigures,
  newDollarFigures,
  runNewsletterQualityGates,
  NEWSLETTER_GATE_LIMITS,
} from "../newsletter/quality-gates.ts";
import type { NewsletterBlogPostInput, NewsletterDraft } from "../newsletter/types.ts";

function passingBlogPost(): NewsletterBlogPostInput {
  return {
    slug: "test-post",
    title: "What a $313 Charizard actually tells you",
    description: "How to read raw vs. graded comps on a Base Set Charizard.",
    content: [
      "The raw Base Set Charizard sold for $313 on eBay this month.",
      "A PSA 10 version of the same card sold for $30,100.",
      "Grading costs $25 per card through PSA's express tier.",
      "Foil's scan data shows 45% of users scan binder pages.",
    ].join("\n\n"),
    tags: ["charizard", "graded-cards"],
  };
}

function passingDraft(): NewsletterDraft {
  const html = [
    "<p>Quick read this week — that $313 Charizard you scrolled past on Marketplace might be a $30,100 PSA 10 candidate.</p>",
    '<p>The grading math: $25 per submission via PSA, return in 8 weeks, sell into a market that hasn\'t cooled.</p>',
    "<p>Foil's scan data this quarter shows where the misreads cluster — set codes and collector numbers, never artwork.</p>",
    '<p><a href="/blog/test-post">Read the full post →</a></p>',
    '<p><a href="https://foiltcg.com/upload">Try Foil free →</a></p>',
  ].join("");
  // Pad to >300 words so the gate passes.
  const filler =
    "Inspect corners, edges, surface, and centering before you commit to a grading submission. " .repeat(40);
  const finalHtml = html + `<p>${filler}</p>`;
  const textBody = finalHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = textBody.split(/\s+/).filter(Boolean).length;
  return {
    subject: "What a $313 Charizard actually tells you", // 41 chars
    previewText: "PSA 10 math: $25 in, $30,100 out, 8 weeks",
    htmlBody: finalHtml,
    textBody,
    wordCount,
    subjectCandidates: [
      "What a $313 Charizard actually tells you",
      "PSA 10 math: $25 in, $30,100 out, 8 weeks",
      "The Charizard you scrolled past on Marketplace",
    ],
  };
}

test("passes when every gate is satisfied", () => {
  const result = runNewsletterQualityGates(passingDraft(), passingBlogPost());
  assert.equal(result.passed, true, `expected pass, got failures: ${result.failures.join("; ")}`);
});

test("gate (a): rejects when word count is below 300", () => {
  const draft = passingDraft();
  draft.textBody = "Short newsletter body.";
  draft.wordCount = 3;
  const result = runNewsletterQualityGates(draft, passingBlogPost());
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.includes("too short")));
});

test("gate (a): rejects when word count exceeds 600", () => {
  const draft = passingDraft();
  draft.wordCount = NEWSLETTER_GATE_LIMITS.wordCountMax + 50;
  const result = runNewsletterQualityGates(draft, passingBlogPost());
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.includes("too long")));
});

test("gate (b): rejects when the blog backlink is missing", () => {
  const draft = passingDraft();
  draft.htmlBody = draft.htmlBody.replace(/\/blog\/test-post/g, "/blog/some-other-slug");
  const result = runNewsletterQualityGates(draft, passingBlogPost());
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.includes("/blog/test-post")));
});

test("gate (c): rejects when no Foil CTA link is present", () => {
  const draft = passingDraft();
  draft.htmlBody = draft.htmlBody
    .replace(/foiltcg\.com\/upload/g, "example.com")
    .replace(/\/upload/g, "/elsewhere");
  draft.textBody = draft.htmlBody.replace(/<[^>]+>/g, " ");
  const result = runNewsletterQualityGates(draft, passingBlogPost());
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.toLowerCase().includes("try foil")));
});

test("gate (d): rejects fabricated dollar figures absent from the blog post (R-001 guard)", () => {
  const blogPost = passingBlogPost();
  const draft = passingDraft();
  // Inject a price NOT in the blog post body
  draft.textBody += " A PSA 9 copy went for $1,200 last week.";
  draft.htmlBody += "<p>A PSA 9 copy went for $1,200 last week.</p>";
  const result = runNewsletterQualityGates(draft, blogPost);
  assert.equal(result.passed, false);
  assert.ok(
    result.failures.some((f) => f.includes("$1,200")),
    `expected fabrication failure to mention $1,200, got: ${result.failures.join(" | ")}`,
  );
});

test("gate (d): allows dollar figures already in the blog post (normalizing commas)", () => {
  const blogPost = passingBlogPost();
  const draft = passingDraft();
  // $30,100 IS in the blog post — newsletter restating it must not fail
  draft.textBody += " That same card hit $30,100 at PSA 10.";
  const result = runNewsletterQualityGates(draft, blogPost);
  assert.equal(result.passed, true);
});

test("gate (e): rejects banned phrases (reuses blog list)", () => {
  const draft = passingDraft();
  draft.textBody += " In conclusion, the upside is real.";
  const result = runNewsletterQualityGates(draft, passingBlogPost());
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.toLowerCase().includes("in conclusion")));
});

test("gate (f): rejects subject under 30 chars", () => {
  const draft = passingDraft();
  draft.subject = "Too short";
  const result = runNewsletterQualityGates(draft, passingBlogPost());
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.includes("Subject too short")));
});

test("gate (f): rejects subject over 65 chars", () => {
  const draft = passingDraft();
  draft.subject = "This is a subject line that is much too long to fit in any inbox preview pane at all";
  const result = runNewsletterQualityGates(draft, passingBlogPost());
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.includes("Subject too long")));
});

test("multiple failures surface together — no early-exit", () => {
  const draft = passingDraft();
  draft.subject = "x"; // gate f
  draft.htmlBody = draft.htmlBody
    .replace(/\/blog\/test-post/g, "/blog/wrong") // gate b
    .replace(/foiltcg\.com\/upload/g, "example.com") // gate c
    .replace(/\/upload/g, "/x");
  draft.textBody += " in conclusion you should buy now"; // gate e
  draft.textBody = draft.htmlBody.replace(/<[^>]+>/g, " ");
  const result = runNewsletterQualityGates(draft, passingBlogPost());
  assert.equal(result.passed, false);
  assert.ok(result.failures.length >= 3, `expected ≥3 concurrent failures, got ${result.failures.length}`);
});

test("extractDollarFigures finds plain + comma'd + decimal forms", () => {
  const text = "Prices: $5, $1,200, $30,100.50, and $0.99 each.";
  const all = extractDollarFigures(text);
  assert.deepEqual(new Set(all), new Set(["$5", "$1,200", "$30,100.50", "$0.99"]));
});

test("newDollarFigures normalizes commas + trailing zeros", () => {
  // "$30,000" in newsletter, "$30000.00" in blog — should be considered same
  const blog = "Reference price $30000.00 here.";
  const newsletter = "Newsletter cites $30,000 as the comp.";
  assert.deepEqual(newDollarFigures(newsletter, blog), []);
});
