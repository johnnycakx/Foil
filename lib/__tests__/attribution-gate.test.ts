// Gate 11 (creator attribution discipline, ADR-050) tests.
//
// R-010: the verbatim-copy negative fixture is a real run from an ingested
// PokeRev transcript (docs/transcripts/pokerev/3QyQKoyToDU.txt). The
// unattributed-claim fixtures use the real collective phrasing the gate guards.

import test from "node:test";
import assert from "node:assert/strict";
import {
  unattributedCreatorClaims,
  verbatimTranscriptRun,
  runQualityGates,
} from "../seo/quality-gates.ts";
import type { GeneratedDraft } from "../seo/content-engine-types.ts";

// --- 11a: unattributed creator claims --------------------------------------

test("11a: collective claim with NO named creator fails", () => {
  const hits = unattributedCreatorClaims("Right now, creators are saying Moonbreon is about to spike again.");
  assert.deepEqual(hits, ["creators are saying"]);
});

test("11a: collective phrase WITH a whitelisted creator within 50 chars passes", () => {
  const hits = unattributedCreatorClaims("Creators are saying it is toppy; PokeBeard called it overheated on his June video.");
  assert.deepEqual(hits, [], "a named creator within 50 chars satisfies attribution");
});

test("11a: a properly attributed sentence (no collective phrase) passes", () => {
  const hits = unattributedCreatorClaims("PikaPikaPapa flagged Charizard ex as the set's chase card this month.");
  assert.deepEqual(hits, []);
});

// --- 11b: verbatim transcript overlap (real PokeRev excerpt) ----------------

const REAL_TRANSCRIPT_RUN =
  "In today's video, I'm going to be opening a tier five versus a tier one mystery box. But that's not all, we're also going to be doing a platinum box.";

test("11b: a >25-word verbatim run copied from a transcript is caught", () => {
  const draft = `Here is my intro. ${REAL_TRANSCRIPT_RUN} And then my own analysis follows.`;
  const run = verbatimTranscriptRun(draft, REAL_TRANSCRIPT_RUN);
  assert.ok(run, "expected a verbatim run to be detected");
  assert.ok(run!.split(" ").length >= 26, "the matched run must exceed 25 words");
});

test("11b: synthesized (non-copied) text returns null", () => {
  const draft = "PokeRev opened mystery boxes across several price tiers and compared the pulls; the takeaway for buyers is that tier pricing rarely tracks pull value.";
  assert.equal(verbatimTranscriptRun(draft, REAL_TRANSCRIPT_RUN), null);
});

test("11b: short shared phrases (<=25 words) do not trip the gate", () => {
  assert.equal(verbatimTranscriptRun("opening a tier five mystery box", REAL_TRANSCRIPT_RUN), null);
});

// --- integration through runQualityGates -----------------------------------

function draftWith(body: string): GeneratedDraft {
  return {
    candidate: {} as GeneratedDraft["candidate"],
    slug: "test-post",
    frontmatter: {
      title: "Test Post About Pokemon Card Values 2026 Guide",
      description: "A test description long enough to be a plausible meta description for the post here, padded.",
      date: "2026-06-01",
      tags: ["pokemon"],
      pillar: "pokemon-card-value-calculator",
      primaryKeyword: "pokemon card value",
    },
    body,
    faq: [{ question: "Q?", answer: "A short answer." }],
    wordCount: body.split(/\s+/).length,
  };
}

test("runQualityGates flags an unattributed creator claim (Gate 11a)", () => {
  const result = runQualityGates(draftWith("Lots of value talk. creators are saying this set will moon."), "/blog/x");
  assert.ok(
    result.failures.some((f) => f.includes("Unattributed creator claim") && f.includes("Gate 11a")),
    `expected a Gate 11a failure, got: ${JSON.stringify(result.failures)}`,
  );
});

test("runQualityGates flags verbatim transcript copy when corpus supplied (Gate 11b)", () => {
  const result = runQualityGates(
    draftWith(`Intro line. ${REAL_TRANSCRIPT_RUN} More analysis.`),
    "/blog/x",
    undefined,
    { transcriptCorpus: REAL_TRANSCRIPT_RUN },
  );
  assert.ok(
    result.failures.some((f) => f.includes("Verbatim transcript copy") && f.includes("Gate 11b")),
    `expected a Gate 11b failure, got: ${JSON.stringify(result.failures)}`,
  );
});

test("Gate 11b is skipped when no corpus is supplied (transcripts gitignored)", () => {
  const result = runQualityGates(draftWith(`Intro. ${REAL_TRANSCRIPT_RUN} Outro.`), "/blog/x");
  assert.ok(
    !result.failures.some((f) => f.includes("Gate 11b")),
    "11b must not run without a corpus",
  );
});

// --- Gate 12: em dash HARD, vague-number hedge SOFT (ADR-051) ---------------

test("Gate 12 (HARD): a draft containing an em dash fails", () => {
  const result = runQualityGates(draftWith("The grade jump is real — and worth it on chase cards."), "/blog/x");
  assert.ok(
    result.failures.some((f) => f.includes("em dash") && f.includes("Gate 12")),
    `expected a Gate 12 em-dash failure, got: ${JSON.stringify(result.failures)}`,
  );
});

test("Gate 12: en dashes in numeric ranges do NOT fail (only em dashes do)", () => {
  const result = runQualityGates(draftWith("LP copies trade at $95–$110 against an NM market of $180."), "/blog/x");
  assert.ok(!result.failures.some((f) => f.includes("Gate 12")), "en-dash range must not trip Gate 12");
});

test("hedging stays SOFT: sourced 'approximately $2,100 (PokeTrace n=363)' is NOT gated", () => {
  // The vague-number-hedge detector false-positives on legitimate sourced
  // citations, so it is deliberately NOT a hard gate. A draft hedging a sourced
  // figure (and with no em dash) must produce no em-dash failure and no
  // hedge/vague failure.
  const body = "Raw NM Moonbreon sits at approximately $2,100 (PokeTrace n=363), roughly double the PSA 9.";
  const result = runQualityGates(draftWith(body), "/blog/x");
  assert.ok(!result.failures.some((f) => f.includes("Gate 12")), "no em dash, so no Gate 12 failure");
  assert.ok(
    !result.failures.some((f) => /hedge|vague|approximately/i.test(f)),
    `sourced hedging must not be gated, got: ${JSON.stringify(result.failures)}`,
  );
});
