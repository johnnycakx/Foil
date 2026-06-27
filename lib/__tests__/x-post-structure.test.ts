// X post quality-gate tests (ADR-074 v2.1 amendment, Fix 3 / 3b). Pins the post
// structure gate used by generatePostText: >=3 beat-separated blocks, a link-free
// body, no em dash, no banned hype, and that the card-hero copy ADDS interpretation
// (does not merely restate the image's three numbers). Plus an integration check
// that the gate actually forces a retry in generatePostText.
//
// (The goal scoped this to lib/social/__tests__; the repo's test runner discovers
// the explicit file list in package.json under lib/__tests__, so it lives here
// with the other social suites.)

import test from "node:test";
import assert from "node:assert/strict";
import { checkPostStructure, splitBeats, bodyHasLink, hasInterpretation } from "../social/post-structure.ts";
import { generatePostText, type PostInput, type DealData } from "../social/post-text.ts";

// The validated deal example (adapted to exact figures — the repo voice gate
// bans "around $N", so "$120 in NM" replaces the goal's "around $120").
const GOOD_DEAL = [
  "Base Set Blastoise just slipped 17% under its own 30-day average.",
  "",
  "The number that matters isn't the 17%. It's the 51 sales behind it.",
  "",
  "One lowball seller is noise. 51 cooling together is a trend.",
  "",
  "$120 in NM right now. Now we watch whether it bounces or keeps sliding.",
].join("\n");

// --- pure helpers ---

test("splitBeats: blank lines separate beats; coupled sentences share a beat", () => {
  assert.equal(splitBeats(GOOD_DEAL).length, 4);
  assert.equal(splitBeats("one line only").length, 1);
  // tightly-coupled sentences on one line = one beat (e.g. noise. + trend.)
  assert.equal(splitBeats("a. b.\n\nc.").length, 2);
});

test("bodyHasLink: detects http(s) URLs and bare foiltcg.com", () => {
  assert.equal(bodyHasLink("see https://foiltcg.com/cards/x"), true);
  assert.equal(bodyHasLink("check foiltcg.com today"), true);
  assert.equal(bodyHasLink("no link here at all"), false);
});

test("hasInterpretation: true when the copy uses volume/signal vocabulary", () => {
  assert.equal(hasInterpretation(GOOD_DEAL), true);
  assert.equal(hasInterpretation("17% off. $120. 51."), false, "a bare number readout adds no interpretation");
});

// --- the gate (card-hero angles: requireBeats) ---

test("checkPostStructure: the validated multi-beat deal post passes the card-hero gate", () => {
  const r = checkPostStructure(GOOD_DEAL, { requireBeats: true });
  assert.deepEqual(r, { ok: true, issues: [] }, JSON.stringify(r));
});

test("checkPostStructure: a dense single-paragraph deal post fails (too few beats)", () => {
  const dense = "Base Set Blastoise slipped 17% under its 30-day average, with 51 sales behind the move, a real trend not one lowball seller, sitting at $120 in NM right now.";
  const r = checkPostStructure(dense, { requireBeats: true });
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /beat-separated/.test(i)), JSON.stringify(r.issues));
});

test("checkPostStructure: a link in the body fails (Fix 3b: link goes in the reply)", () => {
  const withLink = `${GOOD_DEAL}\n\nhttps://foiltcg.com/cards/base1-2-blastoise`;
  const r = checkPostStructure(withLink, { requireBeats: true });
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /link or URL/.test(i)), JSON.stringify(r.issues));
});

test("checkPostStructure: a bare-readout that only restates the numbers fails (no interpretation)", () => {
  // 3 beats, but only the image's three numbers, no interpretation vocabulary.
  const readout = "Blastoise.\n\n17% off.\n\n$120 each, 51 of them.";
  const r = checkPostStructure(readout, { requireBeats: true });
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /restates the numbers/.test(i)), JSON.stringify(r.issues));
});

test("checkPostStructure: em dash and banned hype are rejected (brand voice)", () => {
  const emDash = "Blastoise slipped 17%.\n\nThe 51 sales are the signal — not the percent.\n\n$120 in NM. We watch it.";
  assert.equal(checkPostStructure(emDash, { requireBeats: true }).ok, false, "em dash");
  // "to the moon" is in the enforced BANNED_PHRASES list.
  const hype = "Blastoise slipped 17%.\n\n51 sales behind it, a real trend.\n\nHeaded to the moon. $120 in NM, we watch it.";
  const r = checkPostStructure(hype, { requireBeats: true });
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /banned_phrase/.test(i)), JSON.stringify(r.issues));
});

test("checkPostStructure: non-card-hero angles only require a link-free, clean body (no beats)", () => {
  const ok = "Foil matches condition and language before calling anything a deal.";
  assert.deepEqual(checkPostStructure(ok, { requireBeats: false }), { ok: true, issues: [] });
  // still link-free
  assert.equal(checkPostStructure("Built by a TCGplayer seller. foiltcg.com", { requireBeats: false }).ok, false);
});

// --- integration: the gate forces a retry inside generatePostText ---

const DEAL: DealData = {
  cardName: "Blastoise", setName: "Base Set", slug: "base1-2-blastoise", deltaPct: -16.8,
  soldReference: 120, matchedTier: "NEAR_MINT", saleCount: 51, computedAt: "2026-06-27T00:00:00Z",
  imageUrl: "https://img.example/blastoise.png",
};

test("generatePostText(deal_of_day): rejects a dense/link draft, accepts the beat-structured one", async () => {
  const input: PostInput = { angle: "deal_of_day", date: "June 27, 2026", deal: DEAL };
  let call = 0;
  const generate = async () => {
    call++;
    // attempt 1: dense single paragraph WITH a link → fails beats + link-free.
    return call === 1
      ? "Blastoise slipped 17% under its 30-day average across 51 sales, a real trend. https://foiltcg.com/cards/base1-2-blastoise"
      : GOOD_DEAL;
  };
  const out = await generatePostText(input, { generate });
  assert.equal(out.attempts, 2);
  assert.doesNotMatch(out.text, /foiltcg\.com/, "body is link-free");
  assert.ok(splitBeats(out.text).length >= 3, "the accepted post has >=3 beats");
  assert.equal(out.link, "https://foiltcg.com/cards/base1-2-blastoise", "the link is carried for the reply");
});
