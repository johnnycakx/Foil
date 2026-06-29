# Next-Session Brief — 2026-06-28 — newsletter built end-to-end (never-sent → amazing & proven); go-live is next session

> Read this first: current state + the prioritized next plan. (Written by Cowork; commits run on John's machine.)

## Headline
Today the newsletter went from **never having sent a single issue** to a **fully-built, self-sending, brand-designed, editorially-amazing machine — all proven, none of it live yet.** The whole thing is 5 committed-not-pushed commits + a one-goal final assembly away from going live. Go-live is the clean next-session job (it includes the env-mirroring push, which deserves fresh attention).

## What's LIVE (pushed earlier today)
- **SEO metadata de-stale** (`4d0302b`) + **OG card-hero image** (`837743e`) — pushed + deployed. Fixed the wrong `@foilcards`→`@Johnnycakx` handle, killed stale "scanner" framing on the indexed Japanese pillar, branded the social link-preview. (The morning's SEO crawl fix `668efbe` is also live — card pages 37.9s→1.8s TTFB; GSC re-crawl window is open, watch indexation over the next 2-4 weeks.)

## What's BUILT but NOT pushed — 5 commits, the whole newsletter system
In stack order:
- `ba2d0c5` — `/approve`→deliver rail (Discord approval, parity with the X bot).
- `01eec73` — **own the SEND via Resend Broadcasts** (fully automated, NO Beehiiv upgrade; verified 6 real sends to John's Primary inbox). List of record = Supabase `newsletter_subscribers`, mirrored to a Resend Audience; Beehiiv kept only as signup-form/archive.
- `18905e7` — branded **react-email** template (cream/navy/gold), verified 4/4 Gmail **Primary**, 0 Promotions.
- `027a57b` — the **editorial blueprint** (`docs/knowledge/newsletter-editorial-blueprint.md`) — what makes the newsletter AMAZING.
- `7763176` — the **editorial engine** (data + WHY + John's seller CALL), honesty-gated. Measured: picks-with-why 0→11/12, verdicts 12/12, all hedged; honesty gates fired in the retry loop (caught fabricated figures + unhedged causal claims). Proven to `_pending/editorial-2026-06-29.md`.

## The go-live path (the prioritized plan — next session)
1. **NL-EDIT-SHIP** (goal spec written: `docs/goals/newsletter-edit-ship-wire-cron-template.md`) — the final assembly. The editorial engine is proven to `_pending` but NOT wired in: the cron still calls the deterministic digest and the template renders the old structure, so a live send today would be the OLD anonymous data table. This goal wires the cron → editorial engine (soft-falling to the deterministic digest on 3-strike, so a generation failure never blocks a send) + renders the new segments (Big Move / Seller's Note / $50 Call) in the template, re-tested Primary-safe.
2. **Harden the send** (goal spec written: `docs/goals/newsletter-harden-subdomain-unsubscribe.md`) — Resend-unsubscribe→Supabase sync webhook (compliance: an opt-out must propagate across all 3 stores) + a `news.foiltcg.com` sending subdomain. Do BEFORE real subscribers.
3. **ONE push + activation (John-attended):** apply migrations (`supabase db push`) + set `RESEND_AUDIENCE_ID` / `NEWSLETTER_DIGEST_MODE=approval` / `NEWSLETTER_APPROVE_SECRET` on Vercel prod + the secret on Railway via the authenticated CLIs (NOT just `.env.local` — the silent-no-op trap) + push the stack. Then the weekly Discord `/approve` → branded, editorial, auto-send loop is LIVE.

## The strategic spine (why this mattered)
Every Pokémon price tracker has the same gainers/droppers data Foil has; none is a beloved newsletter because none supplies the WHY + a judgment. That gap IS the product, and John (Level-4 seller) is the one voice an API can't replicate. The editorial engine encodes exactly that (MOVE→WHY→CALL, John's seller voice, signature segments). North star = grow the owned list; the newsletter is finally a product worth subscribing to.

## Hard truths to carry forward (don't relearn)
- **Subscriber reality: ~0 REAL subscribers.** The handful in Beehiiv/Resend are John's own + test addresses. Deliverability "Primary" wins so far are self-sends — strong signal, not a final verdict. The real bottleneck is acquisition, not tooling.
- **Auto-send runs on Resend Broadcasts, NOT Beehiiv.** Beehiiv RSS-to-Send is Max/Enterprise; the Send API is Enterprise. We own the send via Resend instead (on Scale we already pay for). Don't re-propose a Beehiiv upgrade for auto-send.
- **Beehiiv = Scale.** (Confirmed by John 2026-06-28. The `SEND_API_NOT_ENTERPRISE_PLAN` 403 is an Enterprise gate, not free-vs-Scale.)
- **The "why" in the newsletter is interpretive, hedged — never asserted as fact** (honesty gates enforce it). This protects credibility; keep it.

## Standing
- **PokeTrace renews ~Jul 15** — load-bearing for the whole insight engine (movers, /deals, card pages, X, newsletter data). Watch it.
- `AUTO_PUBLISH_WEEKLY_POSTS` intentionally ON.
- Sole-committer rule: don't edit tracked files while Claude Code/the runner is mid git-op (stash/commit/reset); pushes are tree-safe.
- Cowork CANNOT commit/push and CANNOT drive the Claude Code terminal — hand John the `docs:` one-liner + the `/goal` pastes.
- When John sends only a screenshot, READ THE BOARD AND DIRECT — don't ask "what's next?" back.

## Uncommitted at session end (hand John the docs commit)
This brief + today's blueprint placement are in the working tree. The SESSION-LOG / ADRs / COWORK-CONTEXT were committed by each goal. Hand John one `docs:` commit for this brief (the blueprint already committed as `027a57b`).
