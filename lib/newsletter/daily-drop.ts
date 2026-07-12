// The Pro daily deal drop (offer item 2a) — the $6 tier's headline deliverable.
//
// Deterministic composer, no LLM: the day's confident BELOW deals from the
// buy_signals cache (the same rows /deals locks behind the gate), rendered
// text-forward for Gmail Primary (ADR-079 deliverability doctrine: no images,
// no big colored buttons). Links go to the card pages, not raw eBay — the
// ADR-091 "page is the house, email is the doorbell" rule; the affiliate click
// happens on the page. Thin-day rule, DECIDED: a 0-deal day SENDS the honest
// quiet-day email rather than skipping, because the offer copy promises
// exactly that ("On a quiet day it says so. No filler.") — silence would break
// the promise the buyer is paying for.

import type { DealRow } from "../deals/leaderboard";
import { buildUnsubscribeUrl } from "../unsubscribe-token.ts";
import { CAN_SPAM_ADDRESS } from "../notifications/resend.ts";

export type MarketTemperature = { belowCount: number; totalCount: number };

export type DailyDropModel = {
  subject: string;
  bodyHtmlFor: (recipientEmail: string) => string;
  dealCount: number;
};

const SITE = "https://foiltcg.com";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function cardUrl(slug: string): string {
  return `${SITE}/cards/${slug}?utm_source=daily-drop&utm_medium=email&utm_campaign=pro-drop`;
}

/** "listed 18% under what it usually sells for" — card-shop words, no jargon. */
function dealLine(d: DealRow): string {
  const under = Math.abs(Math.round(d.deltaPct ?? 0));
  const usual = typeof d.soldReference === "number" ? usd(d.soldReference) : null;
  const name = `${esc(d.cardName)}${d.setName ? ` (${esc(d.setName)})` : ""}`;
  const priceBit = usual
    ? `listed ${under}% under what it usually sells for. Usually ${usual}.`
    : `listed ${under}% under its usual price.`;
  return `<p style="margin:0 0 12px"><a href="${cardUrl(d.cardSlug)}">${name}</a><br/>${priceBit}</p>`;
}

function temperatureLine(t: MarketTemperature | null): string {
  if (!t || t.totalCount === 0) return "";
  return `<p style="margin:0 0 16px">${t.belowCount} of the ${t.totalCount} cards Foil tracks are going for less than usual this week.</p>`;
}

export function buildDailyDropModel(
  deals: DealRow[],
  temperature: MarketTemperature | null,
  now: Date,
): DailyDropModel {
  const dateLine = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const count = deals.length;

  const subject =
    count === 0
      ? "Quiet day. Nothing worth your money today."
      : count === 1
        ? "Today's drop: 1 real buy"
        : `Today's drop: ${count} real buys`;

  const intro =
    count === 0
      ? `<p style="margin:0 0 16px">Foil checked the board today and nothing cleared the bar. No filler, no stretch picks. If a card you chase dips, you'll hear about it.</p>`
      : `<p style="margin:0 0 16px">Foil checked the board today. ${count === 1 ? "One listing cleared the bar." : `${count} listings cleared the bar.`} Every price below is judged against what the card really sells for, not asking prices.</p>`;

  const bodyHtmlFor = (recipientEmail: string): string => {
    const unsubscribe = buildUnsubscribeUrl(recipientEmail);
    return [
      `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#0f1e3a">`,
      `<p style="margin:0 0 4px;font-size:13px;color:#4a5568">The drop · ${dateLine}</p>`,
      intro,
      ...deals.map(dealLine),
      temperatureLine(temperature),
      `<p style="margin:24px 0 0;font-size:13px;color:#4a5568">You get the drop because you're a Foil Pro member. Foil doesn't guess prices. It reads real sales.</p>`,
      unsubscribe
        ? `<p style="margin:8px 0 0;font-size:12px;color:#4a5568"><a href="${unsubscribe}">Unsubscribe</a> · ${esc(CAN_SPAM_ADDRESS)}</p>`
        : `<p style="margin:8px 0 0;font-size:12px;color:#4a5568">${esc(CAN_SPAM_ADDRESS)}</p>`,
      `</div>`,
    ].join("\n");
  };

  return { subject, bodyHtmlFor, dealCount: count };
}
