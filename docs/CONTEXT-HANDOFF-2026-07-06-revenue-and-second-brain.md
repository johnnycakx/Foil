# Context Handoff — Revenue Bottleneck + Second-Brain Viewer (2026-07-06)

**Provenance:** produced in a *Project Buffet* Cowork session on 2026-07-06 by reading this repo directly (not from live dashboards). Every claim below is sourced to a file in this repo so HQ can verify, not take on faith. Two deliverables: (A) the evidence-based revenue bottleneck + priority sequence, (B) the Obsidian second-brain viewer decision + Foil vault setup.

---

## A. Foil revenue bottleneck — from the repo, evidence not vibes

**The finding, up front:** Foil has a built engine and ~zero revenue. The cause is **not** "needs more traffic" and **not** "needs more product." It is that **the money path has never been closed end-to-end** — every link between a stranger and a dollar is broken or missing. This is the "building ahead of validation" trap, now proven by the repo's own audit rather than asserted.

### The five broken links

**1. No billable mechanism; affiliate is thin and leaking.**
- Revenue today is affiliate only. `docs/BUSINESS-MODEL-2026-06-05.md`: affiliate RPM ≈ $10 per 1,000 visitors → **~150,000 visitors/mo for $1,500/mo**.
- It leaks: "See it on eBay" lands on a name search, not the specific listing (conversion leak, same doc); and `docs/AUDIT-2026-07-01-FABLE.md` flags a missing `EBAY_CAMPAIGN_ID` silently dropping the affiliate tag = **silent 100% revenue loss, no alarm**.
- The real profit lever — subscription ("150 subs @ $10 ≈ 150k affiliate visitors") — is **not built and cannot charge**: no Stripe live, LLC banking not wired (ADR-020 deferred; see `docs/goals/foil-gated-drop-paid-test.md`).

**2. The free funnel silently fails** (`docs/AUDIT-2026-07-01-FABLE.md`, funnel graded **D**).
- `/start` opt-in writes only to Beehiiv, **not** the Resend list that actually sends → a new subscriber never receives an issue.
- **Zero UTM attribution** on `/start` → "the one number the whole strategy needs is unmeasurable." Cannot prove traffic converts.
- Unsubscribe doesn't stop alerts (CAN-SPAM + deliverability exposure); blank-target sentinel fires "$100,000" alerts by default; alert prices can be live auction bids (false deals).
- Audit verdict: **"the site would not survive the eve moment today."**

**3. Traffic is authority-gated, not build-gated.**
- Live GSC pull (`docs/goals/QUEUE.md`, n=45): 1 indexed, 0 defects → verdict **"STOP building for SEO, the lever is off-page distribution."**
- Mobile-perf campaign CLOSED (LCP bottomed at an architectural floor). More engineering does not manufacture traffic; off-page distribution does. Only live distribution lever today is John-in-the-X-replies (manual).

**4. Arriving traffic would hit fabrications** (`docs/AUDIT-2026-07-01-FABLE.md`).
- sv3a Raging Surf post substantially fabricated; Moonbreon figures contradict across 3 live posts; `/deals` first-click resolves to a Poor-condition listing on the page that promises condition-matched verification. Warm traffic bounces on sight.

**5. A dated single point of failure.**
- PokeTrace renewal ~**Jul 15**; without it, movers + newsletter WHY/CALL + engagement briefs + `/deals` degrade to empty.

### Evidence-based priority (matches the audit's own resequencing)
1. **`start-funnel-integrity`** — signups must register + attribute. The conversion counter must work before any traffic push.
2. **`content-trust-hotfix`** — kill the fabrications + false alerts.
3. **Wire Stripe + LLC banking** — the only thing that lets money change hands (John's gate).
4. **Run the bounded $6 gated-drop willingness-to-pay test** (`docs/goals/foil-gated-drop-paid-test.md`; held for Fable after Jul 7 = now). Produces the ONE missing number: **will anyone pay?** 3 card-entering trials = green light; 0 = decisive no.
5. **Only then scale distribution** (paid arms per `docs/PAID-ACQUISITION-VALIDATION-2026-06-29.md`, X replies, off-page authority).

Daily Foil time should go to links 1–4, in order, so that step 4 becomes a fair test. Not design, perf, or catalog.

### Decisions only John owns
- **PokeTrace renewal (~Jul 15)** — dated business decision, not a watch item.
- **Stripe live + LLC banking** — gates any charging.
- **Is the $20K business capital or personal runway?** — sizes how aggressively to scale paid acquisition (`docs/CAPITAL-DEPLOYMENT-PLAN.md`).
- **AUTO_PUBLISH reconciliation** — docs say ON, behavior lands drafts in `_pending/`. Pick one.

### The missing number (per John's operating doctrine)
"Does a Pokémon collector convert to an engaged subscriber, and will anyone pay?" Nothing above step 4 produces revenue; step 4 produces the number. Everything before it exists only to make step 4 a fair test.

---

## B. Second-brain viewer — Obsidian, two vaults

**Reframe:** not a transfer problem, a viewer problem. The markdown files stay the **source of truth** (versioned with code, read/written by Claude Code). Obsidian only *views* them. No Notion export, no migration.

**Decision: two distinct vaults, not one** (scored on usability / efficiency / cost / architectural-fit; fit was decisive). Foil (`C:\Users\John\dev\foil`, local) and Project Buffet (OneDrive) sit in different parents, barely cross-reference, and Foil's brain is large → vault boundary = repo boundary = domain boundary = source-of-truth boundary. Mirrors the two Claude workspaces (foiltcg-HQ vs Buffet). Foil is the daily driver.

**Foil vault setup (do this in HQ):**
1. Obsidian → "Open folder as vault" → select **`C:\Users\John\dev\foil\docs`** (that folder *is* the second brain; pointing at `docs` keeps `node_modules`/`.next` out automatically).
2. Create a `docs/HOME.md` daily cockpit that links: `goals/QUEUE.md` (freshest state), `goals/NEXT-SESSION-BRIEF.md`, `ROADMAP.md`, `DECISIONS.md`, `RISKS.md`, `IDEAS.md`, `AUDIT-2026-07-01-FABLE.md`, and a pinned "revenue-critical path" block = links 1–4 above.
3. Add `docs/.obsidian/` to `.gitignore` (UI config shouldn't pollute the repo).
4. Optional (2026): the **Bases** core plugin turns notes into no-code dashboard views if a richer daily board is wanted later.

(Buffet's vault is already set up — `HOME.md` cockpit written at the Buffet root, with `.venv`/`node_modules` excluded.)

---

## Suggested next action for HQ
Package links **1–4** as a sequenced goal set (start-funnel-integrity → content-trust-hotfix → Stripe/banking wiring → the gated-drop test), and stand up the Foil `docs/HOME.md` vault cockpit in the same pass.
