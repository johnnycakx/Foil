// Content-intelligence: format-mining + keep-the-soul gate (ADR-087).
//
// Pins the three closure-required behaviors:
//   1. Engagement-RATE outlier ranking — a small account punching above its
//      weight outranks a big account with MORE absolute engagement (absolute
//      likes would invert it — the failure mode the goal calls out).
//   2. A generated post that violates the brand voice OR cites wrong/fabricated
//      data is REJECTED by the keep-the-soul gate (never returned/shipped).
//   3. Reuse-not-rebuild — the mining path reuses the read-only searchRecent
//      boundary + the card-resolver + the figures helpers, not re-implementations.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { XPost } from "../social/x-client.ts";
import {
  engagementRate,
  rankOutliers,
  extractPatterns,
  runFormatMiningSweep,
  buildExtractionPrompt,
  type Outlier,
  type MinedPattern,
  type FormatCardData,
} from "../engagement/format-mining.ts";
import {
  validateFormatPost,
  generateFormatPost,
  buildFormatPrompt,
} from "../social/format-generation.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function post(over: Partial<XPost> & { id: string }): XPost {
  return {
    id: over.id,
    text: over.text ?? "Pokemon card pull today",
    authorId: over.authorId ?? "a",
    authorUsername: over.authorUsername ?? "someone",
    authorFollowers: over.authorFollowers ?? 1000,
    createdAt: over.createdAt ?? "2026-06-30T00:00:00.000Z",
    metrics: over.metrics ?? { likes: 0, replies: 0, reposts: 0, impressions: null },
  };
}

// --- 1. Engagement-RATE outlier ranking ------------------------------------

test("ranks by engagement RATE, not absolute likes — small account punching above its weight wins", () => {
  // Big account: MORE absolute engagement (250) but a huge audience (200k).
  const big = post({
    id: "big",
    text: "charizard alt art pull, pokemon tcg",
    authorUsername: "bigaccount",
    authorFollowers: 200_000,
    metrics: { likes: 200, replies: 30, reposts: 20, impressions: null }, // 250 total
  });
  // Small account: LESS absolute engagement (200) but a tiny audience (1k).
  const small = post({
    id: "small",
    text: "my umbreon moonbreon pokemon card finally arrived",
    authorUsername: "smallaccount",
    authorFollowers: 1_000,
    metrics: { likes: 150, replies: 25, reposts: 25, impressions: null }, // 200 total
  });

  // Absolute engagement would rank `big` first; rate must rank `small` first.
  assert.ok(big.metrics!.likes + big.metrics!.replies + big.metrics!.reposts > small.metrics!.likes + small.metrics!.replies + small.metrics!.reposts);
  assert.ok(engagementRate(small) > engagementRate(big));

  const ranked = rankOutliers([big, small], {});
  assert.equal(ranked[0].post.id, "small", "the engagement-rate outlier ranks first");
  assert.equal(ranked[1].post.id, "big");
});

test("drops noise: below the absolute-engagement floor, off-topic, retweets, and our own posts", () => {
  const tiny = post({ id: "tiny", text: "pokemon card", authorFollowers: 5, metrics: { likes: 4, replies: 0, reposts: 0, impressions: null } }); // 4 < floor 20
  const offTopic = post({ id: "off", text: "just had a great lunch today", metrics: { likes: 5000, replies: 100, reposts: 100, impressions: null } });
  const rt = post({ id: "rt", text: "RT @someone: pokemon charizard worth a lot", metrics: { likes: 500, replies: 0, reposts: 0, impressions: null } });
  const own = post({ id: "own", text: "pokemon tcg deal of the day charizard", authorUsername: "FoilTCG", metrics: { likes: 80, replies: 0, reposts: 0, impressions: null } });
  const keep = post({ id: "keep", text: "charizard pokemon card pull", authorFollowers: 2000, metrics: { likes: 60, replies: 10, reposts: 10, impressions: null } });

  const ranked = rankOutliers([tiny, offTopic, rt, own, keep], { ownUsername: "FoilTCG" });
  assert.deepEqual(ranked.map((o) => o.post.id), ["keep"]);
});

