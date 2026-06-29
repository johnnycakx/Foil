// Acquisition Phase 0 / ADR-084 — UTM attribution on the owned newsletter list.
// Pins: (1) UTM sanitization (untrusted URL input → safe charset, length-bound,
// null), (2) a utm_source flows from input → the stored subscriber row, sanitized
// + sticky-first-touch, (3) the shared EmailCapture mirrors the landing URL's
// utm_* (+ ?src= alias) into hidden fields, (4) /deals renders exactly ONE email
// capture (guards ADR-066 + the de-leak fix).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeUtmValue, sanitizeUtm, buildSubscriberRow } from "../newsletter/subscribers.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// --- sanitization (untrusted URL input) -----------------------------------

test("sanitizeUtmValue reduces to [a-z0-9-], lowercases, and trims separators", () => {
  assert.equal(sanitizeUtmValue("Reddit"), "reddit");
  assert.equal(sanitizeUtmValue("Movers Board!"), "movers-board");
  assert.equal(sanitizeUtmValue("  r/PokeInvesting  "), "r-pokeinvesting");
});

test("sanitizeUtmValue caps length at 64 and rejects injection-ish input safely", () => {
  assert.equal(sanitizeUtmValue("a".repeat(100))!.length, 64);
  // SQL/HTML metacharacters collapse to separators; nothing dangerous survives.
  assert.equal(sanitizeUtmValue("'; DROP TABLE newsletter_subscribers; --"), "drop-table-newsletter-subscribers");
  assert.equal(sanitizeUtmValue("<script>alert(1)</script>"), "script-alert-1-script");
});

test("sanitizeUtmValue returns null for empty / non-string / all-garbage input", () => {
  assert.equal(sanitizeUtmValue(""), null);
  assert.equal(sanitizeUtmValue("   "), null);
  assert.equal(sanitizeUtmValue("!!!"), null);
  assert.equal(sanitizeUtmValue(null), null);
  assert.equal(sanitizeUtmValue(undefined), null);
});

test("sanitizeUtm sanitizes all three fields independently", () => {
  assert.deepEqual(sanitizeUtm({ source: "Reddit", medium: "Community", campaign: "Movers Board" }), {
    source: "reddit",
    medium: "community",
    campaign: "movers-board",
  });
});

// --- buildSubscriberRow: URL utm → stored row ------------------------------

test("buildSubscriberRow: a utm_source flows into the stored row, sanitized", () => {
  const row = buildSubscriberRow({
    email: "fan@example.com",
    source: "deals_board",
    resendContactId: "ct_1",
    utm: { source: "Reddit", medium: "community", campaign: "movers_board" },
  });
  assert.equal(row.email, "fan@example.com");
  assert.equal(row.source, "deals_board"); // the capture surface
  assert.equal(row.utm_source, "reddit"); // the inbound channel, sanitized
  assert.equal(row.utm_medium, "community");
  assert.equal(row.utm_campaign, "movers-board");
  assert.equal(row.unsubscribed_at, null);
  assert.equal(row.resend_contact_id, "ct_1");
});

test("buildSubscriberRow: no UTM → utm_* keys are OMITTED (sticky first-touch on re-subscribe)", () => {
  const row = buildSubscriberRow({ email: "x@y.com", source: "homepage_hero", resendContactId: null });
  assert.ok(!("utm_source" in row), "utm_source must be omitted, not null, so a no-UTM re-subscribe can't wipe a prior channel");
  assert.ok(!("utm_medium" in row));
  assert.ok(!("utm_campaign" in row));
  // base columns always present
  assert.equal(row.email, "x@y.com");
  assert.equal(row.source, "homepage_hero");
});

test("buildSubscriberRow: a UTM that sanitizes to empty is omitted (not stored as garbage)", () => {
  const row = buildSubscriberRow({ email: "x@y.com", source: "s", resendContactId: null, utm: { source: "!!!" } });
  assert.ok(!("utm_source" in row));
});

// --- EmailCapture mirrors the landing URL ----------------------------------

test("EmailCapture mirrors utm_* (+ ?src= alias) from the landing URL into hidden form fields", () => {
  const src = readFileSync(join(ROOT, "components", "email-capture.tsx"), "utf8");
  // hidden fields the server action reads
  assert.match(src, /name="utm_source"/);
  assert.match(src, /name="utm_medium"/);
  assert.match(src, /name="utm_campaign"/);
  // reads them from the URL after hydration (window.location, not useSearchParams)
  assert.match(src, /window\.location\.search/);
  assert.match(src, /get\("utm_source"\)/);
  assert.match(src, /get\("utm_medium"\)/);
  assert.match(src, /get\("utm_campaign"\)/);
  // ?src= short alias for utm_source (matches the watchlist convention)
  assert.match(src, /get\("src"\)/);
});

// --- subscribeAction awaits the owned-list write (not fire-and-forget) ------

test("subscribeAction AWAITS recordSubscriber so the attribution write can't be dropped on a Vercel freeze", () => {
  // A `void recordSubscriber(...)` left running after the server-action response
  // can be killed when the function freezes, losing the row + its UTM. The write
  // must be awaited inside the function lifetime.
  const src = readFileSync(join(ROOT, "app", "actions", "subscribe.ts"), "utf8");
  assert.match(src, /await recordSubscriber\(/, "recordSubscriber must be awaited");
  assert.doesNotMatch(src, /void recordSubscriber\(/, "recordSubscriber must NOT be fire-and-forget");
});

// --- /deals: exactly one capture (ADR-066 + de-leak guard) ------------------

test("/deals renders exactly ONE EmailCapture, tagged source=deals_board (ADR-066 one-ask + the de-leak fix)", () => {
  const src = readFileSync(join(ROOT, "app", "(site)", "deals", "page.tsx"), "utf8");
  const captures = src.match(/<EmailCapture\b/g) ?? [];
  assert.equal(captures.length, 1, `expected exactly one EmailCapture on /deals, found ${captures.length}`);
  assert.match(src, /source="deals_board"/);
});
