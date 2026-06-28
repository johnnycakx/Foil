// ADR-078: Resend Audiences + Broadcasts boundary. Fetch-injected unit tests for
// the SEND path that the /approve route uses. (The live end-to-end proof — 6 real
// broadcasts to the founder's Primary inbox + an unsubscribe round-trip — is in
// the SESSION-LOG; these pin the request shapes + the soft-fail behavior.)

import test from "node:test";
import assert from "node:assert/strict";
import {
  upsertResendContact,
  sendResendBroadcast,
  wrapBroadcastFooter,
  DEFAULT_NEWSLETTER_FROM,
  CAN_SPAM_ADDRESS,
} from "../notifications/resend.ts";

const KEY = "RESEND_API_KEY";

function res(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

function withKey<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env[KEY];
  process.env[KEY] = "re_test_key";
  return fn().finally(() => {
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  });
}

test("wrapBroadcastFooter appends the native unsubscribe tag + CAN-SPAM address", () => {
  const out = wrapBroadcastFooter("<h1>Body</h1>");
  assert.match(out, /<h1>Body<\/h1>/);
  assert.ok(out.includes("{{{RESEND_UNSUBSCRIBE_URL}}}"), "carries the Resend unsubscribe merge tag");
  assert.ok(out.includes(CAN_SPAM_ADDRESS), "carries the CAN-SPAM mailing address");
});

test("upsertResendContact POSTs to the audience contacts endpoint + returns the id", async () => {
  await withKey(async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return res(201, { id: "contact-1" });
    }) as unknown as typeof fetch;
    const r = await upsertResendContact({ email: "A@Foil.com", audienceId: "aud-1" }, { fetchImpl });
    assert.deepEqual(r, { ok: true, contactId: "contact-1" });
    assert.match(calls[0].url, /\/audiences\/aud-1\/contacts$/);
    assert.equal((calls[0].body as { email: string }).email, "a@foil.com", "email is normalized lowercase");
  });
});

test("upsertResendContact treats a duplicate (409/422) as success", async () => {
  await withKey(async () => {
    const fetchImpl = (async () => res(409, { error: "exists" })) as unknown as typeof fetch;
    const r = await upsertResendContact({ email: "a@foil.com", audienceId: "aud-1" }, { fetchImpl });
    assert.deepEqual(r, { ok: true, contactId: null });
  });
});

test("upsertResendContact soft-fails on missing key / fields", async () => {
  const prev = process.env[KEY];
  delete process.env[KEY];
  const noKey = await upsertResendContact({ email: "a@foil.com", audienceId: "aud-1" });
  assert.equal(noKey.ok, false);
  if (prev !== undefined) process.env[KEY] = prev;

  await withKey(async () => {
    const missing = await upsertResendContact({ email: "", audienceId: "aud-1" });
    assert.equal(missing.ok, false);
  });
});

test("sendResendBroadcast creates a broadcast then sends it", async () => {
  await withKey(async () => {
    const calls: { url: string; method: string; body: Record<string, unknown> }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, method: String(init.method), body: JSON.parse(String(init.body)) });
      if (url.endsWith("/broadcasts")) return res(201, { id: "bc-1" });
      return res(200, { id: "bc-1" });
    }) as unknown as typeof fetch;

    const r = await sendResendBroadcast(
      { audienceId: "aud-1", subject: "Good buys", html: "<h1>x</h1>", name: "good-buys-2026-W26" },
      { fetchImpl },
    );
    assert.deepEqual(r, { ok: true, broadcastId: "bc-1" });
    // First call creates with the audience + default sender.
    assert.match(calls[0].url, /\/broadcasts$/);
    assert.equal(calls[0].body.audience_id, "aud-1");
    assert.equal(calls[0].body.from, DEFAULT_NEWSLETTER_FROM);
    assert.equal(calls[0].body.subject, "Good buys");
    // Second call sends the created broadcast.
    assert.match(calls[1].url, /\/broadcasts\/bc-1\/send$/);
  });
});

test("sendResendBroadcast schedules when scheduled_at is given", async () => {
  await withKey(async () => {
    let sendBody: Record<string, unknown> = {};
    const fetchImpl = (async (url: string, init: RequestInit) => {
      if (url.endsWith("/send")) { sendBody = JSON.parse(String(init.body)); return res(200, { id: "bc-2" }); }
      return res(201, { id: "bc-2" });
    }) as unknown as typeof fetch;
    await sendResendBroadcast(
      { audienceId: "a", subject: "s", html: "<p>h</p>", name: "n", scheduledAt: "in 1 min" },
      { fetchImpl },
    );
    assert.equal(sendBody.scheduled_at, "in 1 min");
  });
});

test("sendResendBroadcast soft-fails (no throw) when create fails", async () => {
  await withKey(async () => {
    const fetchImpl = (async () => res(422, { error: "bad" })) as unknown as typeof fetch;
    const r = await sendResendBroadcast({ audienceId: "a", subject: "s", html: "<p>h</p>", name: "n" }, { fetchImpl });
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /create_http_422/);
  });
});

test("sendResendBroadcast soft-fails when the send step fails (created but not sent)", async () => {
  await withKey(async () => {
    const fetchImpl = (async (url: string) => (url.endsWith("/send") ? res(500, "boom") : res(201, { id: "bc-3" }))) as unknown as typeof fetch;
    const r = await sendResendBroadcast({ audienceId: "a", subject: "s", html: "<p>h</p>", name: "n" }, { fetchImpl });
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /send_http_500/);
  });
});
