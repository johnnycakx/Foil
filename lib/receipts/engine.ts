// Receipts engine (x-reply-desk, ADR-107) — the shared orchestrator behind the
// in-flow receipts tool (POST /api/receipts, 3d) and the reply desk's inbound
// card-request drafts (3b). Pure over injected IO (resolve / getFacts /
// draftProse) so the whole flow — resolve, figure gate, compose, intent URL —
// is unit-tested with fakes. Soft-fail: a draft/data miss degrades honestly,
// never throws.
//
// Two-lane note: this engine only ever BUILDS an x.com/intent/post URL (the
// human presses X's Post button). It never calls the X write API. The reply
// desk's API-post path (user-initiated contact only) lives separately in
// lib/reply-desk/, never here.

import type { ReceiptFacts, ReceiptSold } from "./facts.ts";
import { receiptAllowedFigures } from "./facts.ts";
import { buildCardPageUrl, buildReplyIntentUrl, tweetLength, RECEIPTS_UTM, type CardPageUtm } from "./intent.ts";
import { CLARIFY_LINE, figureFreeReply } from "./draft.ts";

export type ReceiptsMode = "receipts" | "figure_free" | "clarify";

export type ReceiptsResult = {
  mode: ReceiptsMode;
  resolved: { slug: string; displayName: string } | null;
  sold: ReceiptSold | null;
  cardPageUrl: string | null;
  /** The full reply text John posts (prose + link, the figure-free line, or
   *  the clarify line). Already length-safe for a tweet. */
  reply: string;
  /** x.com/intent/post URL that opens X's composer prefilled + threaded. */
  intentUrl: string;
  /** Which supplied $ figures actually appear in `reply` (observability). */
  figuresCited: string[];
};

export type ReceiptsEngineDeps = {
  /** Resolve text → one exact card (resolveCardSlug); null over guess. */
  resolve: (text: string) => { slug: string; displayName: string } | null;
  /** Sold figures for a resolved slug (getReceiptFacts bound to real sources). */
  getFacts: (slug: string, displayName: string) => Promise<ReceiptFacts>;
  /** Draft the LINK-FREE receipts prose (gated), or null → figure-free. */
  draftProse: (input: {
    context: string;
    cardLabel: string;
    sold: ReceiptSold;
    allowedFigures: Set<string>;
  }) => Promise<string | null>;
  /** Absolute origin for the card link (tests inject; prod uses siteUrl()). */
  origin?: string;
  /** UTM tag for the card link (default RECEIPTS_UTM; the desk may override). */
  utm?: CardPageUtm;
};

export type ReceiptsInput = {
  /** The text to resolve the card from (a tweet's text, or a raw card query). */
  text: string;
  /** The tweet id to thread the reply to (cold-lane: opens X's composer as a
   *  reply). Null → a standalone composer (no in_reply_to). */
  replyToId?: string | null;
};

function figuresIn(prose: string, allowed: Set<string>): string[] {
  return [...allowed].filter((f) => prose.includes(f));
}

/**
 * Turn a card reference (+ optional reply target) into a gate-clean draft + a
 * prefilled x.com/intent/post URL. Modes:
 *   - "clarify":      card unresolvable → ask for set/number, no figures/link.
 *   - "figure_free":  resolved but no sold data we stand behind → card link only.
 *   - "receipts":     resolved + real figures → gated receipts prose + card link.
 */
export async function generateReceipts(input: ReceiptsInput, deps: ReceiptsEngineDeps): Promise<ReceiptsResult> {
  const text = (input.text ?? "").trim();
  const replyToId = input.replyToId ?? null;
  const utm = deps.utm ?? RECEIPTS_UTM;

  const resolved = deps.resolve(text);
  if (!resolved) {
    return {
      mode: "clarify",
      resolved: null,
      sold: null,
      cardPageUrl: null,
      reply: CLARIFY_LINE,
      intentUrl: buildReplyIntentUrl(CLARIFY_LINE, replyToId),
      figuresCited: [],
    };
  }

  const cardPageUrl = buildCardPageUrl(resolved.slug, { origin: deps.origin, utm });
  const facts = await deps.getFacts(resolved.slug, resolved.displayName);

  if (facts.sold) {
    const allowedFigures = receiptAllowedFigures(facts.sold);
    let prose: string | null = null;
    try {
      prose = await deps.draftProse({ context: text, cardLabel: resolved.displayName, sold: facts.sold, allowedFigures });
    } catch {
      prose = null;
    }
    if (prose) {
      const composed = `${prose}\n${cardPageUrl}`;
      if (tweetLength(composed) <= 280) {
        return {
          mode: "receipts",
          resolved,
          sold: facts.sold,
          cardPageUrl,
          reply: composed,
          intentUrl: buildReplyIntentUrl(composed, replyToId),
          figuresCited: figuresIn(prose, allowedFigures),
        };
      }
    }
  }

  // Resolved but no gate-clean figure draft → figure-free line + the card link.
  const reply = figureFreeReply(cardPageUrl);
  return {
    mode: "figure_free",
    resolved,
    sold: facts.sold,
    cardPageUrl,
    reply,
    intentUrl: buildReplyIntentUrl(reply, replyToId),
    figuresCited: [],
  };
}
