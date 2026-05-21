# Foil — Project Briefing (auto-generated 2026-05-21)

Paste this whole file as the opening message of a fresh Claude.ai chat to
bring it up to speed on the build before discussing anything new.

---

## What Foil is + the stack

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
Foil
Consumer AI app that valuates Pokemon TCG card collections from a photo in <10 seconds. Target user: someone scrolling Facebook Marketplace seeing a Pokemon card listing who wants to know if it's worth buying before another buyer commits.
Stack

Next.js 16 (App Router, TypeScript, Tailwind 4, Turbopack, no src/ directory)
Supabase auth (Email magic link, no email confirmation in dev) + Postgres + Storage
Stripe subscription ($14.99/mo Pro tier)
Anthropic Claude Vision for card identification (Sonnet 4.6 for identify + visual confirm, Opus 4.5 for retry pass)
PokeTrace API for multi-source pricing (TCGplayer + eBay + Cardmarket + graded)
Vercel hosting

Tiers

Free: 1 scan/day, confidence score, shareable image with watermark, server-enforced rate limit
Pro ($14.99/mo): unlimited scans, full per-card breakdown, 90-day history, no watermark

Env Vars (all in .env.local)
POKETRACE_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=https://cayzmikutgcwsqvagvzv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY= (TBD)
STRIPE_SECRET_KEY= (TBD)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY= (TBD)
Build Status

MVP sprint: May 18 – Aug 7, 2026
Soft launch: Sep 21, 2026 (waitlist)
Public launch: Oct 7, 2026
Day 90 target: $1.5K MRR

Coding Conventions

Server Components by default; Client Components only for interactivity
Server Actions for mutations, not client-side fetch
@supabase/ssr for auth, NEVER @supabase/auth-helpers-nextjs (deprecated)
Type-safe DB queries via generated Supabase types
No state libraries — Server Components + URL state + Server Actions

