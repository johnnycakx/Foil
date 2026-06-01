// Content-marker live verification (ADR-049). Extends PATTERNS I-006 from
// "HTTP 200" to "the RENDERED CONTENT is actually correct". A 200 OK with the
// wrong rendered content (the R-015 failure: edits landing in a dead dir while
// the live site served stale fabrications) is worse than a 500, because nothing
// flags it.
//
// This is a STANDING CLOSURE-GATE for any goal that touches blog/card content.
// It SKIPS when CONTENT_VERIFY_BASE_URL is unset (so the offline `npm test`
// stays green) and RUNS against the live deploy when set, e.g.:
//   CONTENT_VERIFY_BASE_URL=https://foiltcg.com npm test
//
// The marker spec below is the source of truth for what "correct content"
// means; keep it in sync as fabrications are found/fixed.

import test from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.CONTENT_VERIFY_BASE_URL;
const skip = !BASE;

// Blog posts that must render the corrected, voice-clean content.
const BLOG_SLUGS = [
  "how-much-is-my-pokemon-card-worth-a-60-second-checklist",
  "japanese-sar-vs-english-special-illustration-rare",
  "how-to-read-a-japanese-pokemon-card",
  "near-mint-vs-lightly-played-the-difference-that-doubles-a-card-s-price",
] as const;

// Markers that MUST be ABSENT from every blog post body (fabrications + hedges
// the 47.4 fact-check + V.1 voice pass removed). Regexes tolerate $ / en-dash.
const FORBIDDEN: { label: string; re: RegExp }[] = [
  { label: "Moonbreon $120-140 fabrication", re: /\$120\s*[–-]\s*\$?140/i },
  { label: "vague 'approximately $' hedge", re: /approximately\s*\$?\s?\d/i },
  { label: "vague 'around $' hedge", re: /around\s*\$\s?\d/i },
  { label: "fabricated 'Foil's scan data shows'", re: /Foil's scan data shows/i },
  { label: "dead link /blog/reading-pokemon-card-price-data", re: /\/blog\/reading-pokemon-card-price-data/i },
  { label: "dead link /blog/how-to-read-pokemon-card-collector-numbers", re: /\/blog\/how-to-read-pokemon-card-collector-numbers/i },
  { label: "dead link /blog/how-to-price-pokemon-cards-from-photo", re: /\/blog\/how-to-price-pokemon-cards-from-photo/i },
];

// A sample curated card page must still render (I-006 HTTP layer).
const SAMPLE_CARD_SLUG = "base1-1-alakazam";

async function fetchText(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, { headers: { "user-agent": "foil-content-verify" } });
  return { status: res.status, body: await res.text() };
}

for (const slug of BLOG_SLUGS) {
  test(`live blog post is clean: ${slug}`, { skip }, async () => {
    const { status, body } = await fetchText(`${BASE}/blog/${slug}?cv=${Date.now()}`);
    assert.equal(status, 200, `${slug} must return 200`);
    for (const { label, re } of FORBIDDEN) {
      assert.doesNotMatch(body, re, `${slug} must NOT contain: ${label}`);
    }
  });
}

test("Moonbreon post shows the corrected $2,100 figure", { skip }, async () => {
  const { body } = await fetchText(
    `${BASE}/blog/how-much-is-my-pokemon-card-worth-a-60-second-checklist?cv=${Date.now()}`,
  );
  assert.match(body, /\$2,100/, "the corrected Moonbreon raw figure ($2,100) must be present");
});

test("japanese-sar post is live (was 404 before V.1)", { skip }, async () => {
  const { status } = await fetchText(
    `${BASE}/blog/japanese-sar-vs-english-special-illustration-rare?cv=${Date.now()}`,
  );
  assert.equal(status, 200, "japanese-sar must return 200");
});

test("sample curated card page renders (I-006 HTTP layer)", { skip }, async () => {
  const { status } = await fetchText(`${BASE}/cards/${SAMPLE_CARD_SLUG}?cv=${Date.now()}`);
  assert.equal(status, 200, `card page /cards/${SAMPLE_CARD_SLUG} must return 200`);
});

test("content-marker gate is wired (documents the skip when no base URL)", () => {
  // Always runs: makes the gate visible in the offline suite even when skipped.
  assert.ok(
    BLOG_SLUGS.length === 4 && FORBIDDEN.length >= 5,
    "marker spec must cover the 4 posts + the known fabrication/dead-link markers",
  );
});
