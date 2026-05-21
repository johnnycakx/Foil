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
import { __setClientForTests, subscribeEmail } from "../beehiiv.ts";

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
