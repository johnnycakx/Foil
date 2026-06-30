// Engagement-brief engine (ADR-086) — candidate filter, the draft honesty/voice
// gate, and the orchestrator's dedupe / idempotency / soft-fail / draft-budget,
// all with injected fakes (no X, no LLM, no Supabase).

import test from "node:test";
import assert from "node:assert/strict";
import type { XPost } from "../social/x-client.ts";
import { evaluateCandidate, rankCandidates, advisoryEligible } from "../engagement/candidate-filter.ts";
import {
  validateDraft,
  validateAdvisoryDraft,
  draftAdvisoryReply,
  suppliedFigures,
  usd,
  type MoverFact,
} from "../engagement/draft.ts";
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
  const c = evaluateCandidate(post({ id: "1", text: "Is this Umbreon VMAX worth $400? Should I buy it?" }), "FoilTCG");
  assert.ok(c && c.intentScore > 0.4);
});

test("evaluateCandidate: off-topic 'worth' (no pokemon signal) is rejected", () => {
  assert.equal(evaluateCandidate(post({ id: "2", text: "Is this stock worth buying right now?" }), "FoilTCG"), null);
});

test("evaluateCandidate: a pokemon post with no buy/value intent is rejected", () => {
  assert.equal(evaluateCandidate(post({ id: "3", text: "Just pulled a Charizard from my booster, so happy!" }), "FoilTCG"), null);
});

test("evaluateCandidate: our own account is never targeted", () => {
  assert.equal(evaluateCandidate(post({ id: "4", text: "pokemon card worth checking", authorUsername: "FoilTCG" }), "FoilTCG"), null);
});

test("evaluateCandidate: retweets and link-only posts are rejected", () => {
  assert.equal(evaluateCandidate(post({ id: "5", text: "RT @x: pokemon card worth a lot" }), "FoilTCG"), null);
  assert.equal(evaluateCandidate(post({ id: "6", text: "https://t.co/abc" }), "FoilTCG"), null);
});

