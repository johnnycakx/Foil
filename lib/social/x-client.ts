// X (Twitter) API v2 posting boundary (ADR-058). THE ONLY module that calls the
// X API — like lib/affiliate/epn.ts is the only eBay-affiliate boundary and
// lib/beehiiv.ts the only Beehiiv one. Nothing else may import the X API.
//
// Posting requires USER-CONTEXT auth (app-only Bearer cannot create posts). We
// use OAuth 1.0a user tokens (consumer key/secret + access token/secret) because
// they are long-lived and need no interactive refresh flow, which suits a
// headless own-account bot. Endpoints (docs.x.com, verified 2026-06):
//   - media upload: POST https://upload.twitter.com/1.1/media/upload.json
//     (multipart `media`; OAuth 1.0a; returns { media_id_string }).
//   - create post: POST https://api.x.com/2/tweets  { text, media:{ media_ids } }.
// COST: a post containing a URL is $0.20 per request (pay-per-use); set a
// spending cap in the X developer console. See docs/runbooks/x-bot.md.
//
// VERIFY-ON-ENABLE: X's media-upload auth has been migrating (v1.1 vs /2/media/
// upload, OAuth 1.0a vs 2.0). This client targets the documented v1.1 + OAuth1
// path; John must test it once with real creds before flipping X_BOT_LIVE=true.
// Everything here SOFT-FAILS (never throws) so a misconfig can't crash the cron.

import { createHmac, randomBytes } from "node:crypto";

const MEDIA_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";
const CREATE_POST_URL = "https://api.x.com/2/tweets";

export type XCredentials = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
};

export type PostToXInput = {
  text: string;
  /** Optional portrait PNG to attach. */
  imagePng?: Uint8Array | null;
  fetchImpl?: typeof fetch;
  /** Test/explicit creds; defaults to reading the X_* env vars. */
  credentials?: XCredentials;
};

export type PostToXResult =
  | { ok: true; postId: string; mediaId?: string }
  | { ok: false; error: string };

/** Read OAuth 1.0a user-context creds from env. Null if any are missing. */
export function xCredentialsFromEnv(): XCredentials | null {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) return null;
  return { apiKey, apiSecret, accessToken, accessSecret };
}

// --- OAuth 1.0a signing (RFC 5849) -----------------------------------------

function rfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Build the `Authorization: OAuth ...` header for a request. `bodyParams` are
 *  included in the signature only for form-encoded requests (not multipart/JSON). */
function oauthHeader(
  method: string,
  url: string,
  creds: XCredentials,
  bodyParams: Record<string, string> = {},
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  const all = { ...oauth, ...bodyParams };
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(all[k])}`)
    .join("&");
  const base = [method.toUpperCase(), rfc3986(url), rfc3986(paramString)].join("&");
  const signingKey = `${rfc3986(creds.apiSecret)}&${rfc3986(creds.accessSecret)}`;
  oauth.oauth_signature = createHmac("sha1", signingKey).update(base).digest("base64");
  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((k) => `${rfc3986(k)}="${rfc3986(oauth[k])}"`)
      .join(", ")
  );
}

async function uploadMedia(png: Uint8Array, creds: XCredentials, fetchFn: typeof fetch): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
  try {
    // v1.1 simple upload accepts base64 `media_data` as a form field; that field
    // is part of the OAuth signature base for application/x-www-form-urlencoded.
    const mediaData = Buffer.from(png).toString("base64");
    const bodyParams = { media_data: mediaData };
    const auth = oauthHeader("POST", MEDIA_UPLOAD_URL, creds, bodyParams);
    const res = await fetchFn(MEDIA_UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(bodyParams).toString(),
    });
    if (!res.ok) return { ok: false, error: `media_upload_http_${res.status}` };
    const json = (await res.json()) as { media_id_string?: string };
    if (!json.media_id_string) return { ok: false, error: "media_upload_no_id" };
    return { ok: true, mediaId: json.media_id_string };
  } catch (err) {
    return { ok: false, error: `media_upload_failed: ${(err as Error).message}` };
  }
}

/**
 * Post to X. Soft-fails (never throws): returns { ok:false } when creds are
 * missing or any request fails. Uploads the image first (if any), then creates
 * the post with the media id. This is the ONLY function in the codebase that
 * writes to X.
 */
export async function postToX(input: PostToXInput): Promise<PostToXResult> {
  const creds = input.credentials ?? xCredentialsFromEnv();
  if (!creds) return { ok: false, error: "missing_x_credentials" };
  if (!input.text?.trim()) return { ok: false, error: "empty_text" };
  const fetchFn = input.fetchImpl ?? fetch;

  let mediaId: string | undefined;
  if (input.imagePng && input.imagePng.length > 0) {
    const up = await uploadMedia(input.imagePng, creds, fetchFn);
    if (!up.ok) return { ok: false, error: up.error };
    mediaId = up.mediaId;
  }

  try {
    const payload: Record<string, unknown> = { text: input.text };
    if (mediaId) payload.media = { media_ids: [mediaId] };
    const auth = oauthHeader("POST", CREATE_POST_URL, creds); // JSON body → not signed
    const res = await fetchFn(CREATE_POST_URL, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, error: `create_post_http_${res.status}` };
    const json = (await res.json()) as { data?: { id?: string } };
    const postId = json.data?.id;
    if (!postId) return { ok: false, error: "create_post_no_id" };
    return { ok: true, postId, mediaId };
  } catch (err) {
    return { ok: false, error: `create_post_failed: ${(err as Error).message}` };
  }
}
