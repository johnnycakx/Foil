// funnel-events write module (audit 2026-07-14). Pins the two hard rules:
// (1) NEVER throws / NEVER blocks — a telemetry failure resolves to {ok:false},
// so the render/checkout it rides behind is untouched; (2) NO raw PII — the
// visitor id is a one-way hash, and an unknown IP yields null, not a fake id.

import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logFunnelEvent, hashVisitorId } from "../telemetry/funnel-events.ts";

/** Minimal fake: captures the inserted row, or forces an error/throw. */
function fakeClient(mode: "ok" | "error" | "throw"): { client: SupabaseClient; captured: unknown[] } {
  const captured: unknown[] = [];
  const client = {
    from() {
      return {
        insert(row: unknown) {
          if (mode === "throw") throw new Error("connection exploded");
          captured.push(row);
          return Promise.resolve(mode === "error" ? { error: { message: "insert failed" } } : { error: null });
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, captured };
}

test("hashVisitorId: one-way, stable, and null for an unknown IP", () => {
  const a = hashVisitorId("203.0.113.7");
  const b = hashVisitorId("203.0.113.7");
  assert.equal(a, b, "same IP → same id (stable within the salt epoch)");
  assert.notEqual(a, "203.0.113.7", "the raw IP never appears in the id");
  assert.ok(!a!.includes("203"), "no fragment of the IP survives");
  assert.equal(hashVisitorId(null), null);
  assert.equal(hashVisitorId("unknown"), null, "the clientIpKey sentinel is not a visitor");
  assert.notEqual(hashVisitorId("203.0.113.7"), hashVisitorId("203.0.113.8"), "different IPs → different ids");
});

test("logFunnelEvent: writes the shaped row on success", async () => {
  const { client, captured } = fakeClient("ok");
  const res = await logFunnelEvent(
    { stage: "pro_view", visitorId: "abc", utmSource: "reddit", meta: { hook: "drop" } },
    { client },
  );
  assert.deepEqual(res, { ok: true });
  assert.deepEqual(captured[0], {
    stage: "pro_view",
    visitor_id: "abc",
    utm_source: "reddit",
    utm_campaign: null,
    meta: { hook: "drop" },
  });
});

test("logFunnelEvent: a query error resolves to {ok:false}, never throws", async () => {
  const { client } = fakeClient("error");
  const res = await logFunnelEvent({ stage: "watch_set" }, { client });
  assert.equal(res.ok, false);
  assert.match(res.error ?? "", /insert failed/);
});

test("logFunnelEvent: a THROWN client error is swallowed — the hot path is safe", async () => {
  const { client } = fakeClient("throw");
  // The contract: no matter what the DB layer does, this settles — it never
  // propagates into the render or checkout it was fired from.
  const res = await logFunnelEvent({ stage: "checkout_start" }, { client });
  assert.equal(res.ok, false);
  assert.match(res.error ?? "", /exploded/);
});
