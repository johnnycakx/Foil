// Wishlist alert email composers — pure functions, no I/O (rebuilt for the
// honest event model, alert-engine-rebuild / ADR-091).
//
// Delivery doctrine (John, 2026-07-01): "the page is the house, email is the
// doorbell." The alert is a THIN ping — an honest subject, the market-evidence
// line, ONE link to the card page. All richness lives on the web, which also
// keeps the email maximally Gmail-Primary-safe (ADR-079 constraints: no
// images, no buttons, text-forward). Foil is a SaaS with email notifications,
// not a newsletter — the word "newsletter" never appears in alert copy.
//
// Honesty contract:
//   - kind "dropped" copy renders ONLY when a real cross was observed
//     (lib/wishlist/alert-decision.ts decides; the composer just obeys).
//   - kind "already_below" says so plainly — never "just dropped."
//   - Every email carries EITHER a sold-comp evidence line (real PokeTrace
//     30-day figures with their tier label) OR the explicit no-comp
//     disclosure. No third state.
//   - USD only: the scan gates currency before composing; these composers
//     deal exclusively in USD cents and never render another currency.
//   - No sentinel: a blank target renders as the market basis — the string
//     "$100000.00" can never be built (targetPriceCents is null, not a
//     sentinel).

import type { SoldComp } from "./alert-decision.ts";

export type AlertEmailInputs = {
  cardName: string;
  setName: string;
  /** What actually happened — decided by decideAlert, never by the composer. */
  kind: "dropped" | "already_below";
  /** Which bound triggered: the user's explicit target or the market floor. */
  basis: "target" | "market";
  /** VERIFIED listing price in USD cents (the scan enforces USD). */
  currentPriceCents: number;
  /** The user's explicit target, or null for a blank ("market") watch. */
  targetPriceCents: number | null;
  /** 30-day sold comp (market_movers) or null when none exists. */
  comp: SoldComp | null;
  /** Absolute URL to /cards/<slug> — THE link. */
  cardPageUrl: string;
  /** RFC 8058 one-click unsubscribe URL (null → mailto fallback line). */
  unsubscribeUrl: string | null;
  /** Private vault URL (ADR-093) — "manage your watchlist" in the footer.
   *  Null when the token secret is unavailable; the line is omitted. */
  manageUrl: string | null;
  /** Human variant label ("1st Edition Holofoil") when the watch targets one. */
  variantLabel?: string;
  /** Human condition label ("PSA 10"). Omitted for the any-raw default. */
  conditionLabel?: string;
};

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Percent under the 30-day average, rounded to whole percent. Positive =
 *  under. Returns null when the comp is unusable. */
export function pctUnderAvg(currentPriceCents: number, comp: SoldComp | null): number | null {
  if (!comp || comp.avg30dCents <= 0) return null;
  return Math.round(((comp.avg30dCents - currentPriceCents) / comp.avg30dCents) * 100);
}

/** "1st Edition Holofoil (PSA 10)" / "1st Edition Holofoil" / "(PSA 10)" / "". */
function trackingQualifier(input: Pick<AlertEmailInputs, "variantLabel" | "conditionLabel">): string {
  return [input.variantLabel, input.conditionLabel ? `(${input.conditionLabel})` : null]
    .filter(Boolean)
    .join(" ");
}

/** The reason clause both subject + body lead with — honest per basis. */
function triggerClause(input: AlertEmailInputs): string {
  if (input.basis === "target" && input.targetPriceCents != null) {
    return `at your ${formatUsd(input.targetPriceCents)} target`;
  }
  const pct = pctUnderAvg(input.currentPriceCents, input.comp);
  // Market basis always has a comp by construction (decideAlert can't pick
  // the market basis without one); the fallback keeps the composer total.
  // Register rule: "under what it usually sells for", not "30-day sold average".
  return pct != null ? `${pct}% under what it usually sells for` : `under what it usually goes for`;
}

/**
 * Subject line. Two honest shapes (no em dashes, John's standing rule):
 *   dropped:       "Charizard (Base) dropped to $38.00, at your $40.00 target"
 *   already_below: "Charizard (Base) is $38.00, at your $40.00 target"
 * "dropped" appears ONLY when the decision observed a real cross.
 */
