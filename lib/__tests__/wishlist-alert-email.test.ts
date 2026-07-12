// Alert email composer tests — rebuilt for the thin honest ping (ADR-091).
// Pins the honesty contract:
//   - "dropped" copy renders ONLY for kind "dropped"; "already_below" says so.
//   - Every body carries a sold-comp evidence line OR the explicit no-comp
//     disclosure — no third state (the acceptance criterion).
//   - Delivery doctrine: no <img>, no button-styled CTA, ONE link to the card
//     page (+ the unsubscribe footer link), no "newsletter" framing.
//   - No sentinel: blank target renders market-basis copy; "$100000.00" is
//     unbuildable.

import test from "node:test";
import assert from "node:assert/strict";
import { emailBody, evidenceLine, pctUnderAvg, subjectLine, type AlertEmailInputs } from "../wishlist/alert-email.ts";
import type { SoldComp } from "../wishlist/alert-decision.ts";

const COMP: SoldComp = {
  avg30dCents: 9200,
  saleCount: 14,
  tierLabel: "Near Mint",
  computedAt: "2026-07-01T00:00:00Z",
};

function inputs(over: Partial<AlertEmailInputs> = {}): AlertEmailInputs {
  return {
    cardName: "Charizard",
    setName: "Base",
    kind: "dropped",
    basis: "target",
    currentPriceCents: 3800,
    targetPriceCents: 4000,
    comp: null,
    cardPageUrl: "https://foiltcg.com/cards/base1-4-charizard",
    unsubscribeUrl: "https://foiltcg.com/api/unsubscribe?token=tok",
    manageUrl: "https://foiltcg.com/w/vault-tok",
    ...over,
  };
}

test("subject, dropped + target basis: names the drop and the user's target", () => {
  assert.equal(
    subjectLine(inputs()),
    "Charizard (Base) dropped to $38.00, at your $40.00 target",
  );
});

test("subject, already_below: 'is', never 'dropped' — a drop that wasn't observed is never claimed", () => {
  const s = subjectLine(inputs({ kind: "already_below" }));
  assert.equal(s, "Charizard (Base) is $38.00, at your $40.00 target");
  assert.doesNotMatch(s, /dropped/);
});

test("subject, market basis: cites the percent under the 30-day sold average", () => {
  const s = subjectLine(
    inputs({ kind: "dropped", basis: "market", targetPriceCents: null, currentPriceCents: 7500, comp: COMP }),
  );
  assert.match(s, /dropped to \$75\.00, 18% under what it usually sells for/);
});

test("evidence line cites the comp with tier + figures; discloses plainly when no comp exists", () => {
  const withComp = evidenceLine(inputs({ currentPriceCents: 7500, comp: COMP }));
  assert.equal(withComp, "Usually sells for $92.00 (Near Mint, last 30 days) · this listing: $75.00 (18% under)");
  const overAvg = evidenceLine(inputs({ currentPriceCents: 10000, comp: COMP }));
  assert.match(overAvg, /9% over/);
  const noComp = evidenceLine(inputs({ comp: null }));
  assert.equal(noComp, "No recent sold data for this card. This alert is against your target only.");
});

test("body ALWAYS carries the evidence line or the disclosure (the acceptance criterion)", () => {
  const withComp = emailBody(inputs({ currentPriceCents: 7500, comp: COMP }));
  assert.match(withComp, /Usually sells for \$92\.00 \(Near Mint, last 30 days\)/);
  const noComp = emailBody(inputs({ comp: null }));
  assert.match(noComp, /No recent sold data for this card/);
});

test("body honesty per kind: 'just dropped' only for dropped; already_below says already", () => {
  const dropped = emailBody(inputs({ kind: "dropped" }));
  assert.match(dropped, /just dropped to \$38\.00/);
  const already = emailBody(inputs({ kind: "already_below" }));
  assert.match(already, /already at \$38\.00/);
  assert.doesNotMatch(already, /just dropped/);
});

test("thin ping doctrine: no images, no buttons; card-page + manage-vault + unsubscribe links only", () => {
  const html = emailBody(inputs());
  assert.doesNotMatch(html, /<img/i, "no images (Primary-safe, ADR-079)");
  assert.doesNotMatch(html, /display:\s*inline-block;\s*background/, "no button-styled CTA");
  assert.doesNotMatch(html, /ebay\.com/i, "no affiliate link in the email — the page is the house");
  assert.doesNotMatch(html, /newsletter/i, "SaaS notification, not a newsletter");
  const links = [...html.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(links, [
    "https://foiltcg.com/cards/base1-4-charizard",
    "https://foiltcg.com/w/vault-tok",
    "https://foiltcg.com/api/unsubscribe?token=tok",
  ]);
});

test("footer carries the manage-your-watchlist vault link (ADR-093); omitted cleanly when unmintable", () => {
  const withLink = emailBody(inputs());
  assert.match(withLink, /Manage your watchlist/);
  const without = emailBody(inputs({ manageUrl: null }));
  assert.doesNotMatch(without, /Manage your watchlist/);
});

test("no sentinel can render: blank target produces market copy, never $100000.00", () => {
  const html = emailBody(
    inputs({ basis: "market", targetPriceCents: null, currentPriceCents: 7500, comp: COMP }),
  );
  assert.doesNotMatch(html, /100000/);
  assert.doesNotMatch(html, /you wanted/);
  const subj = subjectLine(
    inputs({ basis: "market", targetPriceCents: null, currentPriceCents: 7500, comp: COMP }),
  );
  assert.doesNotMatch(subj, /100000/);
});

test("variant + condition qualifier renders in subject and as a tracking line, HTML-escaped", () => {
  const withLabels = inputs({ variantLabel: "1st Edition Holofoil", conditionLabel: "PSA 10" });
  assert.match(subjectLine(withLabels), /^Charizard 1st Edition Holofoil \(PSA 10\) \(Base\)/);
  const html = emailBody(inputs({ variantLabel: `<script>alert(1)</script>` }));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /Tracking:/);
  // Absent labels → no tracking line.
  assert.doesNotMatch(emailBody(inputs()), /Tracking:/);
});

test("pctUnderAvg math + guards", () => {
  assert.equal(pctUnderAvg(7500, COMP), 18);
  assert.equal(pctUnderAvg(9200, COMP), 0);
  assert.equal(pctUnderAvg(10000, COMP), -9);
  assert.equal(pctUnderAvg(100, null), null);
  assert.equal(pctUnderAvg(100, { ...COMP, avg30dCents: 0 }), null);
});
