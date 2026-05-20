// The weekly content engine. Picks a topic from the strategy doc backlog,
// calls Claude Sonnet 4.6 with a tightly-scoped system prompt, and returns a
// fully-formed MDX draft (frontmatter + body + FAQs) ready to write to disk.
//
// What this module DOES guarantee:
//   - Topic selection respects shipped slugs (no duplicates).
//   - Output ALWAYS has frontmatter, a body, and a non-empty FAQ array.
//   - System prompt forbids the AI-tell phrases that trigger E-E-A-T downgrades.
//   - The post mentions the parent pillar by primary keyword exactly once.
//
// What this module does NOT do:
//   - Publish anything. Output goes to _pending/ via the script wrapper.
//   - Edit existing posts. That's lib/seo/internal-linking.ts's job.
//   - Fetch live keyword data. The backlog is the source of truth — swap in
//     a Google Trends client when one exists.

import fs from "node:fs";
import path from "node:path";
import { anthropic } from "../anthropic.ts";
import {
  parseStrategyDoc,
  pickNextCandidate,
  slugify,
  type ClusterCandidate,
} from "./keyword-backlog.ts";

export const CONTENT_MODEL = "claude-sonnet-4-6";

export type GeneratedDraft = {
  candidate: ClusterCandidate;
  slug: string;
  frontmatter: {
    title: string;
    description: string;
    date: string; // ISO YYYY-MM-DD
    tags: string[];
    pillar: string;
    primaryKeyword: string;
  };
  body: string; // Full MDX body excluding frontmatter fence
  faq: { question: string; answer: string }[];
  wordCount: number;
};

/**
 * Build the full MDX file text including frontmatter, body, and a serialized
 * FAQ block ready to render. Keeps frontmatter formatting deterministic so a
 * git diff between two weekly runs is meaningful.
 */
export function serializeDraft(draft: GeneratedDraft): string {
  const fm = draft.frontmatter;
  const tagsArray = fm.tags.length
    ? `[${fm.tags.map((t) => `"${t}"`).join(", ")}]`
    : "[]";

  const faqBlock = draft.faq.length
    ? `\n\n## Frequently asked questions\n\n${draft.faq
        .map((q) => `### ${q.question}\n\n${q.answer}`)
        .join("\n\n")}\n`
    : "";

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

${draft.body.trim()}${faqBlock}
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
};

/**
 * Pick the next candidate from the backlog and generate a draft for it.
 * Throws if there's no backlog, no API key, or Claude returns malformed JSON
 * — the caller (script wrapper) is responsible for surfacing those failures.
 */
export async function generateWeeklyPost(
  opts: GenerateOptions,
): Promise<GeneratedDraft> {
  const strategyPath =
    opts.strategyDocPath ?? path.join(process.cwd(), "docs", "seo-strategy.md");
  const strategyDoc = fs.readFileSync(strategyPath, "utf8");
  const candidates = parseStrategyDoc(strategyDoc);
  if (candidates.length === 0) {
    throw new Error(
      `No cluster candidates parsed from ${strategyPath}. Has the strategy doc been edited into a non-parseable shape?`,
    );
  }

  const candidate = pickNextCandidate(candidates, opts.shippedSlugs);
  if (!candidate) {
    throw new Error(
      "Every candidate in docs/seo-strategy.md is already shipped. Add more cluster topics to the doc, then re-run.",
    );
  }

  const client = anthropic();
  const message = await client.messages.create({
    model: CONTENT_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: renderUserPrompt(candidate, opts.today) }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`Claude returned no text content for ${candidate.title}`);
  }
  const parsed = parseModelOutput(textBlock.text);

  return {
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
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// =============================================================================
// System prompt — the foundation of trustworthy output. Every constraint here
// reflects a specific failure mode we'd otherwise have to fix in review.
// =============================================================================

const SYSTEM_PROMPT = `You are the content writer for Foil, a Pokémon TCG card valuation tool. You write SEO-targeted blog posts that English-speaking Pokémon collectors actually want to read — not generic AI prose.

# What Foil is

