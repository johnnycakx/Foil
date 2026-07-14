// In-flow receipts tool (x-reply-desk 3d, ADR-107). Pins the pure receipts
// engine + its builders + gates. Network-free: resolve / getFacts / draftProse
// are injected fakes, so the two-lane firewall + figure/hedge gates + the
// null-over-guess modes are exercised without X or the LLM.

import test from "node:test";
import assert from "node:assert/strict";
import { parseTweetRef, buildCardPageUrl, buildReplyIntentUrl, buildQuoteIntentUrl, tweetLength, RECEIPTS_UTM } from "../receipts/intent.ts";
import { getReceiptFacts, receiptAllowedFigures, type ReceiptFactDeps } from "../receipts/facts.ts";
import { validateReceiptsProse, draftReceiptsProse, CLARIFY_LINE, figureFreeReply } from "../receipts/draft.ts";
import { generateReceipts, type ReceiptsEngineDeps } from "../receipts/engine.ts";
import type { MoverRow } from "../deals/market-movers-read.ts";

const ORIGIN = "https://foiltcg.com";

// --- intent + link builders (pure) -----------------------------------------

test("parseTweetRef: canonical status URLs, bare ids, and garbage", () => {
  assert.deepEqual(parseTweetRef("https://x.com/possiblyeve/status/1234567890123"), { id: "1234567890123", username: "possiblyeve" });
  assert.deepEqual(parseTweetRef("https://twitter.com/FoilTCG/status/999?s=20"), { id: "999", username: "FoilTCG" });
  assert.deepEqual(parseTweetRef("1234567890123"), { id: "1234567890123", username: null });
  assert.equal(parseTweetRef("https://x.com/foiltcg")?.id, undefined); // no status id
  assert.equal(parseTweetRef("not a url"), null);
  assert.equal(parseTweetRef(""), null);
});

test("buildCardPageUrl: UTM-tagged card link off the resolved slug", () => {
  const url = buildCardPageUrl("sv8pt5-161-umbreon-ex", { origin: ORIGIN });
  assert.equal(url, "https://foiltcg.com/cards/sv8pt5-161-umbreon-ex?utm_source=x&utm_medium=reply&utm_campaign=receipts");
  assert.match(url, new RegExp(`utm_source=${RECEIPTS_UTM.source}`));
});

test("buildReplyIntentUrl: threads to in_reply_to when a numeric id is present, encodes text", () => {
  const withReply = buildReplyIntentUrl("Recent sold avg $2,161.", "1234567890123");
  assert.match(withReply, /^https:\/\/x\.com\/intent\/post\?in_reply_to=1234567890123&text=/);
  assert.match(withReply, /%242%2C161/); // "$2,161" percent-encoded
  const noReply = buildReplyIntentUrl("hello world");
  assert.equal(noReply, "https://x.com/intent/post?text=hello%20world");
  // A non-numeric id is dropped (never injected into the URL).
  assert.doesNotMatch(buildReplyIntentUrl("hi", "not-an-id" as unknown as string), /in_reply_to/);
});

test("buildQuoteIntentUrl: quotes the status URL and prefills the comment (§3c cold-lane QT)", () => {
  const url = buildQuoteIntentUrl("Sold data says otherwise: $2,161.", "https://x.com/whale/status/999");
  assert.match(url, /^https:\/\/x\.com\/intent\/post\?url=/);
  assert.match(url, /url=https%3A%2F%2Fx\.com%2Fwhale%2Fstatus%2F999/);
  assert.match(url, /text=Sold%20data/);
  assert.doesNotMatch(url, /in_reply_to/); // a QT, not a reply
});

test("tweetLength: a URL counts as 23 (t.co), not its raw length", () => {
  const link = "https://foiltcg.com/cards/sv8pt5-161-umbreon-ex?utm_source=x&utm_medium=reply&utm_campaign=receipts";
  assert.ok(link.length > 90);
  assert.equal(tweetLength(link), 23);
  assert.equal(tweetLength(`abc ${link}`), 4 + 23);
});

// --- facts resolver (movers → snapshot → null) -----------------------------

const MOVER: MoverRow = {
  cardSlug: "sv8pt5-161-umbreon-ex", cardName: "Umbreon ex", setName: "Prismatic Evolutions",
  imageUrl: "", direction: "up", momentumPct: 12, avg7d: 1420, avg30d: 1290, saleCount: 44,
  matchedTier: "NEAR_MINT", computedAt: new Date().toISOString(), soldAsOfIso: null,
};

