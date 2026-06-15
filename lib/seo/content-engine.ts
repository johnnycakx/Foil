// The content engine — full-autonomy edition. Pipeline:
//
//   1. Pick next unshipped cluster topic from docs/seo-strategy.md
//   2. Fetch SERP context (Brave Search + cheerio scrape of top 3) — degrades silently
//   3. Pull Foil data snapshot from Supabase — degrades silently
//   4. Generate draft via Claude Sonnet 4.6 with DUD prompt + SERP + data context
//   5. Run quality gates → if pass, return draft
//   6. If fail and retries remain, re-prompt Claude with the failures list and retry
//   7. If all retries exhausted, throw with failure context (caller writes to log,
//      pings webhook, skips publishing this run)
//
// What this module DOES NOT do:
//   - File I/O (script wrapper owns that)
//   - Webhook notification (script wrapper)
//   - Git operations (script wrapper / CI)
//
// Anthropic rate-limit handling: exponential backoff (1s, 5s, 30s) on 429/5xx.

import fs from "node:fs";
import path from "node:path";
import { anthropic } from "../anthropic.ts";
import {
  parseStrategyDoc,
  pickNextCandidateWithRationale,
  slugify,
  type ClusterCandidate,
} from "./keyword-backlog.ts";
import {
  emptySnapshot,
  type DataClient,
  type FoilDataSnapshot,
} from "./data-injection.ts";
import {
  fetchSerpContext,
  renderSerpContextPrompt,
  type Cache as SerpCache,
  type SerpContext,
} from "./serp-fetch.ts";
import {
  runQualityGates,
  type GateResult,
  type QualityGateContext,
} from "./quality-gates.ts";
import { readdirSync } from "node:fs";
import { POSTS_DIR } from "../blog/posts-dir.ts";
import { join } from "node:path";
import { CITY_SLUGS } from "../vending/cities.ts";

// Known internal routes for gate 9 (link existence) — the live vending surfaces
// a host post might legitimately link to (ADR-062). The dormant deal-finder
// routes (/cards, /upload, /start, /deals, the three collector pillars) are
// deliberately absent: a generated host post must NOT link into the dead
// product, so a link to one of those fails gate 9 as a dead internal link.
const KNOWN_INTERNAL_ROUTES: ReadonlySet<string> = new Set([
  "/",
  "/host",
  "/faq",
  "/service-areas",
  "/blog",
  "/legal/privacy",
  "/legal/terms",
]);

/**
 * Build the gate-9 internal-link resolver from the live blog-post directory +
 * the service-area city slugs + the known-route allowlist. Soft-fails open
 * (returns a resolver that approves everything) if the posts dir can't be read
 * — a gate infrastructure hiccup must not block an otherwise-good publish.
 */
function buildInternalLinkResolver(): (href: string) => boolean {
  let blogSlugs: Set<string>;
  try {
    blogSlugs = new Set(
      readdirSync(POSTS_DIR)
        .filter((f) => f.endsWith(".mdx"))
        .map((f) => f.replace(/\.mdx$/, "")),
    );
  } catch {
    return () => true;
  }
  const citySlugs = new Set<string>(CITY_SLUGS);
  return (href: string) => {
    let p = href;
    for (const host of ["www.foiltcg.com", "foiltcg.com", "foil-rosy.vercel.app"]) {
      const i = p.indexOf(host);
      if (i >= 0) p = p.slice(i + host.length);
    }
    p = (p.split("#")[0].split("?")[0].replace(/\/+$/, "")) || "/";
    if (!p.startsWith("/")) return true; // external/unresolvable — not ours to fail
    if (p.startsWith("/blog/")) return blogSlugs.has(p.slice("/blog/".length));
    if (p.startsWith("/service-areas/")) return citySlugs.has(p.slice("/service-areas/".length));
    return KNOWN_INTERNAL_ROUTES.has(p);
  };
}
import type { GeneratedDraft } from "./content-engine-types.ts";

export const CONTENT_MODEL = "claude-sonnet-4-6";
export const MAX_RETRIES = 3;
export const BACKOFF_MS: readonly number[] = [1000, 5000, 30000];

