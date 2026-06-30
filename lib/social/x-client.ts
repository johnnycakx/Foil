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
//   - reply (Fix 3b): same endpoint with reply:{ in_reply_to_tweet_id } (per
//     docs.x.com/x-api/posts/creation-of-a-post, fetched 2026-06-27). The main
//     tweet stays LINK-FREE for reach (X throttles posts with a link); the card
//     link is posted as the first reply.
// COST: a post containing a URL is $0.20 per request, a link-free post ~$0.015
// (pay-per-use). A link-in-reply thread is therefore ~$0.015 (main) + $0.20
// (reply) ~= $0.215, vs $0.20 for a single post-with-link. Set a spending cap in
// the X developer console. See docs/runbooks/x-bot.md.
//
// VERIFY-ON-ENABLE: X's media-upload auth has been migrating (v1.1 vs /2/media/
// upload, OAuth 1.0a vs 2.0). This client targets the documented v1.1 + OAuth1
// path; John must test it once with real creds before flipping X_BOT_LIVE=true.
// Everything here SOFT-FAILS (never throws) so a misconfig can't crash the cron.

import { createHmac, randomBytes } from "node:crypto";

const MEDIA_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";
// Chunked async upload for VIDEO (ADR-074 Phase 1, the card-hero motion path).
// Per docs.x.com/x-api/media/quickstart/media-upload-chunked (fetched 2026-06-27):
// POST multipart/form-data to api.x.com/2/media/upload with command=INIT/APPEND/
// FINALIZE, then GET command=STATUS until processing_info.state=succeeded. The
// created post then references the returned media id, same as the image path.
const MEDIA_UPLOAD_V2_URL = "https://api.x.com/2/media/upload";
// 1MB segments (the doc's recommended chunk size). Our clips are ~1-3MB → 1-3 APPENDs.
const VIDEO_CHUNK_BYTES = 1_000_000;
// Bound the FINALIZE→STATUS processing poll so a stuck transcode can't hang the
// cron/approve route. A silent ~2.5s loop transcodes near-instantly in practice.
const VIDEO_STATUS_MAX_POLLS = 12;
const VIDEO_STATUS_MAX_WAIT_MS = 90_000;
const CREATE_POST_URL = "https://api.x.com/2/tweets";
const TWEETS_LOOKUP_URL = "https://api.x.com/2/tweets";
const SEARCH_RECENT_URL = "https://api.x.com/2/tweets/search/recent";

export type XCredentials = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
};

export type PostToXInput = {
  text: string;
  /** Optional portrait PNG to attach (the Phase 0 still / fallback). */
  imagePng?: Uint8Array | null;
  /** Optional MP4 motion clip (ADR-074). Preferred when present; on an upload
   *  reject we fall back to `imagePng` so a post never goes out empty. */
  videoMp4?: Uint8Array | null;
  /** Fix 3b: the card/board link to post as the FIRST REPLY (the body stays
   *  link-free for reach). Best-effort: a reply failure never fails the post —
   *  the main tweet is already out. Null/empty → no reply. */
  linkReply?: string | null;
  fetchImpl?: typeof fetch;
  /** Test/explicit creds; defaults to reading the X_* env vars. */
  credentials?: XCredentials;
  /** Injectable sleep for the video STATUS poll (tests pass a no-op). */
  sleepImpl?: (ms: number) => Promise<void>;
};

export type PostToXResult =
  | { ok: true; postId: string; mediaId?: string; replyId?: string }
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

// --- chunked async VIDEO upload (ADR-074 Phase 1) ---------------------------
//
// VERIFY-ON-ENABLE (like the image path): OAuth 1.0a + the v2 multipart media
// endpoint is the documented path, but X has been migrating media auth — John
// must confirm one real upload before relying on motion in live mode. Until
// then it SOFT-FAILS and the caller posts the Phase 0 still (the guaranteed
// fallback), so a misconfigured video path can never produce a contentless post.

const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

type VideoUploadResult = { ok: true; mediaId: string } | { ok: false; error: string };

/** POST a multipart command to the v2 media endpoint. OAuth 1.0a signs only the
 *  oauth_* params (multipart bodies are not folded into the signature base). */
async function postMediaCommand(
  creds: XCredentials,
  fetchFn: typeof fetch,
  form: FormData,
): Promise<Response> {
  const auth = oauthHeader("POST", MEDIA_UPLOAD_V2_URL, creds); // multipart → no body params signed
  return fetchFn(MEDIA_UPLOAD_V2_URL, { method: "POST", headers: { Authorization: auth }, body: form });
}

