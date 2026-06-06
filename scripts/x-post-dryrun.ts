// Local X-bot dry-run (ADR-058). Generates the day's post TEXT draft to
// docs/social-drafts/{date}/post.txt for review on John's machine (where disk
// writes work, unlike a Vercel cron). Image preview is via the cron's Discord
// dry-run (the portrait is JSX/Satori and can't render under `node
// --strip-types`). NEVER posts to X (the injected `post` throws if reached).
//
// Run: node --experimental-strip-types --no-warnings --env-file=.env.local scripts/x-post-dryrun.ts

import fs from "node:fs";
import path from "node:path";
import { runXBot } from "../lib/social/bot.ts";
import { getDealsForPost, getSpotlightForPost } from "../lib/social/data.ts";
import { generatePostText } from "../lib/social/post-text.ts";

// Fallback .env.local load (so it also works without --env-file).
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const now = new Date();
const outDir = path.join("docs", "social-drafts", now.toISOString().slice(0, 10));
fs.mkdirSync(outDir, { recursive: true });

const result = await runXBot({
  live: false,
  now,
  getDeals: getDealsForPost,
  getSpotlight: () => getSpotlightForPost(now),
  generateText: (input) => generatePostText(input),
  // The Satori card (next-og JSX) can't render under `node --strip-types`, so the
  // local dry-run writes the TEXT draft only; the image is reviewed via the
  // cron's Discord dry-run (where Next compiles the renderer).
  renderImage: async () => null,
  post: async () => {
    throw new Error("DRY-RUN: the X poster must never be called from the local dry-run script");
  },
  review: async (draft) => {
    fs.writeFileSync(
      path.join(outDir, "post.txt"),
      `angle: ${draft.angle}\nlink: ${draft.link}\nchars: ${draft.text.length}\n\n${draft.text}\n`,
    );
  },
});

console.log("X dry-run draft written to", outDir);
console.log(result);
