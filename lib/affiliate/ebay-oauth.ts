// eBay OAuth client_credentials helper. See ADR-023.
//
// The Browse API requires a Bearer access token fetched via the
// client_credentials grant against eBay's identity service. The token is
// scoped to the public Browse API ("https://api.ebay.com/oauth/api_scope")
// and is granted with a 2-hour TTL (empirically verified 2026-05-24).
//
// Architectural rules:
//   1. Soft-fail. Every error path returns `null`. Browse-API callers
//      already soft-fail to the "browse on eBay" fallback CTA when
//      getAccessToken returns null — the page never 500s on auth issues.
//   2. Module-level in-memory cache keyed on expiresAt. Refresh when the
//      cached token has < 60s remaining. This is a single-process cache:
//      each Fluid Compute instance refetches once per 2hr-ish window.
//      eBay's rate limit on the OAuth endpoint is generous; the cache
//      exists for latency, not quota.
//   3. Credentials NEVER appear in error strings, log lines, or thrown
//      messages. The token itself is also never logged.

// Module-level cache. Reset on cold start, persists across invocations
// within the same Fluid Compute instance.
type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;

const OAUTH_ENDPOINT = "https://api.ebay.com/identity/v1/oauth2/token";
const PUBLIC_SCOPE = "https://api.ebay.com/oauth/api_scope";
const REFRESH_BUFFER_MS = 60_000;

export type GetAccessTokenInput = {
  /** Test injection. */
  fetchImpl?: typeof fetch;
};

export type AccessToken = {
  token: string;
  expiresAt: number;
};

/**
 * Fetch (or return cached) an eBay OAuth access token for the public Browse
 * API scope. Returns `null` on any failure — caller soft-fails to the
 * fallback CTA per ADR-021's compliance posture.
 *
 * The in-memory cache is refreshed when the remaining TTL drops below 60s.
 */
export async function getAccessToken(
  input: GetAccessTokenInput = {},
): Promise<AccessToken | null> {
  const now = Date.now();
  if (cached && cached.expiresAt - now > REFRESH_BUFFER_MS) {
    return cached;
  }

  const appId = process.env.EBAY_DEVELOPER_APP_ID;
  const certId = process.env.EBAY_DEVELOPER_CERT_ID;
  if (!appId || !certId) {
    return null;
  }

  const basic = Buffer.from(`${appId}:${certId}`).toString("base64");
  const body = `grant_type=client_credentials&scope=${encodeURIComponent(PUBLIC_SCOPE)}`;
  const fetchFn = input.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchFn(OAUTH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      // The token is short-lived enough that we want a fresh fetch each
      // time the in-memory cache expires; no platform-level caching.
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;
  const { access_token, expires_in } = payload as {
    access_token?: unknown;
    expires_in?: unknown;
  };
  if (typeof access_token !== "string" || !access_token) return null;
  const ttlSec = typeof expires_in === "number" && expires_in > 0 ? expires_in : 7200;
  cached = {
    token: access_token,
    expiresAt: now + ttlSec * 1000,
  };
  return cached;
}

/**
 * Test-only escape hatch — drop the in-process token cache so a test can
 * exercise the "refresh from cold" path deterministically. NOT for runtime
 * code paths.
 */
export function __resetTokenCacheForTests(): void {
  cached = null;
}
