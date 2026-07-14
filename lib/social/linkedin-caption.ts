// LinkedIn paste-rail caption builder (personal-profile syndication).
//
// John's PERSONAL LinkedIn feed is a human_only channel (see
// syndication-channels.ts): this module only ever produces TEXT for a human to
// paste — there is deliberately NO LinkedIn API client anywhere in the repo,
// and none may be added without a new policy decision from John.
//
// The caption is DETERMINISTIC (assembled from the post's own frontmatter,
// never an LLM) so it is fabrication-proof by construction — the same doctrine
// as the deterministic digest (ADR-080). John edits before pasting anyway.

const CAPTION_MAX_CHARS = 1200;
const UTM_CAMPAIGN_MAX = 64;
const SITE_URL = "https://foiltcg.com";

export type LinkedInCaptionInput = {
  /** Published post slug — becomes the URL path and the utm_campaign. */
  slug: string;
  title: string;
  description: string;
};

export type LinkedInCaption = {
  /** Paste-ready caption text, voice-swept, ending with the UTM link. */
  caption: string;
  /** The UTM-tagged blog URL (also the caption's last line). */
  link: string;
};

/**
 * Voice sweep per John's banked rules: NO em dashes (commas do the work) and
 * "chasing" never "hunting". Word-boundary matches only, case-preserving on
 * the leading letter, so substrings ("Hunter's") are untouched.
 */
export function sweepVoice(text: string): string {
  return text
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s*–\s*/g, ", ")
    .replace(/\bhunting\b/g, "chasing")
    .replace(/\bHunting\b/g, "Chasing")
    .replace(/\bhunts\b/g, "chases")
    .replace(/\bHunts\b/g, "Chases")
    .replace(/\bhunt\b/g, "chase")
    .replace(/\bHunt\b/g, "Chase")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** utm_campaign per the acquisition-utm runbook: [a-z0-9-], capped at 64. */
export function sanitizeCampaign(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, UTM_CAMPAIGN_MAX);
}

export function buildLinkedInLink(slug: string): string {
  const campaign = sanitizeCampaign(slug);
  return `${SITE_URL}/blog/${slug}?utm_source=linkedin&utm_medium=social&utm_campaign=${campaign}`;
}

/**
 * Assemble the paste-ready caption: title line, swept description, one fixed
 * first-person line, the UTM link. Hard-capped at 1,200 chars (a conservative
 * readability cap — the description is trimmed at a sentence boundary first,
 * never the link).
 */
export function buildLinkedInCaption(input: LinkedInCaptionInput): LinkedInCaption {
  const link = buildLinkedInLink(input.slug);
  const title = sweepVoice(input.title);
  const closer = `I built Foil to track what Pokemon cards actually sell for. Sold prices, not asking prices. Full breakdown:`;

  let description = sweepVoice(input.description);
  const fixedLen = title.length + closer.length + link.length + 6; // 3 double-newline joins
  const room = CAPTION_MAX_CHARS - fixedLen;
  if (description.length > room) {
    const cut = description.slice(0, Math.max(0, room));
    const lastStop = cut.lastIndexOf(". ");
    description = lastStop > 40 ? cut.slice(0, lastStop + 1) : cut.trimEnd();
  }

  const caption = [title, description, closer, link].filter(Boolean).join("\n\n");
  return { caption, link };
}
