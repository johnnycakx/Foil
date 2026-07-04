// Reply-desk inbound drafting (x-reply-desk, ADR-107 §1 + §3b + §3e). For a
// mention of @FoilTCG or a reply in our thread, draft ONE reply reusing the
// receipts engine's guardrails VERBATIM (card-resolver null-over-guess, figures
// only from market_movers/snapshot, the figure/hedge gate) — then classify:
//
//   - data_cite  : resolved card + real figures → receipts reply + card link.
//   - intake     : resolved card, NO data → "tracking it" reply + card link,
//                  AND enqueue demand-driven hydration (3b: the request IS the
//                  trigger for the demand-driven-data pipeline).
//   - advisory   : unresolvable text → ask for set/number (no figures, no link).
//   - human_look : media + unresolved text → NO auto "couldn't find it" reply;
//                  surface a HUMAN-LOOK card so John identifies the card from the
//                  image, then runs the intake (3e — the request-widget contract).
//
// Pure over injected deps (the receipts engine + the hydration enqueue) so the
// classification + null-over-guess branches are unit-tested without X/LLM/DB.
// This module NEVER posts to X — the API-post happens only on Approve in
// app/api/reply-desk/approve; the reply-desk firewall test pins that.

import { generateReceipts, type ReceiptsEngineDeps } from "../receipts/engine.ts";

export type InboundKind = "mention" | "reply";
export type ReplyDeskMode = "data_cite" | "intake" | "advisory" | "human_look";

export type InboundPost = {
  id: string;
  url: string;
  text: string;
  authorUsername: string | null;
  authorFollowers: number | null;
  kind: InboundKind;
  hasMedia: boolean;
  ourContext?: string | null;
};

export type ReplyDeskDraft = {
  mode: ReplyDeskMode;
  /** The reply body to API-post on Approve. Empty for human_look (John writes it). */
  reply: string;
  matchedCard: string | null;
  matchedSlug: string | null;
  cardPageUrl: string | null;
  dataCited: string;
};

export type DraftInboundDeps = {
  /** The receipts engine deps (resolve / getFacts / draftProse / origin / utm). */
  receipts: ReceiptsEngineDeps;
  /** 3b: enqueue demand-driven hydration for a resolved card with no data. */
  enqueueHydration: (slug: string) => Promise<void>;
};

/** The 3b intake reply: confirm we're tracking it + invite a target. Voice:
 *  "tracking"/"chasing", no em dash, no hype (voiceCheck-clean by construction). */
export function intakeReply(cardPageUrl: string): string {
  return `Done, tracking it now: ${cardPageUrl} Drop a target on it and I'll watch the price for you.`;
}

/**
 * Draft a reply for one inbound. Reuses generateReceipts as the shared drafting
 * core (same resolver + facts + figure/hedge gate as the manual receipts tool
 * and the engagement engine), then applies the reply-desk framing. Soft-fail:
 * a hydration-enqueue error never blocks the draft.
 */
export async function draftInboundReply(inbound: InboundPost, deps: DraftInboundDeps): Promise<ReplyDeskDraft> {
  const r = await generateReceipts({ text: inbound.text, replyToId: inbound.id }, deps.receipts);

  if (r.mode === "receipts" && r.resolved) {
    return {
      mode: "data_cite",
      reply: r.reply,
      matchedCard: r.resolved.displayName,
      matchedSlug: r.resolved.slug,
      cardPageUrl: r.cardPageUrl,
      dataCited: r.figuresCited.join(", "),
    };
  }

  if (r.mode === "figure_free" && r.resolved && r.cardPageUrl) {
    try {
      await deps.enqueueHydration(r.resolved.slug);
    } catch {
      // soft-fail — a queue hiccup must never block surfacing the reply
    }
    return {
      mode: "intake",
      reply: intakeReply(r.cardPageUrl),
      matchedCard: r.resolved.displayName,
      matchedSlug: r.resolved.slug,
      cardPageUrl: r.cardPageUrl,
      dataCited: "",
    };
  }

  // clarify (unresolvable text). 3e: an image-bearing mention we couldn't
  // resolve is NEVER auto-answered "couldn't find it" — it becomes a human-look
  // card so John identifies the card from the attached image.
  if (inbound.hasMedia) {
    return { mode: "human_look", reply: "", matchedCard: null, matchedSlug: null, cardPageUrl: null, dataCited: "" };
  }
  return { mode: "advisory", reply: r.reply, matchedCard: null, matchedSlug: null, cardPageUrl: null, dataCited: "" };
}
