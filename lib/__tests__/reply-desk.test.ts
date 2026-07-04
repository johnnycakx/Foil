// Reply desk (x-reply-desk §1, ADR-107 — the eve-detector). Pins the pure
// classification (data_cite / intake / advisory / human_look), the orchestrator
// (dedupe, self-exclusion, budget, soft-fail), and the claim-once approve core.
// Network-free: X search / facts / LLM / DB / the X poster are all injected fakes.

import test from "node:test";
import assert from "node:assert/strict";
import { draftInboundReply, intakeReply, type InboundPost, type DraftInboundDeps } from "../reply-desk/draft.ts";
import { runReplyDesk } from "../reply-desk/desk.ts";
import { processReplyApproval, type ReplyDeskApproveStore } from "../reply-desk/approve.ts";
import { CLARIFY_LINE } from "../receipts/draft.ts";
import type { ReceiptsEngineDeps } from "../receipts/engine.ts";
import type { XPost } from "../social/x-client.ts";

const ORIGIN = "https://foiltcg.com";

function receiptsDeps(over: Partial<ReceiptsEngineDeps> = {}): ReceiptsEngineDeps {
  return {
    resolve: () => null,
    getFacts: async (slug, displayName) => ({ slug, displayName, sold: null }),
    draftProse: async () => null,
    origin: ORIGIN,
    ...over,
  };
}

function draftDeps(over: Partial<DraftInboundDeps> = {}, receiptsOver: Partial<ReceiptsEngineDeps> = {}): { deps: DraftInboundDeps; hydrated: string[] } {
  const hydrated: string[] = [];
  const deps: DraftInboundDeps = {
    receipts: receiptsDeps(receiptsOver),
    enqueueHydration: async (slug) => { hydrated.push(slug); },
    ...over,
  };
  return { deps, hydrated };
}

const inbound = (over: Partial<InboundPost> = {}): InboundPost => ({
  id: "111", url: "https://x.com/u/status/111", text: "worth it?", authorUsername: "u",
  authorFollowers: 1000, kind: "mention", hasMedia: false, ...over,
});

// --- classification (§3b + §3e + null over guess) --------------------------

test("draftInboundReply: resolved card + figures + clean draft → data_cite (receipts + link)", async () => {
  const { deps } = draftDeps({}, {
    resolve: () => ({ slug: "sv8pt5-161-umbreon-ex", displayName: "Umbreon ex SIR" }),
    getFacts: async (slug, displayName) => ({ slug, displayName, sold: { avgUsd: 1290, recentUsd: null, sampleSize: 44, source: "movers", tierLabel: "NEAR_MINT" } }),
    draftProse: async () => "Last 30 days it has averaged $1,290 across 44 sales.",
  });
  const d = await draftInboundReply(inbound({ text: "is umbreon ex prismatic worth it" }), deps);
  assert.equal(d.mode, "data_cite");
  assert.match(d.reply, /\$1,290/);
  assert.match(d.reply, /foiltcg\.com\/cards\/sv8pt5-161-umbreon-ex\?utm_source=x/);
  assert.equal(d.matchedSlug, "sv8pt5-161-umbreon-ex");
});

test("draftInboundReply: resolved card, NO data → intake (tracking + link) AND enqueues hydration (3b)", async () => {
  const { deps, hydrated } = draftDeps({}, {
    resolve: () => ({ slug: "sv10-231-team-rocket-s-mewtwo-ex", displayName: "Team Rocket's Mewtwo ex" }),
    getFacts: async (slug, displayName) => ({ slug, displayName, sold: null }),
  });
  const d = await draftInboundReply(inbound({ text: "team rocket's mewtwo ex" }), deps);
  assert.equal(d.mode, "intake");
  assert.equal(d.reply, intakeReply(d.cardPageUrl!));
  assert.doesNotMatch(d.reply, /\$\d/);
  assert.deepEqual(hydrated, ["sv10-231-team-rocket-s-mewtwo-ex"]);
});

test("draftInboundReply: unresolvable text, no media → advisory (ask for set/number, null over guess)", async () => {
  const { deps } = draftDeps();
  const d = await draftInboundReply(inbound({ text: "how much is my umbreon worth" }), deps);
  assert.equal(d.mode, "advisory");
  assert.equal(d.reply, CLARIFY_LINE);
  assert.equal(d.matchedSlug, null);
});

test("draftInboundReply: unresolvable text WITH media → human_look (no auto 'couldn't find it', 3e)", async () => {
  const { deps } = draftDeps();
  const d = await draftInboundReply(inbound({ text: "@FoilTCG track this one", hasMedia: true }), deps);
  assert.equal(d.mode, "human_look");
  assert.equal(d.reply, "");
});

// --- orchestrator ----------------------------------------------------------

const xpost = (over: Partial<XPost> = {}): XPost => ({
  id: "1", text: "@FoilTCG worth it?", authorId: "a", authorUsername: "someone",
  authorFollowers: 500, createdAt: new Date().toISOString(), metrics: null, hasMedia: false, ...over,
});

