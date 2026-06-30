// ZERO-X-WRITE INVARIANT (ADR-086) — the ToS + brand firewall. The engagement
// engine reads + drafts + delivers ONLY; it must never post, reply, like,
// follow, retweet, or DM on X. A human posts every reply by hand. This test
// reads the engagement source as TEXT and fails the build if any engagement
// file could reach an X write call — the structural guard that keeps the
// "drafted != sent" boundary from ever eroding.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// Every file in the engagement path (must all be write-free). Includes the
// foil-bot button-handler files (ADR-086 v2): the Skip/Post buttons live in the
// bot, and the "Post" button must NEVER post to X — it only surfaces copy-ready
// text + a deep link. The invariant test reads these as TEXT (CI never imports
// the bot — separate package + discord.js), so the firewall can't erode in a
// refactor of either half.
const ENGAGEMENT_FILES = [
  "lib/engagement/candidate-filter.ts",
  "lib/engagement/card-resolver.ts",
  "lib/engagement/draft.ts",
  "lib/engagement/brief-engine.ts",
  "lib/engagement/brief-queue.ts",
  "lib/engagement/store.ts",
  "lib/engagement/queries.ts",
  "lib/engagement/render.ts",
  "app/api/cron/engagement-brief/route.ts",
  // Content-intelligence format-mining (ADR-087): reads OTHER accounts' posts to
  // mine winning FORMATS, then generates OUR OWN posts (dry-run preview only).
  // The mining/brief/cron surfaces touch others' posts, so they stay strictly
  // read-only — the same firewall the engagement brief lives behind. (The own-post
  // GENERATOR — lib/social/format-generation.ts — is intentionally NOT here: it is
  // an own-post generator like post-text.ts, gate-validated, and is meant to feed
  // the live X-post path once proven.)
  "lib/engagement/format-mining.ts",
  "lib/engagement/format-brief.ts",
  "app/api/cron/format-mining/route.ts",
  // foil-bot delivery + button handlers (the new firewall surface):
  "bot/src/engagement/queue.ts",
  "bot/src/engagement/buttons.ts",
  "bot/src/engagement/render.ts",
  "bot/src/engagement/handler.ts",
];

// Identifiers / endpoints that perform an X WRITE or engagement action. None may
// appear anywhere in the engagement path.
const FORBIDDEN: Array<{ pattern: RegExp; what: string }> = [
  { pattern: /\bpostToX\b/, what: "postToX (create post)" },
  { pattern: /uploadVideoMedia|uploadMedia/, what: "media upload (write)" },
  { pattern: /fetchTweetPublicMetrics/, what: "metrics lookup (not needed; keep the X surface to search only)" },
  { pattern: /CREATE_POST_URL|MEDIA_UPLOAD/, what: "a write endpoint constant" },
  { pattern: /in_reply_to/, what: "a reply payload" },
  { pattern: /upload\.twitter\.com/, what: "the media-upload host" },
  { pattern: /\bapi\.x\.com\b/, what: "a direct X API URL (must go through searchRecent only)" },
  { pattern: /\.(like|follow|retweet|repost|dm|sendDM)\s*\(/i, what: "an engagement action call" },
  // The engagement path (esp. the bot's "Post" button) must NOT route to the
  // X-posting approval flow — that DOES post to X. Skip/Post are human-only.
  { pattern: /callApprovalEndpoint/, what: "the X-posting approval relay (would post to X)" },
  { pattern: /\/api\/x\/approve/, what: "the X-posting approval endpoint (would post to X)" },
];

for (const rel of ENGAGEMENT_FILES) {
  test(`zero-X-write invariant: ${rel} contains no X write/engagement call`, () => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    for (const f of FORBIDDEN) {
      assert.doesNotMatch(src, f.pattern, `${rel} must not reference ${f.what}`);
    }
  });
}

test("the engagement path imports ONLY the read-only `searchRecent` from x-client (never a write fn)", () => {
  // The single permitted X-API touch is the read search. Anything importing the
  // X boundary may import only searchRecent (+ its types).
  const ALLOWED = new Set(["searchRecent", "XPost", "SearchRecentResult", "XCredentials"]);
  for (const rel of ENGAGEMENT_FILES) {
    const src = readFileSync(join(ROOT, rel), "utf8");
    const importMatch = src.match(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["'][^"']*social\/x-client["']/);
    if (!importMatch) continue; // file doesn't import the X boundary at all — fine
    const names = importMatch[1]
      .split(",")
      .map((s) => s.replace(/\btype\b/g, "").trim())
      .filter(Boolean);
    for (const n of names) {
      assert.ok(ALLOWED.has(n), `${rel} imports "${n}" from x-client — only read-only names are allowed (${[...ALLOWED].join(", ")})`);
    }
  }
});

test("the only X-API endpoint the engagement path can reach is recent SEARCH (a read)", () => {
  // searchRecent (in x-client.ts) hits /2/tweets/search/recent. Confirm the
  // engagement path never names a non-search X endpoint directly.
  for (const rel of ENGAGEMENT_FILES) {
    const src = readFileSync(join(ROOT, rel), "utf8");
    const xUrls = src.match(/https?:\/\/[^\s"'`]*x\.com\/[^\s"'`]*/g) ?? [];
    for (const u of xUrls) {
      // Deep links to a post (x.com/<user>/status/...) are fine — those are for
      // the human to click. The forbidden thing is an API host (api.x.com),
      // already covered above; assert no api host slips through here.
      assert.ok(!/api\.x\.com/.test(u), `${rel} references an X API URL: ${u}`);
    }
  }
});