export type { GeneratedDraft };

/**
 * serializeDraft → MDX text with deterministic frontmatter. Used by the
 * script wrapper to write the final file. Frontmatter shape matches what
 * posts-meta.ts reads + what the [slug] route emits for JSON-LD.
 */
export function serializeDraft(draft: GeneratedDraft): string {
  const fm = draft.frontmatter;
  const tagsArray = fm.tags.length
    ? `[${fm.tags.map((t) => `"${escapeYamlString(t)}"`).join(", ")}]`
    : "[]";

  // FAQ lives ONLY in frontmatter (one source of truth). The page route
  // reads post.faq and renders <FAQ items={post.faq} /> after the MDX body,
  // and the same array drives the FAQPage JSON-LD schema. The MDX body
  // itself doesn't render the FAQ — that would require `frontmatter` to be
  // in MDX scope, which @next/mdx doesn't provide.
  return `---
title: "${escapeYamlString(fm.title)}"
description: "${escapeYamlString(fm.description)}"
date: "${fm.date}"
tags: ${tagsArray}
pillar: "${fm.pillar}"
primaryKeyword: "${escapeYamlString(fm.primaryKeyword)}"
faq:
${draft.faq.map((q) => `  - question: "${escapeYamlString(q.question)}"\n    answer: "${escapeYamlString(q.answer)}"`).join("\n")}
---

${draft.body.trim()}
`;
}

function escapeYamlString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export type GenerateOptions = {
  /** Slugs already in the canonical POSTS_DIR — used to skip duplicates. */
  shippedSlugs: ReadonlySet<string>;
  /** Today's date in ISO YYYY-MM-DD for frontmatter.date. */
  today: string;
  /** Path to strategy doc; default = docs/seo-strategy.md from cwd. */
  strategyDocPath?: string;
  /** Force a specific candidate (used by retroactive regeneration). */
  forceCandidate?: ClusterCandidate;
  /** Brave Search API key — undefined disables SERP injection cleanly. */
  braveSearchApiKey?: string;
  /** Optional SERP cache (Supabase-backed in prod). */
  serpCache?: SerpCache;
  /** Supabase admin client — undefined disables data injection cleanly. */
  dataClient?: DataClient;
  /** Site URL used for schema validation. */
  siteUrl?: string;
};

export type EngineResult = {
  draft: GeneratedDraft;
  attempts: number;
  serpContext: SerpContext | null;
  dataSnapshot: FoilDataSnapshot;
  gateResult: GateResult;
  /** Why this topic was picked — empty string when forceCandidate was used. */
  topicRationale: string;
};

export class GenerationFailedAfterRetries extends Error {
  readonly attempts: number;
  readonly lastFailures: string[];
  readonly lastDraft: GeneratedDraft | null;

  constructor(attempts: number, lastFailures: string[], lastDraft: GeneratedDraft | null) {
    super(
      `Generation failed quality gates after ${attempts} attempts. Last failures:\n  - ${lastFailures.join("\n  - ")}`,
    );
    this.name = "GenerationFailedAfterRetries";
    this.attempts = attempts;
    this.lastFailures = lastFailures;
    this.lastDraft = lastDraft;
  }
}

/**
 * The full autonomous pipeline. Returns a draft that passed every quality
 * gate, or throws GenerationFailedAfterRetries if MAX_RETRIES is exhausted.
 *
 * The caller (script wrapper) decides what to do with each outcome — publish
 * the draft on success, or log + skip + webhook on failure.
 */
