// Engagement-brief engine (ADR-086) — candidate filter, the draft honesty/voice
// gate, and the orchestrator's dedupe / idempotency / soft-fail / draft-budget,
// all with injected fakes (no X, no LLM, no Supabase).

import test from "node:test";
import assert from "node:assert/strict";
import type { XPost } from "../social/x-client.ts";
import { evaluateCandidate, rankCandidates } from "../engagement/candidate-filter.ts";
import { validateDraft, suppliedFigures, usd, type MoverFact } from "../engagement/draft.ts";
import { generateEngagementBrief, type BriefDeps } from "../engagement/brief-engine.ts";
import type { BriefStore } from "../engagement/store.ts";
import { renderEngagementBriefChunks, neutralizeMentions } from "../engagement/render.ts";

function post(over: Partial<XPost> & { id: string; text: string }): XPost {
  return {
    authorId: "a1",
    authorUsername: "someuser",
    authorFollowers: 200, // above the reach floor by default
    createdAt: "2026-06-29T12:00:00.000Z",
    metrics: { likes: 1, replies: 0, reposts: 0, impressions: 100 },
    ...over,
  };
}

const FACTS: MoverFact[] = [
  { slug: "swsh7-215-umbreon-vmax-alt-art", cardName: "Umbreon VMAX (Evolving Skies)", avg7dUsd: 480, avg30dUsd: 520, momentumPct: -8, sampleSize: 140 },
  { slug: "obf-125-charizard-ex", cardName: "Charizard ex (Obsidian Flames)", avg7dUsd: 35, avg30dUsd: 30, momentumPct: 16, sampleSize: 90 },
];

// --- candidate filter ------------------------------------------------------

test("evaluateCandidate: a pokemon buy/value post is a candidate", () => {
  const c = evaluateCandidate(post({ id: "1", text: "Is this Umbreon VMAX worth $400? Should I buy it?" }), "Johnnycakx");
  assert.ok(c && c.intentScore > 0.4);
});

test("evaluateCandidate: off-topic 'worth' (no pokemon signal) is rejected", () => {
  assert.equal(evaluateCandidate(post({ id: "2", text: "Is this stock worth buying right now?" }), "Johnnycakx"), null);
});

test("evaluateCandidate: a pokemon post with no buy/value intent is rejected", () => {
  assert.equal(evaluateCandidate(post({ id: "3", text: "Just pulled a Charizard from my booster, so happy!" }), "Johnnycakx"), null);
});

test("evaluateCandidate: our own account is never targeted", () => {
  assert.equal(evaluateCandidate(post({ id: "4", text: "pokemon card worth checking", authorUsername: "Johnnycakx" }), "Johnnycakx"), null);
});

test("evaluateCandidate: retweets and link-only posts are rejected", () => {
  assert.equal(evaluateCandidate(post({ id: "5", text: "RT @x: pokemon card worth a lot" }), "Johnnycakx"), null);
  assert.equal(evaluateCandidate(post({ id: "6", text: "https://t.co/abc" }), "Johnnycakx"), null);
});

test("rankCandidates: fresher + higher-intent posts rank above stale low-intent", () => {
  const fresh = post({ id: "f", text: "Is this Charizard ex a good buy? worth it? how much value?", createdAt: "2026-06-29T11:30:00.000Z" });
  const stale = post({ id: "s", text: "pokemon card worth?", createdAt: "2026-06-24T00:00:00.000Z" });
  const ranked = rankCandidates([stale, fresh], { ownUsername: "Johnnycakx", nowMs: Date.parse("2026-06-29T12:00:00.000Z") });
  assert.equal(ranked[0].post.id, "f");
});

// --- draft honesty/voice gate ----------------------------------------------

test("validateDraft: a clean numbers-first reply passes", () => {
  assert.equal(validateDraft("Recent sold average sits around $480 over the last week, down from $520. Worth that as a hold, not a flip.", suppliedFigures(FACTS)), null);
});

test("validateDraft: a link is rejected (promo + X throttles links)", () => {
  assert.equal(validateDraft("See sold data at foiltcg.com for $480", suppliedFigures(FACTS)), "contains_link");
});

test("validateDraft: an em dash is rejected (BRAND-VOICE Gate 12)", () => {
  assert.equal(validateDraft("Sold average is $480 — a fair price.", suppliedFigures(FACTS)), "em_dash");
});

test("validateDraft: hype is rejected", () => {
  assert.equal(validateDraft("This is insane, it's going to the moon at $480", suppliedFigures(FACTS)), "hype");
});

test("validateDraft: a fabricated $ figure (not in supplied data) is rejected", () => {
  assert.equal(validateDraft("Recent sold average is about $999 right now", suppliedFigures(FACTS)), "unsupplied_figure:$999");
});

test("suppliedFigures + usd: the allowed set is exactly the real averages", () => {
  const f = suppliedFigures(FACTS);
  assert.ok(f.has(usd(480)) && f.has(usd(520)) && f.has(usd(35)) && f.has(usd(30)));
  assert.ok(!f.has("$999"));
});

// --- orchestrator: dedupe / idempotency / soft-fail / budget ---------------

function fakeStore(seen: string[] = []): { store: BriefStore; marked: string[] } {
  const seenSet = new Set(seen);
  const marked: string[] = [];
  return {
    marked,
    store: {
      seenIds: async (ids) => new Set(ids.filter((id) => seenSet.has(id))),
      markBriefed: async (ids) => {
        marked.push(...ids);
      },
    },
  };
}

