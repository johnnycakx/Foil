// Pins the form → server-action → DB-payload contract for waitlist attribution.
//
// The risk this test mitigates: the SEO funnel is invisible if the source /
// UTM / referrer / landing_page fields don't reach the insert payload. We
// exercise parseWaitlistForm directly because it produces the exact row the
// action hands to Supabase — no stubbing of the DB client needed.

import test from "node:test";
import assert from "node:assert/strict";
import {
  parseWaitlistForm,
  type WaitlistInsertRow,
} from "../../app/landing/waitlist-validate.ts";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

function row(result: ReturnType<typeof parseWaitlistForm>): WaitlistInsertRow {
  if (!result.ok) {
    throw new Error(`expected ok result, got error: ${result.message}`);
  }
  return result.row;
}

test("parseWaitlistForm — full attribution payload flows from form to row", () => {
  const r = row(
    parseWaitlistForm(
      fd({
        email: "Jane@Example.COM",
        source: "japanese_guide",
        utm_source: "twitter",
        utm_medium: "social",
        utm_campaign: "jp_cards_launch",
        landing_page: "/japanese-pokemon-cards-value",
        referrer: "https://t.co/abc123",
      }),
    ),
  );

  assert.deepEqual(r, {
    email: "jane@example.com",
    source: "japanese_guide",
    utm_source: "twitter",
    utm_medium: "social",
    utm_campaign: "jp_cards_launch",
    landing_page: "/japanese-pokemon-cards-value",
    referrer: "https://t.co/abc123",
  });
});

test("parseWaitlistForm — email-only signup nulls every attribution column gracefully", () => {
  const r = row(parseWaitlistForm(fd({ email: "anon@example.com" })));

  // source falls back to "landing" so analytics can still bucket organic
  // direct-to-form submits. Every other attribution column persists as null.
  assert.strictEqual(r.email, "anon@example.com");
  assert.strictEqual(r.source, "landing");
  assert.strictEqual(r.utm_source, null);
  assert.strictEqual(r.utm_medium, null);
  assert.strictEqual(r.utm_campaign, null);
  assert.strictEqual(r.landing_page, null);
  assert.strictEqual(r.referrer, null);
});

test("parseWaitlistForm — empty-string attribution fields collapse to null (not '')", () => {
  // The client form sends "" before its mount-effect populates state, and
  // again on submit when the user landed without a referrer / utm params.
  // We MUST coerce those to null, not store empty strings — analytics
  // queries `WHERE utm_source IS NOT NULL` shouldn't match empty strings.
  const r = row(
    parseWaitlistForm(
      fd({
        email: "x@y.co",
        source: "homepage_hero",
        utm_source: "",
        utm_medium: "  ",
        utm_campaign: "",
        landing_page: "",
        referrer: "",
      }),
    ),
  );

  assert.strictEqual(r.source, "homepage_hero");
  assert.strictEqual(r.utm_source, null);
  assert.strictEqual(r.utm_medium, null);
  assert.strictEqual(r.utm_campaign, null);
  assert.strictEqual(r.landing_page, null);
  assert.strictEqual(r.referrer, null);
});

test("parseWaitlistForm — caps oversized attribution at 512 chars to keep the DB row sane", () => {
  const long = "a".repeat(1024);
  const r = row(
    parseWaitlistForm(
      fd({
        email: "x@y.co",
        source: "homepage_hero",
        referrer: long,
      }),
    ),
  );

  assert.strictEqual(r.referrer?.length, 512);
});

test("parseWaitlistForm — rejects missing email", () => {
  const result = parseWaitlistForm(fd({ source: "homepage_hero" }));
  assert.strictEqual(result.ok, false);
});

test("parseWaitlistForm — rejects malformed email", () => {
  const result = parseWaitlistForm(fd({ email: "not-an-email" }));
  assert.strictEqual(result.ok, false);
});