export function subjectLine(input: AlertEmailInputs): string {
  const qualifier = trackingQualifier(input);
  const namePart = qualifier ? `${input.cardName} ${qualifier}` : input.cardName;
  const price = formatUsd(input.currentPriceCents);
  const verb = input.kind === "dropped" ? `dropped to ${price}` : `is ${price}`;
  return `${namePart} (${input.setName}) ${verb}, ${triggerClause(input)}`;
}

/** The trust payoff: cite the comp, or disclose its absence plainly.
 *  Register rule (2026-07-11): card-shop words — "usually sells for", not
 *  "30-day avg sold". Same claim, same figures. */
export function evidenceLine(input: AlertEmailInputs): string {
  const pct = pctUnderAvg(input.currentPriceCents, input.comp);
  if (input.comp && pct != null) {
    const rel = pct >= 0 ? `${pct}% under` : `${Math.abs(pct)}% over`;
    return `Usually sells for ${formatUsd(input.comp.avg30dCents)} (${input.comp.tierLabel}, last 30 days) · this listing: ${formatUsd(input.currentPriceCents)} (${rel})`;
  }
  return `No recent sold data for this card. This alert is against your target only.`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Body HTML — the thin ping. Text-forward, zero images, zero buttons, one
 * styled text link to the card page. Everything else lives on the web.
 */
export function emailBody(input: AlertEmailInputs): string {
  const safeName = escapeHtml(input.cardName);
  const safeSet = escapeHtml(input.setName);
  const price = escapeHtml(formatUsd(input.currentPriceCents));
  const safeCardPageUrl = escapeHtml(input.cardPageUrl);
  const qualifier = trackingQualifier(input);

  const headline =
    input.kind === "dropped"
      ? `${safeName} (${safeSet}) just dropped to ${price}.`
      : `${safeName} (${safeSet}) is already at ${price}, below where you asked to be told.`;

  const reason = `That's ${escapeHtml(triggerClause(input))}.`;

  const trackingLine = qualifier
    ? `<p style="color: #556; font-size: 13px; margin: 0 0 16px;">Tracking: <strong style="color: #334;">${escapeHtml(qualifier)}</strong></p>`
    : "";

  return [
    `<!doctype html>`,
    `<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.6; color: #1a2333; background: #ffffff;">`,
    // Agent receipt (offer 4b): the email reads as Foil reporting back.
    `<p style="font-size: 13px; color: #556; margin: 0 0 12px;">Foil checked your watches. One hit.</p>`,
    `<p style="font-size: 16px; margin: 0 0 8px;"><strong>${headline}</strong></p>`,
    `<p style="font-size: 14px; color: #445; margin: 0 0 16px;">${reason}</p>`,
    trackingLine,
    `<p style="font-size: 14px; color: #334; margin: 0 0 20px; padding: 10px 14px; border-left: 3px solid #C9A24B; background: #faf7f0;">${escapeHtml(evidenceLine(input))}</p>`,
    `<p style="font-size: 15px; margin: 0 0 24px;"><a href="${safeCardPageUrl}" style="color: #0F1E3A; text-decoration: underline; text-underline-offset: 3px; font-weight: 600;">See the live listing and sold history on Foil →</a></p>`,
    `<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 12px;" />`,
    `<p style="font-size: 11px; color: #99a; line-height: 1.5; margin: 0;">You're getting this because you set a price alert at foiltcg.com. You'll hear about this card again only after its price moves back up and drops again.${
      input.manageUrl
        ? ` <a href="${escapeHtml(input.manageUrl)}" style="color: #99a; text-decoration: underline;">Manage your watchlist</a>: change targets, pause, or add cards.`
        : ""
    }</p>`,
    unsubscribeFooter(input.unsubscribeUrl),
    `</body></html>`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Batched digest composers (alert-digest-batching, 2026-07-02). One email per
// subscriber per cron run: n=1 renders EXACTLY the single-card email above
// (the caller branches); these two render only n>=2. Same thin-ping doctrine:
// text-forward, no images, no buttons, one link PER CARD, one footer, one
// unsubscribe. Subject is count + plain words — no hype, no emoji.
// ---------------------------------------------------------------------------

/** Most significant first: explicit-target hits lead (the user named that
 *  number), then the deepest %-under-average. Stable for ties. */
export function sortAlertsBySignificance(entries: readonly AlertEmailInputs[]): AlertEmailInputs[] {
  return [...entries].sort((a, b) => {
    const aTarget = a.basis === "target" ? 0 : 1;
    const bTarget = b.basis === "target" ? 0 : 1;
    if (aTarget !== bTarget) return aTarget - bTarget;
    const aPct = pctUnderAvg(a.currentPriceCents, a.comp) ?? -1;
    const bPct = pctUnderAvg(b.currentPriceCents, b.comp) ?? -1;
    return bPct - aPct;
  });
}

export function batchSubjectLine(count: number): string {
  return `${count} of your cards hit good buys today`;
}

/** One compact section per card, in the existing evidence-line style. */
export function batchEmailBody(unsorted: readonly AlertEmailInputs[]): string {
  const entries = sortAlertsBySignificance(unsorted);
  const sections = entries.map((input) => {
    const safeName = escapeHtml(input.cardName);
    const safeSet = escapeHtml(input.setName);
    const price = escapeHtml(formatUsd(input.currentPriceCents));
    const qualifier = trackingQualifier(input);
    const kindClause =
      input.kind === "dropped"
        ? "Just dropped"
        : "Already below where you asked to be told";
    return [
      `<div style="margin: 0 0 20px; padding-bottom: 16px; border-bottom: 1px solid #eee;">`,
      `<p style="font-size: 15px; margin: 0 0 4px;"><strong>${safeName} (${safeSet}) · ${price}</strong>${
        qualifier ? ` <span style="color: #556; font-size: 13px;">· ${escapeHtml(qualifier)}</span>` : ""
      }</p>`,
      `<p style="font-size: 13px; color: #445; margin: 0 0 6px;">${escapeHtml(kindClause)}, ${escapeHtml(triggerClause(input))}.</p>`,
      `<p style="font-size: 13px; color: #334; margin: 0 0 8px;">${escapeHtml(evidenceLine(input))}</p>`,
      `<p style="font-size: 14px; margin: 0;"><a href="${escapeHtml(input.cardPageUrl)}" style="color: #0F1E3A; text-decoration: underline; text-underline-offset: 3px; font-weight: 600;">See the live listing and sold history →</a></p>`,
      `</div>`,
    ].join("\n");
  });

  // Footer/unsubscribe come from the first entry — all entries belong to the
  // SAME subscriber by construction (the scan groups by email before render).
  const first = entries[0];
  return [
    `<!doctype html>`,
    `<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.6; color: #1a2333; background: #ffffff;">`,
    `<p style="font-size: 13px; color: #556; margin: 0 0 12px;">Foil checked your watches. ${entries.length} hits.</p>`,
    `<p style="font-size: 16px; margin: 0 0 20px;"><strong>${entries.length} of the cards you watch hit prices worth a look.</strong> Most significant first.</p>`,
    ...sections,
    `<p style="font-size: 11px; color: #99a; line-height: 1.5; margin: 12px 0 0;">You're getting this because you set price alerts at foiltcg.com. Each card goes quiet until its price moves back up and drops again.${
      first.manageUrl
        ? ` <a href="${escapeHtml(first.manageUrl)}" style="color: #99a; text-decoration: underline;">Manage your watchlist</a>: change targets, pause, or add cards.`
        : ""
    }</p>`,
    unsubscribeFooter(first.unsubscribeUrl),
    `</body></html>`,
  ].join("\n");
}

function unsubscribeFooter(url: string | null): string {
  if (url) {
    const safe = escapeHtml(url);
    return `<p style="font-size: 11px; color: #99a; line-height: 1.5; margin-top: 8px;">Don't want these? <a href="${safe}" style="color: #99a; text-decoration: underline;">Unsubscribe in one click</a>. It stops every alert.</p>`;
  }
  return `<p style="font-size: 11px; color: #99a; line-height: 1.5; margin-top: 8px;">Don't want these? Email john.c.craig24@gmail.com to be removed.</p>`;
}