const NOW = Date.parse("2026-06-29T12:00:00.000Z");

function okDraft(post: XPost) {
  return Promise.resolve({ ok: true as const, matchedCard: "Umbreon VMAX", reply: `Sold avg ~${usd(480)} this week.`, dataCited: "$480", confidence: 0.8 });
}

test("orchestrator: produces a ranked brief + marks the delivered posts briefed", async () => {
  const { store, marked } = fakeStore();
  const deps: BriefDeps = {
    queries: ["q1", "q2"],
    ownUsername: "Johnnycakx",
    nowMs: NOW,
    store,
    search: async (q) =>
      q === "q1"
        ? [post({ id: "p1", text: "Is this Umbreon VMAX worth buying? how much value?" })]
        : [post({ id: "p2", text: "Charizard ex good buy? worth grading?" })],
    getFacts: async () => FACTS,
    draft: (p) => okDraft(p),
  };
  const brief = await generateEngagementBrief(deps);
  assert.equal(brief.items.length, 2);
  assert.deepEqual(new Set(marked), new Set(["p1", "p2"]));
  assert.ok(brief.items[0].postUrl.startsWith("https://x.com/"));
});

test("orchestrator: idempotent — an already-briefed post is excluded", async () => {
  const { store } = fakeStore(["p1"]);
  const brief = await generateEngagementBrief({
    queries: ["q"],
    ownUsername: "Johnnycakx",
    nowMs: NOW,
    store,
    search: async () => [
      post({ id: "p1", text: "Umbreon VMAX worth it? how much?" }),
      post({ id: "p2", text: "Charizard ex good buy? worth?" }),
    ],
    getFacts: async () => FACTS,
    draft: (p) => okDraft(p),
  });
  assert.deepEqual(brief.items.map((i) => i.postId), ["p2"]);
});

test("orchestrator: dedupes the same post id seen across two queries", async () => {
  const { store } = fakeStore();
  const dup = post({ id: "dup", text: "Umbreon VMAX worth buying? value?" });
  const brief = await generateEngagementBrief({
    queries: ["q1", "q2"],
    ownUsername: "Johnnycakx",
    nowMs: NOW,
    store,
    search: async () => [dup],
    getFacts: async () => FACTS,
    draft: (p) => okDraft(p),
  });
  assert.equal(brief.scanned, 1);
  assert.equal(brief.items.length, 1);
});

test("orchestrator: soft-fail — a throwing query and a failing draft drop only their items", async () => {
  const { store } = fakeStore();
  const brief = await generateEngagementBrief({
    queries: ["boom", "good"],
    ownUsername: "Johnnycakx",
    nowMs: NOW,
    store,
    search: async (q) => {
      if (q === "boom") throw new Error("api down");
      return [
        post({ id: "keep", text: "Umbreon VMAX worth it? value?" }),
        post({ id: "drop", text: "Charizard ex good buy? worth?" }),
      ];
    },
    getFacts: async () => FACTS,
    draft: async (p) => (p.id === "drop" ? { ok: false, reason: "skip" } : okDraft(p)),
  });
  assert.deepEqual(brief.items.map((i) => i.postId), ["keep"]);
});

// --- render + mention-injection guard --------------------------------------

test("neutralizeMentions defangs @everyone/@here and raw mention embeds in untrusted post text", () => {
  const out = neutralizeMentions("hey @everyone and @here check <@123> and <@&456> and <#789>");
  assert.doesNotMatch(out, /@everyone(?!​)/i, "@everyone must be broken");
  assert.doesNotMatch(out, /@here(?!​)/i, "@here must be broken");
  assert.doesNotMatch(out, /<@!?\d+>|<@&\d+>|<#\d+>/, "raw mention embeds must be defanged");
});

test("renderEngagementBriefChunks: chunks stay under the Discord limit + carry the by-hand instruction", () => {
  const items = Array.from({ length: 20 }, (_, i) => ({
    postId: `p${i}`,
    postUrl: `https://x.com/u/status/${i}`,
    postText: "Is this Umbreon VMAX worth buying? ".repeat(3),
    authorUsername: "u",
    matchedCard: "Umbreon VMAX",
    reply: "Sold avg sits near $480 this week, down from $520.",
    dataCited: "$480",
    score: 0.7,
  }));
  const chunks = renderEngagementBriefChunks({ items, scanned: 50, candidates: 30, drafted: 20 }, { dateLabel: "2026-06-29" });
  assert.ok(chunks.length >= 1);
  for (const c of chunks) assert.ok(c.length <= 2000, `chunk too long: ${c.length}`);
  assert.match(chunks[0], /BY HAND/);
});

test("renderEngagementBriefChunks: an empty brief renders no chunks (cron posts a 'nothing today' note)", () => {
  assert.deepEqual(renderEngagementBriefChunks({ items: [], scanned: 0, candidates: 0, drafted: 0 }, { dateLabel: "2026-06-29" }), []);
});

test("orchestrator: respects maxItems (final size cap)", async () => {
  const { store } = fakeStore();
  const many = Array.from({ length: 30 }, (_, i) => post({ id: `m${i}`, text: `Umbreon VMAX worth it? value? #${i}` }));
  const brief = await generateEngagementBrief({
    queries: ["q"],
    ownUsername: "Johnnycakx",
    nowMs: NOW,
    store,
    maxItems: 5,
    search: async () => many,
    getFacts: async () => FACTS,
    draft: (p) => okDraft(p),
  });
  assert.equal(brief.items.length, 5);
});
