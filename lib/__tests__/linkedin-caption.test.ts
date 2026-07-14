// LinkedIn paste-rail caption pins (linkedin-page-syndication goal).
//
// The load-bearing guarantees: the caption is voice-clean (John's banked rules:
// NO em dashes, "chasing" never "hunting"), ends with the exact UTM link shape
// the acquisition readout groups by, and stays under the readability cap. The
// channel itself is pinned human_only in syndication-channels.test.ts.

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLinkedInCaption,
  buildLinkedInLink,
  sanitizeCampaign,
  sweepVoice,
} from "../social/linkedin-caption.ts";

test("caption never contains an em dash, even when the source does", () => {
  const { caption } = buildLinkedInCaption({
    slug: "test-post",
    title: "PSA 10 prices — the real story",
    description: "Grading maths changed in 2026 — here is what sold data shows — with receipts.",
  });
  assert.ok(!caption.includes("—"), "em dash must be swept");
  assert.ok(!caption.includes("–"), "en dash must be swept");
  assert.ok(caption.includes("PSA 10 prices, the real story"));
});

test("hunting → chasing on word boundaries only (no substring false positives)", () => {
  assert.equal(sweepVoice("Stop hunting deals; the hunt is over. Hunting pays."), "Stop chasing deals; the chase is over. Chasing pays.");
  assert.equal(sweepVoice("Hunter's guide to Shrunting"), "Hunter's guide to Shrunting");
});

test("UTM link shape is pinned exactly (runbook convention)", () => {
  const link = buildLinkedInLink("psa-9-vs-psa-10");
  assert.equal(
    link,
    "https://foiltcg.com/blog/psa-9-vs-psa-10?utm_source=linkedin&utm_medium=social&utm_campaign=psa-9-vs-psa-10",
  );
});

test("caption ends with the UTM link (the measurable part can't be trimmed away)", () => {
  const { caption, link } = buildLinkedInCaption({
    slug: "some-post",
    title: "A title",
    description: "A description.",
  });
  assert.ok(caption.endsWith(link));
});

test("campaign sanitization: lowercase, [a-z0-9-] only, 64-char cap", () => {
  assert.equal(sanitizeCampaign("My_Post Slug!!"), "my-post-slug");
  assert.equal(sanitizeCampaign("a".repeat(80)).length, 64);
  assert.equal(sanitizeCampaign("--double--dashes--"), "double-dashes");
});

test("caption is hard-capped at 1200 chars and trims the description at a sentence", () => {
  const longDescription = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} about sold prices.`).join(" ");
  const { caption, link } = buildLinkedInCaption({
    slug: "long-post",
    title: "A long one",
    description: longDescription,
  });
  assert.ok(caption.length <= 1200, `caption was ${caption.length} chars`);
  assert.ok(caption.endsWith(link), "link survives the trim");
});

test("caption is first-person and sold-price framed (the fixed closer line)", () => {
  const { caption } = buildLinkedInCaption({
    slug: "x",
    title: "T",
    description: "D.",
  });
  assert.ok(caption.includes("I built Foil"));
  assert.ok(caption.includes("Sold prices, not asking prices"));
  assert.ok(!/\bhunt/i.test(caption));
});
