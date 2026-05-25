// Contract tests for the HMAC unsubscribe-token primitive (Task #18 /
// Session 37). The token IS the identity proof for the /api/unsubscribe
// endpoint — every assertion below is a security-relevant boundary.
//
// What this pins:
//   - Round-trip: mint(email) → verify → same email back.
//   - Tamper detection: any single-byte change to either the payload OR
//     signature must fail with reason: "bad_signature" or "bad_payload".
//   - Constant-time compare: the verifier never throws on length mismatch
//     or non-base64 inputs — the route handler always gets a tagged
//     result it can branch on.
//   - Missing-secret graceful degradation: mintUnsubscribeToken returns
//     null when UNSUBSCRIBE_TOKEN_SECRET is absent (production sends
//     emails without the header rather than sending a non-functional
//     one-click link).

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUnsubscribeUrl,
  mintUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../unsubscribe-token.ts";

const TEST_SECRET = "test-unsubscribe-secret-must-be-long-enough-for-the-getter-guard";
const FIXED_NOW = () => new Date("2026-05-25T12:00:00Z");

function withSecret<T>(secret: string | undefined, fn: () => T): T {
  const prev = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  if (secret === undefined) {
    delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
  } else {
    process.env.UNSUBSCRIBE_TOKEN_SECRET = secret;
  }
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
    else process.env.UNSUBSCRIBE_TOKEN_SECRET = prev;
  }
}

// ---------------------------------------------------------------------------
// Happy-path round-trip
// ---------------------------------------------------------------------------

test("round-trip: mintUnsubscribeToken + verifyUnsubscribeToken yields the same email", () => {
  withSecret(TEST_SECRET, () => {
    const token = mintUnsubscribeToken("buyer@example.com", { now: FIXED_NOW });
    assert.ok(token, "expected a non-null token");
    const result = verifyUnsubscribeToken(token!);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.email, "buyer@example.com");
      // iat is unix seconds; FIXED_NOW returns 2026-05-25T12:00:00Z.
      assert.equal(result.issuedAt, Math.floor(FIXED_NOW().getTime() / 1000));
    }
  });
});

test("round-trip: emails are lowercased before signing", () => {
  withSecret(TEST_SECRET, () => {
    const token = mintUnsubscribeToken("Buyer@EXAMPLE.com", { now: FIXED_NOW });
    assert.ok(token);
    const result = verifyUnsubscribeToken(token!);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.email, "buyer@example.com");
  });
});

test("round-trip: token is URL-safe (only base64url chars + a single dot)", () => {
  withSecret(TEST_SECRET, () => {
    const token = mintUnsubscribeToken("subscriber@foiltcg.com", { now: FIXED_NOW });
    assert.ok(token);
    assert.match(token!, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
});

// ---------------------------------------------------------------------------
// Tamper detection
// ---------------------------------------------------------------------------

test("tamper: flipping one byte in the signature fails with bad_signature", () => {
  withSecret(TEST_SECRET, () => {
    const token = mintUnsubscribeToken("buyer@example.com", { now: FIXED_NOW });
    assert.ok(token);
    const dot = token!.indexOf(".");
    const payloadPart = token!.slice(0, dot);
    const sigPart = token!.slice(dot + 1);
    // Flip the first sig char (cycle through base64url alphabet via XOR).
    const flipped = (sigPart[0] === "A" ? "B" : "A") + sigPart.slice(1);
    const tampered = `${payloadPart}.${flipped}`;
    const result = verifyUnsubscribeToken(tampered);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "bad_signature");
  });
});

test("tamper: rewriting the email in the payload fails verification", () => {
  withSecret(TEST_SECRET, () => {
    const token = mintUnsubscribeToken("victim@example.com", { now: FIXED_NOW });
    assert.ok(token);
    // Re-encode the payload with a different email but keep the original
    // signature — verification must reject.
    const dot = token!.indexOf(".");
    const sigPart = token!.slice(dot + 1);
    const forgedPayload = Buffer.from(
      JSON.stringify({ e: "attacker@example.com", iat: 1700000000 }),
      "utf8",
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const result = verifyUnsubscribeToken(`${forgedPayload}.${sigPart}`);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "bad_signature");
  });
});

test("tamper: malformed (no dot) → reason: malformed", () => {
  withSecret(TEST_SECRET, () => {
    const result = verifyUnsubscribeToken("notatokenatall");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "malformed");
  });
});

test("tamper: empty string → reason: malformed (never throws)", () => {
  withSecret(TEST_SECRET, () => {
    const result = verifyUnsubscribeToken("");
    assert.equal(result.ok, false);
  });
});

// ---------------------------------------------------------------------------
// Secret missing — graceful degradation
// ---------------------------------------------------------------------------

test("missing secret: mint returns null (caller omits the header)", () => {
  withSecret(undefined, () => {
    const token = mintUnsubscribeToken("buyer@example.com");
    assert.equal(token, null);
  });
});

test("missing secret: verify returns reason: missing_secret", () => {
  withSecret(undefined, () => {
    const result = verifyUnsubscribeToken("anything.atall");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "missing_secret");
  });
});

test("short secret (< 16 chars): mint returns null", () => {
  // The 16-char minimum is a soft guard against e.g. UNSUBSCRIBE_TOKEN_SECRET=foo
  // accidentally landing in env. A real secret should be 32+ random bytes.
  withSecret("tooshort", () => {
    const token = mintUnsubscribeToken("buyer@example.com");
    assert.equal(token, null);
  });
});

// ---------------------------------------------------------------------------
// Cross-secret rejection
// ---------------------------------------------------------------------------

test("cross-secret: token minted with secret A doesn't verify against secret B", () => {
  const tokenA = withSecret(TEST_SECRET, () =>
    mintUnsubscribeToken("buyer@example.com", { now: FIXED_NOW }),
  );
  assert.ok(tokenA);
  const verifyB = withSecret(
    "different-secret-also-long-enough-to-clear-the-getter-guard",
    () => verifyUnsubscribeToken(tokenA!),
  );
  assert.equal(verifyB.ok, false);
  if (!verifyB.ok) assert.equal(verifyB.reason, "bad_signature");
});

// ---------------------------------------------------------------------------
// buildUnsubscribeUrl
// ---------------------------------------------------------------------------

test("buildUnsubscribeUrl: produces an absolute URL with the token in the query string", () => {
  withSecret(TEST_SECRET, () => {
    const url = buildUnsubscribeUrl("buyer@example.com", {
      baseUrl: "https://foiltcg.com",
      now: FIXED_NOW,
    });
    assert.ok(url);
    assert.match(url!, /^https:\/\/foiltcg\.com\/api\/unsubscribe\?token=[A-Za-z0-9_%.-]+$/);
  });
});

test("buildUnsubscribeUrl: returns null when secret missing", () => {
  withSecret(undefined, () => {
    assert.equal(buildUnsubscribeUrl("buyer@example.com", { baseUrl: "https://foiltcg.com" }), null);
  });
});

test("buildUnsubscribeUrl: token round-trips through the URL encoding", () => {
  withSecret(TEST_SECRET, () => {
    const url = buildUnsubscribeUrl("buyer@example.com", {
      baseUrl: "https://foiltcg.com",
      now: FIXED_NOW,
    });
    assert.ok(url);
    const u = new URL(url!);
    const token = u.searchParams.get("token");
    assert.ok(token);
    const verified = verifyUnsubscribeToken(token!);
    assert.equal(verified.ok, true);
    if (verified.ok) assert.equal(verified.email, "buyer@example.com");
  });
});
