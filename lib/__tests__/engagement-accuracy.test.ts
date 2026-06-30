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
import { evaluateCandidate } from "../engagement/candidate-filter.ts";
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
  assert.equal(evaluateCandidate(THELOU7789_MOONBREON, "Johnnycakx"), null);
});

test("evaluateCandidate: the SAME post from an account with real reach is kept", () => {
  const reachy = { ...THELOU7789_MOONBREON, authorFollowers: 5000 };
  assert.ok(evaluateCandidate(reachy, "Johnnycakx"));
});

test("evaluateCandidate: a low-follower but viral (high-view) post is kept (reach floor is followers AND views)", () => {
  const viral = { ...THELOU7789_MOONBREON, authorFollowers: 5, metrics: { likes: 50, replies: 10, reposts: 5, impressions: 9000 } };
  assert.ok(evaluateCandidate(viral, "Johnnycakx"));
});
