// Pins the Resend wrapper's contract:
//   1. Posts to https://api.resend.com/emails
//   2. Bearer auth header carries the RESEND_API_KEY value
//   3. Subject is prefixed with "[Foil Draft] "
//   4. HTML body contains all 4 ADR-012 sections
//   5. Failure paths return ok:false without throwing
//
// We pass a custom fetchImpl rather than monkey-patching global fetch, since
// the production wrapper exposes that seam exactly for this purpose.

import test from "node:test";
import assert from "node:assert/strict";
import {
  EMAIL_SUBJECT_PREFIX,
  renderEmailHtml,
  sendNewsletterDraftEmail,
} from "../notifications/resend.ts";

type CapturedRequest = {
  url: string;
  init: RequestInit;
};

function fakeFetch(impl: (req: CapturedRequest) => Response): {
  fetch: typeof fetch;
  calls: CapturedRequest[];
} {
  const calls: CapturedRequest[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const req = { url: typeof url === "string" ? url : url.toString(), init: init ?? {} };
    calls.push(req);
    return impl(req);
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls };
}

function baseInput() {
  return {
    to: "founder@example.com",
    subject: "The NM/LP gap that costs you 38–45%",
    previewText: "One rounded corner, $180 gone — here's the math",
    body: '<p>Hey — that $313 Charizard…</p>',
    blogSlug: "near-mint-vs-lightly-played",
    blogUrl: "https://foiltcg.com/blog/near-mint-vs-lightly-played",
    topicRationale: "Selected from the Japanese cards pillar. Rank #4.",
    wordCount: 412,
    sourceWordCount: 1499,
    generatedAt: "2026-05-21T23:00:00.000Z",
  };
}

test("sends POST to https://api.resend.com/emails with Bearer auth", async () => {
  process.env.RESEND_API_KEY = "re_test_key_abc";
  const { fetch, calls } = fakeFetch(() =>
    new Response(JSON.stringify({ id: "msg_test_1" }), { status: 200 }),
  );

  const result = await sendNewsletterDraftEmail(baseInput(), { fetchImpl: fetch });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(init.method, "POST");

  const headers = init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer re_test_key_abc");
  assert.equal(headers["Content-Type"], "application/json");
});

test("payload subject is prefixed with [Foil Draft] ", async () => {
  process.env.RESEND_API_KEY = "re_test_key_abc";
  const { fetch, calls } = fakeFetch(() =>
    new Response(JSON.stringify({ id: "msg_test_2" }), { status: 200 }),
  );

  const input = baseInput();
  await sendNewsletterDraftEmail(input, { fetchImpl: fetch });
  const body = JSON.parse(calls[0].init.body as string) as { subject: string; to: string[] };
  assert.equal(body.subject, `${EMAIL_SUBJECT_PREFIX}${input.subject}`);
  assert.ok(body.subject.startsWith("[Foil Draft] "));
  assert.deepEqual(body.to, [input.to]);
});

test("HTML body includes all 4 ADR-012 sections", async () => {
  process.env.RESEND_API_KEY = "re_test_key_abc";
  const { fetch, calls } = fakeFetch(() =>
    new Response(JSON.stringify({ id: "msg_test_3" }), { status: 200 }),
  );

  await sendNewsletterDraftEmail(baseInput(), { fetchImpl: fetch });
  const html = (JSON.parse(calls[0].init.body as string) as { html: string }).html;
  assert.ok(html.toLowerCase().includes("why this topic"));
  assert.ok(html.toLowerCase().includes("newsletter preview"));
  assert.ok(html.toLowerCase().includes("how to publish"));
  assert.ok(html.toLowerCase().includes("source blog post"));
  // Body contents are embedded inline (paste-ready)
  assert.ok(html.includes(baseInput().body));
});

test("renderEmailHtml html-escapes user-provided strings (XSS-safety)", () => {
  const html = renderEmailHtml({
    ...baseInput(),
    subject: "<script>alert(1)</script>",
    previewText: "Quoted 'text'",
    topicRationale: "<b>not bold</b>",
    blogSlug: "<x>",
    blogUrl: 'https://example.com/"',
  });
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("Quoted &#39;text&#39;"));
  assert.ok(html.includes("&lt;b&gt;not bold&lt;/b&gt;"));
});

test("returns ok:false on non-2xx Resend response (no throw)", async () => {
  process.env.RESEND_API_KEY = "re_test_key_abc";
  const { fetch } = fakeFetch(() =>
    new Response('{"name":"validation_error","message":"Invalid `from`"}', { status: 422 }),
  );

  const result = await sendNewsletterDraftEmail(baseInput(), { fetchImpl: fetch });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 422);
  }
});

test("returns ok:false on fetch throw (no propagation)", async () => {
  process.env.RESEND_API_KEY = "re_test_key_abc";
  const fetchImpl = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  const result = await sendNewsletterDraftEmail(baseInput(), { fetchImpl });
  assert.equal(result.ok, false);
});

test("returns ok:false when RESEND_API_KEY is missing — never touches the network", async () => {
  delete process.env.RESEND_API_KEY;
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response("", { status: 200 });
  }) as unknown as typeof fetch;

  const result = await sendNewsletterDraftEmail(baseInput(), { fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(called, false);
  // Restore so other tests stay green
  process.env.RESEND_API_KEY = "re_test_key_abc";
});

test("includes the source blog URL + slug + word counts in section d", () => {
  const html = renderEmailHtml(baseInput());
  assert.ok(html.includes("near-mint-vs-lightly-played"));
  assert.ok(html.includes("https://foiltcg.com/blog/near-mint-vs-lightly-played"));
  assert.ok(html.includes("1499"));
  assert.ok(html.includes("412"));
});
