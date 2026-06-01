// Transcript cleaning tests (ADR-050). Pins the VTT->text dedup + the
// synthesis redaction (R-008 eBay refs + BRAND-VOICE.md AI-tell stripping,
// while PRESERVING market-hype sentiment words that the digest needs).

import test from "node:test";
import assert from "node:assert/strict";
import { cleanVtt, redactForSynthesis } from "../seo/transcript-clean.ts";

// A realistic YouTube auto-sub VTT slice: header, cue timings, inline word
// timing tags on "live" lines, plain rolled-up repeats, HTML entities.
const VTT = `WEBVTT
Kind: captions
Language: en

00:00:00.080 --> 00:00:02.310 align:start position:0%

Are<00:00:00.400><c> you</c><00:00:00.480><c> ready</c><00:00:00.800><c> to</c><00:00:01.040><c> buy?</c>

00:00:02.310 --> 00:00:02.320 align:start position:0%
Are you ready to buy?


00:00:02.320 --> 00:00:05.269 align:start position:0%
Are you ready to buy?
&gt;&gt; Moonbreon<00:00:03.040><c> is</c><00:00:03.120><c> going</c><00:00:03.520><c> to</c><00:00:03.760><c> skyrocket.</c>`;

test("cleanVtt strips header/timestamps/tags and dedups rolling repeats", () => {
  const out = cleanVtt(VTT);
  const lines = out.split("\n");
  assert.equal(lines[0], "Are you ready to buy?");
  assert.equal(lines[1], ">> Moonbreon is going to skyrocket.");
  assert.equal(lines.length, 2, `expected 2 deduped lines, got ${lines.length}: ${JSON.stringify(lines)}`);
  assert.doesNotMatch(out, /WEBVTT|-->|<c>|<00:/);
  assert.doesNotMatch(out, /&gt;/); // entities decoded
});

test("redactForSynthesis strips URLs + eBay refs but KEEPS hype sentiment", () => {
  const text = "Grab it at https://ebay.com/itm/123456 before it skyrockets to the moon.";
  const out = redactForSynthesis(text, ["to the moon", "delve"]);
  assert.doesNotMatch(out, /ebay|https?:\/\//i, "URL + eBay ref must be removed (R-008)");
  // "to the moon" is in the ban list here -> stripped; but "skyrockets" (hype,
  // NOT in ban list) is preserved as digest signal.
  assert.match(out, /skyrockets/, "market-hype words stay (digest signal)");
});

test("redactForSynthesis removes BRAND-VOICE AI-tell phrases", () => {
  const out = redactForSynthesis("Let me delve into this tapestry of cards.", ["delve", "tapestry"]);
  assert.doesNotMatch(out, /delve|tapestry/i);
});
