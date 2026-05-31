// The autonomous newsletter draft pipeline. Single Claude call per attempt
// produces { body, subject candidates }; quality gates filter the result; up
// to 3 retries with the failure list passed back to the model. On success,
// the orchestrator hands the draft to lib/beehiiv-posts.createDraftPost.
//
// On failure (3-strike), throws NewsletterGenerationFailed — caller decides
// whether to soft-log (autonomy mode) or hard-fail.
//
// Architectural decisions worth knowing before editing:
// 1. We do NOT re-summarize the blog post for fact-grounding. Claude reads
//    the blog body directly inside the user prompt and is instructed not to
//    invent figures. R-001 amplification (see ADR-011) means hallucination
//    here is more expensive than in the blog itself.
// 2. Subject + preview text + 3rd-candidate live on the SAME JSON output as
//    the body. One round trip per attempt.
// 3. The HTML produced is intentionally minimal — Beehiiv's draft editor
//    will reflow whatever <p>/<h2>/<strong>/<a> we send.

import { anthropic } from "../anthropic.ts";
import { CONTENT_MODEL, BACKOFF_MS } from "../seo/content-engine.ts";
import { runNewsletterQualityGates, type NewsletterGateResult } from "./quality-gates.ts";
import type { NewsletterBlogPostInput, NewsletterDraft } from "./types.ts";

export const NEWSLETTER_MAX_RETRIES = 3;

export class NewsletterGenerationFailed extends Error {
  readonly attempts: number;
  readonly lastFailures: string[];
  readonly lastDraft: NewsletterDraft | null;

  constructor(attempts: number, lastFailures: string[], lastDraft: NewsletterDraft | null) {
    super(
      `Newsletter draft failed quality gates after ${attempts} attempts. Last failures:\n  - ${lastFailures.join("\n  - ")}`,
    );
    this.name = "NewsletterGenerationFailed";
    this.attempts = attempts;
    this.lastFailures = lastFailures;
    this.lastDraft = lastDraft;
  }
}

/**
 * Transform a blog post into a 300-600 word newsletter draft. Reads ONLY
 * facts/figures already in blogPost.content — see ADR-011 and gate (d).
 * Throws NewsletterGenerationFailed after MAX_RETRIES gate-failures.
 */
export async function generateNewsletterDraft(
  blogPost: NewsletterBlogPostInput,
): Promise<NewsletterDraft> {
  if (!blogPost.content?.trim() || !blogPost.title?.trim()) {
    throw new NewsletterGenerationFailed(0, ["Blog post is missing title or content"], null);
  }

  const client = anthropic();
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  let lastDraft: NewsletterDraft | null = null;
  let lastGate: NewsletterGateResult = { passed: false, failures: ["no attempts made"] };

  for (let attempt = 1; attempt <= NEWSLETTER_MAX_RETRIES; attempt++) {
    const userPrompt =
      attempt === 1
        ? renderInitialPrompt(blogPost)
        : renderRetryPrompt(lastGate.failures);
    history.push({ role: "user", content: userPrompt });

    const text = await callClaudeWithBackoff(client, history);
    history.push({ role: "assistant", content: text });

    let parsed;
    try {
      parsed = parseDraftJson(text);
    } catch (err) {
      lastGate = {
        passed: false,
        failures: [`Model output didn't parse as the required JSON object: ${(err as Error).message}`],
      };
      continue;
    }

    const subjectCandidates = parsed.subjects.slice(0, 3);
    const subject = subjectCandidates[0] ?? "";
    const previewText = subjectCandidates[1] ?? "";
    const textBody = stripHtml(parsed.htmlBody);

    const draft: NewsletterDraft = {
      subject,
      previewText,
      htmlBody: parsed.htmlBody,
      textBody,
      wordCount: countWords(textBody),
      subjectCandidates,
    };

    lastDraft = draft;
    lastGate = runNewsletterQualityGates(draft, blogPost);

    console.log(
      `[newsletter] attempt ${attempt}/${NEWSLETTER_MAX_RETRIES}: ${lastGate.passed ? "PASS" : `FAIL (${lastGate.failures.length} gate violations)`}`,
    );

    if (lastGate.passed) return draft;

    for (const failure of lastGate.failures) {
      console.log(`[newsletter]   - ${failure}`);
    }
  }

  throw new NewsletterGenerationFailed(NEWSLETTER_MAX_RETRIES, lastGate.failures, lastDraft);
}

