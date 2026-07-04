# Next-Session Brief — 2026-07-04 (written at 07-03 close) — belt is loved and live; trust layer half-landed; sold-data goal was IN-FLIGHT at close

> Read first: current state + prioritized plan. (Cowork edits this; commits on John's machine.)

## FIRST ACTION OF THE MORNING (before anything else)
1. **Check the sold-data-integrity goal's closure** in the Claude Code terminal — it was
   IN-FLIGHT (~25m, deep in the fix layer) when John went to bed. If closed clean: review
   its summary + the coherence-scan failure-rate numbers, then **push**. If it stalled:
   esc → /clear → re-run the same goal one-liner (the Session-47 recovery pattern; its
   commits are staged work, a fresh run recovers).
2. **Check Discord #errors / run summaries** for "Suspicious suppressed" counters — the
   plausibility guard (adc15d6, LIVE) proves itself by the hourly crons mailing zero junk
   while suppressions log. Zero suppressed-class mails = the ladder's clean-run proof.
3. Then the scoreboard (below).

## The single biggest fact of 07-03
**The homepage became the product's face and the data layer became honest.** The 200-card
chase belt shipped and John loved it ("I couldn't have designed it better myself"), the hero
simplified to one CTA + an X follow loop, the site speaks first-person ("Tell me"), and BOTH
data-trust incidents got root-caused: the 3 AM junk alert (same-name-printing through the
number-absence identity gate + leftover test rows — ALL test watches purged, ADR-103 35%
plausibility band LIVE) and the Dialga-EX fake numbers (**H3 — OUR misread of PokeTrace API
semantics**: their per-tier `saleCount` is ALL-TIME, we summed it under a "30-day" label;
their `avg30d` anchors to the tier's lastUpdated, not today. PokeTrace's data was fine; our
labeling lied. Fix = freshness gating + coherence gate + movers freshness guard, in flight).

## Shipped 07-03 (pushed + live unless noted)
hero-chase-belt (6538169; GSAP virtual-offset, 26 nodes recycling 200 faces, request widget,
177fps) → hero-polish-followups (4907f35) → homepage-hero-simplify (dd145ec; stats chip gone,
deals CTA gone, vault CTA alone, X follow widget option-a) → first-person voice sweep
(68b80cd + a82c8be; "Tell me", em dashes out of meta/subhead) → **alert-plausibility-guard
(adc15d6, LIVE; ADR-103)**: test rows purged (18 watches, all aliases — eve's claim is now
the only watch-set at her address), 35%-under-basis suppression band, condition-incoherence
subsumed, alert em-dash sweep, Cowork's pre-diagnosis confirmed in code (identity.ts:200
number-absence pass; $57.24 = the cheap non-SIR printing) → sold-data-integrity
(**IN-FLIGHT at close** — H3 verdict established, xy4-122 fixture pinned, sold-coherence.ts
+ scan written, movers freshness guard landing; closure gates not yet run).

## THE SCOREBOARD (still the standing measurement)
1. `npm run subscriber-sources` vs baseline: `src=eve-vault`, `line-umbreon`/`line-espeon`,
   `eve-vault-fork`, `homepage_hero` (+ new `card-page` / `card-request` sources once those
   goals land).
2. `seeded_vault_claims` with `vault_slug='eve'` — eve had NOT claimed or responded as of
   07-03 late night; her claim is now SAFE (guard live, test rows purged).
3. @FoilTCG mentions/replies — reply duty two 10-15 min sessions; named cards = same-day
   delivery clock.
4. #errors: BeehiivSubscribe pings + the new suppression counters.

## The queue (docs/goals/QUEUE.md is the living tree — update it, not just this brief)
1. sold-data-integrity closure + push (morning action #1).
2. **card-page-vault-first** — "Add to vault" above the fold; the eve-pattern as default
   audience (data demoted to expandables, affiliate module stays visible). Runs after
   sold-data so its headline stat is the repaired number.
3. **blackout-brand-and-deals-rework** — AMENDED 07-03: + Workstream D (/start + /cards
   still cream — funnel-critical, belt CTA lands on a white flash); Workstream C fixes
   heating-up images + /deals UI; Workstream A mostly shipped, verify-and-skip.
4. **belt-touch-drag** — swipeable belt (Draggable+Inertia, license verified free);
   bidirectional recycling is the named risk; John phone-tests before push.
5. **belt-og-metadata** — belt-strip static OG frames sitewide (X unfurl eye candy).
6. **github-recruiter-ready** — profile README + Foil README + repo hygiene + secrets scan;
   PAUSES for John's explicit go before the public profile-repo push. His 5-min checklist
   (private-contributions toggle, pins, stars) is in the goal.
7. Then: x-reply-desk · request-widget-v2 (quiet on-site lane = email capture) ·
   target-picker · csv-import · text-crispness (gated) · design-judge-harness.

## Content drafts ready (Cowork's mandate — John veto/edit, then post)
- **Reveal post** (post once sold-data fix is live): "got laid off in may. instead of
  applying to jobs I built the thing I always wanted as a card seller: a site that watches
  every chase card on eBay and emails you when a real one drops to a real price. judged
  against sold data, not asking prices. / foiltcg.com. it's free. tell me a card and I'll
  watch it for you." + second tweet = screen recording of the belt drifting. PIN IT.
- **Manipulation thread** (after reveal settles; the trend lane test): "someone ran 200 fake
  accounts to pump the price of the van gogh pikachu. got caught by cardmarket's lawyers.
  that card is on my homepage right now / this market is full of this stuff. it's half the
  reason I built foil to judge deals against actual sold data instead of asking prices.
  asking prices are whatever a manipulator wants them to be."
- **Vault-noun post** (day after reveal): seller-regret angle drafts in the 07-03 chat;
  John rejected the first (corporate cadence) — use options A/B/C, his edit.
- Positioning ruling (John + Cowork agreed): manipulation-protection = CONTENT LANE now +
  staged provable detection (volume honesty → spike context → anomaly flags → concentration);
  headline repositioning only when detection is real. IDEAS has the roadmap.

## Standing decisions + dates
- **PokeTrace $98/mo**: reminder Jul 13, renewal ~Jul 15. NOTE: the H3 verdict SOFTENS the
  data-quality complaint (their data was fine; we misread semantics) — but the coherence
  scan's failure-rate numbers are still due diligence for the ~Aug 10 source benchmark.
- Fable 5: 50% weekly cap until Jul 7 — judgment goals only; Opus for mechanical.
- AUTO_PUBLISH_WEEKLY_POSTS stays false (approve-gated is the intended end state).
- Jun-25 `_pending` blog draft still ships through blog-approval-loop (queued).
- Small opens carried: Beehiiv masthead confirm · GSC Request-Indexing /lines · re-point
  /umbreon /espeon post-event · opaque vault tokens (IDEAS) · Lighthouse LCP validation on
  belt · PullLoop hand-written figures · eve exemplar → content engine (48-72h).

## Strategy spine (unchanged, ratified 07-02)
Zero-input flywheel horizon; capability now, autonomy on PROOF; conversion before
throughput. Cold X lane human-posted forever (ToS). Flagship loop: "name it → page appears
→ done ✅". NEW 07-03 addition: **the eve pattern is the mainstream flow** — every surface
leads with the service action ("Add to vault"), data is supporting evidence. One noun
sitewide: vault.

## Session-close hygiene
This brief + COWORK-CONTEXT learnings + IDEAS entries written by Cowork at 07-03 close;
John commits via the handed one-liner. sold-data-integrity commits its own work at its
closure (separate commit, already specced NO PUSH).
