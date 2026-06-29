// Pins the subscribeEmail wrapper's contract:
//   1. Bad inputs short-circuit before any SDK call.
//   2. The SDK is called with exactly the utm fields ADR-010 specifies.
//   3. Rate-limit (429) errors trigger backoff + retry, not immediate failure.
//   4. Reactivation (existing email re-subscribing) collapses to ok:true.
//
// We stub the BeehiivClient via __setClientForTests so the real SDK never
// reaches the network — these tests run with no BEEHIIV_API_KEY exposed.

import test from "node:test";
import assert from "node:assert/strict";
import { Beehiiv } from "@beehiiv/sdk";
import { __setClientForTests, subscribeEmail, unsubscribeEmail } from "../beehiiv.ts";

type CapturedCall = {
  publicationId: string;
  request: Beehiiv.SubscriptionRequest;
};

function makeFakeClient(opts: {
  responses?: Array<{ status: "active" | "pending" }>;
  throwOnAttempt?: Array<unknown>;
}): { client: unknown; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  let attempt = 0;
  const client = {
    subscriptions: {
      create: async (publicationId: string, request: Beehiiv.SubscriptionRequest) => {
        calls.push({ publicationId, request });
        const idx = attempt++;
        const throwOn = opts.throwOnAttempt?.[idx];
        if (throwOn) throw throwOn;
        const response = opts.responses?.[idx] ?? { status: "active" as const };
        return {
          data: {
            id: "sub_test",
            email: request.email,
            status: response.status,
            created: 0,
            subscription_tier: "free",
            subscription_premium_tier_names: [],
            utm_source: request.utm_source ?? "",
            utm_medium: request.utm_medium ?? "",
            utm_channel: "direct",
            utm_campaign: request.utm_campaign ?? "",
            referring_site: request.referring_site ?? "",
            referral_code: "",
          },
        };
      },
    },
  };
  return { client, calls };
}

function withFakeClient<T>(client: unknown, fn: () => Promise<T>): Promise<T> {
  // Cast through unknown — the test client only implements the surface
  // subscribeEmail actually touches, not the full BeehiivClient.
  __setClientForTests(client as never);
  return fn().finally(() => __setClientForTests(null));
}

// Pre-populate env so subscribeEmail's getPublicationId() check passes. The
// fake client never touches the API key but BEEHIIV_PUBLICATION_ID is read on
// every call.
process.env.BEEHIIV_API_KEY ??= "test-key";
process.env.BEEHIIV_PUBLICATION_ID ??= "pub_test";

test("subscribeEmail — rejects missing email without touching the SDK", async () => {
  const { client, calls } = makeFakeClient({});
  await withFakeClient(client, async () => {
    const result = await subscribeEmail({ email: "", source: "blog-test" });
    assert.deepEqual(result, { ok: false });
    assert.equal(calls.length, 0);
  });
});

test("subscribeEmail — rejects malformed email without touching the SDK", async () => {
  const { client, calls } = makeFakeClient({});
  await withFakeClient(client, async () => {
    const result = await subscribeEmail({ email: "not-an-email", source: "blog-test" });
    assert.deepEqual(result, { ok: false });
    assert.equal(calls.length, 0);
  });
});

test("subscribeEmail — sends ADR-010 utm payload + reactivate_existing flag", async () => {
  const { client, calls } = makeFakeClient({});
  await withFakeClient(client, async () => {
    const result = await subscribeEmail({
      email: "  JANE@EXAMPLE.COM  ",
      source: "blog-foo",
    });
    assert.deepEqual(result, { ok: true, status: "subscribed" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].publicationId, "pub_test");
    assert.deepEqual(calls[0].request, {
      email: "jane@example.com",
      reactivate_existing: true,
      send_welcome_email: false,
      utm_source: "foil-blog",
      utm_medium: "email-capture",
      utm_campaign: "blog-foo",
      referring_site: "foiltcg.com",
    });
  });
});

test("subscribeEmail — retries once on TooManyRequestsError then succeeds", async () => {
  const rateLimited = new Beehiiv.TooManyRequestsError({ message: "Rate limit" } as never);
  const { client, calls } = makeFakeClient({
    throwOnAttempt: [rateLimited],
    responses: [undefined as never, { status: "active" }],
  });

  await withFakeClient(client, async () => {
    const result = await subscribeEmail({ email: "rl@example.com", source: "blog-rl" });
    assert.deepEqual(result, { ok: true, status: "subscribed" });
    assert.equal(calls.length, 2, "expected exactly one retry after the 429");
  });
});

