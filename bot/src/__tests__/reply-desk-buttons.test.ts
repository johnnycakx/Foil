// Reply-desk button + relay + drain tests (ADR-107 §1). The reply desk's "Reply"
// button DOES post to X — but only by RELAYING to the app's approve endpoint (the
// single X boundary; the bot never calls the X API). Pinned here:
//   - the custom_id + modal-id parse/validation boundary (numeric X id guard);
//   - callReplyDeskApprove sends the dedicated bearer to the approve endpoint;
//   - the drain posts every undelivered card and marks it (soft-fail per item).

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReplyDeskCustomId,
  parseReplyDeskButtonId,
  parseReplyDeskModalId,
  buildReplyDeskButtons,
} from "../reply-desk/buttons.ts";
import { callReplyDeskApprove, drainAndPostOnce } from "../reply-desk/handler.ts";
import type { ReplyDeskItemRow } from "../reply-desk/queue.ts";

// --- custom_id / modal-id parse (the validation boundary) ------------------

test("parseReplyDeskButtonId: valid ids parse; foreign / malformed return null", () => {
  assert.deepEqual(parseReplyDeskButtonId("rd:reply:123"), { action: "reply", postId: "123" });
  assert.deepEqual(parseReplyDeskButtonId("rd:edit:456"), { action: "edit", postId: "456" });
  assert.deepEqual(parseReplyDeskButtonId("rd:skip:789"), { action: "skip", postId: "789" });
  assert.equal(parseReplyDeskButtonId("eng:skip:123"), null, "engagement button, not ours");
  assert.equal(parseReplyDeskButtonId("rd:nope:123"), null, "unknown action");
  assert.equal(parseReplyDeskButtonId("rd:reply:notanid"), null, "non-numeric id rejected");
  assert.equal(parseReplyDeskButtonId(""), null);
});

test("parseReplyDeskModalId: the Edit modal id parses; others return null", () => {
  assert.deepEqual(parseReplyDeskModalId("rd-edit-modal:123"), { postId: "123" });
  assert.equal(parseReplyDeskModalId("rd:reply:123"), null);
  assert.equal(parseReplyDeskModalId("rd-edit-modal:abc"), null);
});

test("buildReplyDeskButtons: full card has Reply+Edit+Skip; a human_look card has only Skip", () => {
  const full = buildReplyDeskButtons("123").toJSON();
  const fullIds = full.components.map((c) => (c as { custom_id?: string }).custom_id);
  assert.deepEqual(fullIds, ["rd:reply:123", "rd:edit:123", "rd:skip:123"]);
  const human = buildReplyDeskButtons("123", { humanLook: true }).toJSON();
  const humanIds = human.components.map((c) => (c as { custom_id?: string }).custom_id);
  assert.deepEqual(humanIds, ["rd:skip:123"], "no auto-Reply for a human-look card");
});

test("buildReplyDeskCustomId round-trips through parse", () => {
  assert.equal(buildReplyDeskCustomId("reply", "999"), "rd:reply:999");
  assert.deepEqual(parseReplyDeskButtonId(buildReplyDeskCustomId("skip", "42")), { action: "skip", postId: "42" });
});

// --- the approve relay (the single X boundary lives in the app) ------------

test("callReplyDeskApprove: POSTs {id, action[, text]} with the dedicated bearer to the approve endpoint", async () => {
  let captured: { url: string; auth: string | null; body: unknown } | null = null;
  const res = await callReplyDeskApprove("post", "555", "edited text", {
    appUrl: "https://app.test",
    secret: "SEKRET",
    fetchImpl: (async (url: string, init: { headers: Record<string, string>; body: string }) => {
      captured = { url, auth: init.headers.Authorization, body: JSON.parse(init.body) };
      return { ok: true, json: async () => ({ ok: true, action: "posted", postId: "42", permalink: "https://x.com/FoilTCG/status/42" }) };
    }) as unknown as typeof fetch,
  });
  assert.ok(res.ok && res.permalink === "https://x.com/FoilTCG/status/42");
  assert.equal(captured!.url, "https://app.test/api/reply-desk/approve");
  assert.equal(captured!.auth, "Bearer SEKRET");
  assert.deepEqual(captured!.body, { id: "555", action: "post", text: "edited text" });
});

test("callReplyDeskApprove: a missing secret fails closed (no request made)", async () => {
  let called = false;
  const res = await callReplyDeskApprove("skip", "1", null, {
    secret: "",
    fetchImpl: (async () => { called = true; return { ok: true, json: async () => ({}) }; }) as unknown as typeof fetch,
  });
  assert.ok(!res.ok);
  assert.equal(called, false);
});

// --- drain + post (delivery) -----------------------------------------------

function row(id: string): ReplyDeskItemRow {
  return {
    post_id: id, post_url: `https://x.com/u/status/${id}`, post_text: "worth it?", author_username: "u",
    author_followers: 100, inbound_kind: "mention", our_context: null, has_media: false, mode: "advisory",
    matched_card: null, matched_slug: null, reply: "ask for set/number", card_page_url: null, data_cited: "", score: 100, status: "pending",
  };
}

test("drainAndPostOnce: posts each undelivered card and marks it; a failed send stays undelivered", async () => {
  const marked: string[] = [];
  const n = await drainAndPostOnce({
    fetchUndelivered: async () => [row("1"), row("2")],
    send: async (it) => { if (it.post_id === "1") throw new Error("discord down"); },
    markPosted: async (id) => { marked.push(id); },
  });
  assert.equal(n, 1);
  assert.deepEqual(marked, ["2"]);
});