/**
 * Upload an MP4 via INIT → APPEND(s) → FINALIZE → STATUS-poll, returning the
 * media id once processing succeeds. Soft-fails (never throws). `media_category=
 * tweet_video` per the docs. Chunk = 1MB. Read the v2 `{ data: { id, ... } }`
 * shape (not the v1.1 `media_id_string`).
 */
export async function uploadVideoMedia(
  mp4: Uint8Array,
  creds: XCredentials,
  fetchFn: typeof fetch,
  sleepFn: (ms: number) => Promise<void> = realSleep,
): Promise<VideoUploadResult> {
  try {
    // INIT
    const init = new FormData();
    init.append("command", "INIT");
    init.append("media_type", "video/mp4");
    init.append("total_bytes", String(mp4.length));
    init.append("media_category", "tweet_video");
    const initRes = await postMediaCommand(creds, fetchFn, init);
    if (!initRes.ok) return { ok: false, error: `video_init_http_${initRes.status}` };
    const initJson = (await initRes.json()) as { data?: { id?: string }; media_id_string?: string };
    const mediaId = initJson.data?.id ?? initJson.media_id_string;
    if (!mediaId) return { ok: false, error: "video_init_no_id" };

    // APPEND (1MB segments)
    let segment = 0;
    for (let offset = 0; offset < mp4.length; offset += VIDEO_CHUNK_BYTES) {
      const chunk = mp4.subarray(offset, Math.min(offset + VIDEO_CHUNK_BYTES, mp4.length));
      const ap = new FormData();
      ap.append("command", "APPEND");
      ap.append("media_id", mediaId);
      ap.append("segment_index", String(segment));
      ap.append("media", new Blob([chunk as unknown as BlobPart], { type: "application/octet-stream" }));
      const apRes = await postMediaCommand(creds, fetchFn, ap);
      if (!apRes.ok) return { ok: false, error: `video_append_http_${apRes.status}` };
      segment++;
    }

    // FINALIZE
    const fin = new FormData();
    fin.append("command", "FINALIZE");
    fin.append("media_id", mediaId);
    const finRes = await postMediaCommand(creds, fetchFn, fin);
    if (!finRes.ok) return { ok: false, error: `video_finalize_http_${finRes.status}` };
    const finJson = (await finRes.json()) as { data?: { processing_info?: ProcessingInfo }; processing_info?: ProcessingInfo };
    let info = finJson.data?.processing_info ?? finJson.processing_info;

    // STATUS poll until succeeded/failed. No processing_info → already ready.
    const startedAt = Date.now();
    for (let poll = 0; info && info.state !== "succeeded" && poll < VIDEO_STATUS_MAX_POLLS; poll++) {
      if (info.state === "failed") return { ok: false, error: `video_processing_failed${info.error?.message ? `: ${info.error.message}` : ""}` };
      const waitMs = Math.min(Math.max((info.check_after_secs ?? 1) * 1000, 500), 15_000);
      if (Date.now() - startedAt + waitMs > VIDEO_STATUS_MAX_WAIT_MS) return { ok: false, error: "video_processing_timeout" };
      await sleepFn(waitMs);
      const stUrl = `${MEDIA_UPLOAD_V2_URL}?command=STATUS&media_id=${encodeURIComponent(mediaId)}`;
      const stAuth = oauthHeader("GET", MEDIA_UPLOAD_V2_URL, creds, { command: "STATUS", media_id: mediaId });
      const stRes = await fetchFn(stUrl, { headers: { Authorization: stAuth } });
      if (!stRes.ok) return { ok: false, error: `video_status_http_${stRes.status}` };
      const stJson = (await stRes.json()) as { data?: { processing_info?: ProcessingInfo }; processing_info?: ProcessingInfo };
      info = stJson.data?.processing_info ?? stJson.processing_info;
    }
    if (info && info.state !== "succeeded") return { ok: false, error: `video_not_ready_${info.state}` };
    return { ok: true, mediaId };
  } catch (err) {
    return { ok: false, error: `video_upload_failed: ${(err as Error).message}` };
  }
}

type ProcessingInfo = { state: string; check_after_secs?: number; error?: { message?: string } };

// --- create a post (optionally with media, optionally as a reply) ------------

/** POST /2/tweets. `mediaId` attaches media; `inReplyToTweetId` threads it as a
 *  reply (Fix 3b). JSON body → not folded into the OAuth signature. Soft-fails. */