test("rankCandidates: fresher + higher-intent posts rank above stale low-intent", () => {
  const fresh = post({ id: "f", text: "Is this Charizard ex a good buy? worth it? how much value?", createdAt: "2026-06-29T11:30:00.000Z" });
  const stale = post({ id: "s", text: "pokemon card worth?", createdAt: "2026-06-24T00:00:00.000Z" });
  const ranked = rankCandidates([stale, fresh], { ownUsername: "FoilTCG", nowMs: Date.parse("2026-06-29T12:00:00.000Z") });
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

// --- advisory mode (value-first, figure-free, spam-safe) -------------------

test("advisoryEligible: only high-reach candidates qualify for a no-data advisory reply", () => {
  const big = { post: post({ id: "b", text: "x", authorFollowers: 5000 }), intentScore: 0.6 };
  const small = { post: post({ id: "s", text: "x", authorFollowers: 100, metrics: { likes: 0, replies: 0, reposts: 0, impressions: 50 } }), intentScore: 0.6 };
  const viral = { post: post({ id: "v", text: "x", authorFollowers: 10, metrics: { likes: 0, replies: 0, reposts: 0, impressions: 5000 } }), intentScore: 0.6 };
  assert.equal(advisoryEligible(big), true, "real audience qualifies");
  assert.equal(advisoryEligible(small), false, "low followers AND low views does not");
  assert.equal(advisoryEligible(viral), true, "low followers but viral views qualifies");
});

test("validateAdvisoryDraft: a clean, helpful, figure-free reply passes", () => {
  assert.equal(
    validateAdvisoryDraft("Condition matters more than the hype here. Buy the cleanest copy you can find and hold it. Foil tracks recent sold data if you want to check real prices first."),
    null,
  );
});

test("validateAdvisoryDraft: ANY dollar figure is rejected (advisory is figure-free by design)", () => {
  assert.equal(validateAdvisoryDraft("It is worth about $120 right now in my honest view."), "advisory_has_figure");
});

test("validateAdvisoryDraft: a promo / cold-outreach spam pattern is rejected", () => {
  assert.equal(validateAdvisoryDraft("Check out my page, it lists every deal you could possibly want today."), "spam_pattern");
  assert.equal(validateAdvisoryDraft("DM me and I will help you find the best ones for cheap right now."), "spam_pattern");
});

test("validateAdvisoryDraft: a bare link is rejected (the cold-reply spam-flag risk)", () => {
  assert.equal(validateAdvisoryDraft("The best place to compare is foiltcg.com for live sold data on everything."), "contains_link");
});

test("validateAdvisoryDraft: the shared voice bar still applies (em dash, hype)", () => {
  assert.equal(validateAdvisoryDraft("Buy the cleanest copy you can find — condition beats hype every single time here."), "em_dash");
  assert.equal(validateAdvisoryDraft("This one is going to the moon, grab it now before it runs away from you."), "hype");
});

test("draftAdvisoryReply: a value-first reply is labelled advisory and carries no figure/data", async () => {
  const res = await draftAdvisoryReply(
    { post: post({ id: "a", text: "Getting back into pokemon after years, what should I buy? worth it?" }) },
    { generate: async () => JSON.stringify({ reply: "Start with sealed from a set you actually like, condition beats hype. Foil tracks recent sold data so you can see what things really sell for before buying.", mentionsFoil: true, confidence: 0.6 }) },
  );
  assert.ok(res.ok && res.mode === "advisory", "advisory mode");
  assert.ok(res.ok && res.dataCited === "" && res.matchedCard === "", "no card / no data cited");
});

test("draftAdvisoryReply: a draft that sneaks in a $ figure is gate-rejected (no wrong-card risk possible)", async () => {
  const res = await draftAdvisoryReply(
    { post: post({ id: "a", text: "what pokemon should I buy? worth it" }) },
    { generate: async () => JSON.stringify({ reply: "Moonbreon sells around $2,100 these days, a solid long-term hold in my view.", confidence: 0.8 }) },
  );
  assert.ok(!res.ok && res.reason === "gate_failed" && res.detail === "advisory_has_figure");
});

test("draftAdvisoryReply: the model can SKIP a post it can't usefully help", async () => {
  const res = await draftAdvisoryReply(
    { post: post({ id: "a", text: "what pokemon should I buy? worth it" }) },
    { generate: async () => JSON.stringify({ skip: true }) },
  );
  assert.ok(!res.ok && res.reason === "skip");
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
  return Promise.resolve({ ok: true as const, mode: "data_cite" as const, matchedCard: "Umbreon VMAX", reply: `Sold avg ~${usd(480)} this week.`, dataCited: "$480", confidence: 0.8 });
}

test("orchestrator: produces a ranked brief + marks the delivered posts briefed", async () => {
  const { store, marked } = fakeStore();
  const deps: BriefDeps = {
    queries: ["q1", "q2"],
    ownUsername: "FoilTCG",
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
    ownUsername: "FoilTCG",
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
    ownUsername: "FoilTCG",
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
    ownUsername: "FoilTCG",
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

test("orchestrator: produces BOTH data-cite and advisory items, each labelled by mode", async () => {
  const { store } = fakeStore();
  const dc = post({ id: "dc", text: "is the moonbreon worth it? how much value?", authorFollowers: 300 });
  const adv = post({ id: "adv", text: "getting back into pokemon, what should I buy? worth it?", authorFollowers: 5000 });
  const brief = await generateEngagementBrief({
    queries: ["q"],
    ownUsername: "FoilTCG",
    nowMs: NOW,
    store,
    search: async () => [dc, adv],
    getFacts: async () => FACTS,
    // data-cite succeeds for dc; for adv it can't resolve a card → skip.
    draft: async (p) =>
      p.id === "dc"
        ? { ok: true, mode: "data_cite", matchedCard: "Moonbreon", reply: `Sold avg ~${usd(480)}.`, dataCited: "$480", confidence: 0.8 }
        : { ok: false, reason: "skip", detail: "no_card_resolved" },
    draftAdvisory: async () => ({ ok: true, mode: "advisory", matchedCard: "", reply: "Buy sealed from a set you like, condition beats hype.", dataCited: "", confidence: 0.6 }),
  });
  const byId = Object.fromEntries(brief.items.map((i) => [i.postId, i]));
  assert.equal(byId.dc?.mode, "data_cite");
  assert.equal(byId.adv?.mode, "advisory");
  assert.equal(byId.adv?.dataCited, "", "advisory items carry no data citation");
});

test("orchestrator: a LOW-reach post with no resolvable card is dropped (advisory is high-reach only)", async () => {
  const { store } = fakeStore();
  let advisoryCalled = false;
  const lowReach = post({ id: "low", text: "what pokemon card should I buy? worth it?", authorFollowers: 100, metrics: { likes: 0, replies: 0, reposts: 0, impressions: 50 } });
  const brief = await generateEngagementBrief({
    queries: ["q"],
    ownUsername: "FoilTCG",
    nowMs: NOW,
    store,
    search: async () => [lowReach],
    getFacts: async () => FACTS,
    draft: async () => ({ ok: false, reason: "skip", detail: "no_card_resolved" }),
    draftAdvisory: async () => {
      advisoryCalled = true;
      return { ok: true, mode: "advisory", matchedCard: "", reply: "x".repeat(20), dataCited: "", confidence: 0.5 };
    },
  });
  assert.equal(brief.items.length, 0, "no advisory for a low-reach generic post");
  assert.equal(advisoryCalled, false, "advisory drafter never called for a low-reach candidate");
});

test("orchestrator: advisory is a FALLBACK — never invoked when data-cite succeeds", async () => {
  const { store } = fakeStore();
  let advisoryCalled = false;
  const brief = await generateEngagementBrief({
    queries: ["q"],
    ownUsername: "FoilTCG",
    nowMs: NOW,
    store,
    search: async () => [post({ id: "dc", text: "moonbreon worth it? how much value?", authorFollowers: 8000 })],
    getFacts: async () => FACTS,
    draft: async () => ({ ok: true, mode: "data_cite", matchedCard: "Moonbreon", reply: `Sold avg ~${usd(480)}.`, dataCited: "$480", confidence: 0.8 }),
    draftAdvisory: async () => {
      advisoryCalled = true;
      return { ok: false, reason: "skip" };
    },
  });
  assert.equal(brief.items[0]?.mode, "data_cite");
  assert.equal(advisoryCalled, false, "data-cite success means advisory is not attempted");
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
    mode: "data_cite" as const,
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
    ownUsername: "FoilTCG",
    nowMs: NOW,
    store,
    maxItems: 5,
    search: async () => many,
    getFacts: async () => FACTS,
    draft: (p) => okDraft(p),
  });
  assert.equal(brief.items.length, 5);
});
