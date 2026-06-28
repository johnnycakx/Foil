// X threaded-reply tests (ADR-074 v2.2, Fix C / D). Pins the pure reply builder:
// the 80/20 newsletter-CTA rotation (deterministic by dayIndex), the value-framed
// card link otherwise, voice compliance on the reply text, and the board-only
// save-ask split (daily replies never carry a bookmark ask; only the weekly board
// does). Network-free — buildReplyText is pure.
//
// (The goal scoped this to lib/social/__tests__; the runner discovers the explicit
// file list in package.json under lib/__tests__, so it lives here with the others.)

import test from "node:test";
import assert from "node:assert/strict";
import { voiceCheck } from "../seo/voice-check.ts";
import {
  buildReplyText,
  isNewsletterReplyDay,
  NEWSLETTER_REPLY_EVERY,
  NEWSLETTER_URL,
  type PostInput,
  type DealData,
  type SpotlightData,
} from "../social/post-text.ts";

const DEAL: DealData = {
  cardName: "Blastoise", setName: "Base Set", slug: "base1-2-blastoise", deltaPct: -16.8,
  soldReference: 120, matchedTier: "NEAR_MINT", saleCount: 51, computedAt: "2026-06-27T00:00:00Z",
  imageUrl: "https://img/x.png",
};
const SPOT: SpotlightData = { cardName: "Charizard", setName: "Base Set", slug: "base1-4-charizard", soldReference: 350, sampleSize: 168, imageUrl: "https://img/c.png" };

const dealInput: PostInput = { angle: "deal_of_day", date: "June 27, 2026", deal: DEAL };
const spotInput: PostInput = { angle: "price_spotlight", date: "June 27, 2026", spotlight: SPOT };
const eduInput: PostInput = { angle: "educational", date: "June 27, 2026" };
const boardInput: PostInput = { angle: "weekly_board", date: "June 27, 2026", deals: [DEAL] };

const VALUE_DAY = 1; // 1 % 5 !== 0 → value-framed reply
const NEWS_DAY = 5; // 5 % 5 === 0 → newsletter CTA reply

// --- rotation predicate ---

test("isNewsletterReplyDay: every Nth day, defensive on negatives", () => {
  assert.equal(NEWSLETTER_REPLY_EVERY, 5);
  assert.equal(isNewsletterReplyDay(0), true);
  assert.equal(isNewsletterReplyDay(5), true);
  assert.equal(isNewsletterReplyDay(10), true);
  assert.equal(isNewsletterReplyDay(1), false);
  assert.equal(isNewsletterReplyDay(4), false);
  assert.equal(isNewsletterReplyDay(-5), true, "negative day index never throws / stays in cycle");
});

// --- value-framed replies (default ~80% of days) ---

test("deal value reply: a calm utility line + the card link, no CTA, no save ask", () => {
  const r = buildReplyText(dealInput, VALUE_DAY);
  assert.equal(r, "Full sold history and the live listings: https://foiltcg.com/cards/base1-2-blastoise");
  assert.doesNotMatch(r, /newsletter/i, "no newsletter CTA on a value day");
  assert.doesNotMatch(r, /bookmark|save this|like this/i, "daily replies carry no save ask");
});

test("spotlight value reply: the spotlight utility variant + the card link", () => {
  const r = buildReplyText(spotInput, VALUE_DAY);
  assert.equal(r, "Every recent sale and the live listings: https://foiltcg.com/cards/base1-4-charizard");
});

test("educational value reply: points at the board, framed as utility", () => {
  const r = buildReplyText(eduInput, VALUE_DAY);
  assert.match(r, /https:\/\/foiltcg\.com\/deals$/);
  assert.doesNotMatch(r, /bookmark/i);
});

// --- newsletter CTA reply (~20% of days) ---

test("newsletter day: the daily reply is the newsletter CTA (no card link, no save ask)", () => {
  const r = buildReplyText(dealInput, NEWS_DAY);
  assert.match(r, new RegExp(NEWSLETTER_URL.replace(/[.]/g, "\\.")), "links to the newsletter landing");
  assert.match(r, /every Sunday/, "the calm value-first CTA line");
  assert.doesNotMatch(r, /\/cards\//, "the card link is dropped that day (the reply is the CTA)");
  assert.doesNotMatch(r, /bookmark/i);
});

test("the spotlight angle also rotates to the newsletter CTA on a newsletter day", () => {
  assert.equal(buildReplyText(spotInput, NEWS_DAY), buildReplyText(dealInput, NEWS_DAY), "the CTA reply is angle-independent");
});

// --- rotation cadence over a window (80/20) ---

test("rotation cadence: exactly the %5 days are newsletter over 0..14 (3 of 15)", () => {
  let news = 0;
  let value = 0;
  for (let d = 0; d < 15; d++) {
    const r = buildReplyText(dealInput, d);
    if (r.includes("/newsletter")) news++;
    else value++;
  }
  assert.equal(news, 3, "0,5,10 → newsletter");
  assert.equal(value, 12, "the rest → value-framed card link");
});

// --- Fix D: the weekly board carries the ONLY save ask ---

test("weekly_board reply: value-framed board link + the save ask (the only place it appears)", () => {
  const r = buildReplyText(boardInput, NEWS_DAY); // even on a newsletter day, the board keeps its own ask
  assert.match(r, /https:\/\/foiltcg\.com\/deals/);
  assert.match(r, /Bookmark the board/, "the board is the genuinely save-worthy surface");
  assert.doesNotMatch(r, /newsletter/i, "the board does not rotate the newsletter (it has its own ask)");
});

test("the save ask appears on the board reply ONLY, never on a daily reply", () => {
  const daily = [
    buildReplyText(dealInput, VALUE_DAY),
    buildReplyText(dealInput, NEWS_DAY),
    buildReplyText(spotInput, VALUE_DAY),
    buildReplyText(spotInput, NEWS_DAY),
    buildReplyText(eduInput, VALUE_DAY),
    buildReplyText(eduInput, NEWS_DAY),
  ];
  for (const r of daily) assert.doesNotMatch(r, /bookmark|save this|like this|retweet/i, `daily reply must not beg a save: ${r}`);
  assert.match(buildReplyText(boardInput, VALUE_DAY), /Bookmark/);
});

// --- voice + length compliance on every reply variant ---

test("every reply variant obeys the voice rules (no em dash / hype / vague) and fits a tweet", () => {
  const variants = [
    buildReplyText(dealInput, VALUE_DAY),
    buildReplyText(spotInput, VALUE_DAY),
    buildReplyText(eduInput, VALUE_DAY),
    buildReplyText(dealInput, NEWS_DAY),
    buildReplyText(boardInput, VALUE_DAY),
  ];
  for (const r of variants) {
    const vc = voiceCheck(r);
    assert.equal(vc.passed, true, `voice violations in "${r}": ${JSON.stringify(vc.violations)}`);
    assert.ok(r.length <= 280, `reply over 280 chars (${r.length}): ${r}`);
  }
});