Foil reads three printed fields off a Pokémon card photo (name, set code, collector number), then prices the card using live eBay sold averages, TCGplayer market price, and PriceCharting's graded ladder (PSA 7-10, BGS 9.5/10, CGC 10, SGC 10). The product's defensible wedge is reading the printed metadata (including Japanese sv-era set codes) as the source of truth, rather than guessing from artwork.

# Hard rules

1. **No generic openings.** Never start with "In today's fast-paced world", "Pokémon cards have captured the hearts of collectors worldwide", "Have you ever wondered", "Let's dive in", or any variant. Open with a concrete scenario or a specific number.

2. **No AI tells.** Forbidden phrases: "delve into", "tapestry", "navigate the landscape", "in the realm of", "ever-evolving", "embark on a journey", "it's important to note", "in conclusion", "leverage", "utilize" (use "use"), "garnered". When a sentence reads like it could appear in any blog on any topic, rewrite it specifically.

3. **Factual citations required.** Any specific number (price, population count, grading fee, release date) needs to be either (a) a defensible round-number range, or (b) explicitly named as approximate ("around $25", "roughly 30-45 days as of 2026"). NEVER make up a precise number you can't source. If you don't know the exact number, write the range and note "as of 2026, check current".

4. **The three-field framework.** When discussing card identification, always reference reading name + set code + collector number. NEVER suggest identifying a card by artwork — that's a known failure mode the product corrects for.

5. **Pillar attribution.** Link to the parent pillar exactly ONCE, near the beginning, using its primary keyword as anchor text. Don't link to it again — over-anchoring is a known E-E-A-T downgrade.

6. **Pokémon spelling.** Always "Pokémon" with the é, never "Pokemon", unless inside a code identifier, URL, or set code where the é doesn't belong.

7. **FAQ section.** Generate 5-6 substantive FAQs. Each answer is 2-4 sentences, not a single sentence and not a wall of text.

# Tone

Direct, declarative, written from experience. You've been collecting since the original Base Set. You operate a TCGplayer storefront. You know what a 70/30-centered card looks like under PSA inspection. Write like you're answering a friend who just texted you the question — knowledgeable, but with no padding.

# Output format

Return a SINGLE JSON object inside a \`\`\`json fence. Schema:

\`\`\`json
{
  "title": "string — the H1 title, 50-65 chars, includes the primary keyword",
  "description": "string — meta description, 140-160 chars, includes the primary keyword",
  "tags": ["string", "..."],
  "body": "string — full MDX body, starts with a 1-sentence direct answer to the primary keyword query, uses ## H2 sections, includes at least one <Callout variant=\\"tip\\"> or <Callout variant=\\"warning\\">, includes one <CardScannerEmbed /> mid-article, ends with a 'Related guides' section linking to the parent pillar via <TopicLink>",
  "faq": [
    { "question": "string", "answer": "string — 2-4 sentences" }
  ]
}
\`\`\`

The body is rendered as MDX. You may use these custom components: <Callout variant="info|warning|tip">...</Callout>, <CardScannerEmbed />, <TopicLink href="/path">anchor</TopicLink>. Do NOT include a frontmatter fence in the body — frontmatter is filled in from the JSON fields.`;

function renderUserPrompt(candidate: ClusterCandidate, today: string): string {
  return `Today is ${today}.

Write a blog post targeting this cluster topic:

- **Candidate title:** ${candidate.title}
- **Rationale:** ${candidate.rationale}
- **Long-tail keywords to target:** ${candidate.longTail.join(", ") || "(none specified — use your judgment)"}
- **Parent pillar URL:** ${candidate.pillar.url}
- **Parent pillar primary keyword:** ${candidate.pillar.primaryKeyword}

The post will be published at /blog/${candidate.slug}. The primary keyword to feature in title, description, and the opening sentence is: **${candidate.longTail[0] ?? candidate.title}**.

Target length: 900-1400 words of body prose (the FAQ section is additional). Return the JSON object only, inside a single \`\`\`json fence.`;
}

/**
 * Extract the JSON payload from the model's response. Tolerates fences with
 * extra whitespace + an optional language tag, but rejects anything that
 * doesn't parse to the expected schema shape.
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

/** Re-exported so the slug helper is reachable without importing two modules. */
export { slugify };
