// Newsletter draft-generator integration tests. We stub the Anthropic client
// via the ANTHROPIC_API_KEY env + a fake fetch — but a simpler path: drive
// the generator's INTERNAL parser + gates with hand-crafted "model output",
// then exercise the gate retry loop separately.
//
// What this file pins:
//   - parseDraftJson tolerates fenced + unfenced JSON
//   - stripHtml drops tags + decodes a few entities
//   - empty blog post throws NewsletterGenerationFailed without calling Claude
//   - The end-to-end generator wired against a mocked Anthropic respects the
//     3-retry / quality-gate loop

import test from "node:test";
import assert from "node:assert/strict";

process.env.ANTHROPIC_API_KEY ??= "test-key";

import { anthropic } from "../anthropic.ts";
import {
  generateNewsletterDraft,
  NewsletterGenerationFailed,
  parseDraftJson,
  stripHtml,
} from "../newsletter/draft-generator.ts";
import type { NewsletterBlogPostInput } from "../newsletter/types.ts";

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

function passingHtmlBody(): string {
  const filler =
    "Inspect corners, edges, surface, and centering before you commit to a grading submission. " .repeat(40);
  return [
    "<p>Quick read this week: that $313 Charizard you scrolled past on Marketplace might be a $30,100 PSA 10 candidate.</p>",
    '<p>The grading math: $25 per submission via PSA, return in 8 weeks, sell into a market that hasn\'t cooled.</p>',
    "<p>Foil's scan data this quarter shows where the misreads cluster: set codes and collector numbers, never artwork.</p>",
    '<p><a href="/blog/test-post">Read the full post →</a></p>',
    '<p><a href="https://foiltcg.com/upload">Try Foil free →</a></p>',
    `<p>${filler}</p>`,
  ].join("");
}

function modelJsonResponse(opts: {
  subjects?: string[];
  htmlBody?: string;
}): string {
  const subjects = opts.subjects ?? [
    "What a $313 Charizard actually tells you",
    "PSA 10 math: $25 in, $30,100 out, 8 weeks",
    "The Charizard you scrolled past on Marketplace",
  ];
  const htmlBody = opts.htmlBody ?? passingHtmlBody();
  return "```json\n" + JSON.stringify({ subjects, htmlBody }) + "\n```";
}

type Capture = { calls: number };

function installFakeAnthropic(responses: string[]): Capture {
  const cap: Capture = { calls: 0 };
  const client = anthropic();
  // Patch the singleton's messages.create directly. The lib/anthropic.ts
  // singleton is the same instance the draft-generator pulls — patching here
  // overrides the network call without touching production code.
  (client as unknown as { messages: { create: unknown } }).messages = {
    create: async () => {
      const text = responses[cap.calls] ?? responses[responses.length - 1] ?? "";
      cap.calls++;
      return { content: [{ type: "text", text }] };
    },
  };
  return cap;
}

test("parseDraftJson tolerates ```json fence", () => {
  const text = "```json\n" + JSON.stringify({ subjects: ["abc"], htmlBody: "<p>x</p>" }) + "\n```";
  const parsed = parseDraftJson(text);
  assert.equal(parsed.subjects[0], "abc");
  assert.equal(parsed.htmlBody, "<p>x</p>");
});

test("parseDraftJson tolerates bare object", () => {
  const text = JSON.stringify({ subjects: ["abc"], htmlBody: "<p>x</p>" });
  const parsed = parseDraftJson(text);
  assert.equal(parsed.subjects[0], "abc");
});

test("parseDraftJson throws on missing htmlBody", () => {
  assert.throws(() => parseDraftJson(JSON.stringify({ subjects: ["abc"] })));
});

test("parseDraftJson throws on missing subjects", () => {
  assert.throws(() => parseDraftJson(JSON.stringify({ htmlBody: "<p>x</p>" })));
});

test("stripHtml removes tags + decodes basic entities", () => {
  const out = stripHtml('<p>Hello <strong>world</strong>&nbsp;&amp; goodbye.</p>');
  assert.equal(out, "Hello world & goodbye.");
});

test("generateNewsletterDraft rejects empty blog post WITHOUT calling Claude", async () => {
  const cap = installFakeAnthropic([]);
  await assert.rejects(
    () => generateNewsletterDraft({ slug: "x", title: "", description: "", content: "" }),
    NewsletterGenerationFailed,
  );
  assert.equal(cap.calls, 0);
});

test("generateNewsletterDraft happy path — 300-600 words, blog link present, Foil CTA present", async () => {
  installFakeAnthropic([modelJsonResponse({})]);
  const draft = await generateNewsletterDraft(passingBlogPost());
  assert.ok(draft.wordCount >= 300 && draft.wordCount <= 600, `word count = ${draft.wordCount}`);
  assert.ok(draft.htmlBody.includes("/blog/test-post"), "missing blog backlink");
  assert.ok(draft.htmlBody.includes("foiltcg.com/upload"), "missing Foil CTA");
  assert.equal(draft.subjectCandidates.length, 3);
});

test("generateNewsletterDraft rejects fabricated dollar figures and retries", async () => {
  // Attempt 1: cites $1,200 — not in the blog post. Gate (d) rejects.
  // Attempt 2: corrected — no $1,200.
  const fabricatedHtml = passingHtmlBody() + "<p>A PSA 9 copy went for $1,200 last week.</p>";
  const cap = installFakeAnthropic([
    modelJsonResponse({ htmlBody: fabricatedHtml }),
    modelJsonResponse({}),
  ]);
  const draft = await generateNewsletterDraft(passingBlogPost());
  assert.ok(!draft.textBody.includes("$1,200"));
  assert.equal(cap.calls, 2, "expected exactly one retry");
});

test("generateNewsletterDraft throws NewsletterGenerationFailed after 3 strikes", async () => {
  const fabricatedHtml = passingHtmlBody() + "<p>A PSA 9 copy went for $1,200 last week.</p>";
  installFakeAnthropic([
    modelJsonResponse({ htmlBody: fabricatedHtml }),
    modelJsonResponse({ htmlBody: fabricatedHtml }),
    modelJsonResponse({ htmlBody: fabricatedHtml }),
  ]);
  await assert.rejects(
    () => generateNewsletterDraft(passingBlogPost()),
    (err: unknown) => {
      assert.ok(err instanceof NewsletterGenerationFailed);
      assert.equal(err.attempts, 3);
      assert.ok(err.lastFailures.some((f) => f.includes("$1,200")));
      return true;
    },
  );
});
