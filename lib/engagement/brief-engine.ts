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
import type { DraftResult, MoverFact } from "./draft.ts";
import { rankCandidates, opportunityScore, type Candidate } from "./candidate-filter.ts";
import type { BriefStore } from "./store.ts";

export type EngagementBriefItem = {
  postId: string;
  postUrl: string;
  postText: string;
  authorUsername: string | null;
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
  /** Draft a reply for a candidate (LLM); gate-validated upstream. */
  draft: (post: XPost, facts: MoverFact[]) => Promise<DraftResult>;
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

  // 4. Draft for the top `draftBudget` candidates (bounds LLM cost); keep the
  //    ones that produce a gate-valid, data-backed reply.
  const drafted: EngagementBriefItem[] = [];
  for (const c of fresh.slice(0, draftBudget)) {
    if (drafted.length >= maxItems) break;
    let res: DraftResult;
    try {
      res = await deps.draft(c.post, facts);
    } catch {
      continue; // soft-fail: drop this candidate, keep going
    }
    if (!res.ok) continue;
    drafted.push({
      postId: c.post.id,
      postUrl: postUrl(c.post),
      postText: c.post.text,
      authorUsername: c.post.authorUsername,
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
