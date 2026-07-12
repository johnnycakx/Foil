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

// Dormant deal-finder posts (still rendered, noindexed) that must stay clean.
const BLOG_SLUGS = [
  "how-much-is-my-pokemon-card-worth-a-60-second-checklist",
  "japanese-sar-vs-english-special-illustration-rare",
  "how-to-read-a-japanese-pokemon-card",
  "near-mint-vs-lightly-played-the-difference-that-doubles-a-card-s-price",
] as const;

// Live vending posts published 2026-06-15 (ADR-063). Each must render 200 with a
// distinctive on-page marker (proves the right BODY rendered, not just a 200) and
// carry none of the FORBIDDEN markers.
const VENDING_BLOG: { slug: string; marker: RegExp }[] = [
  // The marker doubles as the "25 to 45" -> "25 to 40" content-fix proof.
  { slug: "is-a-trading-card-vending-machine-worth-it-for-a-gas-station", marker: /25 to 40/ },
  { slug: "pokemon-card-vending-machine-placement-in-napa", marker: /business locations across Napa/i },
  { slug: "how-vending-machine-revenue-share-hosting-works", marker: /revenue-share hosting means Foil/i },
];

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
  { label: "gas-station pre-fix '25 to 45' age range", re: /25 to 45/ },
  // content-trust-hotfix Defect 3: the Moonbreon (Umbreon VMAX Alt Art, EVS 215)
  // raw NM was undervalued at $180 across a live post (~12x below the sourced
  // ~$2,300). Corrected + globally forbidden so a regression can't re-introduce it.
  { label: "Moonbreon $180 NM undervaluation (Defect 3)", re: /\$180 NM Umbreon/i },
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

for (const { slug, marker } of VENDING_BLOG) {
  test(`live vending post is published + clean: ${slug}`, { skip }, async () => {
    const { status, body } = await fetchText(`${BASE}/blog/${slug}?cv=${Date.now()}`);
    assert.equal(status, 200, `${slug} must return 200 (published into POSTS_DIR)`);
    assert.match(body, marker, `${slug} must render its distinctive on-page marker`);
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

// content-trust-hotfix Defect 3: two OTHER live posts undervalued the same card
// (~12x low). Reconciled to the sourced PokeTrace windowed sold (live 2026-07-08:
// eBay raw NM $2,285 / PSA 9 $2,277 / PSA 10 $4,574; TCG NM $2,240) — which is
// what the checklist post above already showed. This pins that the contradiction
// is resolved on the LIVE render, both directions (correct present, wrong absent).
test("Moonbreon cross-post figures reconciled to the sourced number (Defect 3)", { skip }, async () => {
  const p2 = await fetchText(
    `${BASE}/blog/near-mint-vs-lightly-played-the-difference-that-doubles-a-card-s-price?cv=${Date.now()}`,
  );
  assert.equal(p2.status, 200);
  assert.match(p2.body, /\$2,300 NM Umbreon VMAX alt art/i, "post #2 shows the corrected ~$2,300 Moonbreon NM");
  assert.doesNotMatch(p2.body, /\$180 NM Umbreon/i, "the wrong $180 Moonbreon NM must be gone");

  const p3 = await fetchText(
    `${BASE}/blog/psa-9-vs-psa-10-is-the-200-grading-jump-worth-it?cv=${Date.now()}`,
  );
  assert.equal(p3.status, 200);
  assert.match(p3.body, /Umbreon VMAX Alt Art[\s\S]{0,160}\$4,[456]00/i, "post #3 shows the corrected ~$4,400-$4,600 Moonbreon PSA 10");
  assert.doesNotMatch(
    p3.body,
    /Umbreon VMAX Alt Art \(Evolving Skies\)[\s\S]{0,40}\$175/i,
    "the wrong Umbreon-adjacent $175 PSA 9 figure must be gone (the generic table row is fine)",
  );
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

// validation-sprint Phase 3 (ADR-112), copy re-locked by the 2026-07-11
// offer-lock (ADR-113): the /deals board is gated — top 2 shown, the rest
// locked behind the Pro trial pitch, with the free digest catcher below. The
// gate renders in the SSR HTML in EVERY supply state (0–6 deals/day), so the
// free-catcher line is a stable marker that the re-locked gate shipped.
// Deal-count-specific copy varies daily, so we don't pin it; the honest-degrade
// logic is unit-tested in lib/__tests__/deals-gate.test.ts.
test("/deals renders the re-locked gate (Pro pitch + free catcher live)", { skip }, async () => {
  const { status, body } = await fetchText(`${BASE}/deals?cv=${Date.now()}`);
  assert.equal(status, 200, "/deals must return 200");
  assert.match(
    body,
    /Not ready\? Free gets you 3 watches and the weekly digest\./,
    "the gate's locked free-catcher line must render",
  );
  assert.match(body, /Start your 30-day free trial/, "the gate's Pro trial CTA must render");
  // The board itself still renders its hook (proves the teaser rows, not just the gate).
  assert.match(body, /below sold/i, "the top-2 teaser board still renders");
});

test("content-marker gate is wired (documents the skip when no base URL)", () => {
  // Always runs: makes the gate visible in the offline suite even when skipped.
  assert.ok(
    BLOG_SLUGS.length === 4 && VENDING_BLOG.length === 3 && FORBIDDEN.length >= 5,
    "marker spec must cover the 4 dormant posts + the 3 live vending posts + the fabrication/dead-link markers",
  );
});
