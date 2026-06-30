// Content-intelligence: mine WINNING FORMATS from the niche (the "container"),
// to inform Foil's OWN X-post generation (ADR-087). "Steal the container, keep
// the soul": we copy the transferable MECHANICS that earn reach (hook, format,
// structure, angle, length, CTA style) but NEVER the hype voice or another
// account's substance. Our differentiated soul (real sold-data, honest reads,
// L4-seller credibility) is supplied by Foil and protected by the keep-the-soul
// gate (lib/social/format-generation.ts).
//
// READ + RANK + EXTRACT ONLY. This module reads OTHER accounts' recent posts via
// the single read-only `searchRecent` boundary and computes which posts punch
// ABOVE their follower weight (engagement RATE, not absolute likes — absolute
// just rediscovers "big accounts win"). It NEVER takes an X action on anyone's
// post; the zero-X-write invariant test (engagement-invariant.test.ts) reads this
// file as text and fails the build if any X write/engagement call appears. The
// only thing that ever reaches X is OUR OWN generated post, and only after the
// keep-the-soul gate, and (in this ship) only as a dry-run Discord preview.
//
// Pure heuristics + one injected LLM call (extractPatterns) so the ranking + the
// orchestration are fully unit-tested with fakes. Soft-fail everywhere.

import type { XPost } from "../social/x-client.ts";

// Broad Pokemon-TCG net so we see the full RANGE of formats that earn reach (not
// just buy-intent — the format is what transfers regardless of the post's topic).
// English, retweets/replies excluded. (X v2 operators: -is:retweet -is:reply.)
export const FORMAT_MINING_QUERIES: readonly string[] = [
  "(pokemon card OR pokemon tcg) -is:retweet -is:reply lang:en",
  '(pokemon) (charizard OR umbreon OR "alt art" OR "psa 10" OR vintage OR wotc) -is:retweet -is:reply lang:en',
  '(pokemon) (pull OR "mail day" OR grail OR collection OR "chase card" OR sealed) -is:retweet -is:reply lang:en',
];

// On-topic guard (a stray non-Pokemon viral post can match a broad query). Same
// signal vocabulary the engagement candidate-filter uses.
const POKEMON_SIGNAL =
  /pok[eé]mon|\btcg\b|\bcard(s)?\b|charizard|umbreon|moonbreon|booster|\bpsa\b|graded|holo|\bex\b|vmax|vstar|alt art|secret rare|\bwotc\b/i;

// A post must clear a small ABSOLUTE-engagement floor to even be considered an
// "outlier" — otherwise a 2-like post on a tiny account has a huge "rate" and is
// meaningless noise. And the rate's denominator is floored so a near-zero
// follower count can't manufacture an infinite rate. Both are tunable.
export const MIN_ABSOLUTE_ENGAGEMENT = 20;
export const FOLLOWER_FLOOR = 200;

export type Outlier = {
  post: XPost;
  /** likes + reposts + replies (impressions are author-only on others' posts, so
   *  excluded — the goal ranks on PUBLIC engagement + followers). */
  totalEngagement: number;
  followers: number;
  /** totalEngagement / max(followers, FOLLOWER_FLOOR). Higher = punches further
   *  above its follower weight. THIS is the outlier signal (not absolute likes). */
  engagementRate: number;
};

/** Sum of the public interactions on a post (likes + reposts + replies). Quote
 *  counts are also in public_metrics but not parsed into XPost today; likes +
 *  reposts + replies is a sufficient reach signal. Pure. */
export function totalEngagement(post: XPost): number {
  const m = post.metrics;
  if (!m) return 0;
  return (m.likes ?? 0) + (m.reposts ?? 0) + (m.replies ?? 0);
}

/**
 * Engagement RATE: public engagement normalized by follower count, so we surface
 * posts performing above their audience size rather than just big accounts. The
 * denominator is floored (FOLLOWER_FLOOR) so a tiny/zero follower count can't
 * explode the rate. Pure.
 */
export function engagementRate(post: XPost): number {
  const eng = totalEngagement(post);
  const followers = Math.max(post.authorFollowers ?? 0, FOLLOWER_FLOOR);
  return eng / followers;
}

/**
 * Rank recent posts into engagement-RATE outliers (highest rate first). Drops:
 * our own posts, retweets, off-topic posts, and anything below the absolute
 * engagement floor (so the rate is meaningful). Pure; dedupes by id. `topN`
 * bounds how many outliers feed pattern extraction.
 */
export function rankOutliers(
  posts: XPost[],
  opts: { ownUsername?: string | null; topN?: number },
): Outlier[] {
  const topN = opts.topN ?? 12;
  const seen = new Set<string>();
  const outliers: Outlier[] = [];
  for (const post of posts) {
    if (!post?.id || seen.has(post.id)) continue;
    seen.add(post.id);
    const text = (post.text ?? "").trim();
    if (!text) continue;
    if (/^RT @/.test(text)) continue;
    if (
      opts.ownUsername &&
      post.authorUsername &&
      post.authorUsername.toLowerCase() === opts.ownUsername.toLowerCase()
    ) {
      continue;
    }
    if (!POKEMON_SIGNAL.test(text)) continue;
    const eng = totalEngagement(post);
    if (eng < MIN_ABSOLUTE_ENGAGEMENT) continue;
    outliers.push({
      post,
      totalEngagement: eng,
      followers: post.authorFollowers ?? 0,
      engagementRate: engagementRate(post),
    });
  }
  return outliers.sort((a, b) => b.engagementRate - a.engagementRate).slice(0, topN);
}