test("subscribeEmail — surfaces ok:true when reactivating an existing subscriber", async () => {
  // Beehiiv's reactivate_existing flow returns the existing row with
  // status:"active". Our wrapper collapses that to {ok:true,status:"subscribed"}
  // — the caller treats new + reactivated identically.
  const { client, calls } = makeFakeClient({
    responses: [{ status: "active" }],
  });
  await withFakeClient(client, async () => {
    const result = await subscribeEmail({
      email: "comeback@example.com",
      source: "blog-comeback",
    });
    assert.deepEqual(result, { ok: true, status: "subscribed" });
    assert.equal(calls[0].request.reactivate_existing, true);
  });
});

test("subscribeEmail — returns ok:false (never throws) on non-rate-limit errors", async () => {
  const boom = new Error("boom");
  const { client } = makeFakeClient({ throwOnAttempt: [boom] });
  await withFakeClient(client, async () => {
    const result = await subscribeEmail({ email: "err@example.com", source: "blog-err" });
    assert.deepEqual(result, { ok: false });
  });
});

// ---------------------------------------------------------------------------
// unsubscribeEmail (ADR-083, amends ADR-082). The prior code called phantom
// SDK methods (`.list`/`.update`) through `as unknown as {...}` casts and
// silently no-op'd, leaving a Resend-unsubscribed contact `active` in Beehiiv.
// These pin the fix: it must call the REAL `updateByEmail(pub, email,
// {unsubscribe:true})`, report success ONLY when that call succeeds, and never
// throw. A fake that implements ONLY updateByEmail (not the phantom methods)
// is itself the regression guard — reverting to `.list` would throw here.
// ---------------------------------------------------------------------------

type UnsubCall = { publicationId: string; email: string; request: { unsubscribe?: boolean } };

function makeUnsubFakeClient(opts: { throw?: unknown; status?: string } = {}): {
  client: unknown;
  calls: UnsubCall[];
} {
  const calls: UnsubCall[] = [];
  const client = {
    subscriptions: {
      updateByEmail: async (publicationId: string, email: string, request: { unsubscribe?: boolean }) => {
        calls.push({ publicationId, email, request });
        if (opts.throw) throw opts.throw;
        return { data: { id: "sub_x", email, status: opts.status ?? "inactive" } };
      },
    },
  };
  return { client, calls };
}

test("unsubscribeEmail — calls updateByEmail with {unsubscribe:true} on the normalized email + reports success", async () => {
  const { client, calls } = makeUnsubFakeClient({ status: "inactive" });
  await withFakeClient(client, async () => {
    const r = await unsubscribeEmail("  Alias+Tag@Example.COM ");
    assert.deepEqual(r, { ok: true, status: "unsubscribed" });
    assert.equal(calls.length, 1, "the real SDK method must actually be invoked (the original bug was a no-op)");
    assert.equal(calls[0].publicationId, "pub_test");
    assert.equal(calls[0].email, "alias+tag@example.com"); // trimmed + lowercased
    assert.deepEqual(calls[0].request, { unsubscribe: true });
  });
});

test("unsubscribeEmail — empty/whitespace email short-circuits without any SDK call", async () => {
  const { client, calls } = makeUnsubFakeClient({});
  await withFakeClient(client, async () => {
    assert.deepEqual(await unsubscribeEmail("   "), { ok: false });
    assert.equal(calls.length, 0);
  });
});

test("unsubscribeEmail — a 404 (NotFoundError) is treated as success (already effectively unsubscribed)", async () => {
  const notFound = new Beehiiv.NotFoundError({ message: "not found" } as never);
  const { client, calls } = makeUnsubFakeClient({ throw: notFound });
  await withFakeClient(client, async () => {
    assert.deepEqual(await unsubscribeEmail("ghost@example.com"), { ok: true, status: "not_found" });
    assert.equal(calls.length, 1);
  });
});

test("unsubscribeEmail — a real API error returns ok:false (never throws), so no false-success on a failed write", async () => {
  const boom = new Error("beehiiv 500");
  const { client, calls } = makeUnsubFakeClient({ throw: boom });
  await withFakeClient(client, async () => {
    assert.deepEqual(await unsubscribeEmail("err@example.com"), { ok: false });
    assert.equal(calls.length, 1, "the SDK method is invoked; failure is reported as ok:false, not swallowed as success");
  });
});
