// "Good buys this week" newsletter digest (ADR-069). Serializes the market-
// movers signal into a paste-ready Markdown file under docs/newsletter-drafts/.
// This is the source for newsletter issue #1 and the recurring digest.
//
// DETERMINISTIC BY DESIGN — there is NO LLM in this path. The newsletter
// blog-repurpose pipeline (draft-generator.ts) runs Claude and guards against
// fabricated figures (gate (d)). Here, every figure is assembled directly from
// a real PokeTrace aggregate (avg7d / avg30d) carried on a MoverRow, so
// fabrication is structurally impossible — the strongest form of the honesty
// discipline. A "good buy" is framed as a CANDIDATE trading below its own
// recent average, never a guarantee. No hype, no em dashes (BRAND-VOICE Gate 12).
//
// Pure string assembly; no fs side effects. The caller (scripts/
// generate-movers-digest.ts) reads market_movers from Supabase and writes the
// result. Card-level eBay BROWSE (affiliate search) links — never single
// listings — keep this compliant + robust (the whole point of the reframe).

import type { MarketMovers, MoverRow } from "../deals/market-movers-read.ts";
import { affiliateSearchUrl, buildCustomId } from "../affiliate/epn.ts";

export type MoversDigestInput = {
  movers: MarketMovers;
  /** ISO timestamp string used in frontmatter + the body date line. */
  generatedAt: string;
  /** Absolute site origin for links, e.g. "https://foiltcg.com". */
  siteUrl?: string;
  /** How many down/up movers to include in the body. */
  maxDown?: number;
  maxUp?: number;
};

const DEFAULT_SITE = "https://foiltcg.com";
const LEAD_MAGNET_PATH = "/free/pokemon-card-pricing-cheat-sheet";

export const MOVERS_DIGEST_SEPARATOR = "\n\n## Newsletter body (paste-ready)\n\n";

/** Exact USD, thousands-separated, trailing .00 dropped. */
export function formatUsd(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const [int, dec] = rounded.toFixed(2).split(".");
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec === "00" ? `$${withCommas}` : `$${withCommas}.${dec}`;
}

/** "down 12%" / "up 9.4%" — absolute momentum, exact (1 dp as stored). */
function moveWords(momentumPct: number): string {
  const dir = momentumPct < 0 ? "down" : "up";
  const mag = Math.abs(momentumPct);
  return `${dir} ${mag}%`;
}

/** Card-level eBay BROWSE affiliate search link for a Near-Mint copy. */
function browseUrl(m: MoverRow): string {
  const query = `${m.cardName} ${m.setName} Near Mint`.trim();
  return affiliateSearchUrl(query, buildCustomId({ tier: "deals", slug: m.cardSlug, src: "movers-digest" }));
}

/** One "good buy" line: exact 7d vs 30d figures + the browse link. */
function downLine(m: MoverRow): string {
  const avg7 = typeof m.avg7d === "number" ? formatUsd(m.avg7d) : null;
  const avg30 = typeof m.avg30d === "number" ? formatUsd(m.avg30d) : null;
  const move = moveWords(m.momentumPct);
  const figures =
    avg7 && avg30
      ? `Its Near Mint copies averaged ${avg7} over the last 7 days versus ${avg30} over 30 days (${move} vs its 30-day average), across ${m.saleCount} recent sales.`
      : `Near Mint is ${move} versus its 30-day average, across ${m.saleCount} recent sales.`;
  return [
    `**${m.cardName} (${m.setName})** is ${move} vs its 30-day average.`,
    figures,
    `[Browse Near Mint ${m.cardName} on eBay →](${browseUrl(m)})`,
  ].join("\n\n");
}

/** One "heating up" line: shorter, same honesty. */
function upLine(m: MoverRow): string {
  const avg7 = typeof m.avg7d === "number" ? formatUsd(m.avg7d) : null;
  const avg30 = typeof m.avg30d === "number" ? formatUsd(m.avg30d) : null;
  const move = moveWords(m.momentumPct);
  const figures = avg7 && avg30 ? ` (${avg7} over 7 days versus ${avg30} over 30)` : "";
  return `**${m.cardName} (${m.setName})** is ${move} vs its 30-day average${figures}, across ${m.saleCount} recent sales. [Browse on eBay →](${browseUrl(m)})`;
}