function factDeps(over: Partial<ReceiptFactDeps> = {}): ReceiptFactDeps {
  return {
    mover: async () => null,
    snapshot: () => null,
    ...over,
  };
}

test("getReceiptFacts: a live mover row wins — carries the 7d/30d spread", async () => {
  const f = await getReceiptFacts("sv8pt5-161-umbreon-ex", "Umbreon ex", factDeps({ mover: async () => MOVER }));
  assert.ok(f.sold);
  assert.equal(f.sold?.source, "movers");
  assert.equal(f.sold?.avgUsd, 1290);
  assert.equal(f.sold?.recentUsd, 1420);
  assert.equal(f.sold?.sampleSize, 44);
});

test("getReceiptFacts: no mover → the committed snapshot (single figure, no spread)", async () => {
  const f = await getReceiptFacts("swsh7-215-umbreon-vmax-alt-art", "Moonbreon", factDeps({
    snapshot: () => ({ soldCents: 221400, saleCount: 27, tierLabel: "Near Mint", source: "ebay" }),
  }));
  assert.equal(f.sold?.source, "snapshot");
  assert.equal(f.sold?.avgUsd, 2214);
  assert.equal(f.sold?.recentUsd, null);
});

test("getReceiptFacts: neither source → sold=null (null over guess), never throws on a mover error", async () => {
  const f = await getReceiptFacts("x", "X", factDeps({ mover: async () => { throw new Error("db down"); } }));
  assert.equal(f.sold, null);
});

test("receiptAllowedFigures: exactly the supplied $ strings", async () => {
  const f = await getReceiptFacts("sv8pt5-161-umbreon-ex", "Umbreon ex", factDeps({ mover: async () => MOVER }));
  const figs = receiptAllowedFigures(f.sold);
  assert.deepEqual([...figs].sort(), ["$1,290", "$1,420"]);
  assert.equal(receiptAllowedFigures(null).size, 0);
});

// --- the figure/hedge gate (reuses validateDraft + voiceCheck) -------------

test("validateReceiptsProse: an in-figure, exact, calm line passes", () => {
  const allowed = new Set(["$1,290", "$1,420"]);
  assert.equal(validateReceiptsProse("Last 30 days it has averaged $1,290 across 44 sales, up to $1,420 this week. A real hold.", allowed), null);
});

test("validateReceiptsProse: an UNSUPPLIED figure is rejected (the wrong-card guard)", () => {
  const allowed = new Set(["$1,290"]);
  const r = validateReceiptsProse("Selling around $1,347 right now.", allowed);
  assert.ok(r && (r.startsWith("unsupplied_figure") || r.startsWith("voice")));
});

test("validateReceiptsProse: a HEDGED number fails via voiceCheck", () => {
  const allowed = new Set(["$1,290"]);
  assert.match(validateReceiptsProse("It sells around $1,290 lately.", allowed) ?? "", /voice/);
});

test("validateReceiptsProse: a link or em dash in the prose is rejected", () => {
  const allowed = new Set(["$1,290"]);
  assert.equal(validateReceiptsProse("$1,290 recent avg foiltcg.com/cards/x", allowed), "contains_link");
  assert.equal(validateReceiptsProse("$1,290 recent avg — a hold", allowed), "em_dash");
});

test("draftReceiptsProse: returns the first gate-clean attempt; null when all fail or skip", async () => {
  const sold = { avgUsd: 1290, recentUsd: 1420, sampleSize: 44, source: "movers" as const, tierLabel: "NEAR_MINT" };
  const allowedFigures = new Set(["$1,290", "$1,420"]);
  const clean = await draftReceiptsProse(
    { context: "worth it?", cardLabel: "Umbreon ex", sold, allowedFigures },
    { generate: async () => JSON.stringify({ reply: "Last 30 days it has averaged $1,290 across 44 sales, $1,420 this past week.", confidence: 0.8 }) },
  );
  assert.match(clean ?? "", /\$1,290/);

  const fabricated = await draftReceiptsProse(
    { context: "worth it?", cardLabel: "Umbreon ex", sold, allowedFigures },
    { generate: async () => JSON.stringify({ reply: "Around $9,999 easy money.", confidence: 0.9 }) },
  );
  assert.equal(fabricated, null);

  const skipped = await draftReceiptsProse(
    { context: "worth it?", cardLabel: "Umbreon ex", sold, allowedFigures },
    { generate: async () => JSON.stringify({ skip: true }) },
  );
  assert.equal(skipped, null);
});

