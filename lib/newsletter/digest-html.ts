// Render the "good buys this week" digest to paste-ready HTML for the Beehiiv
// email body (ADR-077). DETERMINISTIC: no LLM — `buildMoversDigestParts` is the
// single source of truth (shared with the markdown-file path), and `marked`
// converts its body markdown to the <h1>/<h2>/<p>/<strong>/<ul>/<a> HTML Beehiiv
// reflows. The affiliate links are wrapped upstream in the markdown (epn.ts),
// so they survive into the HTML unchanged.

import { marked } from "marked";
import { buildMoversDigestParts, type MoversDigestInput } from "./movers-digest.ts";

export type DigestRender = {
  subject: string;
  previewText: string;
  /** The email body markdown (canonical record / debug). */
  bodyMarkdown: string;
  /** The email body HTML (what John pastes into Beehiiv). */
  html: string;
  downCount: number;
  upCount: number;
};

/** Convert the digest body markdown to HTML. Synchronous (`async: false`) so the
 *  cron + approve route stay simple; marked handles headings, bold, links, and
 *  unordered lists, which is the full surface the serializer emits.
 *
 *  SECURITY INVARIANT (ADR-077 review): `marked` does NOT sanitize HTML. Today
 *  this is safe because (a) the only dynamic content is card/set names from
 *  market_movers (PokeTrace-fed, not user input) and (b) the output goes ONLY to
 *  the founder's inbox + a private Discord card, never to subscribers. **Before
 *  wiring this HTML to any subscriber-facing send (the Beehiiv Max RSS-to-Send
 *  graduation path), add an HTML sanitizer here** so a malformed card name can't
 *  inject markup into a subscriber email. */
export function digestBodyToHtml(bodyMarkdown: string): string {
  return (marked.parse(bodyMarkdown, { async: false }) as string).trim();
}

/** Build everything the send path needs: subject, preview, body markdown + HTML. */
export function renderDigestForSend(input: MoversDigestInput): DigestRender {
  const parts = buildMoversDigestParts(input);
  return {
    subject: parts.subject,
    previewText: parts.previewText,
    bodyMarkdown: parts.bodyMarkdown,
    html: digestBodyToHtml(parts.bodyMarkdown),
    downCount: parts.downCount,
    upCount: parts.upCount,
  };
}
