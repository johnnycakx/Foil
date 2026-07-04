// Engagement-brief accuracy + targeting regressions (ADR-086 hardening) — the
// two bugs the first live brief exposed (2026-06-30), pinned with the real
// @thelou7789 Moonbreon fixture:
//   (1) WRONG-CARD CITATION (brand-critical): "Moonbreon" must resolve to its
//       EXACT card (swsh7-215) and cite ONLY that row — never the Umbreon-ex
//       ($1,347) row it was fuzzy-matched to. Null over guess when unresolvable.
//   (2) WORTHLESS TARGET: a 0-follower / 3-view author must be filtered out.

import test from "node:test";
import assert from "node:assert/strict";
import { resolveCardSlug, KNOWN_CARDS } from "../engagement/card-resolver.ts";
import { draftReply, type MoverFact } from "../engagement/draft.ts";
import {
  evaluateCandidate,
  opportunityScore,
  publicEngagement,
  isPriceClaim,
  quoteTweetEligible,
} from "../engagement/candidate-filter.ts";
import type { XPost } from "../social/x-client.ts";
import { THELOU7789_MOONBREON, UMBREON_FACTS } from "../__fixtures__/engagement/thelou7789-moonbreon.ts";

// --- exact-card resolution (null over guess) -------------------------------

test('resolveCardSlug: "Moonbreon" resolves to the EXACT card swsh7-215, not a fuzzy Umbreon', () => {
  assert.equal(resolveCardSlug("Just pulled a Moonbreon!")?.slug, "swsh7-215-umbreon-vmax-alt-art");
  assert.equal(resolveCardSlug("is the umbreon vmax alt art worth it")?.slug, "swsh7-215-umbreon-vmax-alt-art");
});

test("resolveCardSlug: a BARE/ambiguous Pokemon name resolves to null (the wrong-card root cause)", () => {
  // "Umbreon" alone could be any of several printings — name is the weakest
  // signal (framework §2), so we refuse to guess.
  assert.equal(resolveCardSlug("how much is my umbreon worth"), null);
  assert.equal(resolveCardSlug("is this charizard a good buy"), null);
  assert.equal(resolveCardSlug("just pulled an umbreon vmax"), null); // ambiguous between VMAX printings
  assert.equal(resolveCardSlug("nothing about a card here"), null);
});

test("resolveCardSlug: other curated chase cards resolve to their exact slug", () => {
  assert.equal(resolveCardSlug("giratina v alt art")?.slug, "swsh11-186-giratina-v-alt-art");
  assert.equal(resolveCardSlug("lugia alt art worth")?.slug, "swsh12-186-lugia-v-alt-art");
  for (const c of KNOWN_CARDS) assert.ok(c.slug && c.aliases.length > 0 && c.displayName);
});

test("resolveCardSlug: the expanded chase cards (Prismatic eeveelutions, DR trainers) resolve exactly WHEN QUALIFIED", () => {
  assert.equal(resolveCardSlug("is the sylveon ex prismatic worth grading")?.slug, "sv8pt5-156-sylveon-ex");
  assert.equal(resolveCardSlug("prismatic leafeon ex")?.slug, "sv8pt5-144-leafeon-ex"); // qualified with "prismatic"
  assert.equal(resolveCardSlug("umbreon ex prismatic worth it")?.slug, "sv8pt5-161-umbreon-ex"); // the Prismatic SIR, distinct from Moonbreon
  assert.equal(resolveCardSlug("team rocket's mewtwo ex price")?.slug, "sv10-231-team-rocket-s-mewtwo-ex");
  assert.equal(resolveCardSlug("mew vmax alt art value")?.slug, "swsh8-269-mew-vmax-alt-art");
});