// ---------------------------------------------------------------------------
// Pattern extraction — the CONTAINER. Claude reads the outlier texts (+ their
// rates) and returns the transferable MECHANICS, NOT the verbatim posts. Each
// pattern is a reusable format we can express in Foil's voice with Foil's data.
// ---------------------------------------------------------------------------

export type LengthBucket = "short" | "medium" | "long";
export type MediaType = "none" | "image" | "video";

export type MinedPattern = {
  /** The hook mechanic (e.g. "open with a single bold claim plus one number"). */
  hook: string;
  /** The structure/format (e.g. "three short beats, blank line between each"). */
  format: string;
  /** The angle/topic shape (e.g. "price reality-check on a chase card"). */
  angle: string;
  lengthBucket: LengthBucket;
  mediaType: MediaType;
  /** The CTA style observed (e.g. "soft question that invites a reply"). */
  cta: string;
  /** One-line transferable reason it earns reach (the mechanic, not the topic). */
  whyItWorks: string;
  /** Provenance: the outlier post id this was derived from (NOT verbatim copy). */
  sourcePostId: string;
  /** The source post's engagement rate (for the "what's working" brief). */
  sourceRate: number;
};

const LENGTH_BUCKETS: ReadonlySet<string> = new Set(["short", "medium", "long"]);
const MEDIA_TYPES: ReadonlySet<string> = new Set(["none", "image", "video"]);

/** Build the extraction prompt. Pure — exposed for tests. Feeds the outlier texts
 *  + rates and asks for the transferable MECHANICS as structured JSON. It
 *  explicitly forbids returning verbatim posts or copying hype/substance. */
export function buildExtractionPrompt(outliers: Outlier[]): string {
  const lines = outliers.map((o, i) => {
    const text = (o.post.text ?? "").replace(/\s+/g, " ").trim().slice(0, 280);
    return `[${i + 1}] id=${o.post.id} rate=${o.engagementRate.toFixed(3)} (eng ${o.totalEngagement}, followers ${o.followers}): """${text}"""`;
  });
  return [
    "You analyze high-performing Pokemon TCG posts on X to extract REUSABLE FORMAT MECHANICS.",
    "These posts punched above their follower weight (high engagement RATE). Your job is to find WHY the FORMAT worked, so a different account can reuse the structure with its own substance.",
    "",
    "EXTRACT THE CONTAINER, NOT THE CONTENT. Return the transferable mechanics (hook shape, structure, angle, length, media, CTA style). NEVER return a verbatim post, a specific account's claim, or its specific numbers. We will fill the format with our OWN real data and our OWN calm voice.",
    "",
    "The outlier posts:",
    ...lines,
    "",
    "Return a JSON array of 3 to 6 DISTINCT patterns (merge near-duplicates). Each item:",
    '{ "hook": "<the hook mechanic in one line>", "format": "<the structure>", "angle": "<the topic/angle shape>", "lengthBucket": "short|medium|long", "mediaType": "none|image|video", "cta": "<the CTA style>", "whyItWorks": "<one line: the transferable reason it earns reach>", "sourcePostId": "<the id of the single most representative outlier above>" }',
    "Respond with ONLY the JSON array, no preamble.",
  ].join("\n");
}

