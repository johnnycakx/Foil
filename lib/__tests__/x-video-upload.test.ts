// Card-hero v2 Phase 1: X chunked VIDEO upload + the still-fallback contract
// (ADR-074). Pins the documented INIT→APPEND→FINALIZE→STATUS sequence
// (docs.x.com/x-api/media/quickstart/media-upload-chunked), that postToX prefers
// the clip but falls back to the still on an upload reject (so a post is never
// empty), the drafts video round-trip, the approve path posting the persisted
// clip, and the Discord MP4 preview attachment. All network is mocked.

import test from "node:test";
import assert from "node:assert/strict";
import { uploadVideoMedia, postToX, type XCredentials } from "../social/x-client.ts";
import { InMemoryDraftStore, bytesToBase64, expiryFrom } from "../social/drafts.ts";
import { processApproval } from "../social/approval.ts";
import { postDiscordMedia } from "../notifications/discord.ts";
import type { PostToXResult } from "../social/x-client.ts";

const CREDS: XCredentials = { apiKey: "k", apiSecret: "s", accessToken: "t", accessSecret: "x" };
const noSleep = async () => {};
const MEDIA_V2 = "https://api.x.com/2/media/upload";
const MEDIA_V11 = "https://upload.twitter.com/1.1/media/upload.json";
const TWEETS = "https://api.x.com/2/tweets";

type Rec = { url: string; method: string; command: string | null; segment: string | null; mediaCategory: string | null; totalBytes: string | null; jsonBody?: unknown };

