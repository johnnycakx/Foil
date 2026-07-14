// Full-autonomy weekly content generator.
//
// Pipeline:
//   1. Pick next unshipped cluster topic from docs/seo-strategy.md
//   2. Fetch SERP context + Foil data snapshot
//   3. Generate → quality gates → retry up to 3x
//   4. On success:
//      - if AUTO_PUBLISH_WEEKLY_POSTS=true (default): write to app/(site)/blog/posts/{slug}.mdx
//      - if false (kill-switch): write to app/(site)/blog/posts/_pending/{slug}.mdx
//   5. On 3-strike failure: log + POST to webhook + exit 1 (skip this run)
//
// Usage:
//   node --experimental-strip-types scripts/generate-weekly-post.ts
//   node --experimental-strip-types scripts/generate-weekly-post.ts --slug existing-slug   # retroactive regenerate
//
// Env vars (loaded from .env.local if present):
//   ANTHROPIC_API_KEY                  — required
//   BRAVE_SEARCH_API_KEY               — optional (SERP context degrades silently without)
//   NEXT_PUBLIC_SUPABASE_URL           — optional (data injection skipped without)
//   SUPABASE_SERVICE_ROLE_KEY          — optional (data injection skipped without)
//   AUTO_PUBLISH_WEEKLY_POSTS          — "false" → still write to _pending/; default true
//   WEEKLY_POST_WEBHOOK_URL            — optional; POSTed on success AND on 3-strike failure

import fs from "node:fs";
import path from "node:path";
import {
  GenerationFailedAfterRetries,
  generateWeeklyPost,
  serializeDraft,
} from "../lib/seo/content-engine.ts";
import { parseStrategyDoc } from "../lib/seo/keyword-backlog.ts";
import {
  generateNewsletterDraft,
  NewsletterGenerationFailed,
} from "../lib/newsletter/draft-generator.ts";
import { createDraftPost } from "../lib/beehiiv-posts.ts";
import { serializeNewsletterFile } from "../lib/newsletter/file-writer.ts";
import { sendNewsletterDraftEmail } from "../lib/notifications/resend.ts";
import { postContentPublished, postError, postLinkedInDraft } from "../lib/notifications/discord.ts";
import { buildLinkedInCaption } from "../lib/social/linkedin-caption.ts";
import { POSTS_DIR } from "../lib/blog/posts-dir.ts";

const NEWSLETTER_DRAFTS_DIR = path.join(process.cwd(), "docs", "newsletter-drafts");
const FOUNDER_EMAIL = "john.c.craig24@gmail.com";
const SITE_URL = "https://foiltcg.com";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set in env or .env.local — generator can't call Claude.");
  process.exit(1);
}

const AUTO_PUBLISH = process.env.AUTO_PUBLISH_WEEKLY_POSTS !== "false"; // default true
const SKIP_NEWSLETTER = process.argv.includes("--skip-newsletter");
// POSTS_DIR imported from lib/blog/posts-dir (the canonical write+read dir).
const PENDING_DIR = path.join(POSTS_DIR, "_pending");
fs.mkdirSync(POSTS_DIR, { recursive: true });
if (!AUTO_PUBLISH) fs.mkdirSync(PENDING_DIR, { recursive: true });

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function listShippedSlugs(): Set<string> {
  const shipped = new Set<string>();
  for (const entry of fs.readdirSync(POSTS_DIR, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".mdx") && !entry.name.startsWith("_")) {
      shipped.add(entry.name.replace(/\.mdx$/, ""));
    }
  }
  return shipped;
}

function uniqueSlug(slug: string, taken: Set<string>): string {
  if (!taken.has(slug)) return slug;
  for (let i = 2; i < 20; i++) {
    const candidate = `${slug}-v${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Could not find unique slug variant for ${slug}`);
}

async function postWebhook(payload: object): Promise<void> {
  const url = process.env.WEEKLY_POST_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.warn(`[webhook] POST → HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[webhook] failed: ${(err as Error).message}`);
  }
}

// --slug <existing-slug> → force retroactive regeneration of that topic
function parseSlugArg(): string | null {
  const idx = process.argv.indexOf("--slug");
  return idx >= 0 ? process.argv[idx + 1] ?? null : null;
}

async function loadDataClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("[generate] Supabase env vars not set — data injection disabled");
    return undefined;
  }
  const { supabaseAdmin } = await import("../lib/supabase/admin.ts");
  return supabaseAdmin();
}

const today = isoToday();
const forceSlug = parseSlugArg();

console.log(`[generate] today=${today} auto-publish=${AUTO_PUBLISH} force-slug=${forceSlug ?? "(auto-pick)"}`);

