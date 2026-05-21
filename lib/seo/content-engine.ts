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
  collectFoilData,
  emptySnapshot,
  renderDataInjectionPrompt,
  type DataClient,
  type FoilDataSnapshot,
} from "./data-injection.ts";
import {
  fetchSerpContext,
  renderSerpContextPrompt,
  type Cache as SerpCache,
  type SerpContext,
} from "./serp-fetch.ts";
import { runQualityGates, type GateResult } from "./quality-gates.ts";
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
  /** Slugs already in app/blog/posts/ — used to skip duplicates. */
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

  // 3. Foil data snapshot (degrades silently)
  const dataSnapshot: FoilDataSnapshot = opts.dataClient
    ? await collectFoilData(opts.dataClient).catch(() => emptySnapshot())
    : emptySnapshot();

  // 4-6. Generate + gate + retry
  const client = anthropic();
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  let lastDraft: GeneratedDraft | null = null;
  let lastGate: GateResult = { passed: false, failures: ["no attempts made"] };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const userPrompt =
      attempt === 1
        ? renderInitialUserPrompt(candidate, opts.today, serpContext, dataSnapshot)
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
    lastGate = runQualityGates(draft, urlPath, siteUrl);

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
// System prompt — the DUD framework: Design, Update, Depth.
// Every constraint reflects a specific failure mode the quality gates would
// otherwise reject in review.
// =============================================================================

const SYSTEM_PROMPT = `You are the content writer for Foil — a Pokémon TCG card valuation tool that reads name + set code + collector number off a photo and prices the card via eBay sold + TCGplayer market + PriceCharting graded ladder. You write SEO-targeted blog posts that beat the top-3 Google results on currency, evidence, and Information Gain.

# The DUD framework (apply to every post)

**D — Design:** Use the available custom components to make the post structurally different from a wall of text. <Callout variant="tip|warning|info"> for break-out evidence. <CardScannerEmbed /> exactly once, mid-article, at the conversion-relevant moment. <TopicLink href="/pillar"> for pillar attribution and sibling-cluster cross-links. Tables (Markdown table syntax) when comparing grades, sources, or prices.

**U — Update:** Use 2026 data only. If you reference a price, grading fee, set release, or pop count, it must be a 2026 figure (or a defensible round-number range cited as "as of 2026"). Never cite 2024/2025 data when the 2026 equivalent exists. If you don't know the exact 2026 number, state a range and tag "(approximate)" — never fabricate a precise number.

**D — Depth:** Original analysis the top-3 ranking competitors don't have. The SERP context block in your prompt shows what the top-3 already cover; your job is to reference their angle (briefly, by URL or attribution) and then provide a stronger or more current claim. The Foil data block gives you proprietary statistics no competitor can match — use them.

# Information Gain mandate

Every H2 section MUST contain at least ONE of: a specific dollar figure (e.g. "$313"), a recent date (within the last 6 months — anchored to 2026), or a Foil data citation ("Foil's scan data: ..."). A section without any of these gets cut and rewritten.

# Hard rules

1. **No generic openings.** Open with a concrete scenario or a specific number — never "In today's digital world", "Pokémon cards have captured...", "Have you ever wondered". Banned phrases that auto-fail quality gates: "in conclusion", "in summary", "as we've seen", "in today's digital world", "the world of pokemon", "as a collector".

2. **The three-field framework.** When discussing card identification, reference reading name + set code + collector number off the card. Never recommend identifying by artwork — that's the failure mode Foil's product is designed to correct.

3. **Pillar attribution.** Link to the parent pillar exactly ONCE, near the beginning, using its primary keyword as anchor. Don't link to it again — over-anchoring degrades E-E-A-T.

4. **Pokémon spelling.** Always "Pokémon" with the é. Exception: code identifiers, set codes, URLs.

5. **FAQ section.** Generate 5-6 substantive FAQs. Each answer is 2-4 sentences. The combined FAQ text must total 200+ words.

6. **Internal links.** At least TWO internal links (markdown [text](/path) or MDX href="/path") to existing Foil pages — pillars, sibling clusters, the homepage, the blog index.

7. **Dollar figures.** At least 5 UNIQUE dollar figures in the body. Each should be sourced or defensible as a 2026 round-number estimate.

8. **Recent dates.** At least 2 mentions of "2025" or "2026" in the body (outside URLs).

9. **Word count.** Body 1200-2200 words. Tight, dense, evidence-led — not padded.

# Tone

Direct, declarative, written from operational experience. You operate a TCGplayer storefront. You've inspected thousands of cards under PSA criteria. You know what a 70/30-centered card looks like. Write like you're answering a friend who just texted you the question — knowledgeable, no padding.

# Output format

Return a SINGLE JSON object inside a \`\`\`json fence. Schema:

\`\`\`json
{
  "title": "string — 50-65 chars, includes primary keyword",
  "description": "string — 140-160 chars meta description, includes primary keyword",
  "tags": ["string", "..."],
  "body": "string — full MDX body. Opens with a 1-sentence direct answer to the primary keyword. Uses ## H2 sections. Every H2 has at least 1 dollar figure OR 1 recent date OR 1 Foil data citation. Includes 1+ <Callout> and exactly 1 <CardScannerEmbed />. Includes 2+ internal links via [text](/path) or <TopicLink>. Body word count 1200-2200. Do NOT include a frontmatter fence in body — frontmatter is filled from the JSON fields.",
  "faq": [
    { "question": "string", "answer": "string — 2-4 sentences, no fluff" }
  ]
}
\`\`\`

Custom components available: <Callout variant="info|warning|tip">...</Callout>, <CardScannerEmbed />, <TopicLink href="/path">anchor</TopicLink>.`;

function renderInitialUserPrompt(
  candidate: ClusterCandidate,
  today: string,
  serpContext: SerpContext | null,
  dataSnapshot: FoilDataSnapshot,
): string {
  const sections: string[] = [];

  sections.push(`Today is ${today}.`);
  sections.push("");
  sections.push("# Topic assignment");
  sections.push(`- **Candidate title:** ${candidate.title}`);
  sections.push(`- **Rationale:** ${candidate.rationale}`);
  sections.push(`- **Long-tail keywords:** ${candidate.longTail.join(", ") || "(none specified)"}`);
  sections.push(`- **Parent pillar URL:** ${candidate.pillar.url}`);
  sections.push(`- **Parent pillar primary keyword:** ${candidate.pillar.primaryKeyword}`);
  sections.push(`- **Publish path:** /blog/${candidate.slug}`);
  sections.push(`- **Primary keyword to feature:** ${candidate.longTail[0] ?? candidate.title}`);
  sections.push("");

  if (serpContext) {
    sections.push("# Beat-the-top-3 SERP context");
    sections.push(renderSerpContextPrompt(serpContext));
    sections.push("");
  }

  sections.push("# Foil proprietary data");
  sections.push(renderDataInjectionPrompt(dataSnapshot));
  sections.push("");

  sections.push("Generate the JSON object now. Apply the DUD framework, the Information Gain mandate, and every hard rule from the system prompt. Body 1200-2200 words. 5+ dollar figures, 2+ recent (2025/2026) dates, 2+ internal links, 5-6 FAQs totaling 200+ words.");

  return sections.join("\n");
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