test("the follower floor stops a near-zero-follower post from manufacturing an infinite rate", () => {
  const zero = post({ id: "z", text: "pokemon card", authorFollowers: 0, metrics: { likes: 40, replies: 0, reposts: 0, impressions: null } });
  // 40 / max(0, 200) = 0.2, not 40/0 = Infinity.
  assert.equal(engagementRate(zero), 0.2);
  assert.ok(Number.isFinite(engagementRate(zero)));
});

// --- 2. The keep-the-soul gate rejects voice + honesty violations -----------

const MOONBREON: FormatCardData = {
  slug: "swsh7-215-umbreon-vmax-alt-art",
  cardName: "Umbreon VMAX Alt Art",
  setName: "Evolving Skies",
  avg7dUsd: 2161,
  avg30dUsd: 2256,
  momentumPct: -4,
  saleCount: 142,
};

test("accepts a clean, on-data, correct-card post", () => {
  const clean = "Umbreon VMAX alt art is sitting at a $2,161 7-day sold average right now, with 142 sales behind it. The volume is the read, not the price.";
  assert.equal(validateFormatPost(clean, MOONBREON), null);
});

test("rejects hype phrasing voiceCheck's banned list misses (insane / must buy)", () => {
  assert.equal(validateFormatPost("Umbreon VMAX alt art is an insane buy right now.", MOONBREON), "hype");
  assert.equal(validateFormatPost("Umbreon VMAX alt art, you must buy this right now.", MOONBREON), "hype");
});

test("rejects an em dash (brand voice gate 12)", () => {
  const r = validateFormatPost("Umbreon VMAX alt art sits at a $2,161 average right now — worth a look.", MOONBREON);
  assert.ok(r && r.includes("em_dash"), `expected em_dash rejection, got ${r}`);
});

test("rejects a FABRICATED figure — only this card's real averages may be cited", () => {
  const r = validateFormatPost("Umbreon VMAX alt art just hit a $999 sold average right now.", MOONBREON);
  assert.equal(r, "unsupplied_figure:$999");
});

test("rejects a WRONG card — a mined hook can never pull in a different chase card", () => {
  const sylveon: FormatCardData = { slug: "sv8pt5-156-sylveon-ex", cardName: "Sylveon ex", setName: "Prismatic Evolutions", avg7dUsd: 90, avg30dUsd: 95, momentumPct: 3, saleCount: 60 };
  // The post names "Moonbreon" (swsh7-215) while our data is Sylveon (sv8pt5-156).
  const r = validateFormatPost("Moonbreon keeps climbing this week. Worth watching how the chase cards move.", sylveon);
  assert.equal(r, "wrong_card:swsh7-215-umbreon-vmax-alt-art");
});

test("rejects a link in the body (the link is a threaded reply, not the body)", () => {
  assert.equal(validateFormatPost("Umbreon VMAX alt art at $2,161 right now, see foiltcg.com/deals for the sales.", MOONBREON), "contains_link");
});

test("rejects an over-length post", () => {
  const long = "Umbreon VMAX alt art ".repeat(20);
  assert.equal(validateFormatPost(long, MOONBREON), "over_280");
});

const PATTERN: MinedPattern = {
  hook: "open with a single bold number",
  format: "three short beats, blank line between each",
  angle: "price reality-check on a chase card",
  lengthBucket: "medium",
  mediaType: "image",
  cta: "soft question that invites a reply",
  whyItWorks: "a concrete number stops the scroll",
  sourcePostId: "x1",
  sourceRate: 0.3,
};

test("generateFormatPost retries past a hype draft and returns the first gate-valid one", async () => {
  let calls = 0;
  const drafts = [
    "Umbreon VMAX alt art is an insane must buy right now.", // hype → rejected
    "Umbreon VMAX alt art sits at a $2,161 7-day sold average right now across 142 sales. The volume is the read.", // clean
  ];
  const res = await generateFormatPost(PATTERN, MOONBREON, {
    generate: async () => drafts[calls++] ?? "",
    maxAttempts: 3,
  });
  assert.ok(res, "expected a gate-valid post");
  assert.match(res!.text, /\$2,161/);
  assert.equal(calls, 2, "retried once past the hype draft");
});

