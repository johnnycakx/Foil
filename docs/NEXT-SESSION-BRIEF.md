# Next-Session Brief — updated 2026-07-13 (post-ship) — BOTH BRANCHES LIVE ON PROD, veto waived by John. Next = John's on-prod walk → V8 ads-run spec (Fable) → V6.6 cycle-4 → ads.

> Read first: current state + prioritized plan. (Cowork edits this; commits on John's machine.)

## THE HEADLINE
The binder /start (ADR-115/116), the one-page free tier (9 cards, daily), all round-2/3 QA fixes, AND the V6.5 /pro sales page are LIVE on foiltcg.com (merges `11653da` + `cd9a3d5`, docs `9a8e731`, all deploys Ready). John deliberately waived the design-veto gate — zero-traffic reality, prod is the honest staging; recorded in the merge messages + SESSION-LOG. Live verification all green: content markers 1703 tests / 0 fail against RENDERED prod · trial CTA opens real Stripe checkout (no card entered) · /account gates correctly · 22 QA watch rows deleted with a guarded per-email ledger check · ADR-116 revisit trigger re-stated (escalate when the daily free run nears MAX_BROWSE_CALLS 200 or ~10 min).

## THE SEQUENCE
1. **John's assessment walk on foiltcg.com** — /start (binder desk: pack rip, tag write, heartbeat) and /pro (site chrome, tier table, real Moonbreon specimen, $20 Card Ladder anchor, FAQ) are what changed. His unfiltered read feeds #3.
2. **V8 — Fable writes the ads-run spec** (judgment work, stays in this seat, NOT the runner's). Inputs: `offer-implementation.md` · `_results/funnel-stress-test.md` · stranger-run evidence in SESSION-LOG 07-12 · QUEUE row 27 (Reddit+Meta 50/50 ~$300, hooks A grail vs B drop, cooling framing on Reddit variants only, UTM per cell, ~$40 no-pulse kill/consolidate, scoreboard: 3+ card-entering trials = green, 0 = decisive no). Gated on John's walk + zero known funnel bugs (currently true).
3. **V6.6 cycle-4** — the register/feel pass (Finding 6, the "not impressed" direction complaint) — separate future goal, brief gets John's fresh on-prod impressions folded in.
4. **Ads live.**

## THE LOCKED OFFER (live as of today)
- Free = ONE BINDER PAGE: 9 watches, checked daily, weekly digest, top-2 /deals teaser. Pro $6/mo, 30-day card trial: unlimited watches HOURLY + the daily drop.
- Founding line, two-voice register, "Foil doesn't guess prices. It reads real sales.", drop-hook H1 — unchanged. Register rule: card-shop language, 15-year-old test.

## John's open human items
- **PokeTrace payment ~Jul 15 — URGENT (2 days).** Everything soft-fails to empty without it. Decision 07-08: one more cycle tied to the sprint verdict.
- **Verify BOTH `+smoke` live trial cancels in Stripe** (`+smoke2` scheduled-cancel Aug 11; the first one still unverified).
- **⚠️ GCP billing card** (acct `01CBF6-…` past due) — suspension kills the GSC service-account reader.
- **Beehiiv welcome-email cadence copy** (dashboard edit — tier-split the "about one email a week" line).
- **Stripe dashboard Branding** (logo + accent `#d98aa0` save — the S5 remainder).

## State snapshots (2026-07-13 post-ship)
- **Prod:** main carries both merges + Monday's content-engine post (`697d8e4`, rode the fast-forward cleanly). Two merge deploys + docs deploy all Ready. No open branches carrying product work.
- **Digest rail:** `NEWSLETTER_DIGEST_MODE=approval` — first cron Wed 14:13 UTC posts the Discord approval card; nothing sends without /approve.
- **Market-temperature stat:** un-hides on /deals after the next 09:00 UTC movers run (7-day freshness gate).
- **Residual critique ledger:** lives in the V6.5 spec (S1–S6) + V6.6 — carried, not lost.
- **Watch the free-tier scan volume** now that one-page free is live (ADR-116 accepted 3× worst-case; trigger above).

## Standing doctrine
- Judgment artifacts (ads spec, pricing, strategy) stay in the Fable seat; Claude Code executes goals, never authors strategy.
- AUTO_PUBLISH_WEEKLY_POSTS stays false · cold X lane human forever · repo private · @mollipen warm thread — don't let it die.
- Veto-gate doctrine amended 2026-07-13 (John): at zero traffic, prod is the staging environment — ship gated work, assess live, iterate. The taste veto returns when real users are watching (ads live).
- Cowork mount caveat (2026-07-13): the sandbox mount can serve stale/truncated working-tree content + stale reflog after on-machine runs. Git objects/refs sync; file contents may not. Verify on John's machine or via committed gate records before alarming or "fixing".

## Session-close hygiene (2026-07-13 post-ship)
Runner committed SESSION-LOG/QUEUE and pushed (`9a8e731`). This brief is Cowork's rewrite; John commits via the handed `docs:` one-liner.
