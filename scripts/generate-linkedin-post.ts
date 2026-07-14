// LinkedIn paste-rail: generate a paste-ready caption from a PUBLISHED blog post.
//
// LinkedIn (John's personal profile) is a human_only channel — this script's
// output is text for John to paste himself; nothing here (or anywhere) posts to
// LinkedIn programmatically. See lib/social/syndication-channels.ts + the
// linkedin-page-syndication goal spec.
//
// Usage:
//   node --experimental-strip-types scripts/generate-linkedin-post.ts --slug <published-slug>
//
// Behavior:
//   - Refuses _pending/ and _unpublished-* posts (the UTM link must resolve live).
//   - ALWAYS prints the paste-ready caption to stdout.
//   - If DISCORD_WEBHOOK_CONTENT_ENGINE is set, also drops the caption as a
//     #content-engine card (soft-fail — a Discord outage never fails the script).

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { POSTS_DIR } from "../lib/blog/posts-dir.ts";
import { buildLinkedInCaption } from "../lib/social/linkedin-caption.ts";
import { postLinkedInDraft } from "../lib/notifications/discord.ts";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function parseSlugArg(): string | null {
  const idx = process.argv.indexOf("--slug");
  return idx >= 0 ? process.argv[idx + 1] ?? null : null;
}

const slug = parseSlugArg();
if (!slug) {
  console.error("Usage: node --experimental-strip-types scripts/generate-linkedin-post.ts --slug <published-slug>");
  process.exit(1);
}

// The link in the caption must resolve on prod: only live posts qualify.
if (slug.startsWith("_")) {
  console.error(`"${slug}" is not a published post (underscore-prefixed files never go live).`);
  process.exit(1);
}
// Slug shape is constrained (and the read is contained to POSTS_DIR) so this
// script stays safe if a future caller ever feeds it a non-CLI slug — the same
// discipline the /go redirect learned: validate the slug, never trust the path.
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`"${slug}" is not a valid post slug (expected lowercase letters, digits, hyphens).`);
  process.exit(1);
}
const postPath = path.join(POSTS_DIR, `${slug}.mdx`);
if (path.dirname(path.resolve(postPath)) !== path.resolve(POSTS_DIR)) {
  console.error(`Refusing to read outside the posts directory.`);
  process.exit(1);
}
if (!fs.existsSync(postPath)) {
  const pendingPath = path.join(POSTS_DIR, "_pending", `${slug}.mdx`);
  if (fs.existsSync(pendingPath)) {
    console.error(`"${slug}" is still in _pending/ — it has no live URL yet. Publish it first.`);
  } else {
    console.error(`No published post at ${path.relative(process.cwd(), postPath)}.`);
  }
  process.exit(1);
}

const { data } = matter(fs.readFileSync(postPath, "utf8"));
const title = typeof data.title === "string" ? data.title : "";
const description = typeof data.description === "string" ? data.description : "";
if (!title || !description) {
  console.error(`Post "${slug}" is missing a title or description in frontmatter — nothing to caption.`);
  process.exit(1);
}

const { caption, link } = buildLinkedInCaption({ slug, title, description });

console.log("");
console.log("================ LinkedIn caption (paste-ready) ================");
console.log(caption);
console.log("================================================================");
console.log(`UTM link: ${link}`);
console.log("");

const webhook = process.env.DISCORD_WEBHOOK_CONTENT_ENGINE;
if (webhook) {
  const res = await postLinkedInDraft(webhook, { slug, title, caption, link });
  console.log(res.ok ? "[discord] ✓ card posted to #content-engine" : `[discord] ⚠ card failed (${res.error}) — caption above is still paste-ready`);
} else {
  console.log("[discord] DISCORD_WEBHOOK_CONTENT_ENGINE not set — printed only (that's fine).");
}
