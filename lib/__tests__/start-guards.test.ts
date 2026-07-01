// Abuse guards for /api/start (start-funnel-integrity, ADR-090).
// Pure-unit coverage: honeypot, per-IP limiter windowing, watch cap, IP keying.

import test from "node:test";
import assert from "node:assert/strict";
import {
  createIpRateLimiter,
  clientIpKey,
  exceedsWatchCap,
  isHoneypotTripped,
  IP_LIMIT_MAX_REQUESTS,
  IP_LIMIT_WINDOW_MS,
  PER_EMAIL_WATCH_CAP,
} from "../start/guards.ts";

test("honeypot: any non-empty string trips; empty/undefined/non-string does not", () => {
  assert.equal(isHoneypotTripped("http://spam.example"), true);
  assert.equal(isHoneypotTripped("  x  "), true);
  assert.equal(isHoneypotTripped(""), false);
  assert.equal(isHoneypotTripped("   "), false);
  assert.equal(isHoneypotTripped(undefined), false);
  assert.equal(isHoneypotTripped(null), false);
  assert.equal(isHoneypotTripped(42), false);
});

test("ip limiter: allows up to the budget within a window, rejects beyond it", () => {
  const limiter = createIpRateLimiter({ maxRequests: 3, windowMs: 1000 });
  const t0 = 1_000_000;
  assert.equal(limiter.check("1.2.3.4", t0), true);
  assert.equal(limiter.check("1.2.3.4", t0 + 10), true);
  assert.equal(limiter.check("1.2.3.4", t0 + 20), true);
  assert.equal(limiter.check("1.2.3.4", t0 + 30), false, "4th hit in-window must be rejected");
  // A different key has its own bucket.
  assert.equal(limiter.check("5.6.7.8", t0 + 30), true);
});

test("ip limiter: window expiry resets the bucket", () => {
  const limiter = createIpRateLimiter({ maxRequests: 1, windowMs: 1000 });
  const t0 = 5_000_000;
  assert.equal(limiter.check("ip", t0), true);
  assert.equal(limiter.check("ip", t0 + 500), false);
  assert.equal(limiter.check("ip", t0 + 1001), true, "new window starts fresh");
});

test("ip limiter: production defaults are sane (humans submit once or twice)", () => {
  assert.ok(IP_LIMIT_MAX_REQUESTS >= 3 && IP_LIMIT_MAX_REQUESTS <= 30);
  assert.ok(IP_LIMIT_WINDOW_MS >= 60_000, "window must be at least a minute to matter");
});

test("watch cap: bounds the per-email TOTAL across requests", () => {
  assert.equal(exceedsWatchCap(0, 50), false);
  assert.equal(exceedsWatchCap(PER_EMAIL_WATCH_CAP - 1, 1), false);
  assert.equal(exceedsWatchCap(PER_EMAIL_WATCH_CAP - 1, 2), true);
  assert.equal(exceedsWatchCap(PER_EMAIL_WATCH_CAP, 1), true);
});

test("clientIpKey: first x-forwarded-for hop wins; falls back to x-real-ip then 'unknown'", () => {
  const h = (map: Record<string, string>) => ({
    get: (n: string) => map[n.toLowerCase()] ?? null,
  });
  assert.equal(clientIpKey(h({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" })), "9.9.9.9");
  assert.equal(clientIpKey(h({ "x-real-ip": "8.8.8.8" })), "8.8.8.8");
  assert.equal(clientIpKey(h({})), "unknown");
});