function parseJsonArray(raw: string): unknown[] | null {
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Coerce one raw model object into a MinedPattern, or null if it's unusable. The
 *  sourcePostId is validated against the actual outlier set (so a hallucinated id
 *  can't leak through), and sourceRate is looked up from real data, never trusted
 *  from the model. Pure. */
function coercePattern(raw: unknown, byId: Map<string, Outlier>): MinedPattern | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const hook = str(o.hook);
  const format = str(o.format);
  const angle = str(o.angle);
  if (!hook || !format) return null; // a pattern with no hook+format is not usable
  const lengthBucket = (LENGTH_BUCKETS.has(str(o.lengthBucket)) ? str(o.lengthBucket) : "medium") as LengthBucket;
  const mediaType = (MEDIA_TYPES.has(str(o.mediaType)) ? str(o.mediaType) : "none") as MediaType;
  const sourceId = str(o.sourcePostId);
  const source = byId.get(sourceId) ?? null;
  return {
    hook,
    format,
    angle: angle || "general",
    lengthBucket,
    mediaType,
    cta: str(o.cta),
    whyItWorks: str(o.whyItWorks),
    sourcePostId: source ? sourceId : "",
    sourceRate: source ? Number(source.engagementRate.toFixed(3)) : 0,
  };
}

export type ExtractDeps = {
  /** LLM call: prompt → raw model text. Injected so extraction is testable. */
  generate: (prompt: string) => Promise<string>;
};

/**
 * Extract the reusable patterns (the container) from a set of outliers. Soft-fail:
 * an LLM error or unparseable output returns []. Validates the model's
 * sourcePostId against the real outliers so provenance can't be fabricated.
 */
export async function extractPatterns(outliers: Outlier[], deps: ExtractDeps): Promise<MinedPattern[]> {
  if (outliers.length === 0) return [];
  let raw: string;
  try {
    raw = await deps.generate(buildExtractionPrompt(outliers));
  } catch {
    return [];
  }
  const arr = parseJsonArray(raw);
  if (!arr) return [];
  const byId = new Map(outliers.map((o) => [o.post.id, o]));
  const patterns: MinedPattern[] = [];
  for (const item of arr) {
    const p = coercePattern(item, byId);
    if (p) patterns.push(p);
  }
  return patterns;
}

// ---------------------------------------------------------------------------
// Orchestrator — wires READ → RANK → EXTRACT → GENERATE (injected). The generate
// step produces OUR OWN posts (the soul) and is gate-validated inside the
// injected `generatePost`; this orchestrator never touches the X post boundary.
// All IO is injected so the whole sweep is unit-tested with fakes.
// ---------------------------------------------------------------------------

/** A real Foil card + its real figures (the "soul" a generated post must cite).
 *  Mirrors the engagement MoverFact shape; defined here as the data contract the
 *  generator consumes (lib/social/format-generation.ts imports this type). */
export type FormatCardData = {
  slug: string;
  cardName: string;
  setName: string;
  avg7dUsd: number;
  avg30dUsd: number;
  momentumPct: number;
  saleCount: number;
};

/** A gate-valid generated post (the output of the injected generator). */
export type GeneratedFormatPost = {
  pattern: MinedPattern;
  data: FormatCardData;
  text: string;
};

export type FormatMiningDeps = {
  /** Run one search query → posts. Wraps read-only searchRecent; soft-fails. */
  search: (query: string) => Promise<XPost[]>;
  queries: readonly string[];
  /** Extract the container patterns from the ranked outliers (LLM). */
  extract: (outliers: Outlier[]) => Promise<MinedPattern[]>;
  /** Real Foil card data (movers) the generated posts may cite. */
  getCardData: () => Promise<FormatCardData[]>;
  /** Generate ONE gate-valid Foil post for a (pattern, card) pair, or null if it
   *  can't pass the keep-the-soul gate. Injected; never posts to X. */
  generatePost: (pattern: MinedPattern, data: FormatCardData) => Promise<GeneratedFormatPost | null>;
  ownUsername?: string | null;
  /** How many outliers feed extraction (default 12). */
  maxOutliers?: number;
  /** How many top patterns to generate a Foil post for (default 3). */
  maxGenerated?: number;
};

export type FormatMiningResult = {
  scanned: number;
  outliers: Outlier[];
  patterns: MinedPattern[];
  generated: GeneratedFormatPost[];
};

/**
 * Run one content-intelligence sweep: read the niche, rank engagement-rate
 * outliers, extract the reusable formats, and generate gate-valid Foil posts that
 * USE a proven format with Foil's voice + real data. Returns everything for the
 * "what's working" brief + the dry-run previews. Soft-fail per query/pattern; an
 * empty card set or zero outliers yields an empty (not failed) result.
 */
export async function runFormatMiningSweep(deps: FormatMiningDeps): Promise<FormatMiningResult> {
  const maxOutliers = deps.maxOutliers ?? 12;
  const maxGenerated = deps.maxGenerated ?? 3;

  // 1. READ — every query, soft-fail per query, dedupe by id.
  const byId = new Map<string, XPost>();
  for (const q of deps.queries) {
    let posts: XPost[] = [];
    try {
      posts = await deps.search(q);
    } catch {
      posts = [];
    }
    for (const p of posts) if (p?.id && !byId.has(p.id)) byId.set(p.id, p);
  }
  const scanned = byId.size;

  // 2. RANK — engagement-rate outliers.
  const outliers = rankOutliers([...byId.values()], { ownUsername: deps.ownUsername, topN: maxOutliers });

  // 3. EXTRACT — the reusable container patterns.
  let patterns: MinedPattern[] = [];
  if (outliers.length > 0) {
    try {
      patterns = await deps.extract(outliers);
    } catch {
      patterns = [];
    }
  }

  // 4. GENERATE — pair the top patterns with real cards and produce gate-valid
  //    Foil posts (the soul). Different card per pattern so the previews vary.
  let cards: FormatCardData[] = [];
  try {
    cards = await deps.getCardData();
  } catch {
    cards = [];
  }
  const generated: GeneratedFormatPost[] = [];
  if (cards.length > 0) {
    for (let i = 0; i < patterns.length && generated.length < maxGenerated; i++) {
      const data = cards[i % cards.length];
      let post: GeneratedFormatPost | null = null;
      try {
        post = await deps.generatePost(patterns[i], data);
      } catch {
        post = null; // soft-fail this pattern; keep going
      }
      if (post) generated.push(post);
    }
  }

  return { scanned, outliers, patterns, generated };
}
