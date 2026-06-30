// Engagement-brief Skip/Post button tests (ADR-086 v2). The buttons live in the
// bot because only an app-owned message can carry working components. The
// load-bearing guarantees pinned here:
//   - the "Post" button NEVER posts to X — it surfaces copy-ready text + a deep
//     link (the firewall; the no-X-call is also pinned by the repo-level
//     zero-X-write invariant test that reads handler.ts as source);
//   - the owner gate is fail-closed;
//   - Skip records idempotently;
//   - the drain posts every undelivered item and marks it (soft-fail per item).

import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCustomId, parseEngagementButtonId, buildEngagementButtons } from "../engagement/buttons.ts";
import { recordDecision, type BriefItemRow } from "../engagement/queue.ts";
import { handleEngagementButton, drainAndPostOnce, type ButtonHandlerDeps } from "../engagement/handler.ts";

// --- custom_id build / parse (the validation boundary) ---------------------

test("parseEngagementButtonId: valid ids parse; foreign / malformed return null", () => {
  assert.deepEqual(parseEngagementButtonId("eng:skip:123"), { action: "skip", postId: "123" });
  assert.deepEqual(parseEngagementButtonId("eng:post:456"), { action: "post", postId: "456" });
  assert.equal(parseEngagementButtonId("approve:draft:7"), null, "another handler's button");
  assert.equal(parseEngagementButtonId("eng:nope:123"), null, "unknown action");
  assert.equal(parseEngagementButtonId("eng:skip:notanid"), null, "non-numeric post id rejected");
  assert.equal(parseEngagementButtonId("eng:skip:123:extra"), null, "wrong arity");
  assert.equal(parseEngagementButtonId(""), null);
});

test("buildCustomId round-trips through parse", () => {
  assert.equal(buildCustomId("post", "999"), "eng:post:999");
  assert.deepEqual(parseEngagementButtonId(buildCustomId("skip", "42")), { action: "skip", postId: "42" });
});

test("buildEngagementButtons: a row with a Post + Skip button carrying our custom_ids", () => {
  const json = buildEngagementButtons("123").toJSON();
  const ids = json.components.map((c) => (c as { custom_id?: string }).custom_id);
  assert.ok(ids.includes("eng:post:123"), "has the Post button");
  assert.ok(ids.includes("eng:skip:123"), "has the Skip button");
});

// --- recordDecision idempotency (the learning signal) ----------------------

/** Minimal chainable Supabase fake modelling the gated update used by
 *  recordDecision: update(...).eq(post_id).is(decision, null).select(post_id).
 *  A second decision on an already-decided row flips zero rows. */
