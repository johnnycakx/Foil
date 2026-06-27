// X post structure + quality gate (ADR-074 v2.1 amendment, Fix 3 / 3b). The
// card-hero copy rework needs the post to:
//   (a) stay LINK-FREE in the body — the link is posted as the first reply for
//       reach (X throttles posts that contain a link), Fix 3b; and
//   (b) on the card-hero angles, read as several spaced "beats" that ADD the
//       interpretation (the volume read, signal vs noise, what it means for a
//       buyer) rather than just restating the %, $, and sale count already on
//       the branded image.
//
// This is the single post-text quality gate: it composes the brand voiceCheck
// (em dash, hype words, vague/unsourced numbers) with the new structural rules,
// so generatePostText runs ONE check. Pure + deterministic so it doubles as a
// unit-pinned function.
//
// Honest limit (same spirit as voiceCheck): the "adds interpretation" rule is a
// STRUCTURAL proxy (does the copy use the vocabulary of interpretation), not a
// semantic proof. It catches the bare-readout failure mode; it cannot certify
// that the interpretation is correct. Human review (the #content-engine approval
// card) is the final judge.

import { voiceCheck, type VoiceViolation } from "../seo/voice-check.ts";

/** A link/URL in the body: an http(s) URL or a bare foiltcg.com mention. */
const URL_RE = /\bhttps?:\/\/\S+|\b(?:www\.)?foiltcg\.com\b/i;

/** Beats = blocks separated by a blank line. Tightly-coupled sentences sharing
 *  one line count as a single beat (the post breathes on mobile). */
export function splitBeats(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
}

/** Does the body carry a link/URL? The body must be link-free (Fix 3b). */
export function bodyHasLink(text: string): boolean {
  return URL_RE.test(text);
}

// Stems that signal the copy is INTERPRETING the data rather than restating the
// image's three numbers. The card-hero gate requires at least one. Case-
// insensitive substring match on stems (so "sales"/"sold"/"sellers" all hit).
const INTERPRETATION_SIGNALS = [
  "sale", "sold", "seller", "sample", "volume", "trend", "noise", "signal",
  "cooling", "sliding", "slipped", "slid", "bounce", "average", "watch",
  "buyer", "demand", "market", "worth", "outlier", "listing", "ask",
];

/** Minimum beat-separated blocks for a card-hero post (Fix 3 structure). */
export const MIN_BEATS = 3;

export function hasInterpretation(text: string): boolean {
  const lower = text.toLowerCase();
  return INTERPRETATION_SIGNALS.some((w) => lower.includes(w));
}

function describeVoice(v: VoiceViolation): string {
  return `${v.kind} (${v.detail})`;
}

export type PostGateResult = { ok: boolean; issues: string[] };

/**
 * The post-text quality gate. ALWAYS enforces brand voice (no em dash, no hype,
 * no vague/unsourced numbers) AND a link-free body. For the card-hero angles
 * (`requireBeats`), additionally enforces at least MIN_BEATS beat-separated
 * blocks and that the copy adds interpretation (does not merely restate the
 * image's three numbers). Returns every issue so a retry prompt sees them all.
 */
export function checkPostStructure(text: string, opts: { requireBeats: boolean }): PostGateResult {
  const issues: string[] = [];

  for (const v of voiceCheck(text).violations) issues.push(describeVoice(v));

  if (bodyHasLink(text)) {
    issues.push("post body contains a link or URL (the link goes in the reply, not the body)");
  }

  if (opts.requireBeats) {
    const beats = splitBeats(text);
    if (beats.length < MIN_BEATS) {
      issues.push(
        `only ${beats.length} beat-separated block(s); needs at least ${MIN_BEATS} (put a blank line between beats)`,
      );
    }
    if (!hasInterpretation(text)) {
      issues.push(
        "the post just restates the numbers; add the interpretation (the volume read, signal vs noise, what it means)",
      );
    }
  }

  return { ok: issues.length === 0, issues };
}
