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
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  EMAIL_SUBJECT_PREFIX,
  renderEmailHtml,
  sendNewsletterDraftEmail,
  sendTransactionalEmail,
} from "../notifications/resend.ts";

const EXPECTED_SENDER = "Foil <alerts@foiltcg.com>";

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

// ---------------------------------------------------------------------------
// Sender pins (post-domain-verification, Session 30). Both functions now
// default to the branded sender; pin it so a future contributor can't
// silently regress to the Resend onboarding sender.
// ---------------------------------------------------------------------------

test("sendNewsletterDraftEmail: From header defaults to Foil <alerts@foiltcg.com>", async () => {
  process.env.RESEND_API_KEY = "re_test_key_abc";
  const { fetch, calls } = fakeFetch(() =>
    new Response(JSON.stringify({ id: "msg_sender_1" }), { status: 200 }),
  );
  await sendNewsletterDraftEmail(baseInput(), { fetchImpl: fetch });
  const body = JSON.parse(calls[0].init.body as string) as { from: string };
  assert.equal(body.from, EXPECTED_SENDER);
});

test("sendNewsletterDraftEmail: caller-supplied sender override still wins", async () => {
  process.env.RESEND_API_KEY = "re_test_key_abc";
  const { fetch, calls } = fakeFetch(() =>
    new Response(JSON.stringify({ id: "msg_sender_2" }), { status: 200 }),
  );
  await sendNewsletterDraftEmail(baseInput(), { fetchImpl: fetch, sender: "Override <x@foiltcg.com>" });
  const body = JSON.parse(calls[0].init.body as string) as { from: string };
  assert.equal(body.from, "Override <x@foiltcg.com>");
});

test("sendTransactionalEmail: From header defaults to Foil <alerts@foiltcg.com>", async () => {
  process.env.RESEND_API_KEY = "re_test_key_abc";
  const { fetch, calls } = fakeFetch(() =>
    new Response(JSON.stringify({ id: "msg_sender_3" }), { status: 200 }),
  );
  await sendTransactionalEmail(
    {
      to: "subscriber@example.com",
      subject: "Charizard dropped to $38 — you wanted ≤ $40",
      html: "<p>price drop</p>",
    },
    { fetchImpl: fetch },
  );
  const body = JSON.parse(calls[0].init.body as string) as { from: string };
  assert.equal(body.from, EXPECTED_SENDER);
});

test("sendTransactionalEmail: caller-supplied sender override still wins", async () => {
  process.env.RESEND_API_KEY = "re_test_key_abc";
  const { fetch, calls } = fakeFetch(() =>
    new Response(JSON.stringify({ id: "msg_sender_4" }), { status: 200 }),
  );
  await sendTransactionalEmail(
    {
      to: "subscriber@example.com",
      subject: "X",
      html: "<p>x</p>",
      sender: "Override <y@foiltcg.com>",
    },
    { fetchImpl: fetch },
  );
  const body = JSON.parse(calls[0].init.body as string) as { from: string };
  assert.equal(body.from, "Override <y@foiltcg.com>");
});

// ---------------------------------------------------------------------------
// Structural regression guard: the Resend onboarding system address must
// not appear anywhere in lib/ or app/ except this test file. The historical
// fallback sender was "Foil <onboarding@resend.dev>" — if it ever leaks
// back into a code path, this test catches it before the next deploy.
// ---------------------------------------------------------------------------

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SELF_TEST_BASENAME = "resend.test.ts";
const SCAN_DIRS = ["lib", "app"];
const FORBIDDEN = "onboarding@resend.dev";

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      // Skip node_modules / .next-style noise if it bleeds in.
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      yield* walkFiles(full);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      yield full;
    }
  }
}

test("onboarding@resend.dev is not referenced in lib/ or app/ outside this test file", () => {
  const offenders: string[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walkFiles(join(ROOT, dir))) {
      // Exclude this test file itself (basename match — robust against
      // path-separator + drive-letter normalization).
      if (file.endsWith(SELF_TEST_BASENAME)) continue;
      const text = readFileSync(file, "utf8");
      if (text.includes(FORBIDDEN)) {
        offenders.push(file.replace(/\\/g, "/"));
      }
    }
  }
  assert.deepEqual(offenders, [], `\nForbidden Resend onboarding sender leaked back into:\n  ${offenders.join("\n  ")}`);
});
