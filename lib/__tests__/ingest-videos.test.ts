// Ad-hoc video ingestion (ADR-067; extends ADR-050). Pins the yt-dlp arg vector
// AND the security boundary (parseVideoId) — no network call needed.

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVideoYtDlpArgs,
  parseVideoId,
  canonicalVideoUrl,
} from "../../scripts/ingest-videos.ts";

// ---------------------------------------------------------------------------
// buildVideoYtDlpArgs — single-video invocation (no channel playlist / dateafter)
// ---------------------------------------------------------------------------

test("buildVideoYtDlpArgs: auto-subs flags + the video URL last, no channel/dateafter", () => {
  const url = "https://www.youtube.com/watch?v=whzj_2eOgpA";
  const args = buildVideoYtDlpArgs([], url, "/tmp/out");
  assert.ok(args.includes("--write-auto-subs"));
  assert.ok(args.includes("--skip-download"));
  assert.ok(args.includes("--no-playlist"), "single-video mode must not pull a playlist");
  assert.equal(args[args.indexOf("--sub-langs") + 1], "en.*");
  assert.equal(args[args.indexOf("--sub-format") + 1], "vtt");
  // Channel-mode flags must NOT be present.
  assert.ok(!args.includes("--dateafter"), "ad-hoc mode is not date-windowed");
  assert.ok(!args.includes("--playlist-end"), "ad-hoc mode is not a playlist");
  assert.ok(!args.some((a) => a.includes("/videos")), "no @handle/videos playlist URL");
  // The URL is the final positional arg.
  assert.equal(args[args.length - 1], url);
});

test("buildVideoYtDlpArgs: no cookies by default (residential); --cookies-from-browser when given", () => {
  const url = "https://www.youtube.com/watch?v=whzj_2eOgpA";
  const bare = buildVideoYtDlpArgs([], url, "/tmp/out");
  assert.ok(!bare.includes("--cookies-from-browser"));
  assert.ok(!bare.includes("--cookies"));

  const withCookies = buildVideoYtDlpArgs([], url, "/tmp/out", "chrome");
  const i = withCookies.indexOf("--cookies-from-browser");
  assert.ok(i >= 0, "expected --cookies-from-browser");
  assert.equal(withCookies[i + 1], "chrome");
});

test("buildVideoYtDlpArgs: prepends the `pre` vector (e.g. python -m yt_dlp)", () => {
  const args = buildVideoYtDlpArgs(["-m", "yt_dlp"], "https://www.youtube.com/watch?v=whzj_2eOgpA", "/tmp/out");
  assert.equal(args[0], "-m");
  assert.equal(args[1], "yt_dlp");
});

// ---------------------------------------------------------------------------
// parseVideoId — the security boundary (strict 11-char id, YouTube hosts only)
// ---------------------------------------------------------------------------

test("parseVideoId: accepts the standard URL shapes + a bare id", () => {
  assert.equal(parseVideoId("https://www.youtube.com/watch?v=whzj_2eOgpA"), "whzj_2eOgpA");
  assert.equal(parseVideoId("https://youtube.com/watch?v=6X64f1AndtM&t=10s"), "6X64f1AndtM");
  assert.equal(parseVideoId("https://youtu.be/BSrOFsOMUdg"), "BSrOFsOMUdg");
  assert.equal(parseVideoId("https://www.youtube.com/shorts/xuPyBS--EKU"), "xuPyBS--EKU");
  assert.equal(parseVideoId("https://www.youtube.com/embed/xc2IjVqVdQY"), "xc2IjVqVdQY");
  assert.equal(parseVideoId("XUCiFyjtdVI"), "XUCiFyjtdVI"); // bare id
  assert.equal(parseVideoId("  https://m.youtube.com/watch?v=z_QkDtZPc5s  "), "z_QkDtZPc5s"); // trimmed
});

test("parseVideoId: rejects non-YouTube hosts + malformed ids (returns null, never throws)", () => {
  assert.equal(parseVideoId(""), null);
  assert.equal(parseVideoId("not a url"), null);
  assert.equal(parseVideoId("https://evil.com/watch?v=whzj_2eOgpA"), null, "non-YouTube host rejected");
  assert.equal(parseVideoId("https://www.youtube.com/watch?v=tooShort"), null, "id must be 11 chars");
  assert.equal(parseVideoId("https://www.youtube.com/watch?v=way_too_long_id_here"), null);
  assert.equal(parseVideoId("ftp://www.youtube.com/watch?v=whzj_2eOgpA"), null, "non-http(s) rejected");
});

test("parseVideoId: a hostile 'URL' cannot inject yt-dlp args or reach a shell", () => {
  // Even an input crafted to look like flags / shell metachars yields either
  // null (skipped) or a clean 11-char id; the canonical URL we build always
  // starts with https:// (never `-`), so it can't be parsed as a yt-dlp flag.
  assert.equal(parseVideoId("--config-location=/etc/evil"), null);
  assert.equal(parseVideoId("https://www.youtube.com/watch?v=$(rm -rf /)"), null);
  assert.equal(parseVideoId("https://www.youtube.com/watch?v=a;rm -rf /"), null);
  // A legitimate id that begins with a dash still canonicalizes to an https URL,
  // so the argv element is never dash-led.
  const dashId = "-abc12345_X"; // 11 valid chars, leading dash
  assert.equal(parseVideoId(dashId), dashId);
  assert.ok(canonicalVideoUrl(dashId).startsWith("https://"), "canonical URL must start with https://, never `-`");
});

test("canonicalVideoUrl: builds a watch URL from a validated id", () => {
  assert.equal(canonicalVideoUrl("whzj_2eOgpA"), "https://www.youtube.com/watch?v=whzj_2eOgpA");
});
