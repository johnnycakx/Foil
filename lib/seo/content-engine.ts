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
import {
  runQualityGates,
  buildFoilDataAllowedValues,
  type GateResult,
  type QualityGateContext,
} from "./quality-gates.ts";
import { readdirSync } from "node:fs";
import { POSTS_DIR } from "../blog/posts-dir.ts";
import { join } from "node:path";
import { CARD_CATALOG } from "../cards/catalog.ts";

// Known non-blog/non-card internal routes for gate 9 (link existence). Pillars
// + the static app routes a post might legitimately link to.
const KNOWN_INTERNAL_ROUTES: ReadonlySet<string> = new Set([
  "/",
  "/blog",
  "/cards",
  "/start",
  "/newsletter",
  "/account",
  "/upload",
  "/pokemon-card-value-calculator",
  "/japanese-pokemon-cards-value",
  "/pokemon-card-condition-guide",
  "/legal/privacy",
  "/legal/terms",
]);

/**
 * Build the gate-9 internal-link resolver from the live blog-post directory +
 * CARD_CATALOG + the known-route allowlist. Soft-fails open (returns a
 * resolver that approves everything) if the posts dir can't be read — a gate
 * infrastructure hiccup must not block an otherwise-good publish.
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
  const cardSlugs = new Set(CARD_CATALOG.map((c) => c.slug));
  return (href: string) => {
    let p = href;
    for (const host of ["www.foiltcg.com", "foiltcg.com", "foil-rosy.vercel.app"]) {
      const i = p.indexOf(host);
      if (i >= 0) p = p.slice(i + host.length);
    }
    p = (p.split("#")[0].split("?")[0].replace(/\/+$/, "")) || "/";
    if (!p.startsWith("/")) return true; // external/unresolvable — not ours to fail
    if (p.startsWith("/blog/")) return blogSlugs.has(p.slice("/blog/".length));
    if (p.startsWith("/cards/")) return cardSlugs.has(p.slice("/cards/".length));
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

  // 3. Foil data snapshot (degrades silently)
  const dataSnapshot: FoilDataSnapshot = opts.dataClient
    ? await collectFoilData(opts.dataClient).catch(() => emptySnapshot())
    : emptySnapshot();

  // Gate 9 + 10 context (Session 47.4): resolve internal links against the
  // real post dir + catalog, and pin Foil-data numeric claims to the snapshot.
  const gateCtx: QualityGateContext = {
    internalLinkExists: buildInternalLinkResolver(),
    foilDataAllowedValues: buildFoilDataAllowedValues(dataSnapshot),
  };

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

Every H2 section MUST contain at least ONE of: a specific dollar figure (e.g. "$313") or a recent date (within the last 6 months — anchored to 2026). A section without either gets cut and rewritten. You MAY also cite Foil's proprietary data, but ONLY a figure that appears verbatim in the "Foil proprietary data" block of this prompt — never invent a Foil statistic to satisfy this mandate. If the data block is empty, cite no Foil number. (A fabricated "Foil's scan data shows ~18%" claim shipped once and is the reason for this rule + quality-gate 10.)

# Hard rules

1. **No generic openings.** Open with a concrete scenario or a specific number — never "In today's digital world", "Pokémon cards have captured...", "Have you ever wondered". Banned phrases that auto-fail quality gates: "in conclusion", "in summary", "as we've seen", "in today's digital world", "the world of pokemon", "as a collector", plus the brand-voice hype/AI-tell bans: "let's dive in" / "dive in", "game-changer", "to the moon", "navigate the landscape", "delve", "tapestry", "in today's market". No em dashes anywhere (use commas, colons, semicolons, periods, parentheses).

2. **The three-field framework.** When discussing card identification, reference reading name + set code + collector number off the card. Never recommend identifying by artwork — that's the failure mode Foil's product is designed to correct.

3. **Pillar attribution.** Link to the parent pillar exactly ONCE, near the beginning, using its primary keyword as anchor. Don't link to it again — over-anchoring degrades E-E-A-T.

4. **Pokémon spelling.** Always "Pokémon" with the é. Exception: code identifiers, set codes, URLs.

5. **FAQ section.** Generate 5-6 substantive FAQs. Each answer is 2-4 sentences. The combined FAQ text must total 200+ words.

6. **Internal links.** At least TWO internal links (markdown [text](/path) or MDX href="/path") to existing Foil pages — pillars, sibling clusters, the homepage, the blog index.

7. **Dollar figures.** At least 5 UNIQUE dollar figures in the body. Each should be sourced or defensible as a 2026 round-number estimate.

8. **Recent dates.** At least 2 mentions of "2025" or "2026" in the body (outside URLs).

9. **Word count.** Body 1200-2200 words. Tight, dense, evidence-led — not padded.

# Brand voice (canonical: docs/BRAND-VOICE.md)

Matt Levine x Morning Brew, applied to Pokémon TCG, anchored by a working seller's POV. Direct, declarative, written from operational experience: you operate a TCGplayer storefront, you've inspected thousands of cards under PSA criteria. Three words: confident, knowledgeable, calm. A sharp dealer who already did the scrubbing, never a hype machine. The feeling to evoke is "someone reliable already checked this," not urgency or FOMO.

Non-negotiable voice rules:
- **Numbers are always exact, never vague.** "$192 to $176", not "around $180". No "around $X", "roughly N%", "~N", or "(approximate)" as a hedge on a price or stat. If you lack the exact figure, describe it qualitatively or omit it — never dress a guess as data.
- **Every claim is grounded; never fabricate.** A proprietary stat must trace to the Foil data block; a fact about a card (set, number, price, pop) must be true. Fabrication is the single worst failure, worse than a bland sentence.
- **Personality is felt, not performed.** Let specificity carry the authority. At most one genuine operator aside ("I'm not stocking these at that price"). Don't write "as a collector" or "in my opinion".
- **Dry humor permitted, hype banned.** Treat an absurdity with deadpan acknowledgment, never "to the moon" or "game-changer".
- **Assume the reader is in the niche.** Don't define ETB, SAR, PSA grade, pop diff. Mix short punchy sentences with longer analytical breakdowns. Bold for navigation, not decoration.

Write like you're answering a friend who just texted you the question — knowledgeable, no padding.

# Creator commentary context (when a digest is provided)

The prompt may include a "Creator commentary digest" — a synthesis of what whitelisted Pokémon TCG YouTubers said in the last 30 days. It is **speaker-data (what creators are saying), not card-data (what a card is worth)**. Use it for *market-sentiment color* (what the community is watching, what's hyped, what's rotating), never as a price source. Rules:
- **Synthesize, never copy.** Never reproduce more than 25 consecutive words from any transcript or digest line. Paraphrase the idea in Foil's voice.
- **Always attribute by name.** If you reference what a creator said, name them ("PokeBeard called the Destined Rivals chase cards overheated"). Never write "creators are saying" or "the community thinks" without a named source — an unattributed creator claim auto-fails the quality gates.
- **Hype is speaker-data.** When the digest flags a card as a "speculator-spike candidate," treat that as evidence the creator is excited, frequently a contrarian SELL signal — report it as sentiment, never adopt the hype. Stay calm and dealer-skeptical (the brand voice).
- **Facts still need grounding.** A creator saying a card is "$2,000" is not a citable price; cite the Foil data block or completed sales for any number you state as fact. The digest tells you what to *write about*, not what a card *is worth*.

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

  // Creator commentary digest (ADR-050): speaker-data market signal, injected
  // fresh each generation. Synthesis + named attribution required (Gate 11).
  const digest = loadLatestCreatorDigest();
  if (digest) {
    sections.push("# Creator commentary digest (speaker-data — synthesize + attribute by name, never copy >25 words)");
    sections.push(digest);
    sections.push("");
  }

  sections.push("Generate the JSON object now. Apply the DUD framework, the Information Gain mandate, and every hard rule from the system prompt. Body 1200-2200 words. 5+ dollar figures, 2+ recent (2025/2026) dates, 2+ internal links, 5-6 FAQs totaling 200+ words.");

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