function fakeDecisionClient(initial: Record<string, string | null> = {}) {
  const decisions: Record<string, string | null> = { ...initial };
  const client = {
    from() {
      let payload: { decision?: string } = {};
      let postId = "";
      let requireNull = false;
      const builder = {
        update(p: { decision?: string }) {
          payload = p;
          return builder;
        },
        eq(_col: string, val: string) {
          postId = val;
          return builder;
        },
        is(_col: string, _v: null) {
          requireNull = true;
          return builder;
        },
        select(_cols: string) {
          const cur = decisions[postId] ?? null;
          if (requireNull && cur !== null) return Promise.resolve({ data: [], error: null });
          decisions[postId] = payload.decision ?? cur;
          return Promise.resolve({ data: [{ post_id: postId }], error: null });
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, decisions };
}

test("recordDecision: first decision records; a re-click is an idempotent no-op", async () => {
  const { client, decisions } = fakeDecisionClient({ "123": null });
  const r1 = await recordDecision(client, "123", "skipped");
  assert.deepEqual(r1, { ok: true, alreadyDecided: false });
  assert.equal(decisions["123"], "skipped");
  const r2 = await recordDecision(client, "123", "skipped");
  assert.deepEqual(r2, { ok: true, alreadyDecided: true }, "second click flips zero rows");
  assert.equal(decisions["123"], "skipped", "decision unchanged");
});

// --- button handler (owner gate + Skip + Post, no X action) ----------------

function fakeInteraction(customId: string, userId: string) {
  const calls = { reply: [] as { content: string }[], update: [] as unknown[], followUp: [] as { content: string }[] };
  const interaction = {
    customId,
    user: { id: userId },
    reply: async (o: { content: string }) => {
      calls.reply.push(o);
    },
    update: async (o: unknown) => {
      calls.update.push(o);
    },
    followUp: async (o: { content: string }) => {
      calls.followUp.push(o);
    },
  };
  return { interaction: interaction as unknown as Parameters<typeof handleEngagementButton>[0], calls };
}

function fakeDeps(over: Partial<ButtonHandlerDeps> = {}): { deps: ButtonHandlerDeps; recorded: Array<{ postId: string; decision: string }> } {
  const recorded: Array<{ postId: string; decision: string }> = [];
  const deps: ButtonHandlerDeps = {
    ownerId: "owner1",
    getItem: async (postId) => ({
      post_id: postId,
      post_url: `https://x.com/u/status/${postId}`,
      post_text: "post text",
      author_username: "u",
      mode: "data_cite",
      matched_card: null,
      reply: "Sold avg sits near 480 this week, down from 520.",
      data_cited: "$480",
      score: 0.5,
    }),
    recordDecision: async (postId, decision) => {
      recorded.push({ postId, decision });
      return { ok: true, alreadyDecided: false };
    },
    ...over,
  };
  return { deps, recorded };
}

test("handleEngagementButton: a non-owner is refused; no decision recorded (fail-closed)", async () => {
  const { interaction, calls } = fakeInteraction("eng:skip:123", "intruder");
  const { deps, recorded } = fakeDeps();
  await handleEngagementButton(interaction, deps);
  assert.equal(recorded.length, 0, "no decision for a non-owner");
  assert.match(calls.reply[0].content, /owner/i);
});

test("handleEngagementButton: a foreign custom_id is ignored entirely", async () => {
  const { interaction, calls } = fakeInteraction("approve:draft:7", "owner1");
  const { deps, recorded } = fakeDeps();
  await handleEngagementButton(interaction, deps);
  assert.equal(calls.reply.length + calls.update.length + calls.followUp.length, 0);
  assert.equal(recorded.length, 0);
});

test("handleEngagementButton: Skip records 'skipped', disables the row, confirms", async () => {
  const { interaction, calls } = fakeInteraction("eng:skip:123", "owner1");
  const { deps, recorded } = fakeDeps();
  await handleEngagementButton(interaction, deps);
  assert.deepEqual(recorded, [{ postId: "123", decision: "skipped" }]);
  assert.equal(calls.update.length, 1, "buttons disabled");
  assert.match(calls.followUp[0].content, /skipped/i);
});

test("handleEngagementButton: re-clicked Skip reports already-actioned (idempotent UX)", async () => {
  const { interaction, calls } = fakeInteraction("eng:skip:123", "owner1");
  const { deps } = fakeDeps({ recordDecision: async () => ({ ok: true, alreadyDecided: true }) });
  await handleEngagementButton(interaction, deps);
  assert.match(calls.followUp[0].content, /already/i);
});

test("handleEngagementButton: Post surfaces copy-ready reply + deep link, NEVER posts to X", async () => {
  const { interaction, calls } = fakeInteraction("eng:post:123", "owner1");
  const { deps, recorded } = fakeDeps();
  await handleEngagementButton(interaction, deps);
  const msg = calls.followUp[0].content;
  assert.match(msg, /BY HAND/, "instructs the human to post it");
  assert.match(msg, /Sold avg sits near 480/, "carries the copy-ready reply text");
  assert.match(msg, /x\.com\/u\/status\/123/, "carries the deep link to the source post");
  assert.deepEqual(recorded, [{ postId: "123", decision: "posted_by_hand" }]);
  // The no-X-write guarantee itself is pinned by the repo-level zero-X-write
  // invariant test, which reads handler.ts source for any X write/engagement call.
});

// --- drain + post (delivery) -----------------------------------------------

function row(id: string): BriefItemRow {
  return { post_id: id, post_url: `https://x.com/u/status/${id}`, post_text: "post", author_username: "u", mode: "data_cite", matched_card: null, reply: "r".repeat(20), data_cited: "$480", score: 0.5 };
}

test("drainAndPostOnce: posts each undelivered item and marks it posted", async () => {
  const sent: string[] = [];
  const marked: string[] = [];
  const n = await drainAndPostOnce({
    fetchUndelivered: async () => [row("1"), row("2")],
    send: async (it) => {
      sent.push(it.post_id);
    },
    markPosted: async (id) => {
      marked.push(id);
    },
  });
  assert.equal(n, 2);
  assert.deepEqual(sent, ["1", "2"]);
  assert.deepEqual(marked, ["1", "2"]);
});

test("drainAndPostOnce: a failed send leaves that item undelivered (soft-fail per item)", async () => {
  const marked: string[] = [];
  const n = await drainAndPostOnce({
    fetchUndelivered: async () => [row("1"), row("2")],
    send: async (it) => {
      if (it.post_id === "1") throw new Error("discord down");
    },
    markPosted: async (id) => {
      marked.push(id);
    },
  });
  assert.equal(n, 1);
  assert.deepEqual(marked, ["2"], "only the successfully-posted item is marked");
});
