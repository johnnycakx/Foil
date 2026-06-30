// Engagement-brief candidate filter (ADR-086) — pure heuristics, no IO, so the
// "which posts are worth a data-backed reply" logic is fully unit-tested.
//
// READ + RANK ONLY. Nothing in lib/engagement/ ever takes an X action — see
// the zero-X-write invariant test. This module just decides which recent posts
// are plausible candidates and scores the opportunity; a human posts every reply.

import type { XPost } from "../social/x-client.ts";

export type Candidate = {
  post: XPost;
  /** 0..1 heuristic: how strong the buy/value intent reads. */
  intentScore: number;
};

// Buy/value intent — the posts where Foil's sold-data genuinely helps.
const VALUE_INTENT: readonly RegExp[] = [
  /\bworth\b/i,
  /\bvalue\b/i,
  /how much/i,
  /should i (buy|sell|grab|cop|keep|get)/i,
  /good (buy|deal|pickup|price|investment)/i,
  /\bprice\b/i,
  /worth (it|anything|buying|grading)/i,
  /\bgrail\b/i,
  /is this (a )?(good|worth|real|legit)/i,
  /(rip|ripping|crack|open).{0,12}(sealed|booster|box|pack)/i,
  /\b(psa|cgc|bgs)\s?\d/i,
];

// On-topic guard — search is pokemon-scoped but a stray "worth" off-topic post
// can slip in; require a card/TCG signal too.
const POKEMON_SIGNAL =
  /pok[eé]mon|\btcg\b|\bcard(s)?\b|charizard|umbreon|moonbreon|booster|\bpsa\b|graded|holo|\bex\b|vmax|vstar|alt art|secret rare/i;

// Target-reach floor (ADR-086 hardening). A reply seen by no one is not worth
// John's limited daily posts (the @thelou7789 0-follower / ~3-view case). Drop a
// candidate ONLY when BOTH followers AND views are negligible — a high-follower
// account with few views, or a low-follower post that went viral, still has reach.
const REACH_FLOOR_FOLLOWERS = 75;
const REACH_FLOOR_VIEWS = 30;

/**
 * Evaluate one post as an engagement candidate. Returns null when it isn't a
 * value-add target (off-topic, our own post, a retweet, basically just a link,
 * or no buy/value intent). Otherwise a Candidate with an intent score.
 */
export function evaluateCandidate(post: XPost, ownUsername?: string | null): Candidate | null {
  const text = (post.text ?? "").trim();
  if (!text) return null;

  // Never target our own account.
  if (ownUsername && post.authorUsername && post.authorUsername.toLowerCase() === ownUsername.toLowerCase()) {
    return null;
  }
  // Retweets carry no original ask (search uses -is:retweet too; belt + suspenders).
  if (/^RT @/.test(text)) return null;

  // A post that's basically just a link has no substance to reply to.
  const stripped = text.replace(/https?:\/\/\S+/g, "").trim();
  if (stripped.length < 12) return null;

  if (!POKEMON_SIGNAL.test(text)) return null;

  const intentHits = VALUE_INTENT.filter((re) => re.test(text)).length;
  if (intentHits === 0) return null;

  // Reach floor: exclude accounts with no audience AND no views.
  const followers = post.authorFollowers ?? 0;
  const views = post.metrics?.impressions ?? 0;
  if (followers < REACH_FLOOR_FOLLOWERS && views < REACH_FLOOR_VIEWS) return null;

  const intentScore = Math.min(1, 0.4 + intentHits * 0.2);
  return { post, intentScore };
}

/**
 * Opportunity score for ranking: intent (the data-fit signal) weighted most,
 * plus a freshness bonus (newer posts are still gettable) and a light
 * engagement bonus (a post with some traction is worth more reach). Pure;
 * `nowMs` injected for determinism.
 */
export function opportunityScore(c: Candidate, nowMs: number): number {
  const createdMs = c.post.createdAt ? Date.parse(c.post.createdAt) : NaN;
  const ageHours = Number.isFinite(createdMs) ? (nowMs - createdMs) / 3_600_000 : 24;
  // 1.0 at 0h decaying to ~0 by ~24h (recent-search is a 7-day window, but a
  // fresh post is far more replyable before the thread moves on).
  const freshness = Math.max(0, 1 - ageHours / 24);
  const eng = c.post.metrics ? c.post.metrics.likes + c.post.metrics.replies + c.post.metrics.reposts : 0;
  const engagement = Math.min(1, Math.log10(eng + 1) / 2); // ~0..1, saturates ~100 interactions
  // Reach (ADR-086): so John's limited daily posts go to the highest-visibility
  // best-fit targets, not 100-follower accounts. Saturates ~10k followers.
  const reach = Math.min(1, Math.log10((c.post.authorFollowers ?? 0) + 1) / 4);
  return c.intentScore * 0.4 + reach * 0.35 + freshness * 0.15 + engagement * 0.1;
}

// Advisory-mode reach gate (ADR-086 v2). Advisory replies (value-first, no data
// cite) go ONLY to high-reach relevant posts — the generic-but-big buying
// questions ("I'm 50, what should I buy?", "is grading worth it?") that name no
// specific card. Stricter than the base candidate floor so a low-reach generic
// post is skipped rather than cold-replied (the spam-flag risk). A candidate is
// already relevant + buy/value-intent by the time this is asked.
const ADVISORY_REACH_FLOOR_FOLLOWERS = 500;
const ADVISORY_REACH_FLOOR_VIEWS = 1000;

/**
 * Is this candidate worth a value-first ADVISORY reply (no specific card / no
 * data)? Only when it has genuine reach: a real audience OR real views. Pure.
 */
export function advisoryEligible(c: Candidate): boolean {
  const followers = c.post.authorFollowers ?? 0;
  const views = c.post.metrics?.impressions ?? 0;
  return followers >= ADVISORY_REACH_FLOOR_FOLLOWERS || views >= ADVISORY_REACH_FLOOR_VIEWS;
}

/** Filter a flat list of posts to ranked candidates (highest opportunity first). */
export function rankCandidates(posts: XPost[], opts: { ownUsername?: string | null; nowMs: number }): Candidate[] {
  const candidates = posts
    .map((p) => evaluateCandidate(p, opts.ownUsername))
    .filter((c): c is Candidate => c !== null);
  return candidates.sort((a, b) => opportunityScore(b, opts.nowMs) - opportunityScore(a, opts.nowMs));
}