async function createPost(
  text: string,
  creds: XCredentials,
  fetchFn: typeof fetch,
  opts: { mediaId?: string; inReplyToTweetId?: string } = {},
): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  try {
    const payload: Record<string, unknown> = { text };
    if (opts.mediaId) payload.media = { media_ids: [opts.mediaId] };
    if (opts.inReplyToTweetId) payload.reply = { in_reply_to_tweet_id: opts.inReplyToTweetId };
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
    return { ok: true, postId };
  } catch (err) {
    return { ok: false, error: `create_post_failed: ${(err as Error).message}` };
  }
}

// --- read: per-tweet public engagement metrics (ADR-071 follow-up, Part 2) ----

export type TweetMetrics = {
  tweetId: string;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  /** Null when the API omits impression_count for this auth context. */
  impressions: number | null;
};

export type FetchTweetMetricsResult =
  | { ok: true; metrics: Map<string, TweetMetrics>; missing: string[] }
  | { ok: false; error: string };

/**
 * Read public_metrics for up to 100 tweets in one call:
 *   GET https://api.x.com/2/tweets?ids=...&tweet.fields=public_metrics
 * (shape per docs.x.com v2: data[].public_metrics.{like_count, retweet_count,
 * reply_count, quote_count, impression_count}). OAuth 1.0a user-context — the
 * GET query params are folded into the signature base. Soft-fails (never
 * throws). `missing` = requested ids the API did NOT return (deleted/inaccessible).
 * Read-only; ~$0.005/request. Reuses the single X boundary's signing.
 */
export async function fetchTweetPublicMetrics(
  tweetIds: string[],
  input: { credentials?: XCredentials; fetchImpl?: typeof fetch } = {},
): Promise<FetchTweetMetricsResult> {
  const creds = input.credentials ?? xCredentialsFromEnv();
  if (!creds) return { ok: false, error: "missing_x_credentials" };
  const ids = tweetIds.filter(Boolean).slice(0, 100);
  if (ids.length === 0) return { ok: true, metrics: new Map(), missing: [] };
  const fetchFn = input.fetchImpl ?? fetch;

  // Build the query string with rfc3986 so it is byte-identical to the signature
  // base (the params must match what the server re-derives for OAuth 1.0a).
  const queryParams: Record<string, string> = { ids: ids.join(","), "tweet.fields": "public_metrics" };
  const qs = Object.keys(queryParams)
    .map((k) => `${rfc3986(k)}=${rfc3986(queryParams[k])}`)
    .join("&");
  const auth = oauthHeader("GET", TWEETS_LOOKUP_URL, creds, queryParams);

  try {
    const res = await fetchFn(`${TWEETS_LOOKUP_URL}?${qs}`, { headers: { Authorization: auth } });
    if (!res.ok) return { ok: false, error: `tweets_lookup_http_${res.status}` };
    const json = (await res.json()) as {
      data?: Array<{ id: string; public_metrics?: Record<string, number> }>;
      errors?: Array<{ resource_id?: string }>;
    };
    const metrics = new Map<string, TweetMetrics>();
    for (const t of json.data ?? []) {
      const pm = t.public_metrics ?? {};
      metrics.set(t.id, {
        tweetId: t.id,
        likes: pm.like_count ?? 0,
        reposts: pm.retweet_count ?? 0,
        replies: pm.reply_count ?? 0,
        quotes: pm.quote_count ?? 0,
        impressions: typeof pm.impression_count === "number" ? pm.impression_count : null,
      });
    }
    const missing = ids.filter((id) => !metrics.has(id));
    return { ok: true, metrics, missing };
  } catch (err) {
    return { ok: false, error: `tweets_lookup_failed: ${(err as Error).message}` };
  }
}

export type XPost = {
  id: string;
  text: string;
  authorId: string | null;
  authorUsername: string | null;
  /** Author follower count (reach signal, ADR-086 hardening). Null if absent. */
  authorFollowers: number | null;
  createdAt: string | null;
  metrics: { likes: number; replies: number; reposts: number; impressions: number | null } | null;
};

export type SearchRecentResult = { ok: true; posts: XPost[] } | { ok: false; error: string };

/**
 * READ-ONLY recent search (GET /2/tweets/search/recent) — the only read the
 * engagement-brief engine (ADR-086) uses. Returns recent posts matching `query`
 * with author + public-metrics expansions. This NEVER posts, replies, likes,
 * follows, or DMs — it only reads. Entitlement verified live 2026-06-29 (HTTP
 * 200; 300/15min user-auth). Soft-fail; never throws.
 *
 * Search is pay-per-usage (billed on data retrieved), so keep `maxResults` small
 * and the daily query count low; the console spending cap (R-019) bounds it.
 */