export async function generateWeeklyPost(opts: GenerateOptions): Promise<EngineResult> {
  // 1. Topic selection — capture the WHY alongside the WHAT so the fallback
  //    email can explain the choice without re-deriving from the strategy doc.
  let candidate: ClusterCandidate;
  let topicRationale = "";
  if (opts.forceCandidate) {
    candidate = opts.forceCandidate;
    topicRationale = `Forced via --slug flag (retroactive regenerate). Original strategy-doc ranking not consulted.`;
  } else {
    const picked = pickFromBacklog(opts);
    candidate = picked.candidate;
    topicRationale = picked.rationale;
  }
  const siteUrl = opts.siteUrl ?? "https://foil-rosy.vercel.app";
  const urlPath = `/blog/${candidate.slug}`;

  // 2. SERP context (degrades silently)
  let serpContext: SerpContext | null = null;
  try {
    const query = candidate.longTail[0] ?? candidate.title;
    serpContext = await fetchSerpContext(query, opts.braveSearchApiKey, {
      cache: opts.serpCache,
    });
  } catch (err) {
    console.warn(`[engine] SERP fetch threw (continuing): ${(err as Error).message}`);
  }

  // 3. Foil scan/waitlist telemetry is collector data — it has no place in a
  //    vending host post (ADR-062). The engine no longer injects it, and the
  //    Foil-data provenance gate is retired. dataSnapshot stays in EngineResult
  //    as an empty snapshot so the script's run-log shape is unchanged.
  const dataSnapshot: FoilDataSnapshot = emptySnapshot();

  // Gate 9 context: resolve internal links against the real post dir + the
  // service-area city slugs + the known vending routes (buildInternalLinkResolver).
  const gateCtx: QualityGateContext = {
    internalLinkExists: buildInternalLinkResolver(),
  };

  // 4-6. Generate + gate + retry
  const client = anthropic();
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  let lastDraft: GeneratedDraft | null = null;
  let lastGate: GateResult = { passed: false, failures: ["no attempts made"] };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const userPrompt =
      attempt === 1
        ? renderInitialUserPrompt(candidate, opts.today, serpContext)
        : renderRetryUserPrompt(lastGate.failures);

    history.push({ role: "user", content: userPrompt });

    const text = await callClaudeWithBackoff(client, history);
    history.push({ role: "assistant", content: text });

    let parsed;
    try {
      parsed = parseModelOutput(text);
    } catch (err) {
      // Treat parse failures as a gate failure so the retry loop kicks in
      lastGate = {
        passed: false,
        failures: [`Model output didn't parse as the required JSON object: ${(err as Error).message}`],
      };
      continue;
    }

    const draft: GeneratedDraft = {
      candidate,
      slug: candidate.slug,
      frontmatter: {
        title: parsed.title,
        description: parsed.description,
        date: opts.today,
        tags: parsed.tags,
        pillar: candidate.pillar.slug,
        primaryKeyword: candidate.longTail[0] ?? candidate.title,
      },
      body: parsed.body,
      faq: parsed.faq,
      wordCount: countWords(parsed.body),
    };

    lastDraft = draft;
    lastGate = runQualityGates(draft, urlPath, siteUrl, gateCtx);

    console.log(
      `[engine] attempt ${attempt}/${MAX_RETRIES}: ${lastGate.passed ? "PASS" : `FAIL (${lastGate.failures.length} gate violations)`}`,
    );

    if (lastGate.passed) {
      return {
        draft,
        attempts: attempt,
        serpContext,
        dataSnapshot,
        gateResult: lastGate,
        topicRationale,
      };
    }

    // Log the failures so they show up in the GitHub Actions log
    for (const failure of lastGate.failures) {
      console.log(`[engine]   - ${failure}`);
    }
  }

  throw new GenerationFailedAfterRetries(MAX_RETRIES, lastGate.failures, lastDraft);
}

