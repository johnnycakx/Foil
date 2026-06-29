# Next-Session Brief — 2026-06-29 — newsletter is LIVE; next = the ADR-082 manual hardening, then acquisition Phase 0

> Read this first: current state + the prioritized next plan. (Written by Cowork; commits run on John's machine.)

## Headline
The newsletter is **LIVE in production.** The weekly Discord `/approve` → branded, editorial, honesty-gated → Resend-broadcast → Gmail **Primary** loop was activated and smoke-tested end-to-end on 2026-06-29 (migrations applied; `NEWSLETTER_DIGEST_MODE=approval` + `NEWSLETTER_APPROVE_SECRET` [Vercel **and** Railway, sha-matched] + `RESEND_AUDIENCE_ID` set on prod; `a5652da` pushed + deployed green). A real issue ("Pikachu 151 just crossed $104") generated from live `market_movers`, posted a Discord approval card, and on `/approve` sent a Resend broadcast that **landed in John's Gmail Primary, 0 Promotions**. The maiden machine works. **The bottleneck now is acquisition — there are ≈0 real subscribers.**

## What's LIVE in prod now
- **The newsletter send loop** (NL-SEND/NL-EDIT-SHIP). Weekly cron `/api/cron/newsletter-digest` (Wed 14:13 UTC) generates the **editorial** issue (deterministic digest is the soft-fall), persists a draft, posts a Discord `#content-engine` `/approve` card; on `/approve <id>` the bot relays to `/api/newsletter/approve` → Resend broadcast to the `RESEND_AUDIENCE_ID` audience. List of record = Supabase `newsletter_subscribers`; Beehiiv = signup/archive only. Sends from `alerts@foiltcg.com`.
- SEO metadata de-stale + OG card-hero image (live). foil-bot recovered + a CI guard for bot slash-command descriptions.

## Still John-manual — the ADR-082 hardening (do BEFORE pushing acquisition)
Both are built + the code is deployed (`a5652da`); they need John's dashboard/DNS steps. Runbook: `docs/runbooks/newsletter-unsubscribe-and-subdomain.md`.
1. **Part A — unsubscribe webhook** (compliance; the one that matters before real subscribers): Resend dashboard → Webhooks → Add Endpoint `https://foiltcg.com/api/webhooks/resend`, events `contact.updated` + `email.complained` → copy the `whsec_…` → `vercel env add RESEND_WEBHOOK_SECRET production` → redeploy. Without it, a Resend unsubscribe is NOT mirrored to Supabase (source of truth) and the opted-out address could be re-mailed.
2. **Part B — `news.foiltcg.com` sending subdomain** (deliverability): `npm run setup:news-subdomain -- --create` → add the printed SPF/DKIM(×3 CNAME)/DMARC records at the registrar → verify in Resend → `vercel env add NEWSLETTER_FROM production` = `Foil <news@foiltcg.com>`. Until then sends use the verified `alerts@` (transactional reputation shared — fine at ≈0 volume).

## The real job now — acquisition Phase 0
The machine is built and live; it sends to ≈0 people. Every hour on tooling from here is lower-leverage than getting the first real subscribers. Prioritize:
1. **Turn on the funnel that already exists:** the homepage hero + blog/pillar inline `EmailCapture` write to `newsletter_subscribers`. Confirm the capture → audience → next-week's-send path works for a NON-John signup (the loop's been proven only on John's address).
2. **Drive traffic to it:** the X bot (dry-run-verified, John-manual go-live), the indexed content surfaces (GSC re-crawl window open), and a clear "subscribe for weekly good buys" CTA. The newsletter is now a real reason to subscribe — point at it.
3. Let a few real weekly sends accumulate clean deliverability, THEN graduate the `/approve` gate toward full-auto.

## Hard truths (don't relearn)
- **≈0 REAL subscribers.** Every "Primary" win so far is a self-send to John's own address — a strong deliverability signal, NOT product-market traction. Acquisition is the bottleneck, not tooling.
- **Auto-send runs on Resend Broadcasts, NOT Beehiiv** (Beehiiv RSS-to-Send is Max/Enterprise; Beehiiv = Scale, kept as signup/archive). Don't re-propose a Beehiiv upgrade.
- **Verify in prod, don't infer** (this session's wins came from it): the var readbacks were checked on Vercel/Railway not `.env.local`; the editorial engine was confirmed by the live `source:"editorial"` cron response; Primary placement by the actual `category:primary` Gmail query. The local `npm test` "Anthropic credit too low" failures are the LOCAL key only — prod's key has credits (the live editorial gen proved it).
- The `railway` CLI fights headless project resolution — use the backboard GraphQL API (`variables` query / `variableUpsert` mutation; service `2d0552e6-…`, project `08088ed2-…`, env `c1af4109-…`) for bot var reads/writes, not `railway variables`.
- When John sends only a screenshot → READ THE BOARD AND DIRECT, don't ask back.

## Standing
- **PokeTrace renews ~Jul 15** — load-bearing for the whole insight engine (the newsletter's content source). Watch it.
- `AUTO_PUBLISH_WEEKLY_POSTS` intentionally ON.
- The smoke test consumed the `2026-W27` draft slot (delivered to John); the real Wed cron will see it exists → no duplicate. Normal sends resume W28+.
- Cowork CANNOT commit/push and CANNOT drive the Claude Code terminal — hand John the `docs:` one-liner + `/goal` pastes.

## Uncommitted at session end
The activation push (`a5652da`) already happened. This brief + SESSION-LOG + ROADMAP are the `docs:` commit for this session.