test("runReplyDesk: dedupes across queries, excludes our own posts, drafts + enqueues the rest", async () => {
  const enqueued: unknown[] = [];
  const run = await runReplyDesk({
    queries: ["q1", "q2"],
    ownUsername: "FoilTCG",
    search: async (q) => q === "q1"
      ? [xpost({ id: "1" }), xpost({ id: "2", authorUsername: "FoilTCG" })] // id2 is OUR post → excluded
      : [xpost({ id: "1" }), xpost({ id: "3" })], // id1 dup across queries
    queue: { seenIds: async () => new Set(), enqueue: async (items) => { enqueued.push(...items); return items.length; } },
    draftInbound: async (inb) => ({ mode: "advisory", reply: "ask", matchedCard: null, matchedSlug: null, cardPageUrl: null, dataCited: "" }),
    draftDeps: draftDeps().deps,
  });
  assert.equal(run.scanned, 2, "id1 (deduped) + id3; our own id2 excluded");
  assert.equal(run.drafted, 2);
  assert.equal(enqueued.length, 2);
});

test("runReplyDesk: an already-queued inbound (seenIds) is not re-drafted", async () => {
  let drafts = 0;
  const run = await runReplyDesk({
    queries: ["q"],
    ownUsername: "FoilTCG",
    search: async () => [xpost({ id: "1" }), xpost({ id: "2" })],
    queue: { seenIds: async () => new Set(["1"]), enqueue: async (items) => items.length },
    draftInbound: async () => { drafts++; return { mode: "advisory", reply: "x", matchedCard: null, matchedSlug: null, cardPageUrl: null, dataCited: "" }; },
    draftDeps: draftDeps().deps,
  });
  assert.equal(run.fresh, 1, "id1 already seen → only id2 is fresh");
  assert.equal(drafts, 1);
});

// --- approve core (claim-once, edit, release-on-fail) ----------------------

function fakeStore(initial: { reply?: string; status?: string } = {}): { store: ReplyDeskApproveStore; state: { status: string; reply: string } } {
  const state = { status: initial.status ?? "pending", reply: initial.reply ?? "Recent avg $1,290. foiltcg.com/cards/x" };
  const store: ReplyDeskApproveStore = {
    claimForPosting: async (id) => {
      if (state.status !== "pending") return null;
      state.status = "posting";
      return { post_id: id, reply: state.reply };
    },
    markPosted: async () => { state.status = "posted"; },
    release: async () => { state.status = "pending"; },
    skip: async () => { if (state.status === "pending") { state.status = "skipped"; return { ok: true }; } return { ok: false, status: state.status }; },
    get: async () => ({ status: state.status }),
  };
  return { store, state };
}

test("processReplyApproval: post → API-posts the drafted reply, marks posted, returns the permalink", async () => {
  const { store, state } = fakeStore();
  let posted: { text: string; inReplyToTweetId: string } | null = null;
  const res = await processReplyApproval({
    store, id: "999", action: "post", ownUsername: "FoilTCG",
    post: async (x) => { posted = x; return { ok: true, postId: "42" }; },
  });
  assert.ok(res.ok && res.action === "posted");
  assert.equal((res as { permalink: string }).permalink, "https://x.com/FoilTCG/status/42");
  assert.equal(posted!.inReplyToTweetId, "999", "the reply threads to the inbound tweet");
  assert.equal(state.status, "posted");
});

test("processReplyApproval: a second click is an idempotent no-op (claim-once, never double-posts)", async () => {
  const { store } = fakeStore();
  let posts = 0;
  const post = async () => { posts++; return { ok: true as const, postId: "42" }; };
  const first = await processReplyApproval({ store, id: "1", action: "post", ownUsername: "FoilTCG", post });
  const second = await processReplyApproval({ store, id: "1", action: "post", ownUsername: "FoilTCG", post });
  assert.ok(first.ok);
  assert.ok(!second.ok && (second as { status?: string }).status === "posted");
  assert.equal(posts, 1, "exactly one X post despite two clicks");
});

test("processReplyApproval: Edit override posts the revised text, not the draft", async () => {
  const { store } = fakeStore();
  let sent = "";
  const res = await processReplyApproval({
    store, id: "1", action: "post", text: "My edited reply. foiltcg.com/cards/x", ownUsername: "FoilTCG",
    post: async (x) => { sent = x.text; return { ok: true, postId: "7" }; },
  });
  assert.ok(res.ok);
  assert.equal(sent, "My edited reply. foiltcg.com/cards/x");
});

test("processReplyApproval: an X-post failure releases the claim back to pending (retryable)", async () => {
  const { store, state } = fakeStore();
  const res = await processReplyApproval({
    store, id: "1", action: "post", ownUsername: "FoilTCG",
    post: async () => ({ ok: false, error: "create_post_http_403" }),
  });
  assert.ok(!res.ok && res.error === "create_post_http_403");
  assert.equal(state.status, "pending", "released so the owner can re-approve");
});

test("processReplyApproval: skip marks skipped without any X post", async () => {
  const { store, state } = fakeStore();
  let posts = 0;
  const res = await processReplyApproval({ store, id: "1", action: "skip", ownUsername: "FoilTCG", post: async () => { posts++; return { ok: true, postId: "x" }; } });
  assert.ok(res.ok && res.action === "skipped");
  assert.equal(posts, 0);
  assert.equal(state.status, "skipped");
});