export async function searchRecent(
  query: string,
  input: { maxResults?: number; credentials?: XCredentials; fetchImpl?: typeof fetch } = {},
): Promise<SearchRecentResult> {
  const creds = input.credentials ?? xCredentialsFromEnv();
  if (!creds) return { ok: false, error: "missing_x_credentials" };
  if (!query.trim()) return { ok: false, error: "empty_query" };
  const fetchFn = input.fetchImpl ?? fetch;
  // The API requires 10..100; clamp so a caller can't under/over-shoot.
  const maxResults = Math.min(Math.max(input.maxResults ?? 10, 10), 100);

  const queryParams: Record<string, string> = {
    query,
    max_results: String(maxResults),
    "tweet.fields": "created_at,public_metrics,author_id",
    expansions: "author_id",
    "user.fields": "username,public_metrics",
  };
  const qs = Object.keys(queryParams)
    .map((k) => `${rfc3986(k)}=${rfc3986(queryParams[k])}`)
    .join("&");
  const auth = oauthHeader("GET", SEARCH_RECENT_URL, creds, queryParams);

  try {
    const res = await fetchFn(`${SEARCH_RECENT_URL}?${qs}`, { headers: { Authorization: auth } });
    if (!res.ok) return { ok: false, error: `search_http_${res.status}` };
    const json = (await res.json()) as {
      data?: Array<{ id: string; text: string; author_id?: string; created_at?: string; public_metrics?: Record<string, number> }>;
      includes?: { users?: Array<{ id: string; username?: string; public_metrics?: Record<string, number> }> };
    };
    const userById = new Map((json.includes?.users ?? []).map((u) => [u.id, u]));
    const posts: XPost[] = (json.data ?? []).map((t) => {
      const u = t.author_id ? userById.get(t.author_id) : undefined;
      return {
      id: t.id,
      text: t.text,
      authorId: t.author_id ?? null,
      authorUsername: u?.username ?? null,
      authorFollowers: typeof u?.public_metrics?.followers_count === "number" ? u.public_metrics.followers_count : null,
      createdAt: t.created_at ?? null,
      metrics: t.public_metrics
        ? {
            likes: t.public_metrics.like_count ?? 0,
            replies: t.public_metrics.reply_count ?? 0,
            reposts: t.public_metrics.retweet_count ?? 0,
            impressions: typeof t.public_metrics.impression_count === "number" ? t.public_metrics.impression_count : null,
          }
        : null,
      };
    });
    return { ok: true, posts };
  } catch (err) {
    return { ok: false, error: `search_failed: ${(err as Error).message}` };
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
  const hasVideo = !!input.videoMp4 && input.videoMp4.length > 0;
  const hasImage = !!input.imagePng && input.imagePng.length > 0;
  if (hasVideo) {
    // Prefer the motion clip; on ANY video failure fall back to the still so the
    // post still goes out (the Phase 0 still is the guaranteed fallback).
    const vid = await uploadVideoMedia(input.videoMp4!, creds, fetchFn, input.sleepImpl ?? realSleep);
    if (vid.ok) {
      mediaId = vid.mediaId;
    } else if (hasImage) {
      const img = await uploadMedia(input.imagePng!, creds, fetchFn);
      if (!img.ok) return { ok: false, error: `video_then_image_failed: ${vid.error}; ${img.error}` };
      mediaId = img.mediaId;
    } else {
      return { ok: false, error: vid.error };
    }
  } else if (hasImage) {
    const up = await uploadMedia(input.imagePng!, creds, fetchFn);
    if (!up.ok) return { ok: false, error: up.error };
    mediaId = up.mediaId;
  }

  const main = await createPost(input.text, creds, fetchFn, mediaId ? { mediaId } : {});
  if (!main.ok) return { ok: false, error: main.error };

  // Fix 3b: the body is link-free for reach; post the link as the first reply.
  // Best-effort — the main tweet is already out, so a reply failure must NOT
  // fail the post (we just don't get the threaded link). Reported via replyId.
  let replyId: string | undefined;
  const linkReply = input.linkReply?.trim();
  if (linkReply) {
    const reply = await createPost(linkReply, creds, fetchFn, { inReplyToTweetId: main.postId });
    if (reply.ok) replyId = reply.postId;
    else console.warn("[x-client] link reply failed (main post is live):", reply.error);
  }

  return { ok: true, postId: main.postId, mediaId, ...(replyId ? { replyId } : {}) };
}