/** A routing mock for the X media + tweets endpoints. `plan` overrides responses. */
function xMock(plan: {
  initStatus?: number;
  initBody?: unknown;
  appendStatus?: number;
  finalizeBody?: unknown;
  statusBodies?: unknown[];
  imageStatus?: number;
  tweetId?: string;
} = {}) {
  const calls: Rec[] = [];
  let statusIdx = 0;
  const fetchImpl = (async (url: unknown, opts: { method?: string; body?: unknown } = {}) => {
    const u = String(url);
    const method = (opts.method ?? "GET").toUpperCase();
    const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
    const form = isForm ? (opts.body as FormData) : null;
    const command = form ? (form.get("command") as string | null) : u.includes("command=STATUS") ? "STATUS" : null;
    const rec: Rec = {
      url: u, method, command,
      segment: form ? (form.get("segment_index") as string | null) : null,
      mediaCategory: form ? (form.get("media_category") as string | null) : null,
      totalBytes: form ? (form.get("total_bytes") as string | null) : null,
    };
    if (!isForm && typeof opts.body === "string") { try { rec.jsonBody = JSON.parse(opts.body); } catch { /* */ } }
    calls.push(rec);

    if (u.startsWith(MEDIA_V2) && command === "STATUS") {
      const body = plan.statusBodies?.[statusIdx++] ?? { data: { processing_info: { state: "succeeded" } } };
      return new Response(JSON.stringify(body), { status: 200 });
    }
    if (u.startsWith(MEDIA_V2) && command === "INIT") {
      return new Response(JSON.stringify(plan.initBody ?? { data: { id: "vid-1" } }), { status: plan.initStatus ?? 200 });
    }
    if (u.startsWith(MEDIA_V2) && command === "APPEND") {
      return new Response("", { status: plan.appendStatus ?? 200 });
    }
    if (u.startsWith(MEDIA_V2) && command === "FINALIZE") {
      return new Response(JSON.stringify(plan.finalizeBody ?? { data: { id: "vid-1" } }), { status: 200 });
    }
    if (u.startsWith(MEDIA_V11)) {
      return new Response(JSON.stringify({ media_id_string: "img-1" }), { status: plan.imageStatus ?? 200 });
    }
    if (u.startsWith(TWEETS) && method === "POST") {
      return new Response(JSON.stringify({ data: { id: plan.tweetId ?? "tweet-1" } }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

// --- uploadVideoMedia: the documented sequence ---

test("uploadVideoMedia runs INIT(tweet_video)→APPEND→FINALIZE and returns data.id", async () => {
  const { fetchImpl, calls } = xMock();
  const res = await uploadVideoMedia(new Uint8Array(500), CREDS, fetchImpl, noSleep);
  assert.deepEqual(res, { ok: true, mediaId: "vid-1" });
  const init = calls.find((c) => c.command === "INIT")!;
  assert.equal(init.mediaCategory, "tweet_video");
  assert.equal(init.totalBytes, "500");
  assert.equal(init.url.startsWith(MEDIA_V2), true, "uses the v2 media endpoint");
  assert.equal(calls.filter((c) => c.command === "APPEND").length, 1, "one segment for a <1MB clip");
  assert.ok(calls.some((c) => c.command === "FINALIZE"));
});

test("uploadVideoMedia chunks a >1MB clip into multiple APPENDs with incrementing segment_index", async () => {
  const { fetchImpl, calls } = xMock();
  const res = await uploadVideoMedia(new Uint8Array(2_500_000), CREDS, fetchImpl, noSleep);
  assert.equal(res.ok, true);
  const appends = calls.filter((c) => c.command === "APPEND");
  assert.equal(appends.length, 3, "2.5MB / 1MB → 3 segments");
  assert.deepEqual(appends.map((a) => a.segment), ["0", "1", "2"]);
});

test("uploadVideoMedia polls STATUS until succeeded when FINALIZE returns processing_info", async () => {
  const { fetchImpl, calls } = xMock({
    finalizeBody: { data: { processing_info: { state: "in_progress", check_after_secs: 0 } } },
    statusBodies: [
      { data: { processing_info: { state: "in_progress", check_after_secs: 0 } } },
      { data: { processing_info: { state: "succeeded" } } },
    ],
  });
  const res = await uploadVideoMedia(new Uint8Array(100), CREDS, fetchImpl, noSleep);
  assert.equal(res.ok, true);
  assert.equal(calls.filter((c) => c.command === "STATUS").length, 2, "polled twice to reach succeeded");
});

test("uploadVideoMedia soft-fails on a processing failure and on an INIT http error", async () => {
  const failProc = xMock({ finalizeBody: { data: { processing_info: { state: "failed", error: { message: "bad codec" } } } } });
  const r1 = await uploadVideoMedia(new Uint8Array(10), CREDS, failProc.fetchImpl, noSleep);
  assert.equal(r1.ok, false);
  if (!r1.ok) assert.match(r1.error, /video_processing_failed/);

  const failInit = xMock({ initStatus: 400 });
  const r2 = await uploadVideoMedia(new Uint8Array(10), CREDS, failInit.fetchImpl, noSleep);
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.equal(r2.error, "video_init_http_400");
});

// --- postToX: prefer the clip, fall back to the still on an upload reject ---

test("postToX uploads the video and creates the post with the video media id", async () => {
  const { fetchImpl, calls } = xMock({ tweetId: "tweet-9" });
  const res = await postToX({ text: "hi", videoMp4: new Uint8Array(300), imagePng: new Uint8Array([1]), credentials: CREDS, fetchImpl, sleepImpl: noSleep });
  assert.deepEqual(res, { ok: true, postId: "tweet-9", mediaId: "vid-1" });
  const post = calls.find((c) => c.url.startsWith(TWEETS) && c.method === "POST")!;
  assert.deepEqual((post.jsonBody as { media?: { media_ids: string[] } }).media?.media_ids, ["vid-1"]);
  // the v1.1 image path was NOT used (video succeeded).
  assert.equal(calls.some((c) => c.url.startsWith(MEDIA_V11)), false);
});

test("postToX falls back to the STILL when the video upload is rejected (post is never empty)", async () => {
  const { fetchImpl, calls } = xMock({ initStatus: 400, tweetId: "tweet-fallback" });
  const res = await postToX({ text: "hi", videoMp4: new Uint8Array(300), imagePng: new Uint8Array([1, 2, 3]), credentials: CREDS, fetchImpl, sleepImpl: noSleep });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.postId, "tweet-fallback");
  assert.equal(calls.some((c) => c.url.startsWith(MEDIA_V11)), true, "the still image was uploaded as the fallback");
  const post = calls.find((c) => c.url.startsWith(TWEETS) && c.method === "POST")!;
  assert.deepEqual((post.jsonBody as { media?: { media_ids: string[] } }).media?.media_ids, ["img-1"]);
});

test("postToX with a rejected video and NO still soft-fails (ok:false)", async () => {
  const { fetchImpl } = xMock({ initStatus: 500 });
  const res = await postToX({ text: "hi", videoMp4: new Uint8Array(300), imagePng: null, credentials: CREDS, fetchImpl, sleepImpl: noSleep });
  assert.equal(res.ok, false);
});

// --- drafts: the video round-trips through the store ---

test("the draft store persists + returns video_base64 alongside the still", async () => {
  const store = new InMemoryDraftStore(() => 1_000);
  const created = await store.create({
    angle: "deal_of_day", text: "t", link: "l",
    imageBase64: bytesToBase64(new Uint8Array([1])),
    videoBase64: bytesToBase64(new Uint8Array([2, 2])),
    expiresAt: expiryFrom(1_000, 12),
  });
  const got = await store.get(created.id);
  assert.equal(got?.video_base64, bytesToBase64(new Uint8Array([2, 2])));
  const claimed = await store.claimForPosting(created.id, "owner", 1_000);
  assert.equal(claimed?.video_base64, bytesToBase64(new Uint8Array([2, 2])), "the claim carries the clip for posting");
});

test("approve posts the persisted CLIP (and the still travels as the fallback)", async () => {
  const store = new InMemoryDraftStore(() => 1_000);
  const created = await store.create({
    angle: "deal_of_day", text: "exact text https://foiltcg.com/deals", link: "l",
    imageBase64: bytesToBase64(new Uint8Array([1, 1, 1])),
    videoBase64: bytesToBase64(new Uint8Array([9, 9, 9, 9])),
    expiresAt: expiryFrom(1_000, 12),
  });
  let postedVideo: Uint8Array | null = null;
  let postedImage: Uint8Array | null = null;
  const post = async (x: { text: string; imagePng: Uint8Array | null; videoMp4: Uint8Array | null }): Promise<PostToXResult> => {
    postedImage = x.imagePng; postedVideo = x.videoMp4;
    return { ok: true, postId: "tweet-1" };
  };
  const res = await processApproval({ store, post, id: created.id, action: "approve", actor: "owner", nowMs: 1_000 });
  assert.equal(res.ok, true);
  assert.deepEqual(postedVideo, new Uint8Array([9, 9, 9, 9]), "the reviewed clip bytes are posted verbatim");
  assert.deepEqual(postedImage, new Uint8Array([1, 1, 1]), "the still is the upload-reject fallback");
});

// --- Discord: the approval card can preview the MP4 ---

test("postDiscordMedia attaches an MP4 (Discord inline-previews the clip)", async () => {
  let attached: { filename: string; type: string } | null = null;
  const fetchImpl = (async (_url: unknown, opts: { body?: unknown }) => {
    const form = opts.body as FormData;
    const file = form.get("files[0]") as File;
    attached = { filename: file.name, type: file.type };
    return new Response("", { status: 200 });
  }) as unknown as typeof fetch;
  const res = await postDiscordMedia("https://discord.test/webhook", {
    filename: "x-deal_of_day.mp4", bytes: new Uint8Array([1, 2, 3]), contentType: "video/mp4", fetchImpl,
  });
  assert.equal(res.ok, true);
  assert.deepEqual(attached, { filename: "x-deal_of_day.mp4", type: "video/mp4" });
});
