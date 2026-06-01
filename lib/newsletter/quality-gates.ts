// Newsletter quality gates — the safety net between Claude's output and a
// Beehiiv draft. Same architectural pattern as lib/seo/quality-gates.ts: each
// gate returns a single failure string when it fails; the orchestrator
// concatenates them into a retry prompt.
//
// R-001 amplification: a hallucinated $30,000 sale in a blog post is bad. The
// SAME hallucination inside a newsletter that lands in subscribers' inboxes
// is much worse — they trust the channel more, and the claim is harder to
// retract. Gate (d) below is the explicit guard: every dollar figure in the
// newsletter must also appear in the source blog post.

import { BANNED_PHRASES } from "../seo/quality-gates.ts";
import type { NewsletterBlogPostInput, NewsletterDraft } from "./types.ts";

export const NEWSLETTER_GATE_LIMITS = {
  wordCountMin: 300,
  wordCountMax: 600,
  subjectMin: 30,
  subjectMax: 65,
  blogLinkRequired: 1,
  foilCtaRequired: 1,
} as const;

export const BLOG_LINK_PATHS = (slug: string): readonly string[] => [
  `/blog/${slug}`,
  `foiltcg.com/blog/${slug}`,
];

export const FOIL_CTA_TARGETS: readonly string[] = [
  "foiltcg.com/upload",
  "foiltcg.com",
  // Root-relative /upload is also accepted — newsletters render at
  // beehiiv-hosted URLs so the link will be rewritten to absolute on send,
  // but the gate just needs to see one of these targets in the body.
  "/upload",
];

export type NewsletterGateResult = {
  passed: boolean;
  failures: string[];
};

/**
 * Run every gate against a candidate draft. Returns the full failure list so
 * the retry prompt asks Claude to fix all gaps at once instead of playing
 * whack-a-mole one gate at a time.
 */
export function runNewsletterQualityGates(
  draft: NewsletterDraft,
  blogPost: NewsletterBlogPostInput,
): NewsletterGateResult {
  const failures: string[] = [];
  const body = draft.textBody ?? "";
  const html = draft.htmlBody ?? "";
  const subject = (draft.subject ?? "").trim();

  // Gate (a): word count
  const words = draft.wordCount;
  if (words < NEWSLETTER_GATE_LIMITS.wordCountMin) {
    failures.push(
      `Newsletter is too short: ${words} words. Minimum is ${NEWSLETTER_GATE_LIMITS.wordCountMin}. Expand the lead or add a second teaser paragraph from the blog post's standout sections.`,
    );
  } else if (words > NEWSLETTER_GATE_LIMITS.wordCountMax) {
    failures.push(
      `Newsletter is too long: ${words} words. Maximum is ${NEWSLETTER_GATE_LIMITS.wordCountMax}. Trim — newsletter is a teaser, not a re-publish.`,
    );
  }

  // Gate (b): blog backlink present
  const blogLinkPaths = BLOG_LINK_PATHS(blogPost.slug);
  const hasBlogLink = blogLinkPaths.some((p) => html.includes(p) || body.includes(p));
  if (!hasBlogLink) {
    failures.push(
      `Missing "Read the full post →" link to /blog/${blogPost.slug}. Add an anchor pointing to that path.`,
    );
  }

  // Gate (c): Foil CTA present
  const hasFoilCta = FOIL_CTA_TARGETS.some(
    (t) => html.includes(t) || body.includes(t),
  );
  if (!hasFoilCta) {
    failures.push(
      `Missing "Try Foil free →" CTA. Add an anchor to foiltcg.com/upload (or /upload) in the body.`,
    );
  }

  // Gate (d): no fabricated dollar figures
  const newDollars = newDollarFigures(body, blogPost.content);
  if (newDollars.length > 0) {
    failures.push(
      `Newsletter cites dollar figures not present in the source blog post: ${newDollars.join(", ")}. Use ONLY figures that appear verbatim in the source. If a number is needed, quote one already in the blog body.`,
    );
  }

  // Gate (e): no banned phrases (reuse the blog post's list)
  const banned = bannedPhraseMatches(body);
  if (banned.length > 0) {
    failures.push(
      `Banned phrases detected: ${banned.map((p) => `"${p}"`).join(", ")}. Rewrite without them.`,
    );
  }

  // Gate (f): subject length
  if (subject.length < NEWSLETTER_GATE_LIMITS.subjectMin) {
    failures.push(
      `Subject too short: ${subject.length} chars ("${subject}"). Minimum is ${NEWSLETTER_GATE_LIMITS.subjectMin}.`,
    );
  } else if (subject.length > NEWSLETTER_GATE_LIMITS.subjectMax) {
    failures.push(
      `Subject too long: ${subject.length} chars ("${subject}"). Maximum is ${NEWSLETTER_GATE_LIMITS.subjectMax}. Inbox previews truncate.`,
    );
  }

  // Gate (g): no em dashes (HARD — parity with the blog Gate 12, ADR-051).
  // BRAND-VOICE.md rule 7 bans the em dash (—); en dashes (–) in numeric ranges
  // stay legal. Unambiguous literal-char match, zero false positives. Scans
  // EVERY field the model writes: the SUBJECT (inbox-visible), the plain text,
  // and the HTML body — not just the body (the same field-coverage gap that let
  // an em dash ship in a blog post's frontmatter description; PATTERNS I-008).
  const emDashes = (`${subject}\n${body}\n${html}`.match(/—/g) || []).length;
  if (emDashes > 0) {
    failures.push(
      `${emDashes} em dash(es) found. BRAND-VOICE.md bans the em dash character; recast each with a comma, colon, semicolon, period, or parentheses. (En dashes in numeric ranges like $95-$110 are fine.)`,
    );
  }

  return { passed: failures.length === 0, failures };
}

/**
 * Match $1,234 or $45 or $30,000 or $30.50. Commas must be between digit
 * triples — a trailing comma (as in "Prices: $5, $1,200, …") is sentence
 * punctuation and not part of the figure.
 */
export function extractDollarFigures(text: string): string[] {
  return text.match(/\$\d+(?:,\d{3})*(?:\.\d+)?/g) ?? [];
}

/**
 * Return any $-figure in `newsletterText` that does NOT appear in
 * `blogPostText`. Comparison normalizes commas + trailing zeros so "$30,000"
 * matches "$30000". This is the R-001 guard for newsletter copy.
 */
export function newDollarFigures(newsletterText: string, blogPostText: string): string[] {
  const blogSet = new Set(extractDollarFigures(blogPostText).map(normalizeDollar));
  const newsletterFigures = extractDollarFigures(newsletterText);
  const fabricated: string[] = [];
  const seen = new Set<string>();
  for (const fig of newsletterFigures) {
    const norm = normalizeDollar(fig);
    if (blogSet.has(norm)) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    fabricated.push(fig);
  }
  return fabricated;
}

function normalizeDollar(raw: string): string {
  // Strip the $ + commas, drop trailing .00 so "$30,000" matches "$30000.00"
  const digits = raw.replace(/[$,]/g, "");
  if (digits.endsWith(".00")) return digits.slice(0, -3);
  if (digits.endsWith(".0")) return digits.slice(0, -2);
  return digits;
}

export function bannedPhraseMatches(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => lower.includes(p.toLowerCase()));
}