// --- the engine: the three modes -------------------------------------------

function engineDeps(over: Partial<ReceiptsEngineDeps> = {}): ReceiptsEngineDeps {
  return {
    resolve: () => null,
    getFacts: async (slug, displayName) => ({ slug, displayName, sold: null }),
    draftProse: async () => null,
    origin: ORIGIN,
    ...over,
  };
}

test("generateReceipts: unresolvable card → CLARIFY (ask for set/number, no figures, no link)", async () => {
  const r = await generateReceipts({ text: "how much is my umbreon worth", replyToId: "555" }, engineDeps());
  assert.equal(r.mode, "clarify");
  assert.equal(r.reply, CLARIFY_LINE);
  assert.equal(r.cardPageUrl, null);
  assert.deepEqual(r.figuresCited, []);
  assert.match(r.intentUrl, /in_reply_to=555/);
  assert.doesNotMatch(r.reply, /\$\d/);
  assert.doesNotMatch(r.reply, /http/);
});

test("generateReceipts: resolved + figures + clean draft → RECEIPTS (prose + appended card link, threaded)", async () => {
  const r = await generateReceipts(
    { text: "is umbreon ex prismatic worth it", replyToId: "777" },
    engineDeps({
      resolve: () => ({ slug: "sv8pt5-161-umbreon-ex", displayName: "Umbreon ex SIR" }),
      getFacts: async (slug, displayName) => ({ slug, displayName, sold: { avgUsd: 1290, recentUsd: 1420, sampleSize: 44, source: "movers", tierLabel: "NEAR_MINT" } }),
      draftProse: async () => "Last 30 days it has averaged $1,290 across 44 sales, $1,420 this past week.",
    }),
  );
  assert.equal(r.mode, "receipts");
  assert.match(r.reply, /\$1,290/);
  assert.match(r.reply, /foiltcg\.com\/cards\/sv8pt5-161-umbreon-ex\?utm_source=x/);
  assert.deepEqual(r.figuresCited.sort(), ["$1,290", "$1,420"]);
  assert.match(r.intentUrl, /^https:\/\/x\.com\/intent\/post\?in_reply_to=777&text=/);
  assert.ok(tweetLength(r.reply) <= 280);
});

test("generateReceipts: resolved but NO data → FIGURE-FREE (the card link, no numbers)", async () => {
  const r = await generateReceipts(
    { text: "team rocket's mewtwo ex", replyToId: null },
    engineDeps({ resolve: () => ({ slug: "sv10-231-team-rocket-s-mewtwo-ex", displayName: "Team Rocket's Mewtwo ex" }) }),
  );
  assert.equal(r.mode, "figure_free");
  assert.equal(r.reply, figureFreeReply(r.cardPageUrl!));
  assert.doesNotMatch(r.reply, /\$\d/);
  assert.match(r.reply, /foiltcg\.com\/cards\/sv10-231/);
  assert.doesNotMatch(r.intentUrl, /in_reply_to/); // no reply target
});

test("generateReceipts: figures present but every draft attempt fails the gate → FIGURE-FREE (never a bad draft)", async () => {
  const r = await generateReceipts(
    { text: "umbreon ex", replyToId: "1" },
    engineDeps({
      resolve: () => ({ slug: "sv8pt5-161-umbreon-ex", displayName: "Umbreon ex SIR" }),
      getFacts: async (slug, displayName) => ({ slug, displayName, sold: { avgUsd: 1290, recentUsd: null, sampleSize: 44, source: "movers", tierLabel: "NEAR_MINT" } }),
      draftProse: async () => null, // gate rejected every attempt
    }),
  );
  assert.equal(r.mode, "figure_free");
  assert.doesNotMatch(r.reply, /\$\d/);
});

test("generateReceipts: an over-length composed reply degrades to figure-free (never a truncated figure)", async () => {
  const longProse = `Recent sold average is $1,290 exactly. ${"a".repeat(300)}`;
  const r = await generateReceipts(
    { text: "umbreon ex", replyToId: null },
    engineDeps({
      resolve: () => ({ slug: "sv8pt5-161-umbreon-ex", displayName: "Umbreon ex SIR" }),
      getFacts: async (slug, displayName) => ({ slug, displayName, sold: { avgUsd: 1290, recentUsd: null, sampleSize: 44, source: "movers", tierLabel: "NEAR_MINT" } }),
      draftProse: async () => longProse,
    }),
  );
  assert.equal(r.mode, "figure_free");
});