function pickFromBacklog(opts: GenerateOptions): { candidate: ClusterCandidate; rationale: string } {
  const strategyPath =
    opts.strategyDocPath ?? path.join(process.cwd(), "docs", "seo-strategy.md");
  const strategyDoc = fs.readFileSync(strategyPath, "utf8");
  const candidates = parseStrategyDoc(strategyDoc);
  if (candidates.length === 0) {
    throw new Error(`No cluster candidates parsed from ${strategyPath}.`);
  }

  const selection = pickNextCandidateWithRationale(candidates, opts.shippedSlugs);
  if (!selection) {
    throw new Error(
      "Every candidate in docs/seo-strategy.md is already shipped. Add more cluster topics to the doc.",
    );
  }
  return selection;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// =============================================================================
// Anthropic call with exponential backoff. 429 + 5xx are retryable; 4xx (auth,
// validation) fail fast — retrying those is just wasted spend.
// =============================================================================

async function callClaudeWithBackoff(
  client: ReturnType<typeof anthropic>,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  for (let i = 0; i <= BACKOFF_MS.length; i++) {
    try {
      const message = await client.messages.create({
        model: CONTENT_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      });
      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Claude returned no text block");
      }
      return textBlock.text;
    } catch (err) {
      const status = (err as { status?: number }).status;
      const retryable = status === 429 || (typeof status === "number" && status >= 500);
      if (!retryable || i >= BACKOFF_MS.length) throw err;
      const wait = BACKOFF_MS[i];
      console.warn(`[engine] Claude ${status} — backing off ${wait}ms (attempt ${i + 1}/${BACKOFF_MS.length})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("unreachable");
}

// =============================================================================
// System prompt — vending host-acquisition + local SEO (ADR-062). Audience is
// a Bay-Area business/location owner deciding whether to HOST a Pokémon card
// vending machine, NOT a card collector. The deal-finder "DUD" prompt was
// retired with the pivot. Every constraint here reflects a specific failure
// mode the quality gates would otherwise reject in review.
// =============================================================================

const SYSTEM_PROMPT = `You are the content writer for Foil, a Bay-Area company that places and operates Pokémon card vending machines inside local businesses. You write SEO blog posts for ONE reader: a business or location owner (gas station, convenience or smoke shop, bar, brewery, arcade, barbershop, salon, laundromat, restaurant, comic or hobby shop, gym, bowling alley, entertainment center) deciding whether to HOST a machine for a monthly revenue share. You are NOT writing for card collectors, and you never pitch buying, pricing, or grading individual cards.

# Audience and job

The reader owns or runs a business with foot traffic and a few spare square feet. They want to know: is this worth it for a place like mine, what does it cost me, how does it work, am I on the hook for anything, and who actually buys these. Answer those plainly. Every post should move that owner one step closer to reaching out to host a machine.

# Voice: the confident local operator

Foil reads as an established, professional local operator, not a startup hunting for its first location. The register (vending design canon, ADR-061):
- Present-tense operator voice: "We place and operate Pokémon card vending machines across the Bay Area," "We install, stock, restock, and service every machine," "Your staff never touches it."
- Calm, direct, specific. Short declarative sentences a busy owner can skim. Lead with the concrete fact, not a wind-up.
- Confident, never hyped. You are the operator who already does the work, not a pitchman chasing a signature.

# Honesty guardrails (HARD — these auto-fail the quality gates)

1. No earnings guarantees. Never promise income, profit, or a payout figure. Frame upside as "a share of every sale" or "a monthly revenue share," never a dollar amount the owner is guaranteed to make. (You MAY write about passive income as a topic when the keyword calls for it; you may NOT promise it.)
2. No published revenue-share percentage. Do NOT print a split (no "10%", no "10-15%", no "30%", no "of net" / "of gross"). The revenue share is a conversation: "we walk through the revenue share on a quick call."
3. No insurance or liability claims. Do NOT write that a machine is "fully insured," that damage or theft is "fully covered," or that the host "isn't liable." Insurance is a call topic, not a webpage claim. You may truthfully say it is our equipment and our responsibility to operate and keep running.
4. No fabricated scale, locations, testimonials, or statistics. Do NOT invent machine counts, host names, review counts, or "X% of owners" figures. If you don't have a real number, omit it. Never write "we're just starting up" either; the operator voice carries the page without a count.

# Real infrastructure (true — use these to anchor credibility)

Commercial-grade VTM touchscreen machines. NAYAX cashless payments with automatic monthly payouts. Real-time remote monitoring. A guaranteed-drop refund sensor that auto-refunds the customer if product does not drop, confirmed on screen. On-machine QR support so the host's staff never handles a refund or complaint. A footprint of about 3 to 4 square feet. Power draw of about $4 a month, roughly the same as a TV. Wall, pedestal, or freestanding placement, with no drilling required for the freestanding option. An install that takes about an hour and does not disrupt the host's day. A risk-free, no-commitment trial month with no contract required; if a spot is not a fit we adjust the product mix and, if needed, relocate the machine at no cost to the host. Pokémon's buyer base skews adult (a large share are adults roughly 25 to 40), which is why the machine reads as an amenity rather than a kids' toy.

# What makes a good post

- Open with a one-sentence, direct answer to the post's primary keyword (the featured-snippet answer). No generic wind-up.
- Use ## H2 sections. Each H2 makes ONE concrete, host-relevant point: a venue type, an operating fact, a footprint or power number, a local Bay-Area reference, or a step in how it works. Do not pad.
- Be locally specific. Reference the Bay Area and, where it fits, the home-radius cities we serve (Napa, Fairfield, Vacaville, Vallejo, Walnut Creek, Concord, Benicia, Suisun City, and the wider North Bay / East Bay / Solano corridor). Local relevance is the SEO bet.
- Bias toward short, citable, standalone sentences (the shape featured snippets and AI answer engines quote).

# Hard rules

1. No generic openings. Never "In today's digital world," "Pokémon has taken the world by storm," "Have you ever wondered." Open with the specific answer or a concrete scenario. Banned phrases that auto-fail: "in conclusion", "in summary", "as we've seen", "in today's digital world", "in today's market", "let's dive in", "dive in", "game-changer", "navigate the landscape", "delve", "tapestry". Banned hype that auto-fails: "guaranteed", "easy money", "no-brainer", "must-buy", "to the moon", "amazing deal".
2. No em dashes anywhere (use commas, colons, semicolons, periods, or parentheses). Write a range as "3 to 4," not with a dash.
3. Pokémon spelling. Always "Pokémon" with the é. Exception: code identifiers, URLs.
4. Internal links. Include at least TWO internal links to existing Foil pages, and at least ONE must point to a conversion page: /host, /faq, or a /service-areas/[city] page. Use markdown [anchor](/path) or <TopicLink href="/path">anchor</TopicLink>. For a city-specific post, link to that city's /service-areas/[city] page. Do NOT link to /cards, /upload, /start, /deals, /newsletter, or any deal-finder page; that product is dormant and a link to it fails the gates.
5. FAQ section. Generate 5-6 substantive, host-facing FAQs. Each answer is 2-4 sentences. The combined FAQ text must total 200+ words.
6. Word count. Body 1200-2200 words. Tight and concrete, never padded.

# Output format

Return a SINGLE JSON object inside a \`\`\`json fence. Schema:

\`\`\`json
{
  "title": "string — 50-65 chars, includes the primary keyword, host/owner framed",
  "description": "string — 140-160 chars meta description, includes the primary keyword",
  "tags": ["string", "..."],
  "body": "string — full MDX body. Opens with a 1-sentence direct answer to the primary keyword. Uses ## H2 sections. References the Bay Area or a served city at least once. Includes 1+ <Callout> and 2+ internal links (at least one to /host, /faq, or a /service-areas/[city] page). NO <CardScannerEmbed>. Body word count 1200-2200. Do NOT include a frontmatter fence in body — frontmatter is filled from the JSON fields.",
  "faq": [
    { "question": "string", "answer": "string — 2-4 sentences, host-facing, no fluff" }
  ]
}
\`\`\`

Custom components available: <Callout variant="info|warning|tip">...</Callout>, <TopicLink href="/path">anchor</TopicLink>. Do NOT use <CardScannerEmbed> — it belongs to the dormant deal-finder.`;

function renderInitialUserPrompt(
  candidate: ClusterCandidate,
  today: string,
  serpContext: SerpContext | null,
): string {
  const sections: string[] = [];

  sections.push(`Today is ${today}.`);
  sections.push("");
  sections.push("# Topic assignment");
  sections.push(`- **Candidate title:** ${candidate.title}`);
  sections.push(`- **Rationale:** ${candidate.rationale}`);
  sections.push(`- **Long-tail keywords:** ${candidate.longTail.join(", ") || "(none specified)"}`);
  sections.push(`- **Parent pillar URL (link to this once):** ${candidate.pillar.url}`);
  sections.push(`- **Parent pillar primary keyword:** ${candidate.pillar.primaryKeyword}`);
  sections.push(`- **Publish path:** /blog/${candidate.slug}`);
  sections.push(`- **Primary keyword to feature:** ${candidate.longTail[0] ?? candidate.title}`);
  sections.push("");

  if (serpContext) {
    sections.push("# Beat-the-top-3 SERP context");
    sections.push(renderSerpContextPrompt(serpContext));
    sections.push("");
  }

  sections.push(
    "Generate the JSON object now. You are writing for a Bay-Area business/location owner deciding whether to HOST a Pokémon card vending machine, in the confident-local-operator voice. Apply every honesty guardrail and hard rule from the system prompt. Body 1200-2200 words. Reference the Bay Area or a served city. At least 2 internal links, and at least one of them to /host, /faq, or a /service-areas/[city] page (for a city-specific topic, link that city's page). No <CardScannerEmbed>, no em dashes, no earnings guarantees, no revenue-share percentage, no insurance/liability claim. 5-6 host-facing FAQs totaling 200+ words.",
  );

  return sections.join("\n");
}

/**
 * Load the most recent creator-commentary digest (ADR-050) for prompt injection.
 * Returns the digest markdown (truncated to maxChars) or null if none exists.
 * Read fresh per generation so the daily ingestion's latest signal is used.
 */
export function loadLatestCreatorDigest(maxChars = 7000): string | null {
  const dir = join(process.cwd(), "docs", "transcript-digests");
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  files.sort(); // ISO dates sort lexicographically = chronologically
  const latest = files[files.length - 1];
  try {
    const raw = fs.readFileSync(join(dir, latest), "utf8");
    return raw.length > maxChars ? `${raw.slice(0, maxChars)}\n…(digest truncated)` : raw;
  } catch {
    return null;
  }
}

function renderRetryUserPrompt(failures: string[]): string {
  return `Your previous draft failed the following quality gates. Regenerate the JSON object, fixing EVERY failure listed below. Don't shorten the post to satisfy a single gate — fix the gaps in place.

Failures:
${failures.map((f) => `- ${f}`).join("\n")}

Return ONLY the corrected JSON object inside a \`\`\`json fence.`;
}

/**
 * Extract the JSON payload from the model's response. Tolerates fences with
 * extra whitespace + an optional language tag. Throws on schema mismatch.
 */
export function parseModelOutput(text: string): {
  title: string;
  description: string;
  tags: string[];
  body: string;
  faq: { question: string; answer: string }[];
} {
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const payload = fenced ? fenced[1] : text;
  let obj: unknown;
  try {
    obj = JSON.parse(payload);
  } catch (err) {
    throw new Error(
      `Model output was not valid JSON: ${(err as Error).message}. First 300 chars: ${payload.slice(0, 300)}`,
    );
  }

  if (!obj || typeof obj !== "object") {
    throw new Error(`Model output JSON was not an object`);
  }
  const o = obj as Record<string, unknown>;

  const title = expectString(o.title, "title");
  const description = expectString(o.description, "description");
  const body = expectString(o.body, "body");
  const tags = Array.isArray(o.tags)
    ? o.tags.filter((t): t is string => typeof t === "string")
    : [];
  const faqRaw = Array.isArray(o.faq) ? o.faq : [];
  const faq = faqRaw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const e = entry as Record<string, unknown>;
      const q = typeof e.question === "string" ? e.question : null;
      const a = typeof e.answer === "string" ? e.answer : null;
      return q && a ? { question: q, answer: a } : null;
    })
    .filter((e): e is { question: string; answer: string } => e !== null);

  if (faq.length === 0) {
    throw new Error(`Model output had no parseable FAQ entries`);
  }

  return { title, description, body, tags, faq };
}

function expectString(v: unknown, field: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`Model output missing required field: ${field}`);
  }
  return v;
}

export { slugify };
