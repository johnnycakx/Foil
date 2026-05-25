# Foil — eBay API Compliance

**Status:** Living document. Last updated 2026-05-25 (Session 34). Maintenance protocol at the bottom.

## a. Purpose & audience

This is the single readable artifact that ties every eBay API requirement Foil agreed to (2025 License Agreement, Buy APIs program terms, Marketplace Account Deletion compliance, EPN agreement) to (i) the code path that enforces it and (ii) the test that pins it. The compliance posture *exists* across [`ADR-021`](DECISIONS.md#adr-021--epn-as-v1-live-listing-source-browse-api-deferred) / [`ADR-022`](DECISIONS.md#adr-022--marketplace-account-deletion-compliance-via-subscribe-path-over-exemption) / [`ADR-023`](DECISIONS.md#adr-023--browse-api-client-ships-libaffiliatelinksts-multi-source-selector-deferred-until-tcgplayer-access-lands) / [`ADR-024`](DECISIONS.md#adr-024--wishlist-alert-cron-on-vercel-cron-jobs-vs-github-actions-or-supabase-edge-functions) / [`ADR-025`](DECISIONS.md#adr-025--browse-call-telemetry-operational-metadata-only-no-listing-payload) + [`R-008`](RISKS.md#r-008--ebay-2025-license-agreement-ai-output--no-cache-compliance), but it's scattered. Three audiences read this doc:

1. **eBay reviewers** — Application Growth Check submission body links here; the public `/legal/ebay-api-compliance` page is a public summary of this doc. A reviewer should be able to grep this file, click any file:line, and see the enforcement themselves.
2. **Future agents (human or LLM)** — referenced from [`AGENTS.md` external-platform-rules](../AGENTS.md). Before touching any eBay code path, read this first.
3. **John** — single page he can read in 5 minutes to remember the full posture.

## b. Architecture overview

**Single import boundary, render-time fetch, zero listing persistence.**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Foil deal-finder request flow                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   visitor                                                               │
│      │                                                                  │
│      ▼                                                                  │
│   /cards/[slug]   ───[ force-dynamic, no caching ]───┐                  │
│      │                                                ▼                 │
│      │                              lib/affiliate/ebay-browse.ts        │
│      │                                  ├─ getAccessToken() ──┐         │
│      │                                  │     (OAuth ccg)     ▼         │
│      │                                  │      lib/affiliate/ebay-oauth.ts
│      │                                  │            │                  │
│      │                                  │            ▼                  │
│      │                                  │   api.ebay.com/identity/v1    │
│      │                                  │   ↑ ONLY caller of this URL   │
│      │                                  ▼                               │
│      │                          fetch GET item_summary/search           │
│      │                          (cache:'no-store',                      │
│      │                           X-EBAY-C-MARKETPLACE-ID: EBAY_US)      │
│      │                                  │                               │
│      │                                  ▼                               │
│      │                          api.ebay.com/buy/browse/v1              │
│      │                          ↑ ONLY caller of this URL               │
│      │                                  │                               │
│      │                          ┌───────┴───────┐                       │
│      │                          ▼               ▼                       │
│      │             buildAffiliateUrl()   void logBrowseCall()           │
│      │             from epn.ts           fire-and-forget                │
│      │             (mkevt/campid/        operational metadata           │
│      │              customid)            only — no payload              │
│      │                                                                  │
│      ▼                                                                  │
│   page render                                                           │
│   ↑ result discarded after response. NO database persist.               │
│                                                                         │
│                                                                         │
│   Marketplace Account Deletion:                                         │
│     eBay  ───POST/GET───►   /api/webhooks/ebay-marketplace-deletion     │
│                              (HMAC-SHA256 verify + 200 ack — discard)   │
│                                                                         │
│   Telemetry rollup:                                                     │
│     /api/cron/browse-telemetry  ───►   browse_calls table               │
│                                        (id, called_at, surface,         │
│                                         success, latency_ms — that's    │
│                                         the whole schema)               │
└─────────────────────────────────────────────────────────────────────────┘
```

Two facts the architecture enforces structurally:

- **Single import boundary for `api.ebay.com`.** Only `lib/affiliate/ebay-browse.ts` (for `/buy/browse/v1/...`) and `lib/affiliate/ebay-oauth.ts` (for `/identity/v1/oauth2/token`) ever construct an `api.ebay.com` URL or fetch from it. Pinned by [`lib/__tests__/ebay-compliance-invariants.test.ts`](../lib/__tests__/ebay-compliance-invariants.test.ts) — any `api.ebay.com` occurrence outside those two files + the test files fails CI.
- **Single import boundary for affiliate URL construction.** Only `lib/affiliate/epn.ts::buildAffiliateUrl` (and the EPN-internal constants it composes with) ever assemble `mkevt`/`mkcid`/`mkrid`/`campid`/`customid` tracking params. Pinned by the same invariants file.

---

## c. Requirement → Enforcement → Test

Every row maps a contractual eBay requirement to (i) the exact file:line that enforces it and (ii) the test that fails on regression. Spot-check any row by clicking through.

| # | Requirement (source) | Enforced at (file:line) | Pinned by test |
|---|---|---|---|
| 1 | **2025 License Agreement — no caching of listing payloads.** Listing data may not be persisted in any cache, database, or other storage. | `cache: "no-store"` on every Browse GET — [`lib/affiliate/ebay-browse.ts:92`](../lib/affiliate/ebay-browse.ts). `force-dynamic` on the consuming page — [`app/(site)/cards/[slug]/page.tsx:20`](../app/(site)/cards/[slug]/page.tsx). Repo has zero `cached_listings`-style tables (audit: `ls supabase/migrations/` shows only `watchlists`, `browse_calls`, `subscriptions`, etc. — no listing-payload schema). | [`lib/__tests__/ebay-compliance-invariants.test.ts`](../lib/__tests__/ebay-compliance-invariants.test.ts) → "ebay-browse.ts contains cache: 'no-store'" + "/cards/[slug] page exports dynamic = 'force-dynamic'". |
| 2 | **2025 License Agreement — no AI training on eBay data.** Listing payloads / titles / prices may not be used as inputs to model training, prompt-engineering corpora, or content-generation pipelines. | Architectural absence. The content engine (`lib/seo/*`) never imports anything from `lib/affiliate/*` and never calls `api.ebay.com`. The autonomy pipeline's prompts (`lib/seo/content-engine.ts`) describe cards at category level (set, print run, history) — not specific live listings. | [`lib/__tests__/ebay-compliance-invariants.test.ts`](../lib/__tests__/ebay-compliance-invariants.test.ts) → "api.ebay.com appears ONLY in ebay-browse.ts + ebay-oauth.ts" (regex grep across all of `lib/` and `app/`). |
| 3 | **2025 License Agreement — no AI-generated claims about specific listings.** AI-authored copy may not pre-bake prices, seller names, or item-specific details. | Editorial paragraphs on `/cards/[slug]` describe the *card* (set, release date, rarity, history) — see [`app/(site)/cards/[slug]/page.tsx`](../app/(site)/cards/[slug]/page.tsx) "About this card" block. The "Best current listing" block is self-describing from the Browse response at render time; price / title / image are read directly from the response shape and re-fetched every load (R-008 mitigation #4). | Same row as #1 — `force-dynamic` is the structural guard. |
| 4 | **Marketplace Account Deletion — public webhook required.** Production keysets that don't subscribe to deletion notifications (or apply for an exemption) are disabled. | Webhook route: [`app/api/webhooks/ebay-marketplace-deletion/route.ts`](../app/api/webhooks/ebay-marketplace-deletion/route.ts). Pure helpers in [`lib/ebay-marketplace-deletion.ts`](../lib/ebay-marketplace-deletion.ts): `challengeResponseHash` (:53), `handleChallenge` (:75), `parseSignatureHeader` (:119), `fetchEbayPublicKey` (:172), `verifyNotificationSignature` (:236, **ECDSA** against eBay's public key — rewritten Session 34), `handleNotification` (:280). Endpoint URL `https://foiltcg.com/api/webhooks/ebay-marketplace-deletion` registered in eBay developer portal 2026-05-24. | [`lib/__tests__/ebay-marketplace-deletion.test.ts`](../lib/__tests__/ebay-marketplace-deletion.test.ts) — 24 tests pinning challenge-hash fixture, ECDSA verify against a generated P-256 key, GET/POST status paths, header-parse edge cases, public-key-fetch failure. [`lib/__tests__/ebay-webhook-env-integrity.test.ts`](../lib/__tests__/ebay-webhook-env-integrity.test.ts) pins the route's env-var dependency surface. |
| 5 | **Marketplace Account Deletion — handler must respond within 3 seconds, must not persist user data.** | GET (challenge) is synchronous — no DB writes, no outbound fetches. POST does one OAuth token fetch (module-cached ~2h) + one public-key fetch (in-memory cached by `kid` ~1h) — steady-state POST is sub-ms ECDSA verify. POST returns `{ acknowledged: true }` and discards the payload. See `route.ts` + the "ack and discard" comment in `handleNotification` ([`lib/ebay-marketplace-deletion.ts:280`](../lib/ebay-marketplace-deletion.ts)). | Same test file — "handleChallenge completes synchronously — no awaited externals" pins the GET-side no-I/O property. POST's async-but-bounded behavior is covered by the ECDSA verify tests. |
| 6 | **Browse API auth — `client_credentials` grant with application scope only.** Foil's app-level Browse access uses no user-context scopes (no `sell.*`, no `commerce.*`, no fulfillment). | OAuth token endpoint: [`lib/affiliate/ebay-oauth.ts:25`](../lib/affiliate/ebay-oauth.ts). Scope literal: [`lib/affiliate/ebay-oauth.ts:26`](../lib/affiliate/ebay-oauth.ts) — `https://api.ebay.com/oauth/api_scope` (the public Browse scope, no other scopes requested). Grant body: [`lib/affiliate/ebay-oauth.ts:61`](../lib/affiliate/ebay-oauth.ts). | [`lib/__tests__/ebay-oauth.test.ts`](../lib/__tests__/ebay-oauth.test.ts) — pins Basic-auth header, urlencoded body shape, scope verbatim. |
| 7 | **Browse-call telemetry — operational metadata only, no listing payload.** Telemetry that informs the Application Growth Check submission must not itself violate the no-cache requirement. | Schema: [`supabase/migrations/20260524204327_browse_calls.sql:14-19`](../supabase/migrations/20260524204327_browse_calls.sql) — exactly four columns (`called_at`, `surface`, `success`, `latency_ms`) + `id` primary key. The `logBrowseCall` API shape ([`lib/telemetry/browse-calls.ts:57`](../lib/telemetry/browse-calls.ts)) has no parameter for a price / title / URL / card identifier. Service-role RLS only (policy lines 32-39 of the migration). See [`ADR-025`](DECISIONS.md#adr-025--browse-call-telemetry-operational-metadata-only-no-listing-payload). | [`lib/__tests__/ebay-compliance-invariants.test.ts`](../lib/__tests__/ebay-compliance-invariants.test.ts) → "browse_calls migration has exactly {id, called_at, surface, success, latency_ms}". |
| 8 | **EPN affiliate attribution — every outbound eBay click stamped with campaign + custom id.** | Single source of truth: [`lib/affiliate/epn.ts::buildAffiliateUrl`](../lib/affiliate/epn.ts) (line 168). Tracking-param constants: [`lib/affiliate/epn.ts:23-28`](../lib/affiliate/epn.ts). `customid` per-surface: `foil-card-page` (page render), `foil-wishlist-alert` (cron). `EBAY_CAMPAIGN_ID` env var: [`docs/ENV-VARS.md`](ENV-VARS.md#active). | [`lib/__tests__/ebay-compliance-invariants.test.ts`](../lib/__tests__/ebay-compliance-invariants.test.ts) → "raw mkevt/campid param assembly appears ONLY in epn.ts" (grep guard). Also [`lib/__tests__/epn.test.ts`](../lib/__tests__/epn.test.ts) pins the tracking-param set + soft-fail when campaign id missing. |
| 9 | **Browse API rate limits — default 5,000 calls/day, must not exceed quota.** | Per-cron-run cap: [`lib/wishlist/scan-batch.ts:29`](../lib/wishlist/scan-batch.ts) — `MAX_BROWSE_CALLS = 200` (200 × 24 hourly runs = 4,800 + 200 headroom for page renders). Daily summary surfaces `approachingCeiling: true` at ≥ 80% of 5,000: [`lib/telemetry/browse-calls.ts`](../lib/telemetry/browse-calls.ts) `aggregateLast24h`. Application Growth Check submission pending — see [`ROADMAP NOW #10`](ROADMAP.md#now--this-week--2026-05-27). | [`lib/__tests__/wishlist-scan-batch.test.ts`](../lib/__tests__/wishlist-scan-batch.test.ts) — "respects the Browse-call cap and reports capHit=true". [`lib/__tests__/browse-calls-telemetry.test.ts`](../lib/__tests__/browse-calls-telemetry.test.ts) — "approachingCeiling=true at the 80% threshold". |
| 10 | **Marketplace ID required on Buy API calls.** | [`lib/affiliate/ebay-browse.ts:66`](../lib/affiliate/ebay-browse.ts) — `X-EBAY-C-MARKETPLACE-ID: EBAY_US` header on every Browse fetch. | [`lib/__tests__/ebay-browse.test.ts`](../lib/__tests__/ebay-browse.test.ts) — "GETs item_summary/search with Bearer + EBAY_US marketplace + no-store cache". |
| 11 | **Credentials must not be logged or surfaced to clients.** | OAuth helper never logs `EBAY_DEVELOPER_APP_ID` / `EBAY_DEVELOPER_CERT_ID` or the access token. The token itself is held in module-level cache only ([`lib/affiliate/ebay-oauth.ts`](../lib/affiliate/ebay-oauth.ts) `cached` variable). No env-var references appear in any `app/*` client component (Browse module is server-only). | Manual inspection — `grep -r "console" lib/affiliate/ebay-*.ts` returns zero matches. |
| 12 | **No fallback to scraping eBay search HTML.** The 2025 License Agreement explicitly treats automated scraping as a violation. | Architectural absence. The only URL Foil constructs to `*.ebay.com` outside `api.ebay.com` is `https://www.ebay.com/sch/i.html` via `affiliateSearchUrl` ([`lib/affiliate/epn.ts:187`](../lib/affiliate/epn.ts)) — but that's a navigable affiliate-tracked link for the visitor's browser (sponsored CTA fallback), not a server-side fetch. No `fetch(...ebay.com...)` outside `lib/affiliate/ebay-browse.ts`. | [`lib/__tests__/ebay-compliance-invariants.test.ts`](../lib/__tests__/ebay-compliance-invariants.test.ts) → "api.ebay.com" grep guard. Manual: `grep -r "fetch.*ebay.com" lib/ app/` shows only `lib/affiliate/ebay-browse.ts`. |

---

## d. Audit checklist

Use this list as a 5-minute spot-check before any eBay-touching deploy, or quarterly as a discipline pass.

- [ ] `npm run compliance:check` exits 0
- [ ] `grep -r "api.ebay.com" lib/ app/ --include='*.ts' --include='*.tsx' | grep -v __tests__` returns only `lib/affiliate/ebay-browse.ts`, `lib/affiliate/ebay-oauth.ts`, `lib/ebay-marketplace-deletion.ts` (Notification API getPublicKey), and `lib/legal/ebay-compliance-content.ts` (reviewer-facing prose, not code)
- [ ] `grep -r "mkevt\|campid" lib/ app/ --include='*.ts' --include='*.tsx' | grep -v __tests__` returns only `lib/affiliate/epn.ts`
- [ ] `lib/affiliate/ebay-browse.ts` contains the string `cache: "no-store"` exactly once per fetch site (currently 1 site, line 92)
- [ ] `app/(site)/cards/[slug]/page.tsx` exports `dynamic = "force-dynamic"` (line 20)
- [ ] `app/api/webhooks/ebay-marketplace-deletion/route.ts` exists and returns 200 for a valid challenge
- [ ] `supabase/migrations/*browse_calls.sql` schema has exactly five columns; no `title` / `price` / `url` / `card_slug` columns
- [ ] `lib/seo/*` does NOT import anything from `lib/affiliate/*` — `grep -l "lib/affiliate" lib/seo/*.ts` returns nothing
- [ ] No env var referenced in `lib/affiliate/ebay-*` is also present in any `app/components/*` or other client surface (Browse module is server-only)
- [ ] `vercel.json` `crons[]` includes `/api/cron/wishlist-alerts` (hourly) and `/api/cron/browse-telemetry` (daily 06:00 UTC)
- [ ] eBay developer portal → Alerts & Notifications → foil → Production shows keyset "compliant"
- [ ] Browse-call telemetry from the last 14 days shows steady non-zero activity (proves the integration is live, not just plumbed)
- [ ] No `cached_listings`, `cached_browse_results`, or similar table exists in `supabase/migrations/`
- [ ] The "About this card" editorial copy on a sample `/cards/<slug>` describes the *card* (set, history) — no specific listing prices, sellers, or item-IDs verbatim
- [ ] `git log --all --oneline -- lib/affiliate/ebay-*.ts` shows commits trace cleanly to the documented ADRs

---

## e. Maintenance protocol

Update this doc in the **same commit** when any of these change:

1. **New Browse-touching code path lands.** A new file that calls `api.ebay.com` requires the invariants test exception list to update AND a new row (or modified row) in section c.
2. **New eBay endpoint added.** New Buy APIs scope, new auth flow, new webhook — each maps to a new requirement row.
3. **`browse_calls` schema column added or removed.** Section c row #7 + the invariants test must update together. Adding a payload-shaped column (title, price, etc.) is a compliance regression — the migration should be rejected at code review.
4. **New ADR added in the ADR-021..025 family.** Reference it in section a and the relevant section c row.
5. **eBay sends a notice about the affiliate account.** Update the status line at the top; document the response in the maintenance log below.

### Maintenance log

| Date | Change | Session |
|---|---|---|
| 2026-05-24 | Initial doc | Session 32 |
| 2026-05-24 | Public mirror landed at `/legal/ebay-api-compliance`. Content sourced from `lib/legal/ebay-compliance-content.ts`; drift-detection test pins the page-to-doc sync. The content module references `api.ebay.com` in reviewer-facing prose, so it's added to the structural-invariants `EBAY_API_ALLOWED_FILES` allowlist as a documentation-only exception (no integration code). | Session 33 |
| 2026-05-25 | **POST-notification verification rewrite.** `lib/ebay-marketplace-deletion.ts::verifyNotificationSignature` was previously an HMAC-SHA256 keyed on `EBAY_DELETION_VERIFICATION_TOKEN` — not eBay's actual spec. Real spec (per `developer.ebay.com/marketplace-account-deletion` + `github.com/eBay/event-notification-nodejs-sdk`): base64-decode the `x-ebay-signature` header → JSON `{ alg, kid, signature, digest }` → fetch eBay's public key from `api.ebay.com/commerce/notification/v1/public_key/{kid}` (OAuth client_credentials, api_scope) → ECDSA-verify the raw body with `crypto.createVerify('sha1')`. Rewrite ships in `lib/ebay-marketplace-deletion.ts`; in-memory PEM cache by kid (~1h TTL); `__resetPublicKeyCacheForTests` escape hatch. New file added to `EBAY_API_ALLOWED_FILES` in invariants test + `scripts/compliance-check.ts`. POST handler no longer depends on the verification token. New env-integrity drift guard at `lib/__tests__/ebay-webhook-env-integrity.test.ts`. R-009 escalated Low→Medium (second occurrence in 14d); new R-010 added (self-consistent tests don't prove spec conformance). | Session 34 |