test("resolveCardSlug: a BARE eeveelution-ex name resolves to null (3a alias hardening — same-name regular arts exist)", () => {
  // "umbreon ex" / "leafeon ex" alone could be the sv8pt5-60-class regular art
  // (a $5 card) OR the -161 SIR (four figures). Refuse to guess — require a
  // prismatic/number/SIR qualifier (the flipped pin: this used to resolve to the SIR).
  assert.equal(resolveCardSlug("umbreon ex worth it"), null);
  assert.equal(resolveCardSlug("how much is leafeon ex"), null);
  assert.equal(resolveCardSlug("is sylveon ex a good buy"), null);
});

test("resolveCardSlug: the new entries don't reintroduce ambiguity — bare multi-printing names still resolve to null", () => {
  assert.equal(resolveCardSlug("how much is charizard ex worth"), null); // many Charizard ex → needs the number
  assert.equal(resolveCardSlug("is pikachu ex a good buy"), null); // many Pikachu ex → needs set/number
  assert.equal(resolveCardSlug("rocket's mewtwo worth"), null); // vintage gym2-14, NOT the DR team-rocket ex
  assert.equal(resolveCardSlug("mew vmax worth it"), null); // ambiguous vs the regular VMAX → needs "alt"
  // A post naming TWO distinct known cards is ambiguous → null (don't guess which to cite).
  // (Both must be resolvable: "umbreon ex prismatic" is qualified post-3a; bare "umbreon ex" is now null.)
  assert.equal(resolveCardSlug("is moonbreon or umbreon ex prismatic the better buy"), null);
  // ...but a single card named two ways (both alias the SAME slug) still resolves.
  assert.equal(resolveCardSlug("moonbreon, the umbreon vmax alt art")?.slug, "swsh7-215-umbreon-vmax-alt-art");
});

// --- wrong-card citation (the brand-critical regression) -------------------

test("draftReply: a Moonbreon post cites swsh7-215 data, and the LLM is NEVER shown the Umbreon-ex row", async () => {
  let seenPrompt = "";
  const res = await draftReply(
    { post: THELOU7789_MOONBREON, facts: UMBREON_FACTS },
    {
      generate: async (prompt) => {
        seenPrompt = prompt;
        return JSON.stringify({ reply: "Recent sold average is around $2,161 over 30 days, n=62. A real hold, not a quick flip.", dataCited: "$2,161 30d avg", confidence: 0.8 });
      },
    },
  );
  assert.equal(res.ok, true);
  assert.ok(res.ok && res.matchedCard.includes("Moonbreon"));
  // The prompt must carry ONLY the resolved card's figures — never Umbreon-ex's $1,347.
  assert.match(seenPrompt, /\$2,161|\$2,256/);
  assert.doesNotMatch(seenPrompt, /\$1,347|Umbreon ex/);
});

test("draftReply: a draft that cites the WRONG card's figure ($1,347 Umbreon-ex) is REJECTED by the gate", async () => {
  const res = await draftReply(
    { post: THELOU7789_MOONBREON, facts: UMBREON_FACTS },
    { generate: async () => JSON.stringify({ reply: "Recent sold average is about $1,347 right now.", dataCited: "$1,347", confidence: 0.9 }) },
  );
  assert.equal(res.ok, false);
  assert.ok(!res.ok && res.reason === "gate_failed" && res.detail === "unsupplied_figure:$1,347");
});

test("draftReply: resolves the card but its data isn't in the facts → SKIP (never substitute another printing)", async () => {
  let called = false;
  const onlyUmbreonEx: MoverFact[] = UMBREON_FACTS.filter((f) => f.slug === "sv8pt5-161-umbreon-ex");
  const res = await draftReply(
    { post: THELOU7789_MOONBREON, facts: onlyUmbreonEx },
    { generate: async () => { called = true; return "{}"; } },
  );
  assert.ok(!res.ok && res.reason === "skip" && res.detail === "resolved_card_no_data");
  assert.equal(called, false, "must skip BEFORE the LLM — never cite the Umbreon-ex row for a Moonbreon post");
});

test("draftReply: a post with no resolvable specific card → SKIP (no numbered claim, null over guess)", async () => {
  const vague = { ...THELOU7789_MOONBREON, id: "vague", text: "how much is my umbreon worth these days" };
  const res = await draftReply({ post: vague, facts: UMBREON_FACTS }, { generate: async () => "{}" });
  assert.ok(!res.ok && res.reason === "skip" && res.detail === "no_card_resolved");
});

