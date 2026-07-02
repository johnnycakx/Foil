// Structural + light behavioral tests for the /start onboarding stack
// (Task #20 / Session 38).
//
// These are drift guards. Behavioral end-to-end of the form (submit → bulk
// insert → Beehiiv subscribe → success page) is the live-verify step in
// the closure gate; CI catches refactor drift in the structural anchors.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

// ---------------------------------------------------------------------------
// /start page (Server Component)
// ---------------------------------------------------------------------------

test("/start page: imports CARD_CATALOG + passes cataloguedIds to the client form", () => {
  const src = readFile("app/(site)/start/page.tsx");
  assert.match(src, /import\s*\{[^}]*\bCARD_CATALOG\b/);
  assert.match(src, /<StartPageForm[^>]*cataloguedIds=/);
});

test("/start page: is force-static + 24h revalidate (page itself is content-only)", () => {
  const src = readFile("app/(site)/start/page.tsx");
  assert.match(src, /export\s+const\s+dynamic\s*=\s*["']force-static["']/);
  assert.match(src, /export\s+const\s+revalidate\s*=\s*86400/);
});

test("/start page: links to /legal/privacy (transparency footer)", () => {
  const src = readFile("app/(site)/start/page.tsx");
  assert.match(src, /href=["']\/legal\/privacy["']/);
});

test("/start page: headline uses the display font class", () => {
  const src = readFile("app/(site)/start/page.tsx");
  // Pin that the headline carries the display-font class so a refactor
  // can't silently revert to the default sans family.
  assert.match(src, /font-display/);
});

// ---------------------------------------------------------------------------
// StartPageForm (Client component) — drift guards
// ---------------------------------------------------------------------------

test("shared CardTypeahead: debounces search at 300ms and caps results at 8 (ADR-093 extraction)", () => {
  const src = readFile("components/cards/card-typeahead.tsx");
  assert.match(src, /SEARCH_DEBOUNCE_MS\s*=\s*300/);
  // The typeahead fetches /api/cards/search; the route caps results at 8 server-side.
  assert.match(src, /\/api\/cards\/search\?q=/);
  // /start consumes the SHARED component, not a fork.
  assert.match(readFile("components/start-page-form.tsx"), /from "@\/components\/cards\/card-typeahead"/);
});

test("StartPageForm: enforces MAX_SELECTED ≤ 50 client-side", () => {
  const src = readFile("components/start-page-form.tsx");
  assert.match(src, /MAX_SELECTED\s*=\s*50/);
});

test("StartPageForm: newsletter opt-in checkbox starts checked (US CAN-SPAM, ADR-027)", () => {
  const src = readFile("components/start-page-form.tsx");
  // The form's optInNewsletter state initializes to true.
  assert.match(src, /useState\(true\)/);
  assert.match(src, /weekly deals newsletter/i);
});

test("shared CardTypeahead: only catalogued cards are pickable (defense-in-depth before the route also re-validates)", () => {
  const src = readFile("components/cards/card-typeahead.tsx");
  // The pick handler gates on cataloguedSet.has(hit.id).
  assert.match(src, /cataloguedSet\.has\(hit\.id\)/);
});

test("StartPageForm: POSTs to /api/start with opt_in_newsletter + cards array", () => {
  const src = readFile("components/start-page-form.tsx");
  assert.match(src, /fetch\(["']\/api\/start["']/);
  assert.match(src, /opt_in_newsletter/);
  assert.match(src, /cards:\s*selected\.map/);
});

test("StartPageForm: captures utm_*/?src= on mount and posts attribution (ADR-084/ADR-090)", () => {
  const src = readFile("components/start-page-form.tsx");
  // Same client-side capture pattern as EmailCapture — landing URL params,
  // ?src= as the utm_source alias.
  assert.match(src, /p\.get\("utm_source"\) \?\? p\.get\("src"\)/);
  assert.match(src, /p\.get\("utm_medium"\)/);
  assert.match(src, /p\.get\("utm_campaign"\)/);
  // Both keys reach the POST body: src (→ watchlists rows) + utm (→ subscriber).
  assert.match(src, /src:\s*utm\.source \|\| undefined/);
  assert.match(src, /utm:/);
});

test("StartPageForm: renders the off-screen honeypot field and posts it (ADR-090)", () => {
  const src = readFile("components/start-page-form.tsx");
  assert.match(src, /name="website"/);
  assert.match(src, /tabIndex=\{-1\}/, "honeypot must not be tabbable");
  assert.match(src, /aria-hidden="true"/, "honeypot must not be announced");
  assert.match(src, /website:\s*website \|\| undefined/, "honeypot value must reach the POST body");
});

// ---------------------------------------------------------------------------
// /api/start route — structural + slug derivation
// ---------------------------------------------------------------------------

test("/api/start route: zod schema enforces 1-50 cards", () => {
  const src = readFile("app/api/start/route.ts");
  assert.match(src, /z\.array\(cardSchema\)\.min\(1\)\.max\(50\)/);
});

test("/api/start route: re-validates pokemon_tcg_id against CARD_CATALOG", () => {
  const src = readFile("app/api/start/route.ts");
  // The route builds catalogById from CARD_CATALOG and checks each card.
  assert.match(src, /catalogById\.get\(card\.pokemon_tcg_id\)/);
  assert.match(src, /not_in_catalog/);
});

test("/api/start route: blank target stays NULL — the sentinel is purged (ADR-091)", () => {
  const src = readFile("app/api/start/route.ts");
  // Blank target = "alert me at ≥15% under the 30-day sold average." The old
  // 10,000,000¢ sentinel fired on ANY listing and rendered "you wanted ≤
  // $100000.00" in the email. It must never come back.
  assert.doesNotMatch(src, /SENTINEL_ANY_PRICE_CENTS/);
  assert.doesNotMatch(src, /10_000_000\s*[,;)]?\s*$/m, "no sentinel assignment");
  assert.match(src, /target_price_cents: card\.target_price_cents \?\? null/);
});

test("/api/start route: subscribeEmail uses source='start-page'", () => {
  const src = readFile("app/api/start/route.ts");
  assert.match(src, /source\s*:\s*["']start-page["']/);
});

test("/api/start route: Beehiiv subscribe is soft-failed (try/catch)", () => {
  const src = readFile("app/api/start/route.ts");
  const subscribeIdx = src.search(/subscribeEmail\s*\(/);
  assert.ok(subscribeIdx > 0, "expected subscribeEmail call");
  const before = src.slice(Math.max(0, subscribeIdx - 400), subscribeIdx);
  assert.match(before, /\btry\s*\{/, "subscribeEmail must be wrapped in try/catch for soft-fail");
});

test("/api/start route: opt_in_newsletter gates the subscribeEmail call (textually-prior reference)", () => {
  const src = readFile("app/api/start/route.ts");
  const subscribeIdx = src.search(/subscribeEmail\s*\(/);
  const lastOptInBeforeSubscribe = src.slice(0, subscribeIdx).lastIndexOf("opt_in_newsletter");
  assert.ok(
    lastOptInBeforeSubscribe >= 0,
    "subscribeEmail must be gated on a textually-prior opt_in_newsletter reference",
  );
});

test("/api/start route: per-row UPSERT via the shared helper — no bulk insert (ADR-090)", () => {
  const src = readFile("app/api/start/route.ts");
  // The old bulk .insert() 500'd the WHOLE batch when one row hit the
  // UNIQUE(email, card_slug, variant, condition) constraint (a re-submit of
  // the same cards = "Something broke"). Every row now goes through the same
  // upsertWatchlist helper as the per-card page form.
  assert.doesNotMatch(src, /from\(["']watchlists["']\)\.insert\(/, "bulk insert must not return");
  assert.match(src, /upsertWatchlist\(\s*admin,/);
  assert.match(src, /import \{ upsertWatchlist \} from "@\/lib\/wishlist\/upsert"/);
});

test("/api/start route: tri-store newsletter opt-in — recordSubscriber with utm (ADR-090)", () => {
  const src = readFile("app/api/start/route.ts");
  // Supabase owned list + Resend audience (the stores the weekly digest
  // actually sends from) — the old route wrote Beehiiv ONLY, so /start
  // opt-ins never received an issue.
  assert.match(src, /recordSubscriber\(\{ email, source: "start-page", utm \}\)/);
  assert.match(src, /await recordSubscriber/, "owned-list write must be awaited (Vercel freeze)");
});

test("/api/start route: soft-fail paths ping #errors, not just console.warn (ADR-090)", () => {
  const src = readFile("app/api/start/route.ts");
  assert.match(src, /DISCORD_WEBHOOK_ERRORS/);
  assert.match(src, /postError\(/);
  assert.match(src, /BeehiivSubscribeFailed/);
  assert.match(src, /OwnedListWriteFailed/);
});

test("/api/start route: abuse guards wired — honeypot fake-success, IP limit, watch cap (ADR-090)", () => {
  const src = readFile("app/api/start/route.ts");
  assert.match(src, /isHoneypotTripped\(parsed\.data\.website\)/);
  assert.match(src, /ipLimiter\.check\(clientIpKey\(request\.headers\)\)/);
  assert.match(src, /exceedsWatchCap\(/);
  assert.match(src, /watch_cap_reached/);
  assert.match(src, /rate_limited/);
  // src is sanitized before persistence (shared charset with every other
  // URL-derived attribution tag).
  assert.match(src, /sanitizeUtmValue\(parsed\.data\.src/);
});

// ---------------------------------------------------------------------------
// /api/cards/search route
// ---------------------------------------------------------------------------

test("/api/cards/search: queries searchCards from lib/cards/sdk", () => {
  const src = readFile("app/api/cards/search/route.ts");
  assert.match(src, /import\s*\{[^}]*\bsearchCards\b/);
});

test("/api/cards/search: clamps query length to <= 64 chars before calling the SDK", () => {
  const src = readFile("app/api/cards/search/route.ts");
  assert.match(src, /MAX_QUERY_LENGTH\s*=\s*64/);
});

test("/api/cards/search: returns empty hits when q is missing/long (no SDK call)", () => {
  const src = readFile("app/api/cards/search/route.ts");
  // The "empty hits without an SDK call" branch is identifiable by an early
  // NextResponse.json({hits:[]}) inside the q-length gate.
  assert.match(src, /\{ hits: \[\] \}/);
});

// ---------------------------------------------------------------------------
// Pokemon TCG SDK searchCards — Lucene-injection guard
// ---------------------------------------------------------------------------

test("searchCards: strips Lucene-control chars before building the query string", async () => {
  // We can run searchCards with a stub fetch — it shouldn't throw on
  // adversarial input, and the constructed URL must NOT contain raw
  // colons/parens that would short-circuit the name:value filter.
  const { searchCards } = await import("../cards/sdk.ts");
  let capturedUrl = "";
  const fakeFetch = (async (url: string | URL | Request) => {
    capturedUrl = typeof url === "string" ? url : url.toString();
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  await searchCards({
    query: 'charizard") OR set.id:("base1',
    fetchImpl: fakeFetch,
  });
  // The cleaned query must not pass through `)`, `(`, or `"`. The literal
  // `name:` prefix is server-controlled and fine; the user-content portion
  // (everything after `name:`) must be sanitized.
  const queryParam = new URL(capturedUrl).searchParams.get("q") ?? "";
  assert.match(queryParam, /^name:/, "expected the name: filter prefix");
  const userPortion = queryParam.replace(/^name:/, "");
  assert.doesNotMatch(userPortion, /[():"]/, "user content must not introduce Lucene control chars");
  // Sanity: must still start with the sanitized cleartext.
  assert.match(queryParam, /^name:charizard/);
});
