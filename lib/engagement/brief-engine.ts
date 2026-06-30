// Engagement-brief orchestrator (ADR-086). READ + DRAFT + RANK + DELIVER only —
// the engine NEVER takes an X action (no post/reply/like/follow/retweet/DM). It
// pulls recent buy/value-intent posts, drafts a data-backed reply for each, and
// hands John a ranked, deep-linked brief; John posts every reply by hand. The
// human send is the ToS + brand firewall (the zero-X-write invariant test pins
// that nothing in lib/engagement/ can reach an X write call).
//
// Pure orchestration over injected IO (search/getFacts/draft/store) so the whole
// flow — dedupe, idempotency, ranking, soft-fail, draft budget — is unit-tested
// with fakes. Soft-fail everywhere: a bad query or a failed draft drops that
// item, never the brief.

import type { XPost } from "../social/x-client.ts";
import type { BriefMode, DraftResult, MoverFact } from "./draft.ts";
import { rankCandidates, opportunityScore, advisoryEligible, type Candidate } from "./candidate-filter.ts";
import type { BriefStore } from "./store.ts";

export type EngagementBriefItem = {
  postId: string;
  postUrl: string;
  postText: string;
  authorUsername: string | null;
  /** "data_cite" (cites the exact card's real figures) or "advisory" (value-first,
   *  figure-free). Drives how the Discord card is labelled so John knows whether a
   *  $ figure is present. */
  mode: BriefMode;
  matchedCard: string;
  reply: string;
  dataCited: string;
  score: number;
};

export type EngagementBrief = {
  items: EngagementBriefItem[];
  scanned: number;
  candidates: number;
  drafted: number;
};

export type BriefDeps = {
  /** Run one search query → posts. Wraps the read-only searchRecent; soft-fails. */
  search: (query: string) => Promise<XPost[]>;
  /** Fetch the real mover facts (figures the replies may cite) once per run. */
  getFacts: () => Promise<MoverFact[]>;
  /** Draft a DATA-CITE reply for a candidate (LLM); cites the exact card's real
   *  figures or skips. Gate-validated upstream. */
  draft: (post: XPost, facts: MoverFact[]) => Promise<DraftResult>;
  /** Draft an ADVISORY reply (value-first, figure-free) for a high-reach post
   *  with no resolvable specific card. Optional: omit to keep the v1 data-cite-only
   *  behavior. Gate-validated upstream. */
  draftAdvisory?: (post: XPost) => Promise<DraftResult>;
  store: BriefStore;
  queries: readonly string[];
  nowMs: number;
  ownUsername?: string | null;
  /** Final brief size (default 20). */
  maxItems?: number;
  /** How many top candidates to spend an LLM draft on (cost bound; default 40). */
  draftBudget?: number;
};

function postUrl(p: XPost): string {
  return p.authorUsername
    ? `https://x.com/${p.authorUsername}/status/${p.id}`
    : `https://x.com/i/web/status/${p.id}`;
}

export async function generateEngagementBrief(deps: BriefDeps): Promise<EngagementBrief> {
  const maxItems = deps.maxItems ?? 20;
  const draftBudget = deps.draftBudget ?? 40;

  // 1. Search every query, soft-fail per query, dedupe by post id.
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

  // 2. Rank to candidates, then drop anything already briefed (idempotency).
  const ranked = rankCandidates([...byId.values()], { ownUsername: deps.ownUsername, nowMs: deps.nowMs });
  const seen = await deps.store.seenIds(ranked.map((c) => c.post.id));
  const fresh = ranked.filter((c) => !seen.has(c.post.id));

  // 3. Real data once. No facts → no brief (the value-add is the data).
  let facts: MoverFact[] = [];
  try {
    facts = await deps.getFacts();
  } catch {
    facts = [];
  }

  // 4. Draft for the top `draftBudget` candidates (bounds LLM cost). Try the
  //    DATA-CITE path first (exact card + real figures); if that can't apply (no
  //    resolvable card / no data) AND the post has real reach, fall through to an
  //    ADVISORY draft (value-first, figure-free) so the high-reach generic posts
  //    aren't thrown away. Keep only gate-valid replies.
  const drafted: EngagementBriefItem[] = [];
  for (const c of fresh.slice(0, draftBudget)) {
    if (drafted.length >= maxItems) break;
    let res: DraftResult | null = null;
    try {
      res = await deps.draft(c.post, facts);
    } catch {
      res = null; // soft-fail the data-cite attempt; advisory may still apply
    }
    if ((!res || !res.ok) && deps.draftAdvisory && advisoryEligible(c)) {
      try {
        res = await deps.draftAdvisory(c.post);
      } catch {
        continue; // soft-fail: drop this candidate, keep going
      }
    }
    if (!res || !res.ok) continue;
    drafted.push({
      postId: c.post.id,
      postUrl: postUrl(c.post),
      postText: c.post.text,
      authorUsername: c.post.authorUsername,
      mode: res.mode,
      matchedCard: res.matchedCard,
      reply: res.reply,
      dataCited: res.dataCited,
      score: Number(opportunityScore(c, deps.nowMs).toFixed(3)),
    });
  }

  // 5. Mark delivered posts briefed so they never resurface.
  await deps.store.markBriefed(drafted.map((i) => i.postId));

  return { items: drafted, scanned, candidates: fresh.length, drafted: drafted.length };
}

/** Exposed for the brief renderer / tests. */
export type { Candidate };