test("generateFormatPost returns null when the model can never pass the gate (no unvalidated post escapes)", async () => {
  const res = await generateFormatPost(PATTERN, MOONBREON, {
    generate: async () => "Umbreon VMAX alt art is an insane guaranteed must buy right now.",
    maxAttempts: 3,
  });
  assert.equal(res, null);
});

test("buildFormatPrompt carries the container (pattern) and the soul (exact figures + card)", () => {
  const { system, user } = buildFormatPrompt(PATTERN, MOONBREON);
  assert.match(system, /no em dash/i);
  assert.match(user, /open with a single bold number/); // the hook (container)
  assert.match(user, /\$2,161/); // the real figure (soul)
  assert.match(user, /Umbreon VMAX Alt Art/); // the exact card (soul)
});

// --- 3. Pattern extraction + orchestration ---------------------------------

function outlier(id: string, rate: number, text = "pokemon charizard pull"): Outlier {
  return { post: post({ id, text }), totalEngagement: 100, followers: 1000, engagementRate: rate };
}

test("extractPatterns keeps valid patterns, drops hook-less ones, and validates provenance", async () => {
  const outliers = [outlier("real1", 0.42), outlier("real2", 0.21)];
  const model = JSON.stringify([
    { hook: "bold number first", format: "three beats", angle: "reality check", lengthBucket: "medium", mediaType: "image", cta: "ask", whyItWorks: "concrete", sourcePostId: "real1" },
    { hook: "", format: "two beats", angle: "x" }, // no hook → dropped
    { hook: "story open", format: "narrative", angle: "collection", lengthBucket: "long", mediaType: "none", cta: "", whyItWorks: "", sourcePostId: "HALLUCINATED" },
  ]);
  const patterns = await extractPatterns(outliers, { generate: async () => model });
  assert.equal(patterns.length, 2, "the hook-less pattern is dropped");
  // Real provenance carries the real rate.
  assert.equal(patterns[0].sourcePostId, "real1");
  assert.equal(patterns[0].sourceRate, 0.42);
  // A hallucinated source id is stripped (can't fabricate provenance) → rate 0.
  assert.equal(patterns[1].sourcePostId, "");
  assert.equal(patterns[1].sourceRate, 0);
});

test("extractPatterns soft-fails to [] on unparseable model output, and [] on no outliers", async () => {
  assert.deepEqual(await extractPatterns([outlier("a", 0.1)], { generate: async () => "not json" }), []);
  assert.deepEqual(await extractPatterns([], { generate: async () => "[]" }), []);
});

test("extractPatterns SALVAGES complete patterns from a TRUNCATED array (the prod patterns:0 bug)", async () => {
  // The model hit its token cap mid-object: two complete patterns, then a third
  // cut off with no closing brace/bracket. A whole-array JSON.parse throws; the
  // salvage must still recover the two complete ones (not return zero).
  const truncated =
    '```json\n[\n' +
    '  { "hook": "bold number first", "format": "three beats", "angle": "reality check", "lengthBucket": "medium", "mediaType": "image", "cta": "ask", "whyItWorks": "concrete", "sourcePostId": "real1" },\n' +
    '  { "hook": "story open", "format": "narrative", "angle": "collection", "lengthBucket": "long", "mediaType": "none", "cta": "", "whyItWorks": "", "sourcePostId": "real2" },\n' +
    '  { "hook": "this one got cut off by the token limit and never clos';
  const patterns = await extractPatterns([outlier("real1", 0.4), outlier("real2", 0.2)], { generate: async () => truncated });
  assert.equal(patterns.length, 2, "the two complete patterns are salvaged despite the truncation");
  assert.equal(patterns[0].hook, "bold number first");
  assert.equal(patterns[1].sourcePostId, "real2");
});

