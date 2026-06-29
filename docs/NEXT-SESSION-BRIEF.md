# Next-Session Brief — 2026-06-29 (late) — newsletter LIVE; the real question is now the CONVERSION MODEL, not more build

> Read this first: current state + the prioritized next plan. (Written by Cowork; commits run on John's machine.)

## Headline
The newsletter went from never-sent → **live, editorial, honesty-gated, Primary-verified, hardened, and attributed** today — a genuinely strong machine. But the session's real conclusion is strategic: **the bottleneck is not the quality of the build, it's that ~0 real humans are using it.** We kept building infrastructure ahead of audience (newsletter, attribution, channel policy) — all good work, none of it moves the only scoreboard that matters (subscribers/revenue). **Next session is a DECISION session, not a build session:** pick the conversion model, then commit to the cheapest path to the first real conversion signal. Everything downstream — the $1K spend, what to build, what's worth perfecting — is gated on that decision.

## What's LIVE in prod now
- **Newsletter `/approve` → editorial → Resend-broadcast loop is LIVE** (ADR-078/080/081/082/083). Real editorial issue ("Pikachu 151 just crossed $104") landed 4/4 Gmail Primary; unsubscribe sync verified across Supabase/Resend/Beehiiv (the live test caught + we fixed a real Beehiiv no-op bug — ADR-083; Resend is now the sole unsubscribe surface, Beehiiv passive). Sends from `alerts@foiltcg.com`; weekly Wed 14:13 UTC cron.
- **Phase 0 funnel attribution is LIVE** (ADR-084): `/deals` has a strong board-tied email capture; UTM→source captured on every signup (sanitized, sticky first-touch); `npm run subscriber-sources` reads conversion-by-channel; UTM cheat-sheet at `docs/runbooks/acquisition-utm.md`.
- Anthropic credits topped up + **auto-reload ON** (whole autonomous stack unblocked; the morning "API off" email was real, now resolved).

## Shipped today (3 commits UNPUSHED — see audit)
ADR-082 hardening (`a5652da`, pushed) · ADR-083 Beehiiv fix (`8597d1f`, pushed) · ADR-084 Phase 0 (`3ca0f44`, pushed) · ADR-085 Postiz channel-safety policy (Postiz parked, policy layer built).
**UNPUSHED:** `5907d68` (await recordSubscriber — reliability), `b1997db` + `4983152` (Postiz park + policy). → push these.

## AUDIT — what slipped through the cracks
**No-regret quick wins (do regardless of the model decision):**
1. **Push the 3 unpushed commits** (`5907d68`, `b1997db`, `4983152`).
2. **Add a visible "Follow on X" link/widget** — CONFIRMED missing; `@Johnnycakx` exists only in OG metadata, no visible follow CTA anywhere. Closes the site→X funnel loop (visitors → followers → compounding). Small build: footer/nav link + optional embedded follow button.
3. **Extend the Sunday acquisition-review scheduled task** to track 4 compounding leading indicators (GSC impressions/clicks WoW, X engagement vs. baseline, channel members, list growth) + CPA-per-arm once paid runs. (Cowork can do this directly.)

**Parked, pre-FIRST-REAL-SUBSCRIBER (not urgent at ~0 subs; do before real ones land):**
4. Part B — `news.foiltcg.com` sending subdomain (DNS; runbook `newsletter-unsubscribe-and-subdomain.md`).
5. Pause the Beehiiv "Foil welcome" automation (R-059; manual dashboard toggle — automations API is read-only).

**Queued goal specs, NOT executed (deliberately deferred):**
6. `graduate-newsletter-x-to-autonomous.md` — removes the last weekly human gates; build when ready.
7. `owned-deal-channel-scenario-a.md` — free owned Discord/Telegram deal channel; **shelved pending audience validation** (don't build a channel for 0 members).
8. `postiz-multichannel-autosyndication.md` — parked; resumes when John does the Postiz account + OAuth (runbook `postiz-syndication-setup.md`).

## THE prioritized next step — decide the conversion model (first 10 min of next session)
Three options; recommendation = freemium:
- **(A) Free list + affiliate** (current default): low-leverage to *pay* for (free subs monetize at cents, LTV unproven).
- **(B) Free → paid tier (FREEMIUM) — RECOMMENDED:** free list/deal-channel for reach + affiliate; a paid tier (faster/better/filtered alerts) as the real revenue. Delivery secondary (on-site Stripe vs a Whop-gated Discord — Whop is the fast paid-Discord path). The high-leverage thing to *pay* to acquire is a paying customer.
- **(C) Paid product first:** direct revenue, but zero proof of demand yet.

**The honest sequence (the $1K is the LAST step):**
1. **Prove the free product converts — organically, $0.** Founder distribution (Reddit/Discord value-first + X engagement) + the attribution we built. Does `/deals` convert a real human to an *engaged* sub? This one number gates everything.
2. **Probe willingness-to-pay cheaply** — the $59 founding-member link exists (zero build); or a Whop-gated Discord.
3. **Build the paid tier** for whichever segment shows demand (the *flipper/investor* segment has real WTP — Foil's "below sold-average" signal is a flip tool; collectors pay less readily).
4. **THEN deploy the $1K** (`docs/PAID-ACQUISITION-VALIDATION-2026-06-29.md`: lean 2-arm test, Reddit ads primary + small X *traffic* campaign; measure CPA + engagement; scale the winner).

**Single clearest action for John between sessions:** get the first real humans in front of Foil this week (the Monday distribution kit is scheduled — post it for real) and watch `subscriber-sources`. That signal, not more build, makes the next decision real.

## Hard truths (don't relearn)
- **Building ahead of audience is the trap we hit all session.** Perfect-before-validation causes rework + burns the $20K/October runway. Perfect the hard-to-reverse + trust-critical (brand, data accuracy, editorial honesty); ship "good enough to learn" on everything whose right shape needs real users to reveal.
- **Paying for free subs is low-leverage; pay to acquire PAYING customers** — but that needs a validated paid product first.
- **Reddit/Discord auto-posting into others' communities = bans** (CQS shadowban ~2h, proven). Safe automation = OWN channels (Telegram/Discord-webhook/Bluesky/Mastodon/X-API) + paid Reddit *ads*. Owned channels RETAIN/CONVERT, they don't DISCOVER.
- **Verify irreversible side-effects LIVE, not just on green tests** (the Beehiiv unsubscribe no-op passed unit tests; only the live unsubscribe caught it).

## Standing
- **PokeTrace renews ~Jul 15** (load-bearing; reminder scheduled Jul 13).
- `AUTO_PUBLISH_WEEKLY_POSTS` intentionally ON.
- Scheduled tasks: daily GSC indexing, Sunday acquisition review, Monday distribution kit (click "Run now" once to pre-approve Supabase access).
- **$1K in Mercury — HOLD until the funnel is proven to convert.**
- Cowork CANNOT commit/push — hand John the `docs:` one-liner + `/goal` pastes.

## Uncommitted at session end
This brief + the COWORK-CONTEXT learning append + `docs/PAID-ACQUISITION-VALIDATION-2026-06-29.md` are in the working tree. Hand John one `docs:` commit.