API Notes
PokeTrace (https://api.poketrace.com/v1, X-API-Key header):

Pro tier required for graded + EU + commercial use
10K req/day, 30 req/10s burst
Returns prices per source (ebay/tcgplayer/cardmarket) + tier (NEAR_MINT, PSA_10, etc.)
Surfaces anomaly flags for suspicious listings

Claude Vision:

Sonnet 4.6 for the identify + visual confirm passes; Opus 4.5 for the retry pass on failed PokeTrace lookups
Photos contain 1–50 cards; handle multi-card binder pages
Edge cases: holos, reverse holos, first editions, foreign-language, fakes

UX Principles

Speed beats completeness — show partial results fast rather than waiting for perfect ID
Confidence transparency — always show per-card + overall confidence
Mobile-first — primary use case is phone while scrolling Marketplace
Graceful degradation — unidentified cards show as "manual review needed" not errors

MVP Critical Path (build order)

Auth: magic link signup/login + session middleware ✅
Upload page (mobile-first): drag-or-tap photo upload ✅
Claude Vision integration → identified cards JSON ✅
PokeTrace integration → pricing per card ✅
Aggregation logic → total value + confidence ✅
Results page: per-card prices + overall + share image ✅ (share image pending)
Free tier rate limit (1/day, server-enforced via Supabase) ✅
Stripe Pro subscription + paywall on scan #2/day ✅

Deferred (NOT in V1)

Google OAuth (need domain whitelist, post-LLC formation)
Stripe live mode (need LLC banking)
Multi-TCG (MTG, Yu-Gi-Oh) — Pokemon only at launch
WebSocket price streams (Scale tier feature)
Sold-listings endpoint (Scale tier feature)
Anomaly detection beyond surfacing PokeTrace flags

Founder
John Craig — solo founder, Oracle SDR background, semi-technical. Operates a TCGplayer storefront (Level 4 seller). Will be the public face / content creator for launch (Twitter primary).

Vision pipeline rules (emerged from May 18–19 work)
These are the rules that make Foil trustworthy. They override generic Vision-LLM helpfulness.

Return null over guess. Vision never fabricates a collector number, set code, or name. If a field is illegible → null. If name AND (setCode OR collectorNumber) are both null → status insufficient_information. This is a feature, not a failure.
Don't auto-correct printed numbers. Left number > right number in XXX/YYY (e.g. 188/132) IS a real secret rare. Pass through verbatim.
3-letter set codes are atomic. SVI, MEW, SSP, BLK, MEG. Pass through, don't translate to set names. Better setCode: null than a fabricated code.
Low-confidence text matches require visual confirmation. A name-only PokeTrace fuzzy match is not a priced result until confirmMatch agrees with "high" confidence.

Pipeline order (app/upload/actions.ts)

detectScan — DETECT pass returns bounding boxes with detectionConfidence scores
Post-detect filter — drop area < 1.5% of image, drop detectionConfidence < 0.55, drop aspect outside [0.55, 0.95], IoU-merge any pair > 0.35
Crop per surviving box — lib/crop.ts, sharp, lanczos3, 1024–1600px long edge
identifyScan — IDENTIFY pass reads each crop's printed fields (returns null over guess)
priceCard — PokeTrace lookup priority: exact (collectorNumber + setCode) → fuzzy (name + setCode) → name-only (lowConfidence flag)
confirmMatch — visual side-by-side for low-confidence matches AND ambiguous PokeTrace results
retryIdentify — Opus retry for cards still failing on no_candidates / low_score / regulation_mismatch

Newsletter (Beehiiv)

`lib/beehiiv.ts` is the ONLY module allowed to import `@beehiiv/sdk`. Beehiiv blocks browser-origin requests via CORS and the API key must stay server-side — call `subscribeEmail({ email, source })` from a Server Action (`app/actions/subscribe.ts`) or another server module, never from a Client Component. If a new feature needs another Beehiiv endpoint (Posts, segments, custom fields), add it to `lib/beehiiv.ts` and re-export — keep the import boundary intact. See [ADR-010](docs/DECISIONS.md) for the rationale.

Key files

docs/foil-card-id-framework.md — Pokemon Card Identification Framework. Read before touching vision.ts or poketrace.ts.
lib/vision.ts — VISION_SYSTEM_PROMPT, CARD_SCAN_SCHEMA, DETECT_SCHEMA, DETECT_SYSTEM_PROMPT
lib/vision-retry.ts — Opus 4.5 retry pass with PokeTrace topCandidates context
lib/vision-confirm.ts — Sonnet 4.6 multi-image side-by-side comparison
lib/poketrace.ts — Client + cacheCardImage (Supabase Storage) + byCondition rollup (NM/LP/MP/HP/DMG)
lib/crop.ts — Per-card crops via sharp
lib/detect-filter.ts — Bounding-box filtering + IoU dedup
app/upload/actions.ts — Pipeline orchestrator (detectScan, identifyScan)
app/upload/upload-form.tsx — UI: PokeTrace reference images + condition picker + live total

Auth gate (lib/supabase/proxy.ts)

The proxy is default-deny — every request redirects unauthenticated users to /login unless its path is in the PUBLIC_ROUTES allowlist. When you add a new route under app/, decide which list it belongs on:

PUBLIC (marketing/SEO/auth/3rd-party — add to PUBLIC_ROUTES in lib/supabase/proxy.ts):
- / (homepage)
- /japanese-pokemon-cards-value, /pokemon-card-value-calculator, /pokemon-card-condition-guide (pillars)
- /blog and /blog/* (blog index + every post)
- /login (sign-in form)
- /auth/* (magic-link callback — MUST be public or the magic link redirect-loops and consumes the OTP)
- /api/webhooks/* (Stripe and any other 3rd-party POSTs with their own signature scheme)
- /robots.txt, /sitemap.xml, /opengraph-image, /twitter-image, /manifest.webmanifest (metadata routes)

GATED (user-data — do NOT add to PUBLIC_ROUTES; they self-gate via redirect("/login") after getUser()):
- /upload, /account
- Any future /api/scan, /api/identify, /api/cards endpoints

The contract is pinned in lib/__tests__/proxy.test.ts. If you add or remove a public route, update that test.

Local CLI tooling for autonomous infra changes

The repo has three CLIs installed and authenticated. Future goals SHOULD use them directly instead of writing manual rollout playbooks for John. Reserve manual playbooks for actions the CLIs genuinely can't do (e.g. accepting a domain-transfer email, clicking through a Stripe Connect onboarding).

- **`vercel` CLI** — v54.3.0, authenticated as `johnnycakx`. Project linked to `team_MYkF82HXU8It3L9TjpJia1zB / prj_0FH8NcWH3AIRUI6FnF719QaEC4ug` (foil). Use for: project settings, env vars, deploy hooks, domains, deploys, log inspection. See `vercel:*` plugin skills (also installed) for guided flows — `vercel:env`, `vercel:deploy`, `vercel:env-vars`, `vercel:deployments-cicd`, `vercel:vercel-cli`.
- **Vercel Plugin for Claude Code** — installed during `vercel link`. Surfaces ~30 `vercel:*` skills (full list shows in the session skills sidebar). Prefer the skills over raw `vercel ...` calls when one matches the task — they encode platform-specific guardrails.
- **`gh` CLI** — v2.92.0, authenticated as `johnnycakx` (keyring, HTTPS protocol, scopes: gist/read:org/repo/workflow). Use for: GitHub repo secrets (`gh secret set`), workflow dispatch (`gh workflow run`), releases, PR creation, PR review/inspection, issue management.

**Routing rule for new goals:**
- Touches Vercel project settings / env vars / deploy hooks / domains → `vercel ...`
- Touches GitHub secrets / workflow dispatch / releases / PRs → `gh ...`
- Touches both (e.g. "wire a new env var end-to-end") → run both, no UI clicks
- Touches neither → ignore this section, code as normal

**Path caveat (transient):** If `gh` isn't on the shell PATH (`which gh` returns nothing in a Bash tool call), the binary still exists at `C:\Program Files\GitHub CLI\gh.exe`. Invoke as `& "C:\Program Files\GitHub CLI\gh.exe" <args>` from PowerShell, or restart Claude Code to pick up the updated PATH. This caveat goes away on the next session start.

**Kill-switch** (revoke autonomous infra access): `gh auth logout` + Vercel UI → Account Settings → Tokens → Revoke. Both are session-bound credentials with no machine-wide effect beyond their respective CLI scopes.

Common commands

npm run dev — Dev server, port 3000 (Turbopack)
npm test — All suites (vision-prompt, vision-confirm, low-confidence-gate, detect-filter)
npx tsc --noEmit — Typecheck
npm run build — Production build
stripe listen --forward-to localhost:3000/api/webhooks/stripe — Webhook tunnel for paywall testing
supabase db push — Apply pending migrations (after linking project)

Autonomous content engine

The content engine generates a new blog post TWICE A WEEK (Mondays + Thursdays 14:03 UTC), runs 8 quality gates against the draft, and publishes directly to main with NO human review step. Vercel auto-deploys. The gates are the safety net — quality is enforced structurally, not editorially. Kill-switch: set repo variable AUTO_PUBLISH_WEEKLY_POSTS=false to fall back to _pending/ drafts.

Pipeline (lib/seo/):
- content-engine.ts → generateWeeklyPost(): picks next unshipped cluster topic from docs/seo-strategy.md → pulls SERP context (Brave Search + cheerio scrape) → pulls Foil data snapshot (Supabase) → calls Claude Sonnet 4.6 with the DUD prompt → runs quality-gates → re-prompts with failures up to 3 times → returns passing draft or throws GenerationFailedAfterRetries.
- quality-gates.ts → 8 gates: (a) word count 1200-2200, (b) 5+ unique dollar figures, (c) 2+ recent-date (2025/2026) citations, (d) 1+ Foil-data citation, (e) zero banned phrases, (f) valid Article + FAQPage JSON-LD, (g) FAQ section 200+ words, (h) 2+ internal links. To add a gate: edit lib/seo/quality-gates.ts and add a positive + negative test in lib/__tests__/seo-quality-gates.test.ts.
- serp-fetch.ts → Brave Search API + top-3 outline scrape. Optional 24h Supabase cache. Degrades silently if BRAVE_SEARCH_API_KEY missing or rate-limited.
- data-injection.ts → Foil-proprietary stats (scans count, waitlist mix). Returns null per-field on empty/error; engine just renders fewer cited statistics.

Scripts:
- scripts/generate-weekly-post.ts — main entry. Flags: --slug <existing> for retroactive regenerate.
- scripts/refresh-internal-links.ts [slug] — writes docs/internal-link-suggestions.md.
- scripts/competitive-gap-scan.ts [url ...] — writes docs/competitive-gaps.md.

Scheduled workflow: .github/workflows/weekly-content.yml runs both cron entries:
  - '3 14 * * 1'  # Mondays 14:03 UTC
  - '3 14 * * 4'  # Thursdays 14:03 UTC
On gate pass: commits + pushes to main. On 3-strike gate failure: exits 2, workflow logs warning + sends webhook + skips commit (next cron picks a different topic).

Required secrets (Repository → Settings → Secrets → Actions):
- ANTHROPIC_API_KEY (mandatory)
- BRAVE_SEARCH_API_KEY (optional — SERP context falls back to "no competitor reference" without it)
- NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (optional — data injection skipped without)
- WEEKLY_POST_WEBHOOK_URL (optional — POST on publish + on gate-exhaustion failure)

Reading failure logs: GitHub Actions → weekly-content workflow run → "Generate post (autonomous)" step. The script logs every gate failure with the prompt-ready failure string on each retry; a "GenerationFailedAfterRetries" exit means all 3 attempts logged failures and no commit happened. The next scheduled run picks a different topic from the backlog.

Disabling autonomy: set repository variable (not secret) AUTO_PUBLISH_WEEKLY_POSTS=false. Drafts then land in app/blog/posts/_pending/ for manual review. To revert to per-PR review entirely, replace the "Commit + push to main" step in the workflow with peter-evans/create-pull-request (the prior architecture).

Newsletter draft step (ADR-011): after every successful blog publish, the workflow runs `lib/newsletter/draft-generator.ts` to transform the post into a 300-600 word newsletter, then `lib/beehiiv-posts.createDraftPost` to land it in Beehiiv as `status: "draft"`. **Drafts NEVER auto-send.** John reviews in Beehiiv's UI and presses send manually. The step is soft-fail — a Beehiiv outage, a quality-gate exhaustion, or an SDK breaking change cannot undo a blog publish. Beehiiv calls go only through `lib/beehiiv.ts` (subscribe) or `lib/beehiiv-posts.ts` (drafts) — those two modules are the import boundary; any other module importing `@beehiiv/sdk` is the bug. Newsletter quality gate (d) blocks dollar figures absent from the source blog post (R-001 amplification guard). To disable the step temporarily, pass `--skip-newsletter` to the script or unset `BEEHIIV_*` env vars in the workflow.

Adjusting cadence: edit the `on.schedule` entries in .github/workflows/weekly-content.yml. Prefer minute marks NOT on :00 or :30 to avoid the global cron stampede on the Anthropic API.

Project Second Brain

The repo carries five docs under docs/ that persist context across Claude Code sessions. Ideas, decisions, and risks discussed in chat get lost between sessions; these docs are how we stop that.

- docs/ROADMAP.md — NOW / NEXT / LATER / PARKED. The "what's next" backlog.
- docs/DECISIONS.md — one ADR per major architectural choice with Context + Decision + Consequences. "Why did we pick X?" lives here.
- docs/SESSION-LOG.md — reverse-chronological per-session log. Each entry: date, commits, summary paragraph, key decisions, follow-ups added to ROADMAP, state at session end.
- docs/ENV-VARS.md — registry of every env var, where it's configured, and whether it's public or secret.
- docs/RISKS.md — known risks with severity + status + trigger-to-escalate + mitigation plan.

**Hard contract for every goal:**

1. **Read** docs/ROADMAP.md and docs/SESSION-LOG.md AT THE START of work, before touching code. Surface anything relevant to the current goal — pending items, blockers, related prior sessions.
2. **Update** docs/SESSION-LOG.md with a one-paragraph summary AND any new ROADMAP items discovered during the goal, BEFORE committing the goal's work. The session-log entry is part of the goal's commit (or a follow-on commit in the same push).
3. **If the goal addresses a RISKS.md entry,** update its Status field (e.g. `monitoring` → `mitigating` → `resolved`) and add a sentence on what changed. Don't delete resolved rows — the history is the point.
4. **If the goal introduces a non-obvious architectural choice,** add an ADR to docs/DECISIONS.md in the same commit.
5. **If the goal adds or removes any env var,** update docs/ENV-VARS.md in the same commit.

This contract is non-negotiable. Skipping it loses context across sessions and the build drifts. If a goal claims to be too small to log — log it anyway in one sentence. Future-you will thank you.

Hard rules for new /goal commands

Any goal touching identification must read docs/foil-card-id-framework.md first.
Every goal ends with npm test passing AND npx tsc --noEmit clean before commit.
Conventional commit prefixes only: feat:, fix:, docs:, test:, refactor:.
Never git push --force on main. Never rewrite history.
When fixing a bug surfaced by a real upload, add a fixture to lib/__fixtures__/cards/ and a test that pins the fix.

Shipped commits (May 18–19, 2026)

997f73f — feat(vision): apply Pokemon Card Identification Framework (null-over-guess)
25ce6a1 — feat(vision): visual confirmation pass + reference images
877c841 — feat(poketrace): cacheCardImage — Supabase Storage cache
f8046a5 — fix(vision): gate low-confidence matches behind visual confirm + fix stat counting
e16c1e4 — feat: detect filter + PokeTrace images + per-card condition picker

---

## Most recent session

## 2026-05-21 — Session 9: Autonomous Beehiiv draft generation (never auto-send)

**Commits:** this commit only

**Summary.** Wired the autonomous content engine to produce a companion Beehiiv newsletter draft for every blog publish. `lib/beehiiv-posts.ts` is the second module in the Beehiiv-import boundary (joining `lib/beehiiv.ts` from [Session 8](#2026-05-21--session-8-beehiiv-email-capture-on-the-blog)); it wraps `client.posts.create` with `status: "draft"` hard-coded — there is no code path in this repo that calls posts.create with any other status. `lib/newsletter/draft-generator.ts` calls Sonnet 4.6 once per attempt to emit `{ subjects: [3 candidates], htmlBody }` in a single JSON output, then runs 6 quality gates (word count 300-600, blog backlink, Foil CTA, NO new-$ figures, no banned phrases, subject 30-65 chars) and retries up to 3x. Wired into `scripts/generate-weekly-post.ts` AFTER the blog file is written — soft-fail try/catch so any newsletter regression cannot undo a successful blog publish. `--skip-newsletter` flag added for local testing. `.github/workflows/weekly-content.yml` now passes `BEEHIIV_API_KEY` + `BEEHIIV_PUBLICATION_ID` to the script. Both are GH Actions secrets (set via `gh secret set` from `.env.local` this session).

**Key decisions made.**
- [ADR-011](DECISIONS.md#adr-011--newsletter-drafts-auto-generated-never-auto-sent) — auto-generated drafts; never auto-sent. R-001 amplification rationale + the architectural contract: status="draft" hard-coded, soft-fail wired, fact-grounding gate against the source blog post. Lifts the "deferred until ≥50 signups" trigger noted in ADR-010 because the audience-risk concern is now bounded by manual review.

**R-001 update.** Trigger-to-escalate now explicitly includes "first time a Beehiiv draft auto-generated by ADR-011 ships to subscribers without manual review" — that would mean the never-auto-send contract was broken and the engine needs an immediate audit. Channel-amplification subsection added with the three baked-in mitigations.

**Tests added.**
- `lib/__tests__/newsletter-quality-gates.test.ts` (13 tests) — every gate has a positive AND negative case, including a multi-failure case to prove no early-exit. The R-001 guard (gate d) has both a fabrication-rejection case and a comma-normalization passing case.
- `lib/__tests__/newsletter-draft-generator.test.ts` (10 tests) — happy path, parse-tolerance, stripHtml, retry-after-fabrication, 3-strike exhaustion, empty-input rejection without an API call. Stubs Anthropic via prototype patch (cheapest seam — production code unaltered).

**End-to-end MCP verification** — recorded once Beehiiv responds. Goal step 14 calls for: pick a recent blog slug → run generator via temp script → `mcp__beehiiv__list_posts(status="draft")` → `get_post_content` → assert blog link + Foil CTA + word count in band. Result captured at the bottom of this entry after verification runs.

**State at session end.** Tests + typecheck green. Newsletter pipeline is opt-in via env vars — Mon 2026-05-25 cron will be the first scheduled fire that touches it.

---

## Active roadmap (NOW + NEXT only — ask for LATER/PARKED if needed)

## NOW — this week (≤ 2026-05-27)

| # | Item | Why it's NOW | Owner | Status |
|---|------|--------------|-------|--------|
| 1 | **GitHub Actions secrets:** set `ANTHROPIC_API_KEY`, `BRAVE_SEARCH_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | The Monday + Thursday autonomous workflow can't run without these. First scheduled fire is Mon 2026-05-25 14:03 UTC. | John (manual GitHub settings) | Pending |
| 2 | **v0.dev homepage redesign** | Current `app/page.tsx` hero is functional but plain. v0 generates a stronger hero + social-proof block for the launch surface. | John (paste output) | Pending |
| 3 | **Google Search Console:** add `foiltcg.com` property, TXT-verify, submit `/sitemap.xml` | Indexing latency is 1-4 weeks. The earlier we submit, the earlier the three pillars + blog start appearing in search. | John (Cloudflare DNS + GSC UI) | Pending |
| 4 | **Decision: keep or kill the 2 auto-generated posts** | `how-to-read-a-japanese-pokemon-card` + `near-mint-vs-lightly-played-…` shipped via the new autonomy pipeline on 2026-05-20. Both passed gates on first attempt. Read them in the live preview and decide: leave up, edit, or delete. | John (manual review) | Pending |

---

## NEXT — next 2 weeks (2026-05-28 → 2026-06-10)

| # | Item | Trigger | Notes |
|---|------|---------|-------|
| 5 | **9th quality gate: "Citable claim density"** — 8+ standalone factual statements per post | AI Overview optimization. Google's SGE pulls atomic sentences that read as standalone facts; current gates reward presence of $/dates/Foil-cites but not the citable-sentence shape. | `lib/seo/quality-gates.ts` + positive/negative test in `lib/__tests__/seo-quality-gates.test.ts`. Heuristic: count sentences ≤ 25 words that contain a named entity + a verb + a specific noun. |
| 6 | **Content engine prompt: AI Overview citation discipline** | Same trigger as gate 9. Prompt needs to bias toward short declarative sentences with named entities. | Edit `SYSTEM_PROMPT` in `lib/seo/content-engine.ts`. Add a "Citable claim" rule. |
| 7 | **Run `searchfit-seo:ai-visibility` baseline** | Once domain is GSC-verified. Establishes the "before" snapshot we'll re-measure monthly. | Document the report location in `docs/SESSION-LOG.md`. |
| 8 | **Expand `seo-strategy.md` before week-10 topic exhaustion** | Backlog currently has ~35 cluster topics. At 2/week we run out around 2026-08-19. Need to add another 10-15 cluster topics OR introduce a new pillar. | Either ask the engine to propose new topics from competitive-gap reports, or hand-curate from PokeScope's blog. |
| 9 | **Scrydex API migration** | Triggered by waitlist hitting ~50 signups OR PokeTrace rate limits biting. Scrydex has per-card endpoints we'd need for programmatic per-card landing pages. | Tracked separately in [DECISIONS.md](DECISIONS.md). |

---

## Open risks worth knowing about

## R-001 — Content engine fabrication

**Severity:** High
**Status:** `accepted` pre-launch (see [ADR-006](DECISIONS.md#adr-006--full-autonomy-no-human-review-step-gates-as-the-safety-net))

**The risk.** The 8 quality gates check structure (word count, dollar figures, banned phrases, valid JSON-LD), not facts. A hallucinated "$45,000 Charizard sale" or a fabricated "PSA pop count of 234" passes every gate because it has correct dollar formatting and recent-date citations. With full autonomy, anything Claude invents ships to the live domain unreviewed.

**Why accepted.** Pre-launch, traffic is zero. A wrong fact in week 1 hurts nobody. The kill-switch (`AUTO_PUBLISH_WEEKLY_POSTS=false`) reverts to `_pending/` drafts in seconds.

**Trigger to escalate.** First time the gates pass something embarrassing OR sustained organic traffic begins (defined as: ≥100 sessions/day to blog content for 7 consecutive days) OR **the first time a Beehiiv draft auto-generated by ADR-011 ships to subscribers without manual review** (which would mean the never-auto-send architectural contract has been broken — investigate immediately and revert).

**Mitigation candidates** (tracked at [ROADMAP item #15](ROADMAP.md#later--1-3-months-2026-06-11--2026-08-20)):
1. Manual spot-check requirement on every autonomous post (revert toward the v1 review-PR architecture).
2. 24-hour `noindex` window before posts become search-visible (gives me a day to catch issues).
3. Add a 9th gate for citation density + named-entity verification ([ROADMAP item #5](ROADMAP.md#next--next-2-weeks-2026-05-28--2026-06-10)).

**Channel-amplification: newsletter.** [ADR-011](DECISIONS.md#adr-011--newsletter-drafts-auto-generated-never-auto-sent) re-raises this risk for email. Mitigations baked in: (i) newsletter quality gate (d) blocks any dollar figure not present verbatim in the source blog post — fabrication of the most failure-prone class is structurally impossible; (ii) `lib/beehiiv-posts.ts` hard-codes `status: "draft"`, so nothing ships without John pressing send in Beehiiv's UI; (iii) the newsletter pipeline is soft-fail from the workflow's perspective, so a draft-generation regression cannot cascade into the blog publish path.

## R-002 — Topic backlog exhaustion (~week 10-15)

**Severity:** Medium
**Status:** `monitoring` — re-evaluate 2026-07-15

**The risk.** `docs/seo-strategy.md` has ~35 cluster topics. At the twice-weekly cadence (ADR-005), that's ~17 weeks of runway — exhaustion lands around 2026-09-09. After exhaustion, the engine's `pickNextCandidate` throws because every backlog slug is shipped.

**Why monitoring.** 17 weeks of buffer. We'll have ranking data by then to inform which clusters to deepen.

**Trigger to mitigate.** First whichever-comes-first: (a) backlog drops below 8 unshipped items, (b) any pillar's cluster list drops below 3 unshipped items.

**Mitigation playbook.**
1. Run `scripts/competitive-gap-scan.ts` against an expanded competitor list to generate fresh topic candidates.
2. Add 10-15 new cluster bullets to `docs/seo-strategy.md` per the existing format.
3. Consider adding a 4th pillar (most likely: graded card economics, modern set EV, or specific era deep-dive).

## R-005 — Per-card persistence gap blocks accuracy diagnostics

**Severity:** Medium
**Status:** `monitoring`

**The risk.** `scans` table only stores the image metadata (filename, size, mime). The actual per-card identifications + prices live in a transient `scanResults` returned by `app/upload/actions.ts` and rendered once. We can't answer "what's the actual identification accuracy across users?" or "which cards are people scanning most?" because the data isn't persisted.

**Why monitoring.** Pre-launch, the production-grade accuracy diagnostics aren't needed yet. The data-injection helpers in `lib/seo/data-injection.ts` that would surface this stat (`mostScannedCards`) return `null` and degrade silently.

**Trigger to mitigate.** First whichever: (a) we want to A/B test vision-prompt changes against real user scans, (b) the autonomous content engine's data injection has been silent on `mostScannedCards` for >30 days and we want it back online.

**Mitigation.** Add a `scan_cards` table per [ROADMAP item #14](ROADMAP.md#later--1-3-months-2026-06-11--2026-08-20). One row per identified card per scan. Schema: `scan_id`, `card_name`, `set_code`, `collector_number`, `confidence`, `price_quotes_jsonb`. RLS: users see their own; service role sees all for aggregate analytics.

---

## What I want to discuss in this chat

<your question goes here — replace this line>
