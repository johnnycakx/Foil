# Next-Session Brief — updated 2026-07-12 (late, Fable close) — THE FUNNEL IS STRANGER-PROVEN, zero known blocking bugs. Next = Fable writes the ads-run spec (V8, morning judgment) · V6.5 design · V6.6 binder-delight.

> Read first: current state + prioritized plan. (Cowork edits this; commits on John's machine.)

## THE HEADLINE
The money path is COMPLETE and was walked end-to-end ON PRODUCTION the way a paying stranger will hit it (Fable drove John's browser; John touched only the card form and the cancel click): guest checkout with no login wall → $0-due card trial → branded sign-in email from `alerts@foiltcg.com` → one-click sign-in (token_hash `/auth/confirm`) → Pro entitlement rendered on /account → watch created through the agent prompt box → self-serve scheduled cancel via the Stripe portal. The stranger run surfaced and FIXED five hard defects the green test suite could never see — dead guest sign-in links, the Supabase built-in-mailer 2/hr throttle silently 503ing ALL magic links, swallowed /login errors, invisible-ink inputs, and a REAL open redirect that /security-review caught inside the fix itself ([ADR-114](DECISIONS.md)). **What remains before the ~$300 goes out: the ads-run spec (V8 — Fable authors it, reserved judgment work, do NOT hand it to Claude Code) + John's short list below.**

## THE LOCKED OFFER (sheet of record, 2026-07-11 — unchanged, now LIVE)
- **Test:** consumer $6 WTP test. **ICP:** modern-set singles chasers; grail hook leads.
- **Free:** top-2 /deals teaser · weekly digest · 3 watches checked DAILY (gift vaults exempt). **Pro $6/mo, 30-day card trial:** unlimited watches HOURLY + the full daily drop.
- **Founding line:** "$6 a month, locked. The price rises as Foil gets faster. Founding members keep their rate for life and get everything new first."
- **Voice:** two-voice (product = Foil the agent; John's "I" = X/editorial). Core line: **"Foil doesn't guess prices. It reads real sales."** Register rule: card-shop language, 15-year-old test. Drop-hook H1 (ratified 07-12): **"The day's best buys. In your inbox."** — and the rule it taught: card body copy never promotes to a headline slot.
- **Ads:** Reddit + Meta 50/50 (~$300), hooks A (grail) vs B (drop), UTM per cell, ~$40 no-pulse kill/consolidate. Scoreboard: 3+ card-entering trials = green; 0 = decisive no.

## THE SEQUENCE
1. **V8 — Fable writes the ads-run spec** (morning judgment, deliberately not 1 a.m.). Inputs: `offer-implementation.md` (the lock) + `_results/funnel-stress-test.md` + the stranger-run evidence in SESSION-LOG 07-12.
2. **V6.5 `pro-conversion-redesign`** (spec ready, incl. stranger-run findings S1–S6). One-liner: `/goal Read docs/goals/pro-conversion-redesign.md and execute it end-to-end, honoring the P0 premise check, the stranger-run findings section, the rubric bounds, and closure gates. Commit, no push.` Runs on a branch — safe to fire anytime.
3. **V6.6 `start-binder-delight`** (spec written 07-12 — John's taste call: card selection = pack-reveal + data-as-payoff + growing binder, honest register, no dark patterns; carries the signed-in coherence defects). Fire after V6.5.
4. **Ads live** once V8 is spec'd + the human list is clear.

## John's open human items
- **Verify the `+smoke` (05:40Z) live trial is CANCELED in Stripe** — `+smoke2` is confirmed scheduled-cancel Aug 11 (self-terminates, no charge ever); the first one Fable never saw die. Both were real-card live subs.
- **⚠️ GCP billing card** (acct `01CBF6-…` past due) — suspension kills the GSC service account.
- **PokeTrace payment** (~Jul 15; decision made 07-08: one more cycle, tied to the sprint verdict).
- **Beehiiv welcome-email cadence copy** (dashboard edit — tier-split the "about one email a week" line).
- **Stripe Branding:** icon uploaded mid-run (the portal shows the sakura mark) — confirm the accent `#d98aa0` was SAVED on the Checkout & Payment Links tab; also the checkout product description still carries an em dash (one-line `stripe-setup.ts` refresh, fold into V6.5's S5).

## State snapshots (2026-07-12 late)
- **Pushed LIVE through `d5f7ede`:** the locked offer (ADR-113 — tier mechanics, payment-first guest checkout, THE DAILY DROP SEND, market-temperature stat, full copy stack + register sweep) · auth hardening (ADR-114) · both migrations applied · `NEWSLETTER_DIGEST_MODE=approval` set (weekly digest rail ON — first cron Wed 14:13 UTC posts an approval card to #content-engine; NOTHING sends without /approve).
- **Subscriptions truth:** John's main account corrected to tier=free with dead Stripe ids cleared (the test-mode entitlement-drift trap — test-mode cancels never reach the prod webhook; learning banked). All test-mode subs canceled. Live: `+smoke2` scheduled-cancel Aug 11 only (pending the `+smoke` verify above).
- **Critique ledger (design debt, non-blocking):** V6.5 S1–S6 (+/account shows "next charge" to a canceling user — a false claim; scheduled-cancel state display) · tier-aware receipts · signed-in email prefill · "we'll" voice residue in the /start target-price microcopy (V6.6 carries these three).
- **Market-temperature stat:** first figure lands after the next 09:00 UTC movers run (7-day freshness gate un-hides the /deals line).
- **GSC:** ~0 impressions/day, authority-gated — SEO stays closed as a lever.
- **HF scan (07-12):** nothing on Hugging Face shortens time-to-revenue; card-detection models/datasets noted for the parked V2 scanner only. The HF "price predictor" models GUESS — useful positioning contrast for our "reads real sales" line, nothing more.

## Standing doctrine
- Judgment artifacts (ads spec, pricing, strategy) stay in the Fable seat; Claude Code executes goals, never authors strategy (offer-lock rule, re-affirmed 07-12 when "write the ads-run spec" nearly went to the runner).
- AUTO_PUBLISH_WEEKLY_POSTS stays false · cold X lane human forever · repo private · @mollipen warm thread — don't let it die.

## Session-close hygiene (2026-07-12)
Brief rewritten, COWORK-CONTEXT learnings, IDEAS entries, QUEUE rows (V6.6 + V9 auth-hardening LIVE), `start-binder-delight.md` spec — all written on disk by Cowork. John commits via the handed `docs:` one-liner.
