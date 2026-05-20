# Session Log

Reverse-chronological log of meaningful work sessions. Each entry: date, commits shipped, one-paragraph summary, and any follow-ups added to [ROADMAP.md](ROADMAP.md).

The point: when I open this repo three weeks from now, the most-recent entry tells me what state we're in without re-deriving from `git log`.

Append new entries at the TOP. Don't edit old entries except to add a "Related: see <date>" link if subsequent work reframes them.

---

## 2026-05-20 — Session 5: Second-brain docs + briefing generator

**Commits:** `7689801`, plus this commit

**Summary.** Shipped the 5 second-brain docs (ROADMAP, DECISIONS, SESSION-LOG, ENV-VARS, RISKS) and the CLAUDE.md hard contract that requires every future goal to read + update them. Follow-on: built `scripts/generate-briefing.ts`, which composes a single ~21KB briefing file (`docs/BRIEFING.md`) from CLAUDE.md + the top SESSION-LOG entry + ROADMAP NOW/NEXT + High/Medium risks. Use case: paste the briefing as the opening message of a fresh Claude.ai web chat to bring it cold-start up to current state without losing context to the message limit. Generator overwrites BRIEFING.md on each run so it always reflects the latest docs. Patch after first inspection: resolved Claude Code's `@<file>.md` import directives inline (otherwise they appeared as literal strings in the web chat) and stripped trailing horizontal rules per section to avoid stacked `---` dividers.

**Key decisions made.** None new — applied the existing contract.

**Follow-ups added to ROADMAP.** None.

**State at session end.** Local commit not yet pushed at time of writing. Run `node --experimental-strip-types scripts/generate-briefing.ts` before any new strategy chat to refresh the briefing.

---

## 2026-05-20 — Session 4: Content engine v2 (full autonomy)

**Commits:** `8848382`, `ce4f6d3`, `c969388`, `ad316e5`, `749b21a`

**Summary.** Four-stage build: (1) MDX blog infrastructure + topic-cluster strategy doc, (2) two new pillar landing pages for the value calculator and condition guide, (3) auth-proxy fix to stop the new marketing surfaces from getting gated to `/login`, (4) autonomous content engine v1 (drafts to `_pending/`, opens review PR), (5) full-autonomy upgrade (8 quality gates, 3-retry loop, twice-weekly direct-commit-to-main, SERP context injection via Brave Search, Foil data injection via Supabase). Two real posts shipped end-to-end via the autonomous pipeline: `how-to-read-a-japanese-pokemon-card` and `near-mint-vs-lightly-played-…`. Both passed all 8 gates on first attempt.

