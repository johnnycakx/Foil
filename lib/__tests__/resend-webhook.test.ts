// Resend unsubscribe webhook (ADR-082) — the boundary between Resend's signed
// POST and our three-store unsubscribe sync. We pin: (1) the Svix signature
// verification (HMAC-SHA256 over `${id}.${timestamp}.${body}`, base64, replay
// window), (2) which events become an opt-out, (3) the sync's idempotency +
// soft-fail branching.

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import {
  verifySvixSignature,
  extractUnsubscribeEmails,
  SVIX_TOLERANCE_SECONDS,
} from "../resend-webhook.ts";
import { syncUnsubscribe } from "../newsletter/unsubscribe-sync.ts";

// A realistic whsec_ secret: "whsec_" + base64(32 random bytes).
const SECRET = "whsec_" + randomBytes(32).toString("base64");
const FIXED_NOW_MS = 1_780_000_000_000; // deterministic clock
const FIXED_TS = Math.floor(FIXED_NOW_MS / 1000).toString();

/** Produce a valid Svix `svix-signature` header for the given body. */
function signSvix(body: string, opts: { id?: string; timestamp?: string; secret?: string } = {}): {
  id: string;
  timestamp: string;
  signature: string;
} {
  const id = opts.id ?? "msg_2abc";
  const timestamp = opts.timestamp ?? FIXED_TS;
  const secret = opts.secret ?? SECRET;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return { id, timestamp, signature: `v1,${sig}` };
}

// --- verifySvixSignature ---------------------------------------------------

test("verifySvixSignature accepts a valid Svix signature", () => {
  const body = '{"type":"contact.updated"}';
  const h = signSvix(body);
  assert.equal(
    verifySvixSignature({ body, headers: h, secret: SECRET, nowMs: FIXED_NOW_MS }),
    true,
  );
});

test("verifySvixSignature works whether or not the secret carries the whsec_ prefix", () => {
  const body = "{}";
  const h = signSvix(body);
  const raw = SECRET.replace(/^whsec_/, "");
  assert.equal(verifySvixSignature({ body, headers: h, secret: raw, nowMs: FIXED_NOW_MS }), true);
});

test("verifySvixSignature rejects a mutated body", () => {
  const body = '{"type":"contact.updated","data":{"unsubscribed":true}}';
  const h = signSvix(body);
  const mutated = body.replace("true", "false");
  assert.equal(
    verifySvixSignature({ body: mutated, headers: h, secret: SECRET, nowMs: FIXED_NOW_MS }),
    false,
  );
});

test("verifySvixSignature rejects a signature made with a different secret", () => {
  const body = "{}";
  const forged = signSvix(body, { secret: "whsec_" + randomBytes(32).toString("base64") });
  assert.equal(
    verifySvixSignature({ body, headers: forged, secret: SECRET, nowMs: FIXED_NOW_MS }),
    false,
  );
});

test("verifySvixSignature rejects a stale timestamp (replay guard)", () => {
  const body = "{}";
  const staleTs = (Math.floor(FIXED_NOW_MS / 1000) - SVIX_TOLERANCE_SECONDS - 5).toString();
  const h = signSvix(body, { timestamp: staleTs });
  assert.equal(
    verifySvixSignature({ body, headers: h, secret: SECRET, nowMs: FIXED_NOW_MS }),
    false,
  );
});

test("verifySvixSignature rejects a far-future timestamp", () => {
  const body = "{}";
  const futureTs = (Math.floor(FIXED_NOW_MS / 1000) + SVIX_TOLERANCE_SECONDS + 5).toString();
  const h = signSvix(body, { timestamp: futureTs });
  assert.equal(
    verifySvixSignature({ body, headers: h, secret: SECRET, nowMs: FIXED_NOW_MS }),
    false,
  );
});

test("verifySvixSignature accepts when one of several space-delimited signatures is valid", () => {
  const body = '{"ok":1}';
  const good = signSvix(body).signature; // "v1,<sig>"
  const headers = {
    id: "msg_2abc",
    timestamp: FIXED_TS,
    // an unrelated v1 sig + a v0 (unsupported version) + the real one
    signature: `v1,AAAABBBBCCCC v0,ignored ${good}`,
  };
  assert.equal(verifySvixSignature({ body, headers, secret: SECRET, nowMs: FIXED_NOW_MS }), true);
});

test("verifySvixSignature returns false on any missing header (no throw)", () => {
  const body = "{}";
  const h = signSvix(body);
  assert.equal(verifySvixSignature({ body, headers: { ...h, id: null }, secret: SECRET, nowMs: FIXED_NOW_MS }), false);
  assert.equal(verifySvixSignature({ body, headers: { ...h, timestamp: null }, secret: SECRET, nowMs: FIXED_NOW_MS }), false);
  assert.equal(verifySvixSignature({ body, headers: { ...h, signature: null }, secret: SECRET, nowMs: FIXED_NOW_MS }), false);
  assert.equal(verifySvixSignature({ body, headers: h, secret: "", nowMs: FIXED_NOW_MS }), false);
});

test("verifySvixSignature returns false on a malformed signature header without throwing", () => {
  const body = "{}";
  const base = signSvix(body);
  assert.equal(verifySvixSignature({ body, headers: { ...base, signature: "no-comma-here" }, secret: SECRET, nowMs: FIXED_NOW_MS }), false);
  assert.equal(verifySvixSignature({ body, headers: { ...base, signature: "v1," }, secret: SECRET, nowMs: FIXED_NOW_MS }), false);
  assert.equal(verifySvixSignature({ body, headers: { ...base, timestamp: "not-a-number" }, secret: SECRET, nowMs: FIXED_NOW_MS }), false);
});

// --- extractUnsubscribeEmails ----------------------------------------------