const shipped = listShippedSlugs();

let forceCandidate;
if (forceSlug) {
  const strategyDoc = fs.readFileSync(path.join(process.cwd(), "docs", "seo-strategy.md"), "utf8");
  forceCandidate = parseStrategyDoc(strategyDoc).find((c) => c.slug === forceSlug);
  if (!forceCandidate) {
    console.error(`No candidate found in docs/seo-strategy.md with slug "${forceSlug}".`);
    console.error("Available slugs:", parseStrategyDoc(strategyDoc).map((c) => c.slug).slice(0, 20).join(", "), "...");
    process.exit(1);
  }
  // For retroactive regenerate, exclude the slug from shipped so the engine
  // doesn't think it's a duplicate
  shipped.delete(forceSlug);
}

const dataClient = await loadDataClient();

let result;
try {
  result = await generateWeeklyPost({
    shippedSlugs: shipped,
    today,
    forceCandidate,
    braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY,
    dataClient,
  });
} catch (err) {
  if (err instanceof GenerationFailedAfterRetries) {
    console.error("");
    console.error("================================================================");
    console.error(`  FAILED after ${err.attempts} attempts — skipping this run`);
    console.error("================================================================");
    for (const f of err.lastFailures) console.error(`  - ${f}`);
    console.error("================================================================");
    await postWebhook({
      event: "generation_failed",
      attempts: err.attempts,
      failures: err.lastFailures,
      date: today,
    });
    if (process.env.DISCORD_WEBHOOK_ERRORS) {
      await postError(process.env.DISCORD_WEBHOOK_ERRORS, {
        source: "content-engine",
        errorType: "GenerationFailedAfterRetries",
        message: err.lastFailures.slice(0, 3).join(" · "),
        context: { attempts: err.attempts, date: today },
        runUrl: process.env.GITHUB_RUN_URL,
      });
    }
    process.exit(2); // 2 = quality-gate exhaustion (workflow doesn't commit)
  }
  throw err;
}

// Resolve final slug (handle conflicts with -v2, -v3 suffix)
const taken = listShippedSlugs();
if (forceSlug) taken.delete(forceSlug); // we're explicitly replacing it
const finalSlug = uniqueSlug(result.draft.slug, taken);
if (finalSlug !== result.draft.slug) {
  console.log(`[generate] slug "${result.draft.slug}" already exists — publishing as "${finalSlug}"`);
  result.draft.slug = finalSlug;
}

const outDir = AUTO_PUBLISH ? POSTS_DIR : PENDING_DIR;
const outPath = path.join(outDir, `${finalSlug}.mdx`);
fs.writeFileSync(outPath, serializeDraft(result.draft));

const previewUrl = `https://foil-rosy.vercel.app/blog/${finalSlug}`;

console.log("");
console.log("================================================================");
console.log(`  Published → ${path.relative(process.cwd(), outPath)}`);
console.log("================================================================");
console.log(`  Title          : ${result.draft.frontmatter.title}`);
console.log(`  Slug           : ${finalSlug}`);
console.log(`  Target keyword : ${result.draft.frontmatter.primaryKeyword}`);
console.log(`  Pillar         : /${result.draft.frontmatter.pillar}`);
console.log(`  Word count     : ${result.draft.wordCount} body words + ${result.draft.faq.length} FAQs`);
console.log(`  Generator      : ${result.attempts} attempt(s), all gates passed`);
console.log(`  SERP context   : ${result.serpContext ? (result.serpContext.degraded ? `degraded (${result.serpContext.degradationReason})` : `${result.serpContext.topResults.length} results, ${result.serpContext.topOutlines.length} outlines`) : "skipped"}`);
console.log(`  Foil data      : scans=${result.dataSnapshot.totalScans?.count ?? "n/a"} waitlist=${result.dataSnapshot.waitlistTotal ?? "n/a"}`);
console.log(`  Preview URL    : ${previewUrl}`);
console.log("================================================================");

await postWebhook({
  event: "post_published",
  title: result.draft.frontmatter.title,
  slug: finalSlug,
  pillar: result.draft.frontmatter.pillar,
  primaryKeyword: result.draft.frontmatter.primaryKeyword,
  wordCount: result.draft.wordCount,
  attempts: result.attempts,
  previewUrl,
  publishedPath: outPath,
});

// Discord #content-engine notification fires AFTER the newsletter step
// completes (so the embed includes newsletter subject + preview + artifact).
// We track whether the combined ping has been sent; if newsletter is
// skipped, we post a blog-only embed at the bottom of the script.
let contentEnginePosted = false;

