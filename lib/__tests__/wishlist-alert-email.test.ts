// Contract tests for the wishlist alert email composers. Pins:
//   1. Subject line shape ("Card (Set) dropped to $X — you wanted ≤ $Y").
//   2. Body HTML contains the affiliate CTA, the affiliate URL verbatim,
//      and the customid=foil-wishlist-alert attribution suffix.
//   3. Body renders without an <img> when cardImage is null.
//   4. HTML escaping prevents listing-title XSS.

import test from "node:test";
import assert from "node:assert/strict";
import { emailBody, subjectLine, type WishlistEmailInputs } from "../wishlist/alert-email.ts";

function inputs(overrides: Partial<WishlistEmailInputs> = {}): WishlistEmailInputs {
  return {
    cardName: "Charizard",
    setName: "Base",
    cardSlug: "base1-4-charizard",
    listing: {
      title: "Charizard 4/102 Base Set Holo NM",
      image: "https://img.ebay/x.jpg",
      price: 38.5,
      currency: "USD",
      affiliateUrl:
        "https://www.ebay.com/itm/123?mkevt=1&mkcid=1&mkrid=711-53200-19255-0&toolid=10001&campid=555555&customid=foil-wishlist-alert",
    },
    targetPriceCents: 4000,
    cardImage: "https://img.tcg/charizard.png",
    cardPageUrl: "https://foiltcg.com/cards/base1-4-charizard",
    unsubscribeUrl: "https://foiltcg.com/api/unsubscribe?token=test-token-abc",
    ...overrides,
  };
}

test("subjectLine: card + set + dropped-to + wanted-≤ shape", () => {
  const subject = subjectLine(inputs());
  assert.equal(subject, "Charizard (Base) dropped to $38.50 — you wanted ≤ $40.00");
});

test("subjectLine: rounds price to two decimals from the listing's raw float", () => {
  const subject = subjectLine(
    inputs({ listing: { ...inputs().listing, price: 7.999 } }),
  );
  assert.match(subject, /dropped to \$8\.00/);
});

test("subjectLine: non-USD currency falls through to numeric + code", () => {
  const subject = subjectLine(
    inputs({ listing: { ...inputs().listing, price: 25.0, currency: "EUR" } }),
  );
  assert.match(subject, /dropped to 25\.00 EUR/);
});

test("emailBody: includes the affiliate URL verbatim with customid=foil-wishlist-alert", () => {
  const html = emailBody(inputs());
  assert.ok(html.includes("customid=foil-wishlist-alert"));
  // The full URL string should appear unmodified (escape-safe) in href.
  assert.match(html, /href="[^"]*customid=foil-wishlist-alert[^"]*"/);
});

test("emailBody: includes the price + card name + listing title + target price", () => {
  const html = emailBody(inputs());
  assert.match(html, /\$38\.50/);
  assert.match(html, /Charizard/);
  assert.match(html, /Base/);
  assert.match(html, /Charizard 4\/102 Base Set Holo NM/);
  assert.match(html, /\$40\.00/);
});

test("emailBody: omits the card image block when cardImage is null", () => {
  const html = emailBody(inputs({ cardImage: null }));
  // The card-art <img> shouldn't be present; the listing image still is.
  const imgTags = html.match(/<img[^>]*>/g) ?? [];
  // At most one <img> (the listing image), zero card-art img.
  assert.ok(imgTags.length <= 1);
  assert.ok(!html.includes("https://img.tcg/charizard.png"));
});

test("emailBody: HTML-escapes a malicious listing title", () => {
  const html = emailBody(
    inputs({
      listing: {
        ...inputs().listing,
        title: '<script>alert("xss")</script>',
      },
    }),
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("emailBody: includes the per-card page link for after-the-fact browsing", () => {
  const html = emailBody(inputs());
  assert.match(html, /href="https:\/\/foiltcg\.com\/cards\/base1-4-charizard"/);
});

// --- Session 49b: variant + condition labels -------------------------------

test("subjectLine: injects variant + condition qualifier when present", () => {
  const subject = subjectLine(
    inputs({ variantLabel: "1st Edition Holofoil", conditionLabel: "PSA 10" }),
  );
  assert.equal(
    subject,
    "Charizard 1st Edition Holofoil (PSA 10) (Base) dropped to $38.50 — you wanted ≤ $40.00",
  );
});

test("subjectLine: variant only (no condition) still reads cleanly", () => {
  const subject = subjectLine(inputs({ variantLabel: "Shadowless Holofoil" }));
  assert.match(subject, /^Charizard Shadowless Holofoil \(Base\) dropped to/);
});

test("subjectLine: omitting both labels is byte-identical to the pre-49b format", () => {
  // Guards the all-defaults watch (variant 'default' / condition 'any-raw' →
  // the cron passes undefined labels) against any regression.
  assert.equal(
    subjectLine(inputs()),
    "Charizard (Base) dropped to $38.50 — you wanted ≤ $40.00",
  );
});

test("emailBody: renders a 'Tracking: …' line with the qualifier, HTML-escaped", () => {
  const html = emailBody(inputs({ variantLabel: "1st Edition Holofoil", conditionLabel: "PSA 10" }));
  assert.match(html, /Tracking:/);
  assert.match(html, /1st Edition Holofoil \(PSA 10\)/);
});

test("emailBody: no 'Tracking:' line when labels are absent", () => {
  const html = emailBody(inputs());
  assert.ok(!html.includes("Tracking:"));
});
