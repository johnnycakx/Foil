// ADR-077: the newsletter digest run-mode resolver + ISO-week idempotency key.

import test from "node:test";
import assert from "node:assert/strict";
import { resolveNewsletterDigestMode, isoWeekTag } from "../newsletter/digest-mode.ts";

test("mode defaults to off (safe — deploying the code posts nothing)", () => {
  assert.equal(resolveNewsletterDigestMode({}), "off");
  assert.equal(resolveNewsletterDigestMode({ NEWSLETTER_DIGEST_MODE: "" }), "off");
  assert.equal(resolveNewsletterDigestMode({ NEWSLETTER_DIGEST_MODE: "live" }), "off");
  assert.equal(resolveNewsletterDigestMode({ NEWSLETTER_DIGEST_MODE: "on" }), "off");
});

test("mode is approval only when explicitly set (case-insensitive)", () => {
  assert.equal(resolveNewsletterDigestMode({ NEWSLETTER_DIGEST_MODE: "approval" }), "approval");
  assert.equal(resolveNewsletterDigestMode({ NEWSLETTER_DIGEST_MODE: "Approval" }), "approval");
  assert.equal(resolveNewsletterDigestMode({ NEWSLETTER_DIGEST_MODE: "  APPROVAL " }), "approval");
});

test("isoWeekTag computes the ISO-8601 week (the per-week idempotency key)", () => {
  // 2026-01-01 is a Thursday → ISO week 1 of 2026.
  assert.equal(isoWeekTag(new Date("2026-01-01T12:00:00Z")), "2026-W01");
  // 2026-06-28 is a Sunday, the last day of ISO week 26.
  assert.equal(isoWeekTag(new Date("2026-06-28T12:00:00Z")), "2026-W26");
  // 2026-06-29 is the Monday that starts ISO week 27.
  assert.equal(isoWeekTag(new Date("2026-06-29T00:00:00Z")), "2026-W27");
});

test("isoWeekTag is stable across a day's hours (UTC-normalized)", () => {
  assert.equal(
    isoWeekTag(new Date("2026-06-28T00:00:01Z")),
    isoWeekTag(new Date("2026-06-28T23:59:59Z")),
  );
});