// ---------------------------------------------------------------------------
// Newsletter draft step (ADR-011). Runs AFTER the blog file has been written.
// Soft-fail: any error here logs + webhooks but does NOT propagate to the
// process exit code, so a Beehiiv outage cannot undo a successful blog
// publish. Drafts NEVER auto-send — they land in Beehiiv's drafts list
// awaiting John's manual review.
// ---------------------------------------------------------------------------
if (SKIP_NEWSLETTER) {
  console.log("[newsletter] --skip-newsletter flag set, skipping draft step");
} else if (!process.env.BEEHIIV_API_KEY || !process.env.BEEHIIV_PUBLICATION_ID) {
  console.log("[newsletter] BEEHIIV_* env vars not set — skipping draft step");
} else {
  try {
    console.log("[newsletter] generating draft from blog post…");
    const newsletter = await generateNewsletterDraft({
      slug: finalSlug,
      title: result.draft.frontmatter.title,
      description: result.draft.frontmatter.description,
      content: result.draft.body,
      tags: result.draft.frontmatter.tags,
      primaryKeyword: result.draft.frontmatter.primaryKeyword,
    });

    // Try the Beehiiv API first. On Enterprise it lands as a draft directly;
    // on the free tier it 403s and we fall through to the manual-paste path.
    // Either way the .md artifact + email below ALWAYS land.
    const draftResult = await createDraftPost({
      title: newsletter.subject,
      subjectLine: newsletter.previewText || newsletter.subject,
      htmlBody: newsletter.htmlBody,
      originalBlogSlug: finalSlug,
    });

    const generatedAt = new Date().toISOString();
    const beehiivStatus: "auto-drafted" | "deferred-manual-paste" = draftResult.ok
      ? "auto-drafted"
      : "deferred-manual-paste";

    // Always send the email so John has the paste-ready copy regardless of
    // Beehiiv's tier. Resend failure is logged but never blocks.
    const emailResult = await sendNewsletterDraftEmail({
      to: FOUNDER_EMAIL,
      subject: newsletter.subject,
      previewText: newsletter.previewText,
      body: newsletter.htmlBody,
      blogSlug: finalSlug,
      blogUrl: `${SITE_URL}/blog/${finalSlug}`,
      topicRationale: result.topicRationale,
      wordCount: newsletter.wordCount,
      sourceWordCount: result.draft.wordCount,
      generatedAt,
    });

    if (emailResult.ok) {
      console.log(`[newsletter] ✓ email sent: messageId=${emailResult.messageId}`);
    } else {
      console.warn(`[newsletter] ⚠ Resend send failed (status=${emailResult.status ?? "n/a"}); .md artifact still landed`);
    }

    // ALWAYS write the canonical artifact, even if email failed. The .md is
    // the permanent record; the email is the immediate ping.
    fs.mkdirSync(NEWSLETTER_DRAFTS_DIR, { recursive: true });
    const draftPath = path.join(NEWSLETTER_DRAFTS_DIR, `${finalSlug}.md`);
    fs.writeFileSync(
      draftPath,
      serializeNewsletterFile({
        blogSlug: finalSlug,
        blogTitle: result.draft.frontmatter.title,
        blogUrl: `${SITE_URL}/blog/${finalSlug}`,
        sourceWordCount: result.draft.wordCount,
        generatedAt,
        topicRationale: result.topicRationale,
        beehiivStatus,
        emailMessageId: emailResult.ok ? emailResult.messageId : undefined,
        draft: newsletter,
      }),
    );
    console.log(`[newsletter] ✓ artifact saved: ${path.relative(process.cwd(), draftPath)}`);
    console.log(`[newsletter]   subject       : ${newsletter.subject}`);
    console.log(`[newsletter]   preview text  : ${newsletter.previewText}`);
    console.log(`[newsletter]   word count    : ${newsletter.wordCount}`);
    console.log(`[newsletter]   beehiiv       : ${beehiivStatus}`);
    if (draftResult.ok) {
      console.log(`[newsletter]   post_id       : ${draftResult.postId}`);
    }

    await postWebhook({
      event: draftResult.ok
        ? "newsletter_draft_created"
        : "newsletter_draft_deferred_manual",
      blogSlug: finalSlug,
      subject: newsletter.subject,
      wordCount: newsletter.wordCount,
      beehiivStatus,
      emailOk: emailResult.ok,
      ...(draftResult.ok ? { postId: draftResult.postId } : {}),
      ...(emailResult.ok ? { emailMessageId: emailResult.messageId } : {}),
    });

    // Discord #content-engine: combined blog + newsletter embed (ADR-014).
    if (process.env.DISCORD_WEBHOOK_CONTENT_ENGINE) {
      await postContentPublished(process.env.DISCORD_WEBHOOK_CONTENT_ENGINE, {
        blogTitle: result.draft.frontmatter.title,
        blogUrl: `${SITE_URL}/blog/${finalSlug}`,
        blogWordCount: result.draft.wordCount,
        newsletter: {
          subject: newsletter.subject,
          previewText: newsletter.previewText,
          wordCount: newsletter.wordCount,
          artifactPath: path.relative(process.cwd(), draftPath).replace(/\\/g, "/"),
        },
      });
      contentEnginePosted = true;
    }
  } catch (err) {
    if (err instanceof NewsletterGenerationFailed) {
      console.warn(`[newsletter] ⚠ quality gates exhausted after ${err.attempts} attempts — blog publish unaffected`);
      for (const f of err.lastFailures) console.warn(`[newsletter]   - ${f}`);
      await postWebhook({
        event: "newsletter_draft_failed",
        blogSlug: finalSlug,
        reason: "quality_gates_exhausted",
        attempts: err.attempts,
        failures: err.lastFailures,
      });
      if (process.env.DISCORD_WEBHOOK_ERRORS) {
        await postError(process.env.DISCORD_WEBHOOK_ERRORS, {
          source: "content-engine",
          errorType: "NewsletterGenerationFailed",
          message: err.message,
          context: { slug: finalSlug, attempts: err.attempts },
          runUrl: process.env.GITHUB_RUN_URL,
        });
      }
    } else {
      console.warn(`[newsletter] ⚠ unexpected error (blog publish unaffected): ${(err as Error).message}`);
      await postWebhook({
        event: "newsletter_draft_failed",
        blogSlug: finalSlug,
        reason: "unexpected_error",
        message: (err as Error).message,
      });
      if (process.env.DISCORD_WEBHOOK_ERRORS) {
        await postError(process.env.DISCORD_WEBHOOK_ERRORS, {
          source: "content-engine",
          errorType: (err as Error).name || "Error",
          message: (err as Error).message,
          context: { slug: finalSlug },
          runUrl: process.env.GITHUB_RUN_URL,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// LinkedIn paste-rail tap (linkedin-page-syndication goal). Human_only channel:
// this only drops a paste-ready caption card in #content-engine — John posts it
// to his personal feed himself; nothing auto-posts to LinkedIn, ever.
// Fires ONLY when the flag is on AND the post actually published live —
// a _pending/ draft has no live URL, so its caption link would 404.
// Soft-fail: a caption/Discord failure never affects the publish or exit code.
// ---------------------------------------------------------------------------
if (process.env.LINKEDIN_SYNDICATION_ENABLED === "true" && AUTO_PUBLISH) {
  try {
    const { caption, link } = buildLinkedInCaption({
      slug: finalSlug,
      title: result.draft.frontmatter.title,
      description: result.draft.frontmatter.description,
    });
    if (process.env.DISCORD_WEBHOOK_CONTENT_ENGINE) {
      const liRes = await postLinkedInDraft(process.env.DISCORD_WEBHOOK_CONTENT_ENGINE, {
        slug: finalSlug,
        title: result.draft.frontmatter.title,
        caption,
        link,
      });
      console.log(
        liRes.ok
          ? "[linkedin] ✓ paste-ready caption card posted to #content-engine"
          : `[linkedin] ⚠ caption card failed (${liRes.error}) — publish unaffected`,
      );
    } else {
      console.log("[linkedin] DISCORD_WEBHOOK_CONTENT_ENGINE not set — caption below (publish unaffected):");
      console.log(caption);
    }
  } catch (err) {
    console.warn(`[linkedin] ⚠ caption generation failed (publish unaffected): ${(err as Error).message}`);
    if (process.env.DISCORD_WEBHOOK_ERRORS) {
      await postError(process.env.DISCORD_WEBHOOK_ERRORS, {
        source: "content-engine",
        errorType: "LinkedInCaptionFailed",
        message: (err as Error).message,
        context: { slug: finalSlug },
        runUrl: process.env.GITHUB_RUN_URL,
      });
    }
  }
}

// Fallback blog-only #content-engine ping when newsletter step was skipped.
if (!contentEnginePosted && process.env.DISCORD_WEBHOOK_CONTENT_ENGINE) {
  await postContentPublished(process.env.DISCORD_WEBHOOK_CONTENT_ENGINE, {
    blogTitle: result.draft.frontmatter.title,
    blogUrl: `${SITE_URL}/blog/${finalSlug}`,
    blogWordCount: result.draft.wordCount,
    newsletter: null,
  });
}
