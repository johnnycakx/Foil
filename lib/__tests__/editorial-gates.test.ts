// ADR-080: the editorial quality gates — the structural enforcement of the
// blueprint (Why / Call / Signature / Volume-honesty / POV / Hype+em-dash /
// Length / Subject) + the two honesty gates (Figures-trace / Causal-hedge).
// A passing fixture + a negative case per gate.

import test from "node:test";
import assert from "node:assert/strict";
import { runEditorialGates, MIN_SALE_VOLUME } from "../newsletter/editorial-gates.ts";
import type { EditorialIssue } from "../newsletter/editorial-engine.ts";
import type { DigestModel, DigestCardModel } from "../newsletter/movers-digest.ts";

function card(over: Partial<DigestCardModel>): DigestCardModel {
  return {
    name: "Whimsicott VSTAR",
    set: "Brilliant Stars",
    momentumPct: -10,
    moveWords: "down 10%",
    arrow: "down",
    avg7dUsd: "$1.42",
    avg30dUsd: "$1.57",
    saleCount: 97,
    browseUrl: "https://www.ebay.com/sch/i.html?_nkw=x&campid=5339154326",
    ...over,
  };
}

const MODEL: DigestModel = {
  subject: "x",
  previewText: "x",
  dateLine: "June 28, 2026",
  down: [
    card({}),
    card({ name: "Tinkaton ex", set: "Paldea Evolved", momentumPct: -18, moveWords: "down 18%", avg7dUsd: "$3.05", avg30dUsd: "$3.71", saleCount: 11 }),
  ],
  up: [
    card({ name: "Charizard ex", set: "Obsidian Flames", arrow: "up", momentumPct: 19, moveWords: "up 19%", avg7dUsd: "$24.10", avg30dUsd: "$20.30", saleCount: 412 }),
  ],
  leadMagnetUrl: "https://foiltcg.com/free/pokemon-card-pricing-cheat-sheet",
};

// A complete, blueprint-faithful issue that passes every gate.
function passingIssue(): EditorialIssue {
  return {
    subject: "Whimsicott just quietly dropped 10%",
    open: "Quiet week up top, busy week underneath. The big chase cards barely budged, but the mid-tier churned. Mostly post-regional settling, and that drift is where the buys are.",
    bigMove: {
      cardName: "Whimsicott VSTAR",
      body: "Whimsicott VSTAR slid to $1.42, down 10% from its $1.57 month-average, on a healthy 97 sales, so this is real demand cooling, not one weird listing. The likely culprit: the deck it anchored fell out of the regional meta after last weekend. At under a buck-fifty I'd grab clean NM copies now. Not much floor left, and a single tournament result swings it back up.",
    },
    coolingPicks: [
      {
        cardName: "Tinkaton ex",
        body: "Tinkaton ex shows a scary 18% drop to $3.05, but read the fine print: only 11 sales drove that. That is two cheap listings dragging the average, not a market move. No catalyst I can find. I'd ignore the percentage and watch the floor. Right now it is just noise.",
      },
    ],
    heatingPicks: [
      {
        cardName: "Charizard ex",
        body: "Charizard ex is up 19% to $24.10 on heavy volume, 412 sales. Feels like the usual Charizard tax plus a creator opening spree. Honest read: when a card runs this hard, you're buying the top, not the dip. I'd let it cool and don't chase here.",
      },
    ],
    sellersNote: "One thing the price feed won't show: the spread between listed and sold is widening on mid-tier ex cards. As someone moving these every week, that is the tell. Sellers haven't repriced to the new floor. If you're buying, make offers.",
    theRead: "Cooling board, soft buy side. If I had $50 to deploy this week: a couple clean Whimsicott VSTAR at $1.42 and hold the rest. Skip Heating Up.",
    oneMoreThing: "Quick poll: what are you watching right now? Hit reply with one card and a price. I read every one.",
    signoff: "That's the read. See you next week. John.",
  };
}

const SHORT = { wordMin: 50 }; // the fixture is complete but compact; isolate non-length gates

test("a blueprint-faithful issue passes every editorial gate", () => {
  const r = runEditorialGates(passingIssue(), MODEL, SHORT);
  assert.deepEqual(r.failures, []);
  assert.equal(r.passed, true);
});

test("Why-gate: a pick with numbers but no named cause fails", () => {
  const issue = passingIssue();
  // No causal keyword (keeps a verdict + hedge so only the Why-gate fires).
  issue.coolingPicks[0].body = "Tinkaton ex went to $3.05. I'd ignore it, my read is to wait.";
  const r = runEditorialGates(issue, MODEL, SHORT);
  assert.ok(r.failures.some((f) => /Why-gate.*Tinkaton/.test(f)));
});

test("Call-gate: a pick with no verdict fails", () => {
  const issue = passingIssue();
  issue.heatingPicks[0].body = "Charizard ex is up 19% to $24.10 on 412 sales. Feels like the usual Charizard tax plus a creator opening spree. The set is back in front of people.";
  const r = runEditorialGates(issue, MODEL, SHORT);
  assert.ok(r.failures.some((f) => /Call-gate.*Charizard/.test(f)));
});