test("extractUnsubscribeEmails: contact.updated with unsubscribed:true → [email] (lowercased)", () => {
  const emails = extractUnsubscribeEmails({
    type: "contact.updated",
    data: { email: "Steve.Wozniak@Gmail.com", unsubscribed: true },
  });
  assert.deepEqual(emails, ["steve.wozniak@gmail.com"]);
});

test("extractUnsubscribeEmails: contact.updated with unsubscribed:false → [] (no auto-resubscribe)", () => {
  const emails = extractUnsubscribeEmails({
    type: "contact.updated",
    data: { email: "a@b.com", unsubscribed: false },
  });
  assert.deepEqual(emails, []);
});

test("extractUnsubscribeEmails: contact.created with unsubscribed:true → [email]", () => {
  const emails = extractUnsubscribeEmails({
    type: "contact.created",
    data: { email: "new@b.com", unsubscribed: true },
  });
  assert.deepEqual(emails, ["new@b.com"]);
});

test("extractUnsubscribeEmails: email.complained → data.to recipients", () => {
  const emails = extractUnsubscribeEmails({
    type: "email.complained",
    data: { to: ["Hater@Example.com", "second@example.com"] },
  });
  assert.deepEqual(emails, ["hater@example.com", "second@example.com"]);
});

test("extractUnsubscribeEmails: email.complained tolerates a bare-string `to`", () => {
  const emails = extractUnsubscribeEmails({ type: "email.complained", data: { to: "x@y.com" } });
  assert.deepEqual(emails, ["x@y.com"]);
});

test("extractUnsubscribeEmails: unrelated events are a no-op", () => {
  assert.deepEqual(extractUnsubscribeEmails({ type: "email.delivered", data: { to: ["x@y.com"] } }), []);
  assert.deepEqual(extractUnsubscribeEmails({ type: "email.opened", data: {} }), []);
  assert.deepEqual(extractUnsubscribeEmails({ type: "contact.deleted", data: { email: "x@y.com" } }), []);
});

test("extractUnsubscribeEmails: missing/garbage input is a no-op (never throws)", () => {
  assert.deepEqual(extractUnsubscribeEmails(null), []);
  assert.deepEqual(extractUnsubscribeEmails(undefined), []);
  assert.deepEqual(extractUnsubscribeEmails({}), []);
  assert.deepEqual(extractUnsubscribeEmails({ type: "contact.updated", data: { unsubscribed: true } }), []); // no email
  assert.deepEqual(extractUnsubscribeEmails({ type: "contact.updated", data: { email: "not-an-email", unsubscribed: true } }), []);
});

test("extractUnsubscribeEmails dedupes repeated recipients", () => {
  const emails = extractUnsubscribeEmails({
    type: "email.complained",
    data: { to: ["dup@x.com", "DUP@x.com", "dup@x.com"] },
  });
  assert.deepEqual(emails, ["dup@x.com"]);
});

// --- syncUnsubscribe (injected IO) -----------------------------------------

test("syncUnsubscribe: both legs succeed → updated + beehiiv true", async () => {
  const calls: string[] = [];
  const r = await syncUnsubscribe("User@X.com", {
    setSupabaseUnsubscribed: async (email, at) => {
      calls.push(`sb:${email}:${at}`);
      return "updated";
    },
    beehiivUnsubscribe: async (email) => {
      calls.push(`bh:${email}`);
      return true;
    },
    nowIso: "2026-06-30T00:00:00.000Z",
  });
  assert.deepEqual(r, { email: "user@x.com", supabase: "updated", beehiiv: true });
  // Email is normalized before either leg sees it.
  assert.deepEqual(calls.sort(), ["bh:user@x.com", "sb:user@x.com:2026-06-30T00:00:00.000Z"]);
});

test("syncUnsubscribe: replayed webhook is a no-op (0 rows changed → noop, still not an error)", async () => {
  const r = await syncUnsubscribe("user@x.com", {
    setSupabaseUnsubscribed: async () => "noop",
    beehiivUnsubscribe: async () => true,
  });
  assert.equal(r.supabase, "noop");
  assert.equal(r.beehiiv, true);
});

test("syncUnsubscribe: a Supabase error surfaces as supabase:error (route will retry)", async () => {
  const r = await syncUnsubscribe("user@x.com", {
    setSupabaseUnsubscribed: async () => "error",
    beehiivUnsubscribe: async () => true,
  });
  assert.equal(r.supabase, "error");
});

test("syncUnsubscribe: a Beehiiv failure does not deny the Supabase leg (soft-fail, independent)", async () => {
  const r = await syncUnsubscribe("user@x.com", {
    setSupabaseUnsubscribed: async () => "updated",
    beehiivUnsubscribe: async () => false,
  });
  assert.deepEqual(r, { email: "user@x.com", supabase: "updated", beehiiv: false });
});

test("syncUnsubscribe: a thrown leg is caught and downgraded, never propagated", async () => {
  const r = await syncUnsubscribe("user@x.com", {
    setSupabaseUnsubscribed: async () => {
      throw new Error("db down");
    },
    beehiivUnsubscribe: async () => {
      throw new Error("beehiiv down");
    },
  });
  assert.deepEqual(r, { email: "user@x.com", supabase: "error", beehiiv: false });
});

test("syncUnsubscribe: empty email short-circuits without calling either leg", async () => {
  let called = false;
  const r = await syncUnsubscribe("   ", {
    setSupabaseUnsubscribed: async () => {
      called = true;
      return "updated";
    },
    beehiivUnsubscribe: async () => {
      called = true;
      return true;
    },
  });
  assert.equal(called, false);
  assert.deepEqual(r, { email: "", supabase: "noop", beehiiv: false });
});