**Key decisions made.**
- [ADR-004](DECISIONS.md#adr-004--brave-search-for-serp-context-injection-2kmo-free-fits-2xweek-cadence) Brave Search over SerpApi/DataForSEO.
- [ADR-005](DECISIONS.md#adr-005--twice-weekly-content-cadence-mondays--thursdays-at-1403-utc) Twice-weekly Mon + Thu 14:03 UTC.
- [ADR-006](DECISIONS.md#adr-006--full-autonomy-no-human-review-step-gates-as-the-safety-net) Full autonomy, no review step.
- [ADR-007](DECISIONS.md#adr-007--8-quality-gates--3-retries--skip-on-failure-not-fail-the-build) Skip-on-failure (not fail-the-build) on gate exhaustion.

**Follow-ups added to ROADMAP.** Items #1-9 (NOW + NEXT) are net-new this session. The fabrication risk discussed in ADR-006 is tracked as [RISKS.md R-001](RISKS.md).

**State at session end.** Both commits pushed to `main` (`c969388..749b21a`). Vercel auto-deployed. Local working tree clean. First scheduled cron fires Mon 2026-05-25 14:03 UTC — blocked on GitHub Actions secrets (ROADMAP item #1).

---

## 2026-05-19 — Session 3: Pricing pipeline maturation + UX flip + first SEO surface

**Commits:** `ba35a63`, `6e9e360`, `c4842b8`, `86bc754`, `e16c1e4`, `f8046a5`, `522f194`, `a675475`, `1888d6c`, `f9305d8`, `1243ce9`, `7bfa259`, `30f393e`

**Summary.** Largest single-session count of the build so far. PriceCharting graded ladder added, condition multipliers killed in favor of per-tier quotes (`ba35a63`). Detect filter shipped to drop tiny/low-confidence/bad-aspect boxes and IoU-merge duplicates (`e16c1e4`). Visual confirmation pass gated behind low-confidence matches (`f8046a5`). Partial-id recovery via PokeTrace + PriceCharting candidate dedup (`a675475`). UX flipped: single-card scanning is now V1 primary, binder is an advanced toggle (`f9305d8`, see [ADR-003](DECISIONS.md#adr-003--single-card-scanning-is-the-v1-primary-ux-binder-mode-is-an-advanced-toggle)). First SEO landing page shipped: `/japanese-pokemon-cards-value` with Article + FAQPage JSON-LD (`7bfa259`). Waitlist attribution + UTM capture (`1243ce9`). Card Identification Framework documented (`30f393e`).

**Key decisions made.**
- [ADR-003](DECISIONS.md#adr-003--single-card-scanning-is-the-v1-primary-ux-binder-mode-is-an-advanced-toggle) Single-card primary.
- Pipeline rules established as "null over guess, don't auto-correct printed numbers, 3-letter set codes atomic, low-confidence requires visual confirm" (now codified in `docs/foil-card-id-framework.md` + CLAUDE.md).

**State at session end.** All shipped to main. First pillar page indexed-eligible.

---

## 2026-05-18 — Session 2: V1 critical path end-to-end

**Commits:** `0e19f6d`, `419fdf3`, `ca84b81`, `20a590c`, `311fac4`, `a6ee634`, `997f73f`, `25ce6a1`, `877c841`

**Summary.** End-to-end V1 stood up in a single day. Magic-link auth (`0e19f6d`), Claude Vision wired (`419fdf3`), end-to-end verified on Prismatic Evolutions fixtures (`ca84b81`), two-pass multi-card pipeline + null-safety (`20a590c`), Stripe paywall + Pro subscription verified (`311fac4`), retry pipeline + AGGREGATED price fallback (`a6ee634` — went from 0/9 to 9/9 on the Prismatic binder), Pokemon Card Identification Framework applied to the vision system prompt (`997f73f`), visual confirmation pass + reference images (`25ce6a1`), PokeTrace image cache in Supabase Storage (`877c841`).

**Key decisions made.**
- [ADR-001](DECISIONS.md#adr-001--domain-foiltcgcom-over-foilapp) Domain choice.
- [ADR-002](DECISIONS.md#adr-002--pricing-data-poketrace--pricecharting-scrydex-deferred) PokeTrace + PriceCharting; Scrydex deferred.

**State at session end.** V1 critical path complete. Ready for SEO + content phase.

---

## 2026-05-18 — Session 1: Scaffold

**Commits:** `a68731a`, `32810fc`

**Summary.** Initial Next.js 16 scaffold with Supabase, Stripe, Anthropic SDK wired. Project structure established (no `src/`, App Router, Tailwind 4, Turbopack).

**Key decisions made.** Stack choice (see CLAUDE.md → Stack section).

**State at session end.** Bare scaffold, no domain logic yet.

---

## How to log a session

Run at the end of any non-trivial goal:

1. Add a new entry at the top of this file.
2. Date format: `YYYY-MM-DD`. If a session crosses midnight UTC, use the day the bulk of work happened.
3. List the commit short-hashes shipped, in commit order.
4. **Summary paragraph:** 2-4 sentences. What changed, why it mattered. NOT a commit-by-commit recap (that's what `git log` is for).
5. **Key decisions:** link to the ADRs added or amended in [DECISIONS.md](DECISIONS.md). If no ADR was needed, omit this section.
6. **Follow-ups:** list any items added to [ROADMAP.md](ROADMAP.md) during the session.
7. **State at session end:** one sentence on the working-tree state, what's pushed, what's blocking the next ship.