function formatDate(iso: string): string {
  // Stable UTC date line; the caller passes the run timestamp.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * Build the paste-ready "good buys this week" digest. Returns the full Markdown
 * file (frontmatter + body). Returns a body explicitly noting "no movers" when
 * the signal is empty (honest, never a fabricated list).
 */
/** The structured pieces of a digest: the subject + preview-text + the email
 *  BODY markdown (from "# Good buys this week" onward, no review header). The
 *  HTML send path (lib/newsletter/digest-html.ts) renders `bodyMarkdown`; the
 *  markdown file path (serializeMoversDigest) wraps it with the review header +
 *  frontmatter. One source of truth so the two never drift. */
export type MoversDigestParts = {
  subject: string;
  previewText: string;
  /** The email body as Markdown — `# Good buys this week` … `Built by John Craig.` */
  bodyMarkdown: string;
  downCount: number;
  upCount: number;
};

export function buildMoversDigestParts(input: MoversDigestInput): MoversDigestParts {
  const site = (input.siteUrl ?? DEFAULT_SITE).replace(/\/+$/, "");
  const down = input.movers.down.slice(0, input.maxDown ?? 8);
  const up = input.movers.up.slice(0, input.maxUp ?? 4);
  const dateLine = formatDate(input.generatedAt);

  const subject =
    down.length > 0
      ? `${down.length} Pokémon cards trading below their 30-day average`
      : "This week's Pokémon card market check";
  const previewText =
    down.length > 0
      ? "The cards cooling off versus their recent average, with exact numbers."
      : "No cards cleared the good-buy bar this week, and that is fine.";

  const body: string[] = [];
  body.push(`# Good buys this week`);
  body.push("");
  body.push(`Here is what the Pokémon card market did this week, ${dateLine}. These are cards whose Near Mint copies are trading below their own 30-day sold average. That makes each one a candidate worth a look, not a guarantee. Every number below is a real recent sold average, and the bar is set so thin or noisy cards never make the list.`);
  body.push("");

  if (down.length > 0) {
    body.push(`## Cooling off (candidate buys)`);
    body.push("");
    for (const m of down) {
      body.push(downLine(m));
      body.push("");
    }
  } else {
    body.push(`No cards cleared the good-buy bar this week. When the market is flat, the honest move is to say so rather than manufacture a deal. Check back next week.`);
    body.push("");
  }

  if (up.length > 0) {
    body.push(`## Heating up`);
    body.push("");
    body.push(`The other side of the same signal, cards trading above their 30-day average:`);
    body.push("");
    for (const m of up) {
      body.push(`- ${upLine(m)}`);
    }
    body.push("");
  }

  body.push(`---`);
  body.push("");
  body.push(`Want the quick reference I built for pricing any card by condition? Grab the free [Pokémon Card Pricing Cheat Sheet](${site}${LEAD_MAGNET_PATH}).`);
  body.push("");
  body.push(`Browse links are eBay affiliate searches. Foil is free, and when you buy through a link eBay pays us a commission at no cost to you. It does not change which cards we surface, we rank by the move, not the payout.`);
  body.push("");
  body.push(`Built by John Craig.`);

  return {
    subject,
    previewText,
    bodyMarkdown: body.join("\n"),
    downCount: input.movers.down.length,
    upCount: input.movers.up.length,
  };
}

export function serializeMoversDigest(input: MoversDigestInput): string {
  const { subject, previewText, bodyMarkdown, downCount, upCount } = buildMoversDigestParts(input);

  const fm = [
    "---",
    `kind: "market-movers-digest"`,
    `generatedAt: "${input.generatedAt}"`,
    `subject: "${escapeYaml(subject)}"`,
    `previewText: "${escapeYaml(previewText)}"`,
    `downCount: ${downCount}`,
    `upCount: ${upCount}`,
    `source: "poketrace-near-mint-momentum"`,
    "---",
  ].join("\n");

  // The review header (Subject/Preview lines the founder reads before the body)
  // lives only in the markdown-file artifact, never in the email/Beehiiv body.
  const reviewHeader = [`**Subject:** ${subject}`, `**Preview text:** ${previewText}`, "", "---", ""].join("\n");

  return `${fm}${MOVERS_DIGEST_SEPARATOR}${reviewHeader}\n${bodyMarkdown}\n`;
}

function escapeYaml(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
