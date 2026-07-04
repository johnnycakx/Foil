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
  // Grading intent (widen-scan amendment): a grade decision is a value question —
  // Foil's raw-vs-graded sold spread is exactly the data that answers it. Lets the
  // new grading query surface real candidates ("should i grade" isn't in should-i).
  /should i grade|get(ting)? (it |this )?graded|gem mint|\bgrade (it|this)\b/i,
];

// On-topic guard — search is pokemon-scoped but a stray "worth" off-topic post
// can slip in; require a card/TCG signal too.
const POKEMON_SIGNAL =
  /pok[eé]mon|\btcg\b|\bcard(s)?\b|charizard|umbreon|moonbreon|booster|\bpsa\b|graded|holo|\bex\b|vmax|vstar|alt art|secret rare/i;

// Target-reach floor (ADR-086 hardening; the dead "views" leg fixed in
// x-reply-desk §2c). A reply seen by no one is not worth John's limited daily
// posts (the @thelou7789 0-follower / ~0-engagement case). Drop a candidate ONLY
// when BOTH followers AND PUBLIC ENGAGEMENT are negligible — a high-follower
// account with a quiet post, or a low-follower post that went viral, still has
// reach. NOTE: `impressions` (views) are AUTHOR-ONLY on other people's posts
// (ADR-087), so they're ~always null/0 in a candidate sweep — the old
// impressions leg was dead code. Public engagement (likes + replies + reposts)
// IS visible on others' posts, so it is the real reach/velocity proxy.
const REACH_FLOOR_FOLLOWERS = 75;
const REACH_FLOOR_ENGAGEMENT = 5;

/** Public engagement (visible on others' posts): likes + replies + reposts. The
 *  reach/velocity signal that replaces the dead author-only impressions leg. */
export function publicEngagement(post: XPost): number {
  const m = post.metrics;
  return m ? (m.likes ?? 0) + (m.replies ?? 0) + (m.reposts ?? 0) : 0;
}

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

  // Reach floor: exclude accounts with no audience AND no public engagement.
  const followers = post.authorFollowers ?? 0;
  if (followers < REACH_FLOOR_FOLLOWERS && publicEngagement(post) < REACH_FLOOR_ENGAGEMENT) return null;

  const intentScore = Math.min(1, 0.4 + intentHits * 0.2);
  return { post, intentScore };
}

/**
 * Opportunity score for ranking (x-reply-desk §3c: adds a velocity term). Intent
 * (the data-fit signal) weighted most, plus REACH, a VELOCITY term
 * (public-engagement-per-hour — a post accelerating in its first hours outranks a
 * bigger stale one, since top-reply/QT slots are won early), freshness, and a
 * small absolute-engagement bonus. Pure; `nowMs` injected for determinism.
 */
export function opportunityScore(c: Candidate, nowMs: number): number {
  const createdMs = c.post.createdAt ? Date.parse(c.post.createdAt) : NaN;
  const ageHours = Number.isFinite(createdMs) ? (nowMs - createdMs) / 3_600_000 : 24;
  // 1.0 at 0h decaying to ~0 by ~24h (a fresh post is far more replyable before
  // the thread moves on).
  const freshness = Math.max(0, 1 - ageHours / 24);
  const eng = publicEngagement(c.post);
  const engagement = Math.min(1, Math.log10(eng + 1) / 2); // ~0..1, saturates ~100 interactions
  // Velocity (§3c): public engagement PER HOUR — the acceleration proxy. A post
  // with 20 likes in its first hour outranks one with 40 over two days.
  const perHour = eng / Math.max(ageHours, 0.5);
  const velocity = Math.min(1, Math.log10(perHour + 1) / 1.5); // saturates ~30/hr
  // Reach: John's limited daily posts go to the highest-visibility best-fit
  // targets. Saturates ~10k followers.
  const reach = Math.min(1, Math.log10((c.post.authorFollowers ?? 0) + 1) / 4);
  return c.intentScore * 0.35 + reach * 0.3 + velocity * 0.2 + freshness * 0.1 + engagement * 0.05;
}

// Advisory-mode reach gate (ADR-086 v2; the dead views leg fixed §2c; floor
// lowered 500 → 250 in the widen-scan amendment). Advisory replies (value-first,
// no data cite) go ONLY to relevant posts with genuine reach — the generic-but-
// -sizable buying questions that name no specific card. Still stricter than the
// base candidate floor (75) so a true low-reach post is skipped rather than
// cold-replied (the spam-flag risk). 500 was over-tight for a young account; 250
// still guarantees a real mid-tier audience while surfacing more candidates, and
// opportunityScore still sorts best-first so the strongest reach reads at the top.
const ADVISORY_REACH_FLOOR_FOLLOWERS = 250;
const ADVISORY_ENGAGEMENT_FLOOR = 25;

/**
 * Is this candidate worth a value-first ADVISORY reply (no specific card / no
 * data)? Only when it has genuine reach: a real audience OR real public
 * engagement (the visible-on-others'-posts proxy). Pure.
 */
export function advisoryEligible(c: Candidate): boolean {
  const followers = c.post.authorFollowers ?? 0;
  return followers >= ADVISORY_REACH_FLOOR_FOLLOWERS || publicEngagement(c.post) >= ADVISORY_ENGAGEMENT_FLOOR;
}

// QT-with-receipts lane (x-reply-desk §3c, from the @humfhuang playbook). A
// quote-tweet candidate is a trending post that makes a CLAIM about card
// prices/market ("hit $X", "sold for $X", a spike/crash take, grading drama) —
// exactly where Foil's receipts (the real sold figure + the card page) land
// hardest. The QT stays COLD: an x.com/intent/post?url=<quoted> composer John
// posts by hand, never an API post.
const PRICE_CLAIM: readonly RegExp[] = [
  /(hit|hitting|reached|now|up to|sold for|selling for|went for)\s*\$?\s?\d/i,
  /\$\s?\d[\d,]*(\.\d+)?\s*(now|already|today|card|each)?/i,
  /\b(spike|spiked|spiking|crash|crashed|crashing|tank(ed|ing)?|moon(ed|ing)?|dump(ed|ing)?)\b/i,
  /\b(up|down)\s+\d{1,3}\s?%/i,
  /\b(psa|cgc|bgs)\b.*\b(scandal|drama|scam|fake|bump|regrade)\b/i,
];

/** Does the post make a price/market CLAIM worth a quote-tweet with receipts? Pure. */
export function isPriceClaim(text: string): boolean {
  const t = text ?? "";
  return PRICE_CLAIM.some((re) => re.test(t));
}

/**
 * Is this candidate a quote-tweet-with-receipts target? A price/market claim
 * with genuine reach (a real audience OR real engagement) — the QT lands on the
 * claim itself. Pure.
 */
export function quoteTweetEligible(c: Candidate): boolean {
  if (!isPriceClaim(c.post.text ?? "")) return false;
  const followers = c.post.authorFollowers ?? 0;
  return followers >= ADVISORY_REACH_FLOOR_FOLLOWERS || publicEngagement(c.post) >= ADVISORY_ENGAGEMENT_FLOOR;
}

/** Filter a flat list of posts to ranked candidates (highest opportunity first). */
export function rankCandidates(posts: XPost[], opts: { ownUsername?: string | null; nowMs: number }): Candidate[] {
  const candidates = posts
    .map((p) => evaluateCandidate(p, opts.ownUsername))
    .filter((c): c is Candidate => c !== null);
  return candidates.sort((a, b) => opportunityScore(b, opts.nowMs) - opportunityScore(a, opts.nowMs));
}