test("Signature-segment gate: a missing Seller's Note or $50 call fails", () => {
  const a = passingIssue();
  a.sellersNote = "";
  assert.ok(runEditorialGates(a, MODEL, SHORT).failures.some((f) => /Signature-segment.*Seller/.test(f)));
  const b = passingIssue();
  b.theRead = "Cooling board, soft buy side. Hold everything for next week.";
  assert.ok(runEditorialGates(b, MODEL, SHORT).failures.some((f) => /\$50/.test(f)));
});

test("Volume-honesty gate: a thin-volume move with no noise caveat fails", () => {
  const issue = passingIssue();
  // Tinkaton has 11 sales (< MIN_SALE_VOLUME); present it as a real move, no caveat.
  issue.coolingPicks[0].body = "Tinkaton ex fell 18% to $3.05, a clean cooldown driven by an oversupplied market. I'd grab NM copies here, my read is this snaps back.";
  assert.ok(MODEL.down[1].saleCount < MIN_SALE_VOLUME);
  const r = runEditorialGates(issue, MODEL, SHORT);
  assert.ok(r.failures.some((f) => /Volume-honesty.*Tinkaton/.test(f)));
});

test("POV gate: a voiceless issue (no first person) fails", () => {
  const issue = passingIssue();
  // Strip every first-person marker from every field.
  const deI = (s: string) => s.replace(/\bI'd\b/g, "one would").replace(/\bI\b/g, "we").replace(/I'm/g, "we are").replace(/I read/g, "we read");
  issue.open = deI(issue.open);
  issue.bigMove.body = deI(issue.bigMove.body);
  issue.coolingPicks[0].body = deI(issue.coolingPicks[0].body);
  issue.heatingPicks[0].body = deI(issue.heatingPicks[0].body);
  issue.sellersNote = deI(issue.sellersNote).replace(/as someone/gi, "for sellers");
  issue.theRead = deI(issue.theRead);
  issue.oneMoreThing = deI(issue.oneMoreThing);
  issue.signoff = deI(issue.signoff);
  const r = runEditorialGates(issue, MODEL, SHORT);
  assert.ok(r.failures.some((f) => /POV gate/.test(f)));
});

test("Hype/em-dash gate: an em dash or a banned hype word fails", () => {
  const a = passingIssue();
  a.open = a.open + " This one is going to the moon.";
  assert.ok(runEditorialGates(a, MODEL, SHORT).failures.some((f) => /Hype\/em-dash/.test(f)));
  const b = passingIssue();
  b.open = "Quiet week up top — busy week underneath.";
  assert.ok(runEditorialGates(b, MODEL, SHORT).failures.some((f) => /em dash/.test(f)));
});

test("Length gate: under the floor + an over-long pick both fail (real bounds)", () => {
  const issue = passingIssue();
  const r = runEditorialGates(issue, MODEL); // real bounds: the compact fixture is < 850 words
  assert.ok(r.failures.some((f) => /Length gate.*under the 850/.test(f)));
  const long = passingIssue();
  // A regular (cooling) pick over 110 words fails; the Big Move has a higher cap.
  long.coolingPicks[0].body = Array.from({ length: 130 }, (_, i) => `word${i}`).join(" ") + " Only 11 sales, noise. I'd ignore, my read is wait.";
  assert.ok(runEditorialGates(long, MODEL, SHORT).failures.some((f) => /over 110/.test(f)));
  // And an over-long Big Move (> 200) fails its own cap.
  const longBig = passingIssue();
  longBig.bigMove.body = Array.from({ length: 210 }, (_, i) => `word${i}`).join(" ") + " I'd buy, likely a reprint, my read.";
  assert.ok(runEditorialGates(longBig, MODEL, SHORT).failures.some((f) => /Big Move.*over 200/.test(f)));
});

test("Subject-line gate: too long / hype / missing the Big Move card all fail", () => {
  const a = passingIssue();
  a.subject = "This week the market did a lot of interesting things across the whole board";
  assert.ok(runEditorialGates(a, MODEL, SHORT).failures.some((f) => /Subject-line/.test(f)));
  const b = passingIssue();
  b.subject = "Pikachu is going to skyrocket";
  assert.ok(runEditorialGates(b, MODEL, SHORT).failures.some((f) => /Subject-line.*hype|Subject-line.*Big Move/.test(f)));
});

test("Figures-trace gate (honesty): a $ figure not in the supplied data fails", () => {
  const issue = passingIssue();
  issue.bigMove.body = issue.bigMove.body + " Some sellers are even asking $999 for sealed copies.";
  const r = runEditorialGates(issue, MODEL, SHORT);
  assert.ok(r.failures.some((f) => /Figures-trace.*\$999/.test(f)));
});

test("Causal-hedge gate (honesty): a cause stated as hard fact (no hedge) fails", () => {
  const issue = passingIssue();
  // Names a cause with a verdict but zero hedging language → asserts it as fact.
  issue.coolingPicks[0].body = "Tinkaton ex fell to $3.05 because of the Paldea Evolved reprint that flooded supply. Only 11 sales, pure noise. I'd ignore it and watch the floor.";
  const r = runEditorialGates(issue, MODEL, SHORT);
  assert.ok(r.failures.some((f) => /Causal-hedge.*Tinkaton/.test(f)));
});