// --- target reach (the worthless-target regression) ------------------------

test("evaluateCandidate: the @thelou7789 0-follower / 3-view author is filtered out", () => {
  assert.equal(evaluateCandidate(THELOU7789_MOONBREON, "FoilTCG"), null);
});

test("evaluateCandidate: the SAME post from an account with real reach is kept", () => {
  const reachy = { ...THELOU7789_MOONBREON, authorFollowers: 5000 };
  assert.ok(evaluateCandidate(reachy, "FoilTCG"));
});

test("evaluateCandidate: a low-follower but high-engagement post is kept (reach floor is followers AND public engagement, §2c)", () => {
  const viral = { ...THELOU7789_MOONBREON, authorFollowers: 5, metrics: { likes: 50, replies: 10, reposts: 5, impressions: 0 } };
  assert.ok(evaluateCandidate(viral, "FoilTCG"), "real public engagement clears the floor even with no author-only views");
});

// --- cold-lane fixes: dead views leg, velocity, QT lane (§2c + §3c) --------

const cp = (over: Partial<XPost> = {}): XPost => ({
  id: "1", text: "is this charizard worth it", authorId: "a", authorUsername: "u",
  authorFollowers: 1000, createdAt: "2026-07-03T00:00:00.000Z", metrics: null, ...over,
});

test("publicEngagement: likes + replies + reposts (impressions ignored — they're author-only)", () => {
  assert.equal(publicEngagement(cp({ metrics: { likes: 4, replies: 2, reposts: 1, impressions: 9999 } })), 7);
  assert.equal(publicEngagement(cp({ metrics: null })), 0);
});

test("opportunityScore: a fast-accelerating post outranks a bigger but stale one (velocity term, §3c)", () => {
  const now = Date.parse("2026-07-03T02:00:00.000Z");
  // Fresh (1h old) with strong engagement → high velocity.
  const fast = { post: cp({ id: "fast", createdAt: "2026-07-03T01:00:00.000Z", authorFollowers: 1500, metrics: { likes: 25, replies: 6, reposts: 6, impressions: 0 } }), intentScore: 0.8 };
  // Bigger absolute engagement but 3 days old → velocity ~0.
  const stale = { post: cp({ id: "stale", createdAt: "2026-06-30T02:00:00.000Z", authorFollowers: 1500, metrics: { likes: 60, replies: 20, reposts: 20, impressions: 0 } }), intentScore: 0.8 };
  assert.ok(opportunityScore(fast, now) > opportunityScore(stale, now), "the accelerating post wins the early slot");
});

test("isPriceClaim: detects price/market claims; passes on a plain question", () => {
  assert.equal(isPriceClaim("This just hit $500 raw, insane"), true);
  assert.equal(isPriceClaim("Moonbreon crashed hard this week"), true);
  assert.equal(isPriceClaim("PSA 10 pop is up 30% since the reprint"), true);
  assert.equal(isPriceClaim("what set is this from?"), false);
});

test("quoteTweetEligible: a price-claim post with real reach qualifies; a quiet one does not", () => {
  const claimBig = { post: cp({ text: "Charizard hit $1,200 today", authorFollowers: 5000 }), intentScore: 0.7 };
  const claimQuiet = { post: cp({ text: "Charizard hit $1,200 today", authorFollowers: 10, metrics: { likes: 1, replies: 0, reposts: 0, impressions: 0 } }), intentScore: 0.7 };
  const questionBig = { post: cp({ text: "is charizard worth grading", authorFollowers: 5000 }), intentScore: 0.7 };
  assert.equal(quoteTweetEligible(claimBig), true);
  assert.equal(quoteTweetEligible(claimQuiet), false, "no reach → skip the QT");
  assert.equal(quoteTweetEligible(questionBig), false, "not a price claim → not a QT target");
});
