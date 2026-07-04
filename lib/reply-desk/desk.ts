// Reply-desk orchestrator (x-reply-desk, ADR-107 §1 — the eve-detector). Polls
// X for user-initiated contact (mentions of @FoilTCG + replies in our threads),
// dedupes against the queue, drafts a reply for each fresh inbound, and enqueues
// it for the bot to deliver with Reply / Edit / Skip buttons. READ + DRAFT +
// ENQUEUE only — the API-post happens later on Approve, never here.
//
// Pure orchestration over injected IO (search / queue / draftInbound) so dedupe,
// self-exclusion, budget, and soft-fail are unit-tested with fakes.

import type { XPost } from "../social/x-client.ts";
import type { ReplyDeskQueue, ReplyDeskItem } from "./queue.ts";
import type { InboundPost, DraftInboundDeps, ReplyDeskDraft } from "./draft.ts";

/** Recent-search queries for user-initiated contact. `@FoilTCG` catches both
 *  mentions AND replies to our posts (X auto-prefixes replies with @FoilTCG);
 *  our own posts + retweets are excluded at the query and again in code. */
export const REPLY_DESK_QUERIES: readonly string[] = [
  "(@FoilTCG) -is:retweet -from:FoilTCG",
];

export type ReplyDeskRun = {
  items: ReplyDeskItem[];
  scanned: number;
  fresh: number;
  drafted: number;
  queued: number;
};

export type ReplyDeskDeps = {
  search: (query: string) => Promise<XPost[]>;
  queue: ReplyDeskQueue;
  draftInbound: (inbound: InboundPost, deps: DraftInboundDeps) => Promise<ReplyDeskDraft>;
  draftDeps: DraftInboundDeps;
  queries?: readonly string[];
  ownUsername?: string | null;
  /** How many fresh inbounds to spend an LLM draft on (cost bound; default 25). */
  draftBudget?: number;
};

function postUrl(p: XPost): string {
  return p.authorUsername
    ? `https://x.com/${p.authorUsername}/status/${p.id}`
    : `https://x.com/i/web/status/${p.id}`;
}

/** Best-effort mention/reply label — a leading @mention reads as a reply. Both
 *  are user-initiated contact (API-post-eligible); the label is cosmetic. */
function inboundKind(text: string): InboundPost["kind"] {
  return /^\s*@\w/.test(text) ? "reply" : "mention";
}

export async function runReplyDesk(deps: ReplyDeskDeps): Promise<ReplyDeskRun> {
  const queries = deps.queries ?? REPLY_DESK_QUERIES;
  const draftBudget = deps.draftBudget ?? 25;
  const own = deps.ownUsername?.toLowerCase() ?? null;

  // 1. Search, soft-fail per query, dedupe by id, drop our own posts.
  const byId = new Map<string, XPost>();
  for (const q of queries) {
    let posts: XPost[] = [];
    try {
      posts = await deps.search(q);
    } catch {
      posts = [];
    }
    for (const p of posts) {
      if (!p?.id) continue;
      if (own && p.authorUsername && p.authorUsername.toLowerCase() === own) continue; // never our own posts
      if (/^RT @/.test(p.text ?? "")) continue; // retweets carry no ask
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
  }
  const scanned = byId.size;

  // 2. Drop anything already queued (idempotency).
  const seen = await deps.queue.seenIds([...byId.keys()]);
  const fresh = [...byId.values()].filter((p) => !seen.has(p.id));

  // 3. Draft each fresh inbound (bounded by draftBudget).
  const items: ReplyDeskItem[] = [];
  for (const p of fresh.slice(0, draftBudget)) {
    const inbound: InboundPost = {
      id: p.id,
      url: postUrl(p),
      text: p.text ?? "",
      authorUsername: p.authorUsername,
      authorFollowers: p.authorFollowers,
      kind: inboundKind(p.text ?? ""),
      hasMedia: p.hasMedia === true,
      ourContext: null,
    };
    let draft: ReplyDeskDraft;
    try {
      draft = await deps.draftInbound(inbound, deps.draftDeps);
    } catch {
      continue; // soft-fail: drop this inbound, keep going
    }
    items.push({
      postId: inbound.id,
      postUrl: inbound.url,
      postText: inbound.text,
      authorUsername: inbound.authorUsername,
      authorFollowers: inbound.authorFollowers,
      inboundKind: inbound.kind,
      ourContext: inbound.ourContext ?? null,
      hasMedia: inbound.hasMedia,
      mode: draft.mode,
      matchedCard: draft.matchedCard,
      matchedSlug: draft.matchedSlug,
      reply: draft.reply,
      cardPageUrl: draft.cardPageUrl,
      dataCited: draft.dataCited,
      score: inbound.authorFollowers ?? 0,
    });
  }

  // 4. Enqueue for the bot to deliver.
  const queued = await deps.queue.enqueue(items);

  return { items, scanned, fresh: fresh.length, drafted: items.length, queued };
}
