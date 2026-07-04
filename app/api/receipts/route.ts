// POST /api/receipts (x-reply-desk 3d, ADR-107) — the in-flow receipts tool.
// John's OUTBOUND-manual lane: from any x.com status page (a bookmarklet) or the
// iOS share sheet (a Shortcut), turn a tweet into a prefilled X reply composer
// carrying Foil's receipts + the card-page link, in <=2 clicks / <=3 taps. The
// draft NEVER auto-posts anywhere — the response is JSON + an x.com/intent/post
// URL; John presses X's own Post button (the ToS firewall for cold replies).
//
// Auth: a private Bearer token (X_RECEIPTS_SECRET) John holds in his bookmarklet
// + Shortcut — NOT public. Rate-limited per IP. Abuse blast radius if the token
// leaks is bounded to Claude drafting cost + one public-tweet read (no user
// data, no writes); rotate the secret to revoke. CORS is opened so the
// bookmarklet can call it from x.com; the token is the auth, not the origin.

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveCardSlug } from "@/lib/engagement/card-resolver";
import { getReceiptFacts } from "@/lib/receipts/facts";
import { getMoverBySlug } from "@/lib/deals/market-movers-read";
import { getSnapshotSold } from "@/lib/vault-seeds";
import { draftReceiptsProse } from "@/lib/receipts/draft";
import { generateReceipts } from "@/lib/receipts/engine";
import { parseTweetRef } from "@/lib/receipts/intent";
import { fetchTweetText } from "@/lib/social/x-client";
import { anthropic } from "@/lib/anthropic";
import { CONTENT_MODEL } from "@/lib/seo/content-engine";
import { clientIpKey, createIpRateLimiter } from "@/lib/start/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-instance limiter (module scope survives on a warm function; a cold start
// resets it — right cost/benefit for a single-user private tool). Tighter than
// /api/start: this is one human clicking a bookmark a handful of times a day.
const ipLimiter = createIpRateLimiter({ maxRequests: 20, windowMs: 10 * 60 * 1000 });

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

const receiptsSchema = z
  .object({
    /** The status URL of the tweet John is replying to (threads the composer). */
    tweetUrl: z.string().max(500).optional(),
    /** The text to resolve the card from — the tweet text (bookmarklet scrapes
     *  it to avoid an X read) or a raw card query ("umbreon ex 199"). */
    text: z.string().max(2000).optional(),
  })
  .refine((v) => (v.tweetUrl && v.tweetUrl.trim()) || (v.text && v.text.trim()), {
    message: "tweetUrl or text required",
  });

/** Claude drafting call — short reply; soft-fail returns "" so the draft gate
 *  simply falls back to the figure-free line. */
async function claudeGenerate(prompt: string): Promise<string> {
  const message = await anthropic().messages.create({
    model: CONTENT_MODEL,
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });
  const block = message.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.X_RECEIPTS_SECRET;
  if (!expected) return json({ ok: false, error: "receipts_disabled" }, 503);

  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header !== `Bearer ${expected}`) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  if (!ipLimiter.check(clientIpKey(request.headers))) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = receiptsSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ ok: false, error: "invalid_payload" }, 400);
  }

  // The reply target: the tweet id parsed from the URL (threads the composer).
  const ref = parsed.data.tweetUrl ? parseTweetRef(parsed.data.tweetUrl) : null;
  const replyToId = ref?.id ?? null;

  // The text to resolve the card from: the supplied text, else fetch the tweet's
  // text via the X API (the URL-only path, e.g. the iOS Shortcut).
  let text = parsed.data.text?.trim() ?? "";
  if (!text && replyToId) {
    const fetched = await fetchTweetText(replyToId);
    if (fetched.ok) text = fetched.tweet.text.trim();
  }
  if (!text) {
    return json({ ok: false, error: "no_text_to_resolve" }, 422);
  }

  try {
    const result = await generateReceipts(
      { text, replyToId },
      {
        resolve: resolveCardSlug,
        getFacts: (slug, displayName) =>
          getReceiptFacts(slug, displayName, {
            mover: (s) => getMoverBySlug(s),
            snapshot: (s) => getSnapshotSold(s),
          }),
        draftProse: (input) => draftReceiptsProse(input, { generate: claudeGenerate }),
      },
    );
    return json({ ok: true, ...result });
  } catch (err) {
    console.error("[receipts] failed:", (err as Error).message);
    return json({ ok: false, error: "receipts_failed" }, 500);
  }
}
