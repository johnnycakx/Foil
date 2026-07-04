// X reply-intent + card-page-link builders for the in-flow receipts tool and
// the reply desk (x-reply-desk, ADR-107). PURE string builders — no X API call.
//
// THE COLD-LANE FIREWALL. The `in_reply_to` param here composes an
// x.com/intent/post URL that opens X's OWN composer prefilled; the human
// presses X's Post button. That is the platform-safe alternative to
// API-posting a reply on a stranger's thread (a manipulation-ban risk that is
// account-fatal). This file is deliberately OUTSIDE lib/engagement/ — that
// tree's zero-X-write invariant bans the `in_reply_to` token because it scans
// for API writes, and an intent URL is not one (no post is made; a URL is
// built for a human to click). See ADR-107's two-lane rule.

import { siteUrl } from "../seo/site-url.ts";

const INTENT_POST_URL = "https://x.com/intent/post";

export type TweetRef = { id: string; username: string | null };

/**
 * Parse a tweet URL (or a bare numeric id) into { id, username }. Null when no
 * numeric status id is present. Accepts x.com + twitter.com, /status/ +
 * /statuses/, query strings, and trailing slashes. Pure.
 */
export function parseTweetRef(input: string): TweetRef | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  // Bare numeric id (what the bookmarklet may pass directly).
  if (/^\d{1,32}$/.test(s)) return { id: s, username: null };
  // A canonical status URL: https://x.com/<user>/status/<id>?...
  const m = s.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,32})/i);
  if (m) return { id: m[2], username: m[1] };
  // Fallback: any .../status/<id> fragment (username unknown).
  const m2 = s.match(/status(?:es)?\/(\d{1,32})/i);
  if (m2) return { id: m2[1], username: null };
  return null;
}

export type CardPageUtm = { source: string; medium: string; campaign: string };

/** The receipts attribution tag: reply → click → /cards/[slug] with utm_* the
 *  EmailCapture mirrors into the signup (ADR-084). This is the whole
 *  reply→signup proof chain for John's manual replies. */
export const RECEIPTS_UTM: CardPageUtm = { source: "x", medium: "reply", campaign: "receipts" };

/** The reply-desk attribution tag — distinguishes desk-driven signups (the cron
 *  eve-detector, ADR-107 §1) from the manual bookmarklet receipts (§3d) so
 *  `npm run subscriber-sources` can tell the two X lanes apart. */
export const REPLY_DESK_UTM: CardPageUtm = { source: "x", medium: "reply", campaign: "reply-desk" };

/**
 * The UTM-tagged card-page URL a receipt links to. Pure; origin + utm
 * injectable for tests. Uses encodeURIComponent (%20-style) to match the
 * codebase's proven intent-URL encoding (app/(site)/page.tsx REQUEST_INTENT_URL).
 */
export function buildCardPageUrl(slug: string, opts: { origin?: string; utm?: CardPageUtm } = {}): string {
  const origin = (opts.origin ?? siteUrl()).replace(/\/$/, "");
  const u = opts.utm ?? RECEIPTS_UTM;
  const qs =
    `utm_source=${encodeURIComponent(u.source)}` +
    `&utm_medium=${encodeURIComponent(u.medium)}` +
    `&utm_campaign=${encodeURIComponent(u.campaign)}`;
  return `${origin}/cards/${slug}?${qs}`;
}

/**
 * Build the x.com/intent/post URL that opens X's composer prefilled with
 * `text`, threaded as a reply to `inReplyToId` when a valid numeric id is
 * given. The human presses X's own Post button (the cold-lane ToS firewall).
 * `in_reply_to` verified as a documented web-intent param (docs.x.com
 * web-intents, fetched 2026-07-03); encodeURIComponent matches the in-repo
 * REQUEST_INTENT_URL precedent (%20 for spaces, which X's composer accepts).
 */
export function buildReplyIntentUrl(text: string, inReplyToId?: string | null): string {
  const parts: string[] = [];
  if (inReplyToId && /^\d{1,32}$/.test(inReplyToId)) parts.push(`in_reply_to=${inReplyToId}`);
  parts.push(`text=${encodeURIComponent(text)}`);
  return `${INTENT_POST_URL}?${parts.join("&")}`;
}

/**
 * Build the x.com/intent/post URL for a QUOTE TWEET (x-reply-desk §3c): X quotes
 * the post at `quotedStatusUrl` and prefills `text` as the comment. The human
 * presses X's Post button (the cold-lane firewall — a QT on a stranger's claim
 * is never an API post). `url` is the documented quote param (docs.x.com
 * web-intents). encodeURIComponent to match the REQUEST_INTENT_URL precedent.
 */
export function buildQuoteIntentUrl(text: string, quotedStatusUrl: string): string {
  return `${INTENT_POST_URL}?url=${encodeURIComponent(quotedStatusUrl)}&text=${encodeURIComponent(text)}`;
}

/** X counts every URL as a fixed 23 chars (t.co wrapping), regardless of the
 *  real length. A receipts reply carries one long UTM'd card link inline, so
 *  the raw string length over-counts; this is the length X actually enforces. */
export const TCO_URL_LENGTH = 23;
export function tweetLength(text: string): number {
  return (text ?? "").replace(/https?:\/\/\S+/g, "x".repeat(TCO_URL_LENGTH)).length;
}
