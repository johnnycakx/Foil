# Next-Session Brief — 2026-06-29 — newsletter fully built & verified live; GO-LIVE is the next job

> Read this first: current state + the prioritized next plan. (Written by Cowork; commits run on John's machine.)

## Headline
The newsletter is **fully assembled and verified working end-to-end** — never-sent → a branded, editorial, honesty-gated, self-sending machine that landed 4/4 in Gmail **Primary** on the live test. It is **committed and pushed but DORMANT** (env-gated off). The only thing between here and a live, autonomous, amazing weekly newsletter is the **go-live**: the harden goal + the activation push. That's the next session's job — done fresh, because it's the env-mirroring-to-prod step that's the costly one.

## What's LIVE in prod now
- SEO metadata de-stale + OG card-hero image (pushed earlier). Crawl fix live (card pages 37.9s→1.8s); GSC re-crawl window open — watch indexation over 2-4 weeks.
- **foil-bot recovered** (`b8f1647`). It crash-looped after a push because a `/approve` slash-command description was 104 chars (Discord caps at 100, validated at module load) + had an em dash. Fixed (descriptions trimmed) + a **CI guard test** (`lib/__tests__/bot-slash-commands.test.ts`) now reads the bot source and fails in `npm test` if any description >100 chars or has an em dash. Railway redeploy confirmed green. **Lesson: the main `tsc`/`npm test` gates don't cover the bot (separate project, strip-types, no typecheck) — bot-specific constraints slip to prod unless a source-reading guard test catches them.**

## The newsletter system — built, verified, DORMANT (all pushed)
Commits `ba2d0c5` → `16e51c7`, all on origin:
- `/approve` rail + **own the SEND via Resend Broadcasts** (no Beehiiv upgrade; 6 real Primary-verified sends). List of record = Supabase `newsletter_subscribers`, mirrored to a Resend Audience; Beehiiv = signup-form/archive only.
- Branded **react-email** template (cream/navy/gold), Primary-safe.
- **Editorial blueprint** (`docs/knowledge/newsletter-editorial-blueprint.md`) + **editorial engine** (data + WHY + John's seller CALL, honesty-gated; the "why" is hedged/interpretive, never asserted as fact).
- **NL-EDIT-SHIP** (`16e51c7`): editorial engine wired into the live send via `lib/newsletter/digest-compose.ts` (editorial-first → deterministic **soft-fall** on 3-strike/error) + `emails/editorial-digest-email.tsx` (the 8 segments, Primary-safe). Live test: 4 editorial issues + 1 forced-fallback → 4/4 Primary, voice + honesty intact, 12 affiliate links tagged, soft-fall proven.

## GO-LIVE — the next session's prioritized plan
1. **Harden the send** (`docs/goals/newsletter-harden-subdomain-unsubscribe.md`) — Resend-unsubscribe→Supabase sync webhook (an opt-out must propagate across all 3 stores; compliance) + a `news.foiltcg.com` sending subdomain. Land BEFORE real subscribers.
2. **The activation push (John-attended, fresh, careful):** apply migrations (`supabase db push`); set `NEWSLETTER_DIGEST_MODE=approval` + `NEWSLETTER_APPROVE_SECRET` + `RESEND_AUDIENCE_ID` on **Vercel prod AND the bot's Railway** via the authenticated CLIs (NOT just `.env.local` — the silent-no-op trap that bit us 3× on 2026-06-28); push. Verify each var reads back from prod.
3. Result: the weekly Discord `/approve` → branded, editorial, auto-send loop is LIVE. First real send goes to John's own backfilled address (≈0 real external subs), so it's a safe maiden run. Then graduate toward full-auto after a few clean weeks.

## Hard truths (don't relearn)
- **≈0 REAL subscribers.** The few in Beehiiv/Resend are John's own/test addresses. "Primary" wins so far are self-sends — strong signal, not a verdict. The real bottleneck is acquisition, not tooling.
- **Auto-send runs on Resend Broadcasts, NOT Beehiiv** (Beehiiv RSS-to-Send is Max/Enterprise; Send API is Enterprise). Beehiiv = Scale. Don't re-propose a Beehiiv upgrade.
- **Verify in prod, don't infer.** Repeatedly today, "should be fixed/clean" ≠ "is fixed": the bot "clean code" read was wrong (the real crash log was authoritative); plan-tier capabilities must come from the vendor's current docs, not memory. Pull the live signal.
- When John sends only a screenshot → READ THE BOARD AND DIRECT, don't ask back. Terminal "push it"/option prompts in a screenshot are Claude Code's suggestions, not John's decisions — evaluate them.

## Standing
- **PokeTrace renews ~Jul 15** — load-bearing for the whole insight engine. Watch it.
- `AUTO_PUBLISH_WEEKLY_POSTS` intentionally ON.
- Cowork CANNOT commit/push and CANNOT drive the Claude Code terminal — hand John the `docs:` one-liner + `/goal` pastes.
- Sole-committer: don't edit tracked files while Claude Code is mid git-op; pushes are tree-safe.

## Uncommitted at session end (hand John the docs commit)
This brief is in the working tree. SESSION-LOG / ADRs / COWORK-CONTEXT were committed by each goal. Hand John one `docs:` commit for this brief.
