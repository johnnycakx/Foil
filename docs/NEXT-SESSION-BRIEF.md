# Next-Session Brief — updated 2026-07-11 (later: V7 + V6 BOTH BUILT) — Stripe live env wired + verified; offer-implementation committed (NO PUSH); next = John's localhost veto → push → activation steps → smoke test → ads-run spec

> Read first: current state + prioritized plan. (Cowork edits this; commits on John's machine.)

## THE HEADLINE
The 07-05 validation reframe reached its judgment session: **the offer is fully LOCKED (2026-07-11, every decision ratified by John)** and the funnel has been stress-tested end-to-end. What remains before the ads test: one paused goal (Stripe live env), one build goal (offer-implementation), one spec (ads-run), and John's smoke test. **The decisions of record live in `docs/goals/offer-implementation.md` — read it before touching any offer surface.** (The 07-05/07-06 held-for-Fable framing below is now RESOLVED — the judgment session happened; history preserved in git.)

## THE LOCKED OFFER (sheet of record, 2026-07-11)
- **Test:** consumer $6 WTP test (flipper/shop lanes explicitly downstream of the list; zero-cost DM probe idea in IDEAS).
- **ICP:** modern-set singles chasers; grail hook leads.
- **Free:** top-2 /deals teaser · weekly digest · 3 active watches checked DAILY (seeded gift vaults exempt).
- **Pro $6/mo, 30-day card-required trial:** unlimited watches checked HOURLY ("first in line") + the full daily drop.
- **Founding line (honest rate-lock ONLY, no unshipped artifacts):** "$6 a month, locked. The price rises as Foil gets faster. Founding members keep their rate for life and get everything new first."
- **Voice:** TWO-VOICE architecture — product surfaces = **Foil the agent**; John's "I" = X + editorial. Core line verbatim: **"Foil doesn't guess prices. It reads real sales."** Avoid literal "AI" on product surfaces.
- **REGISTER RULE:** all customer copy in card-shop language (15-year-old test; finance/tech words banned; model line: "usually $19.11").
- **Ads:** Reddit + Meta 50/50 (~$300 top of range), hooks A (grail) vs B (drop), cooling framing on Reddit variants only, UTM per cell, per-cell kill/consolidation (~$40 no-pulse → roll into live cells). Scoreboard: 3+ card-entering trials = green; 0 = decisive no.
- **Scope honesty:** NO market-level claims until the market-temperature stat ships (offer-implementation item 6).

## THE SEQUENCE (do in this order)
1. ~~Resume `stripe-live-wiring` (V7)~~ ✅ **DONE 2026-07-11** — all four live vars in Vercel prod, redeployed, no-charge checks passed (/pro 200 with the $6 offer; webhook signature-verifying). Committed `ef48dc7`.
2. ~~Fire V6 (offer-implementation)~~ ✅ **BUILT 2026-07-11 ([ADR-113](DECISIONS.md#adr-113--the-locked-offer-wired-in-tier-mechanics-payment-first-guest-checkout-the-pro-daily-drop-two-voice-copy--the-register-rule)) — committed, NO PUSH.** Everything locked is wired: 3-watch cap + daily/hourly cadence split + one-trial gate + payment-first guest checkout + the daily-drop send + market-temperature + the full copy stack/agent dress/jargon sweep. See the SESSION-LOG entry for the flagged deviations.
3. **John's copy veto on localhost** (`npm run dev` → /pro, /deals gate, /, /start success, /account) → **push**.
4. **John's activation steps (post-push):** `supabase db push` (2 new migrations) · set `NEWSLETTER_DIGEST_MODE=approval` on Vercel prod · **live smoke test** (incognito → foiltcg.com/pro → real card trial → subscriptions row trialing/pro → cancel → revoke; also try the SIGNED-OUT guest checkout — it's the new default buy path) · cancel the stray $14.99 test-mode sub · Beehiiv welcome cadence copy edit (dashboard) · optionally retitle the Supabase magic-link template.
5. **Fable writes the ads-run spec (V8)** → the gate to ads-live: V6+V7 closed · smoke test passed · zero known funnel bugs · instrumentation proven. Then the ~$300 goes out and the 14-month question gets its answer.

## State snapshots (2026-07-11)
- **Pushed LIVE:** adf55d3 (funnel-stress fixes: dead multi-word card search FIXED + verified on prod — Team Rocket 0→8 hits; CAN-SPAM unsubscribe third sync leg; scanner-era copy purged from checkout + /account; funnel-report attribution fixed). Memo: `docs/goals/_results/funnel-stress-test.md` — THE ads-live gate artifact.
- **Stripe:** account live; **exposed sk_live ROLLED** (07-11 leak via screenshot, handled at zero cost); live $6 product `price_1TrwmPEmPu7zPPxMNKIyOCeT`; live webhook destination (5 events) created; prod env slate cleaned + price id set; TWO SECRETS not yet pasted (step 1 above).
- **GSC:** impressions collapsed to ~0/day (25/28d vs 609 at the 07-05 report; 3 pages indexed; NO manual action). The authority gate deepening — NOT actionable, do NOT reopen SEO.
- **Email reality (stress-test confirmed):** no daily-drop send exists; weekly digest OFF in prod (`NEWSLETTER_DIGEST_MODE=""`); the welcome email promises "weekly." All handled inside V6.

## Standing items
- **PokeTrace $98/mo renewal ~Jul 15 (days away).** Call already made 07-08: renew ONE more cycle, tied to the sprint verdict. John makes the payment happen.
- **⚠️ GCP billing past-due** (`n8n-content-project` — hosts the GSC service account): fix at console.cloud.google.com/billing/01CBF6-7D6D18-F894B6/settings or the GSC API monitoring dies.
- **Beehiiv Scale $49/mo** = cut candidate (signup form + archive only since ADR-078) — John's billing call.
- Obsidian `Untitled*.base`/`Untitled.canvas` junk in docs/ — delete when convenient; real untracked docs (07-06 handoff, TheRightTrader teardown, HOME.md, MAP.md) fold into a docs: commit.
- **@mollipen warm thread** — don't let it die; a journalist citation is the authority-gate breaker.

## Session-close hygiene (2026-07-11)
SESSION-LOG entry, COWORK-CONTEXT learnings (offer-lock, two-voice, register rule, CLI-goal correction, key-roll protocol, scope-honesty), IDEAS (chat-first UI, demand-driven catalog, PWA, flipper probe), QUEUE V5–V8 — all written on disk by Cowork. John commits via the handed `docs:` one-liner. Note: the paused V7 goal will make its own docs commit when it resumes; both commits coexist fine.