test("buildExtractionPrompt forbids verbatim copying and asks for the transferable mechanics", () => {
  const p = buildExtractionPrompt([outlier("a", 0.5, "some viral pokemon post")]);
  assert.match(p, /CONTAINER, NOT THE CONTENT/i);
  assert.match(p, /NEVER return a verbatim post/i);
});

test("runFormatMiningSweep wires read → rank → extract → generate, soft-failing a bad query", async () => {
  const good = [
    post({ id: "p1", text: "charizard pokemon pull", authorFollowers: 1500, metrics: { likes: 90, replies: 10, reposts: 10, impressions: null } }),
    post({ id: "p2", text: "umbreon moonbreon pokemon card", authorFollowers: 3000, metrics: { likes: 200, replies: 20, reposts: 20, impressions: null } }),
  ];
  const patterns: MinedPattern[] = [PATTERN, { ...PATTERN, angle: "second pattern" }];
  const card: FormatCardData = MOONBREON;

  let generateCalls = 0;
  const result = await runFormatMiningSweep({
    queries: ["q-good", "q-throws"],
    search: async (q) => {
      if (q === "q-throws") throw new Error("rate limited");
      return good;
    },
    extract: async () => patterns,
    getCardData: async () => [card],
    generatePost: async (pattern, data) => {
      generateCalls++;
      // First pattern generates; second returns null (gate couldn't pass).
      return pattern.angle === "second pattern" ? null : { pattern, data, text: "Umbreon VMAX alt art at $2,161 right now." };
    },
    maxGenerated: 3,
  });

  assert.equal(result.scanned, 2, "dedup + soft-failed the throwing query");
  assert.ok(result.outliers.length >= 1);
  assert.equal(result.patterns.length, 2);
  assert.equal(result.generated.length, 1, "only the gate-valid generation is kept");
  assert.equal(generateCalls, 2);
});

test("runFormatMiningSweep generates nothing when there is no real card data (no soul → no post)", async () => {
  const result = await runFormatMiningSweep({
    queries: ["q"],
    search: async () => [post({ id: "p", text: "charizard pokemon pull", metrics: { likes: 60, replies: 10, reposts: 10, impressions: null } })],
    extract: async () => [PATTERN],
    getCardData: async () => [], // no movers → no figures to cite
    generatePost: async () => {
      throw new Error("must not be called without card data");
    },
  });
  assert.equal(result.generated.length, 0);
});

// --- 4. Reuse-not-rebuild (structural) --------------------------------------

test("format-mining reuses the read-only X boundary type, not a re-implemented client", () => {
  const src = readFileSync(join(ROOT, "lib/engagement/format-mining.ts"), "utf8");
  assert.match(src, /import type \{ XPost \} from "\.\.\/social\/x-client\.ts"/, "reuses the x-client XPost type");
  // No bespoke fetch to the X API — reads are the injected searchRecent boundary.
  assert.doesNotMatch(src, /api\.x\.com/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
});

test("format-generation reuses the card-resolver and the figures helpers, not copies of them", () => {
  const src = readFileSync(join(ROOT, "lib/social/format-generation.ts"), "utf8");
  assert.match(src, /resolveCardSlug \} from "\.\.\/engagement\/card-resolver\.ts"/, "reuses the card-resolver");
  assert.match(src, /from "\.\.\/engagement\/draft\.ts"/, "reuses the draft figures + hype helpers");
  assert.match(src, /\bmatchesHype\b/);
  assert.match(src, /\bsuppliedFigures\b/);
  // It must NOT re-declare its own card alias map or its own hype list.
  assert.doesNotMatch(src, /KNOWN_CARDS\s*=/, "no rebuilt card map");
  assert.doesNotMatch(src, /const HYPE\s*=/, "no rebuilt hype list");
});

test("the format-mining cron reuses searchRecent (the single read boundary)", () => {
  const src = readFileSync(join(ROOT, "app/api/cron/format-mining/route.ts"), "utf8");
  assert.match(src, /import \{ searchRecent \} from "@\/lib\/social\/x-client"/);
});