async function callClaudeWithBackoff(
  client: ReturnType<typeof anthropic>,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  for (let i = 0; i <= BACKOFF_MS.length; i++) {
    try {
      const message = await client.messages.create({
        model: CONTENT_MODEL,
        max_tokens: 2048,
        system: NEWSLETTER_SYSTEM_PROMPT,
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
      console.warn(`[newsletter] Claude ${status} — backing off ${wait}ms (attempt ${i + 1}/${BACKOFF_MS.length})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("unreachable");
}

const NEWSLETTER_SYSTEM_PROMPT = `You are John Craig — operator of a TCGplayer storefront, building Foil (a Pokémon card valuation tool). You're writing a short companion newsletter for a blog post that just published. The newsletter ships to subscribers via Beehiiv; it lives next to their inbox primary tab, not on a SERP. Voice is canonical per docs/BRAND-VOICE.md: Matt Levine x Morning Brew anchored by a working seller's POV. Direct, declarative, confident, knowledgeable, calm. A sharp dealer who already did the scrubbing, never a hype machine. Personality is felt through specificity, not performed; assume the reader is already in the niche. No padding, no SEO hedging.

# Hard rules (any violation rejects the draft)

1. **Word count: 300-600.** Tighter than the blog. This is a teaser + a directive, not a re-publish.

2. **Fact-grounding (R-001 amplification rule).** You may reference ONLY facts and dollar figures that already appear verbatim in the source blog post text I provide. Do not invent or extrapolate. If a number isn't in the source, don't use a number — describe it qualitatively. This is non-negotiable: fabricated figures in a newsletter erode subscriber trust permanently. If you need a price to make a point, quote one directly from the blog body.

3. **Required anchors.** The body MUST include:
   - One anchor to \`/blog/{slug}\` with anchor text "Read the full post →" (or a close variant ending in "→").
   - One anchor to \`foiltcg.com/upload\` with a Foil CTA anchor text like "Try Foil free →" or "Scan a card →".

4. **HTML output only.** Body is raw HTML. Use <p>, <h2>, <strong>, <em>, <a href="...">. NO <html>/<body>/<head> wrapper, NO inline styles, NO Beehiiv-specific blocks. Beehiiv's draft editor reflows whatever you send.

5. **Opener.** 1-2 sentences in John's voice. Concrete — a scenario, a card, a number directly quoted from the blog. Not "Hey readers" or "Hope you're well".

6. **Subject lines.** Produce exactly 3 candidates, each 30-65 characters. Specific, curiosity-driven, NOT clickbait. No emoji. No ALL CAPS. The best candidate goes first — it'll be the subject; the second feeds the inbox preview text.

7. **Banned phrases.** Never use: "in conclusion", "in summary", "as we've seen", "in today's digital world", "the world of pokemon", "as a collector", plus the brand-voice hype/AI-tell bans: "let's dive in" / "dive in", "game-changer", "to the moon", "navigate the landscape", "delve", "tapestry", "in today's market". (Same list as the blog quality gates.) No em dashes anywhere.

8. **Pokémon spelling.** Always "Pokémon" with the é.

9. **Exact numbers only (brand voice).** Every figure is exact, never hedged: "$192 to $176", not "around $180". No "around $X", "roughly N%", "~N", or "(approximate)". Combined with rule 2, this means: quote a precise number that's in the source post, or describe it qualitatively. Never a vague or invented figure. (docs/BRAND-VOICE.md)

# Output format

Return a SINGLE JSON object inside a \`\`\`json fence. Schema:

\`\`\`json
{
  "subjects": ["string (30-65 chars)", "string (30-65 chars)", "string (30-65 chars)"],
  "htmlBody": "string — full newsletter body as HTML, 300-600 words, with the required anchors above"
}
\`\`\`

No other keys. No prose outside the fence.`;

function renderInitialPrompt(blogPost: NewsletterBlogPostInput): string {
  const tags = blogPost.tags?.length ? blogPost.tags.join(", ") : "(none)";
  const kw = blogPost.primaryKeyword ?? blogPost.title;
  return [
    `# Source blog post (the ONLY fact source you may cite)`,
    ``,
    `Slug: ${blogPost.slug}`,
    `Title: ${blogPost.title}`,
    `Description: ${blogPost.description}`,
    `Primary keyword: ${kw}`,
    `Tags: ${tags}`,
    ``,
    `--- BEGIN SOURCE ---`,
    blogPost.content.trim(),
    `--- END SOURCE ---`,
    ``,
    `Write the newsletter now. 300-600 words, 3 subject candidates, required anchors, JSON-fenced. Cite no figure not present above.`,
  ].join("\n");
}

function renderRetryPrompt(failures: string[]): string {
  return [
    `Your previous draft failed the following gates. Regenerate the JSON object, fixing EVERY failure listed. Do not drop the required anchors when trimming for length.`,
    ``,
    `Failures:`,
    ...failures.map((f) => `- ${f}`),
    ``,
    `Return ONLY the corrected JSON object inside a \`\`\`json fence.`,
  ].join("\n");
}

export function parseDraftJson(text: string): { subjects: string[]; htmlBody: string } {
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
    throw new Error("Model output JSON was not an object");
  }
  const o = obj as Record<string, unknown>;
  const subjects = Array.isArray(o.subjects)
    ? o.subjects.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
  const htmlBody = typeof o.htmlBody === "string" ? o.htmlBody : "";
  if (subjects.length === 0) throw new Error("Model output had no usable subjects");
  if (!htmlBody.trim()) throw new Error("Model output had empty htmlBody");
  return { subjects, htmlBody };
}

/**
 * Strip HTML tags for word-counting and link gates. Handles common entities so
 * "&amp;" doesn't count as a word. Not a security boundary — purely for
 * gate inspection, since Beehiiv re-renders the source HTML anyway.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
