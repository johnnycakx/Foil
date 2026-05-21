// Pins the contract for docs/newsletter-drafts/{slug}.md — the
// permanent record per ADR-012. The file's shape is what John pastes
// into Beehiiv off-cycle if the email gets lost, so the separator + every
// frontmatter field is load-bearing.

import test from "node:test";
import assert from "node:assert/strict";
import {
  NEWSLETTER_BODY_SEPARATOR,
  serializeNewsletterFile,
} from "../newsletter/file-writer.ts";
import type { NewsletterDraft } from "../newsletter/types.ts";

function sampleDraft(): NewsletterDraft {
  return {
    subject: "The NM/LP gap that costs you 38–45%",
    previewText: "One rounded corner, $180 gone — here's the math",
    htmlBody: '<p>Hey — that $313 Charizard…</p><p><a href="/blog/test">Read →</a></p>',
    textBody: "Hey — that $313 Charizard… Read →",
    wordCount: 412,
    subjectCandidates: [
      "The NM/LP gap that costs you 38–45%",
      "One rounded corner, $180 gone — here's the math",
      "Why sellers miss this NM disqualifier every time",
    ],
  };
}

test("frontmatter contains every required field", () => {
  const out = serializeNewsletterFile({
    blogSlug: "test-post",
    blogTitle: "Near Mint vs Lightly Played",
    blogUrl: "https://foiltcg.com/blog/test-post",
    sourceWordCount: 1499,
    generatedAt: "2026-05-21T23:00:00.000Z",
    topicRationale: "Selected from the Japanese cards pillar. Rank #4 of 12.",
    beehiivStatus: "deferred-manual-paste",
    emailMessageId: "msg_abc123",
    draft: sampleDraft(),
  });

  // YAML opens + closes at column 0
  assert.match(out, /^---\n/);
  assert.match(out, /\n---\n/);

  for (const field of [
    'blogSlug: "test-post"',
    'blogTitle: "Near Mint vs Lightly Played"',
    'blogUrl: "https://foiltcg.com/blog/test-post"',
    "subject:",
    "previewText:",
    "wordCount: 412",
    "sourceWordCount: 1499",
    'generatedAt: "2026-05-21T23:00:00.000Z"',
    'beehiivStatus: "deferred-manual-paste"',
    'emailMessageId: "msg_abc123"',
    "subjectCandidates:",
    "topicRationale: |",
  ]) {
    assert.ok(out.includes(field), `expected frontmatter to include "${field}"`);
  }
});

test("omits emailMessageId when none was provided", () => {
  const out = serializeNewsletterFile({
    blogSlug: "test-post",
    blogTitle: "x",
    blogUrl: "https://foiltcg.com/blog/test-post",
    sourceWordCount: 1000,
    generatedAt: "2026-05-21T23:00:00.000Z",
    topicRationale: "rationale",
    beehiivStatus: "deferred-manual-paste",
    draft: sampleDraft(),
  });
  assert.ok(!out.includes("emailMessageId"), "should not include emailMessageId when undefined");
});

test("body separator is the exact agreed string + appears between frontmatter and body", () => {
  const out = serializeNewsletterFile({
    blogSlug: "x",
    blogTitle: "y",
    blogUrl: "https://foiltcg.com/blog/x",
    sourceWordCount: 1000,
    generatedAt: "2026-05-21T23:00:00.000Z",
    topicRationale: "rationale",
    beehiivStatus: "deferred-manual-paste",
    draft: sampleDraft(),
  });

  // Separator literal stable
  assert.equal(NEWSLETTER_BODY_SEPARATOR, "\n\n## Newsletter body (paste-ready)\n\n");

  // Frontmatter closes BEFORE the separator, body follows immediately AFTER
  const sepIdx = out.indexOf(NEWSLETTER_BODY_SEPARATOR);
  assert.ok(sepIdx > -1, "separator must appear in the output");
  const beforeSep = out.slice(0, sepIdx);
  const afterSep = out.slice(sepIdx + NEWSLETTER_BODY_SEPARATOR.length);
  assert.ok(beforeSep.trim().endsWith("---"), "frontmatter must close immediately before separator");
  assert.ok(afterSep.startsWith("**Subject:**"), `body must start with **Subject:**, got: "${afterSep.slice(0, 40)}"`);
});

test("escapes embedded double quotes so YAML stays parseable", () => {
  const draft = sampleDraft();
  draft.subject = 'A "loaded" subject';
  const out = serializeNewsletterFile({
    blogSlug: "x",
    blogTitle: 'Title with "quotes"',
    blogUrl: "https://foiltcg.com/blog/x",
    sourceWordCount: 1000,
    generatedAt: "2026-05-21T23:00:00.000Z",
    topicRationale: "rationale",
    beehiivStatus: "deferred-manual-paste",
    draft,
  });
  assert.ok(out.includes('blogTitle: "Title with \\"quotes\\""'));
  assert.ok(out.includes('subject: "A \\"loaded\\" subject"'));
});

test("includes the 3 subject candidates as YAML list items", () => {
  const out = serializeNewsletterFile({
    blogSlug: "x",
    blogTitle: "y",
    blogUrl: "https://foiltcg.com/blog/x",
    sourceWordCount: 1000,
    generatedAt: "2026-05-21T23:00:00.000Z",
    topicRationale: "rationale",
    beehiivStatus: "deferred-manual-paste",
    draft: sampleDraft(),
  });
  // All three candidates land in the file
  for (const candidate of sampleDraft().subjectCandidates) {
    assert.ok(out.includes(candidate.replace(/"/g, '\\"')), `missing candidate: ${candidate}`);
  }
});
