// The /auth/confirm redirect sanitizer (auth-hardening, 2026-07-12). The
// `next` param rides an emailed URL, so it is untrusted input: same-origin
// PATHS only, everything else falls back to /account.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeNextPath, DEFAULT_NEXT_PATH } from "../auth/next-path.ts";

test("plain paths pass through", () => {
  assert.equal(sanitizeNextPath("/start"), "/start");
  assert.equal(sanitizeNextPath("/account"), "/account");
  assert.equal(sanitizeNextPath("/w/some-token"), "/w/some-token");
});

test("absolute URLs, protocol-relative, and backslash tricks fall back", () => {
  assert.equal(sanitizeNextPath("https://evil.com/phish"), DEFAULT_NEXT_PATH);
  assert.equal(sanitizeNextPath("//evil.com"), DEFAULT_NEXT_PATH);
  assert.equal(sanitizeNextPath("/\\evil.com"), DEFAULT_NEXT_PATH);
  assert.equal(sanitizeNextPath("javascript:alert(1)"), DEFAULT_NEXT_PATH);
});

// REGRESSION PIN (security-review F1, 2026-07-12): the first draft used a
// string-prefix check, which the WHATWG URL parser defeats — it strips
// tab/CR/LF BEFORE resolving, so these collapse to protocol-relative and
// escaped the origin. Each of these was empirically shown to redirect to
// https://evil.com/ before the fix. searchParams.get() hands us the DECODED
// value, so the control char is what the sanitizer actually sees.
test("control-character smuggling cannot escape the origin", () => {
  const vectors = [
    "/\t/evil.com",
    "/\n//evil.com",
    "/\r/evil.com",
    "/\t\t//evil.com",
    "///evil.com",
    "\t//evil.com",
  ];
  for (const v of vectors) {
    assert.equal(sanitizeNextPath(v), DEFAULT_NEXT_PATH, `vector ${JSON.stringify(v)} must fall back`);
  }
});

test("whatever comes back is always a same-origin path", () => {
  // Belt-and-braces: anything the sanitizer returns must resolve to the
  // caller's own origin, never a foreign host.
  const probes = [
    "/start",
    "/\t/evil.com",
    "//evil.com",
    "https://evil.com",
    "/account?x=1#frag",
    "/%2F%2Fevil.com",
    "/..//evil.com",
  ];
  for (const p of probes) {
    const out = sanitizeNextPath(p);
    const resolved = new URL(out, "https://foiltcg.com/auth/confirm");
    assert.equal(resolved.origin, "https://foiltcg.com", `${JSON.stringify(p)} → ${out}`);
  }
});

test("empty/missing falls back to the signed-in home", () => {
  assert.equal(sanitizeNextPath(null), DEFAULT_NEXT_PATH);
  assert.equal(sanitizeNextPath(undefined), DEFAULT_NEXT_PATH);
  assert.equal(sanitizeNextPath(""), DEFAULT_NEXT_PATH);
  assert.equal(DEFAULT_NEXT_PATH, "/account");
});

test("every signInWithOtp sender points at /auth/confirm with a query string", () => {
  // The magic-link template appends `&token_hash=…` to {{ .RedirectTo }}, so
  // an emailRedirectTo WITHOUT a query would produce a broken link. Pin both
  // senders to the /auth/confirm?next=… shape.
  const root = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  for (const rel of ["app/login/actions.ts", "app/api/webhooks/stripe/route.ts"]) {
    const src = readFileSync(join(root, rel), "utf8");
    const matches = src.match(/emailRedirectTo: [^,\n]+/g) ?? [];
    assert.ok(matches.length > 0, `${rel} must set emailRedirectTo`);
    for (const m of matches) {
      assert.match(m, /\/auth\/confirm\?next=/, `${rel}: ${m} must target /auth/confirm?next=…`);
    }
  }
});
