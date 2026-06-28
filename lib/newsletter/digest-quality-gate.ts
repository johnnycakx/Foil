// Quality gate for the "good buys this week" movers digest (ADR-077). Runs
// BEFORE the Discord approval card is posted; a failure means log + skip, no
// card (the goal's "fail -> no card" contract).
//
// The movers digest is DETERMINISTIC (every figure assembled from a real
// PokeTrace avg7d/avg30d on a MoverRow), so fabrication is structurally
// impossible. These gates make that structural property ENFORCED, and add the
// brand-voice + revenue-integrity checks the deterministic serializer can't
// self-guarantee:
//   (a) non-empty    — at least one cooling-off candidate (else a thin-week skip)
//   (b) figures      — every $ figure traces to a source MoverRow (avg7d/avg30d)
//   (c) sample-size  — every shown card has >= MIN sales (re-checks the cron gate)
//   (d) em dash      — none (BRAND-VOICE.md rule 7; parity with the blog gate)
//   (e) banned       — no banned/hype phrases (reuses the blog list)
//   (f) affiliate    — every eBay link carries campid (the issue-#1 revenue bug:
//                      an unwrapped link is untracked AND makes the footer's
//                      "affiliate searches" claim false). Toggleable for tests.

import type { MarketMovers } from "../deals/market-movers-read.ts";
import type { MoversDigestParts } from "./movers-digest.ts";
import { formatUsd } from "./movers-digest.ts";
import { extractDollarFigures, bannedPhraseMatches } from "./quality-gates.ts";
import { isAffiliateWrapped } from "../affiliate/epn.ts";

/** Minimum recent sales for a card to appear in the digest. The cron that
 *  populates market_movers already gates harder; this is belt-and-suspenders. */
export const MOVERS_DIGEST_MIN_SALES = 20;

export type DigestGateResult = { passed: boolean; failures: string[] };

export type DigestGateInput = {
  parts: MoversDigestParts;
  movers: MarketMovers;
  /** The rendered HTML body (for the affiliate-link integrity check). */
  html: string;
  /** Enforce that eBay links carry a campid. Default true; tests pass false when
   *  the fixture intentionally has no EBAY_CAMPAIGN_ID configured. */
  requireAffiliate?: boolean;
};

function normalizeDollar(raw: string): string {
  const digits = raw.replace(/[$,]/g, "");
  if (digits.endsWith(".00")) return digits.slice(0, -3);
  if (digits.endsWith(".0")) return digits.slice(0, -2);
  return digits;
}

export function runDigestQualityGates(input: DigestGateInput): DigestGateResult {
  const { parts, movers, html } = input;
  const requireAffiliate = input.requireAffiliate ?? true;
  const failures: string[] = [];
  const body = parts.bodyMarkdown;

  // The cards actually shown (the serializer slices to 8 down / 4 up).
  const shownDown = movers.down.slice(0, 8);
  const shownUp = movers.up.slice(0, 4);
  const shown = [...shownDown, ...shownUp];

  // (a) non-empty: a digest with no cooling-off candidates is a thin week — skip.
  if (shownDown.length === 0) {
    failures.push("No cooling-off candidates this week (down movers = 0). Skip the send rather than mail a thin issue.");
  }

  // (b) figures: every $ figure in the body must be a real source avg7d/avg30d.
  const allowed = new Set<string>();
  for (const m of shown) {
    if (typeof m.avg7d === "number") allowed.add(normalizeDollar(formatUsd(m.avg7d)));
    if (typeof m.avg30d === "number") allowed.add(normalizeDollar(formatUsd(m.avg30d)));
  }
  const fabricated: string[] = [];
  const seen = new Set<string>();
  for (const fig of extractDollarFigures(body)) {
    const norm = normalizeDollar(fig);
    if (allowed.has(norm) || seen.has(norm)) continue;
    seen.add(norm);
    fabricated.push(fig);
  }
  if (fabricated.length > 0) {
    failures.push(
      `Digest cites $ figures with no matching source sold-average: ${fabricated.join(", ")}. Every figure must be a real avg7d/avg30d from market_movers.`,
    );
  }

  // (c) sample-size: every shown card must clear the minimum recent-sales bar.
  const thin = shown.filter((m) => m.saleCount < MOVERS_DIGEST_MIN_SALES);
  if (thin.length > 0) {
    failures.push(
      `Cards below the ${MOVERS_DIGEST_MIN_SALES}-sale minimum were shown: ${thin.map((m) => `${m.cardName} (${m.saleCount})`).join(", ")}.`,
    );
  }

  // (d) em dash — BRAND-VOICE rule 7. Scan subject + preview + body.
  const emDashes = (`${parts.subject}\n${parts.previewText}\n${body}`.match(/—/g) || []).length;
  if (emDashes > 0) {
    failures.push(`${emDashes} em dash(es) found. BRAND-VOICE.md bans the em dash; recast with a comma, colon, or period.`);
  }

  // (e) banned/hype phrases (reuse the blog list).
  const banned = bannedPhraseMatches(`${parts.subject} ${parts.previewText} ${body}`);
  if (banned.length > 0) {
    failures.push(`Banned phrases detected: ${banned.map((p) => `"${p}"`).join(", ")}. Rewrite without them.`);
  }

  // (f) affiliate integrity: an unwrapped eBay link is untracked revenue AND
  // makes the footer's "affiliate searches" line false (the issue-#1 bug). The
  // wrapped-check lives in epn.ts (the affiliate-param boundary).
  if (requireAffiliate) {
    const ebayLinks = html.match(/https:\/\/www\.ebay\.com\/sch\/[^"')\s]+/g) ?? [];
    const unwrapped = ebayLinks.filter((u) => !isAffiliateWrapped(u));
    if (ebayLinks.length === 0) {
      failures.push("No eBay browse links found in the digest body — the cards have no buy CTAs.");
    } else if (unwrapped.length > 0) {
      failures.push(
        `${unwrapped.length}/${ebayLinks.length} eBay links are not affiliate-wrapped (untracked). EBAY_CAMPAIGN_ID must be set so the links are tracked and the footer's affiliate claim holds.`,
      );
    }
  }

  return { passed: failures.length === 0, failures };
}
