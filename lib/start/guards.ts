// Abuse guards for /api/start (start-funnel-integrity, ADR-090).
//
// Minimum viable, no over-build (the goal's explicit boundary): a honeypot
// field, an in-memory per-IP request limiter, and a per-email total watch cap.
// Pure/injectable so every branch is unit-tested without a route or network.
//
// The IP limiter is per-serverless-instance memory — a warm Vercel function
// keeps its map; a cold start resets it. That's the right cost/benefit for a
// pre-traffic funnel: it stops naive loops and script-kiddie floods without a
// Redis dependency. Real distributed rate limiting is a deliberate non-goal
// until traffic justifies infra (tracked in IDEAS with the double-opt-in
// deferral). Double-opt-in is explicitly OUT of scope here.

/** Max total watchlist rows one email can hold across ALL requests. The
 *  per-request zod cap is 50; this bounds the sum so a loop can't build an
 *  unbounded alert fan-out for one address. */
export const PER_EMAIL_WATCH_CAP = 100;

/** Per-IP request budget for /api/start within the window. Humans submit the
 *  form once or twice; a burst beyond this is automation. */
export const IP_LIMIT_MAX_REQUESTS = 10;
export const IP_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Honeypot: the form renders an off-screen "website" input humans never see
 * or fill. Any non-empty value marks the submission as a bot. The route
 * responds with a FAKE success (don't teach the bot which field tripped it).
 */
export function isHoneypotTripped(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Does adding `requestedCount` new watches exceed the per-email cap, given
 * `existingCount` rows already stored? (Upserts of existing watches count
 * conservatively as new here — precision isn't worth a second query; the cap
 * has headroom by design.)
 */
export function exceedsWatchCap(existingCount: number, requestedCount: number): boolean {
  return existingCount + requestedCount > PER_EMAIL_WATCH_CAP;
}

export type IpRateLimiter = {
  /** Record a hit for the key and report whether it's within budget. */
  check: (key: string, nowMs?: number) => boolean;
  /** Test/introspection helper. */
  size: () => number;
};

/**
 * Sliding-window-ish limiter: per key, a window start + count. When the
 * window expires the bucket resets. Old buckets are pruned opportunistically
 * so the map can't grow unbounded across a long-lived warm instance.
 */
export function createIpRateLimiter(opts?: {
  maxRequests?: number;
  windowMs?: number;
}): IpRateLimiter {
  const maxRequests = opts?.maxRequests ?? IP_LIMIT_MAX_REQUESTS;
  const windowMs = opts?.windowMs ?? IP_LIMIT_WINDOW_MS;
  const buckets = new Map<string, { windowStart: number; count: number }>();

  function prune(nowMs: number): void {
    // Cheap opportunistic sweep — only when the map is getting large.
    if (buckets.size < 1_000) return;
    for (const [k, b] of buckets) {
      if (nowMs - b.windowStart >= windowMs) buckets.delete(k);
    }
  }

  return {
    check(key: string, nowMs: number = Date.now()): boolean {
      prune(nowMs);
      const bucket = buckets.get(key);
      if (!bucket || nowMs - bucket.windowStart >= windowMs) {
        buckets.set(key, { windowStart: nowMs, count: 1 });
        return true;
      }
      bucket.count += 1;
      return bucket.count <= maxRequests;
    },
    size: () => buckets.size,
  };
}

/**
 * Client IP for rate-limit keying. On Vercel, `x-forwarded-for`'s FIRST hop is
 * the client (later hops are proxies). Untrusted input — it only keys a rate
 * bucket, never authorization — so a spoofed header just picks a different
 * bucket. Falls back to a shared key when absent (local dev).
 */
export function clientIpKey(headers: { get(name: string): string | null }): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}
