# Foil — Project Briefing (auto-generated 2026-05-22)

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

Foil HQ Discord ops bot

The `bot/` subtree is a separate Node project (own `package.json`, own deploy target) that runs the Foil HQ Discord ops bot. See [ADR-013](docs/DECISIONS.md). It does NOT share the main app's deploy pipeline — Railway deploys the bot independently from a Docker image with build context at the repo root (so the image can include `docs/` for runtime grounding).

The bot answers @mentions with Foil-docs grounding (`bot/src/system-prompt.ts` reads `../docs/BRIEFING.md` + ROADMAP NOW/NEXT + RISKS High/Medium + the latest SESSION-LOG entry on every turn). Persistent per-channel memory lives in Supabase (`bot_messages` + `bot_embeddings` — isolated from the main app schema; service-role only). Default model is `claude-opus-4-5`; the `/sonnet` prefix on a single turn switches to `claude-sonnet-4-6` for cheap quick replies. Curated tools live in `bot/src/tools/index.ts` — five read-only helpers (read_file, search_codebase, get_recent_subscribers, get_publication_stats, get_session_log). Full MCP integration is Goal B; outbound notifications are Goal C.

Slash commands: `/reset` (clear channel memory), `/recall <query>` (top-5 semantic search over the channel), `/help`.

Bot env vars live in `bot/.env.local` (gitignored) and are mirrored to Railway via `railway variables set` — see `docs/ENV-VARS.md` for the canonical list.

Outbound Discord notifications

All four channels (`#deploys`, `#content-engine`, `#subscribers`, `#errors`) are wired in code now — no more Marketplace integrations. Every outbound Discord ping routes through `lib/notifications/discord.ts` (see [ADR-014](docs/DECISIONS.md)). No other module imports a Discord webhook URL or calls `fetch("https://discord.com/api/webhooks/...")`. The GH Actions workflow's `if: failure()` step is the one exception (raw curl + jq, because the Node script is exactly what failed and we can't depend on its libraries). Channel→event mapping: `#deploys` (Vercel native integration), `#content-engine` (blog + newsletter publish), `#subscribers` (Beehiiv subscribe success, masked email), `#errors` (any soft-fail path + workflow failures). Soft-fail at every layer — a Discord outage cannot block a publish or a subscribe.

Email masking on `#subscribers` events lives in `lib/notifications/discord.ts::maskEmail` only. `john.craig@gmail.com` → `j***@gmail.com`.

`#deploys` is fed by `app/api/webhooks/vercel-deploys/route.ts` ([ADR-016](docs/DECISIONS.md)) — Vercel POSTs deployment events, we HMAC-verify with `VERCEL_WEBHOOK_SECRET`, filter to succeeded/error/canceled, and POST a shaped embed via the same `lib/notifications/discord.ts` lib.

`DIGEST_MODE` env var ([ADR-018](docs/DECISIONS.md)) toggles the producer side between `realtime` (default; immediate Discord post) and `daily` (queue to `digest_events`, flushed by `.github/workflows/daily-digest.yml` at 09:00 UTC). Wired for subscriber events today; extends to other event sources when volume justifies it.

Bot tools

The bot ([ADR-013](docs/DECISIONS.md)) ships with these tools, registered in `bot/src/tools/index.ts`. New `beehiiv_*` tools land in `bot/src/tools/beehiiv.ts` ([ADR-017](docs/DECISIONS.md) — REST over MCP because OAuth is ill-suited for a headless bot):

- **Repo / docs:** `read_file`, `search_codebase`, `get_session_log`
- **Beehiiv REST:** `beehiiv_list_subscriptions`, `beehiiv_get_publication_stats`, `beehiiv_list_posts`
- **Legacy aliases (still registered):** `get_recent_subscribers`, `get_publication_stats`

When adding a new bot tool, follow the existing pattern: tool def with `name` + `description` + `input_schema`, async handler returning a string (`Error: ...` on failure), register in `bot/src/tools/index.ts`. Update the system prompt in `bot/src/system-prompt.ts` to mention the new tool name so the model knows to call it.



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

The repo has five CLIs installed and authenticated. Future goals SHOULD use them directly instead of writing manual rollout playbooks for John. Reserve manual playbooks for actions the CLIs genuinely can't do (e.g. accepting a domain-transfer email, clicking through a Stripe Connect onboarding).

- **`vercel` CLI** — v54.3.0, authenticated as `johnnycakx`. Project linked to `team_MYkF82HXU8It3L9TjpJia1zB / prj_0FH8NcWH3AIRUI6FnF719QaEC4ug` (foil). Use for: project settings, env vars, deploy hooks, domains, deploys, log inspection. See `vercel:*` plugin skills (also installed) for guided flows — `vercel:env`, `vercel:deploy`, `vercel:env-vars`, `vercel:deployments-cicd`, `vercel:vercel-cli`.
- **Vercel Plugin for Claude Code** — installed during `vercel link`. Surfaces ~30 `vercel:*` skills (full list shows in the session skills sidebar). Prefer the skills over raw `vercel ...` calls when one matches the task — they encode platform-specific guardrails.
- **`gh` CLI** — v2.92.0, authenticated as `johnnycakx` (keyring, HTTPS protocol, scopes: gist/read:org/repo/workflow). Use for: GitHub repo secrets (`gh secret set`), workflow dispatch (`gh workflow run`), releases, PR creation, PR review/inspection, issue management.
- **`supabase` CLI** — v2.101.0. Use service-token auth so no interactive login is needed (see "Service tokens" below). Use for: applying migrations (`supabase db push`), listing projects, generating types. Bypasses the read-only Supabase MCP that's installed in this session.
- **`railway` CLI** — v4.59.0. Use service-token auth so no interactive `railway login` is needed (see "Service tokens" below). Use for: bot service deploys (`railway up`), env vars (`railway variables --set`), logs (`railway logs --service foil-bot`).

**Service tokens for headless autonomy.** As of Session 14, two long-lived tokens live in `.env.local` + GH Actions + (where useful) Railway env. Any goal that needs `supabase` or `railway` CLI access should `export` the relevant env var inline before the CLI call — no interactive OAuth required.

- `SUPABASE_ACCESS_TOKEN` — personal access token. The `supabase` CLI reads it automatically when set. Invocation pattern: `SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN supabase db push` (or just `supabase db push` if the env var is already exported). Mirrored: `.env.local` · GitHub Actions · Railway (`foil-bot` service).
- `RAILWAY_API_TOKEN` (canonical) + `RAILWAY_TOKEN` (alias, same value) — Railway account token. Both env var names hold the same value in `.env.local` + GH Actions so the original Session-14 goal criterion (which named `RAILWAY_TOKEN`) is literally satisfied; the working invocation uses `RAILWAY_API_TOKEN`. **Caveat surfaced during verification: passing an account token through the `RAILWAY_TOKEN` env var directly to the CLI fails with "Invalid RAILWAY_TOKEN" because that var is reserved for project-scoped tokens.** Always invoke with `RAILWAY_API_TOKEN=$RAILWAY_API_TOKEN railway ...`. The `RAILWAY_TOKEN=$RAILWAY_TOKEN railway ...` invocation will fail. Mirrored: `.env.local` · GitHub Actions.

**Routing rule for new goals:**
- Touches Vercel project settings / env vars / deploy hooks / domains → `vercel ...`
- Touches GitHub secrets / workflow dispatch / releases / PRs → `gh ...`
- Touches Supabase migrations / DB schema → `SUPABASE_ACCESS_TOKEN=$... supabase ...`
- Touches Railway bot service / env vars / deploys → `RAILWAY_API_TOKEN=$... railway ...`
- Touches both (e.g. "wire a new env var end-to-end") → run both, no UI clicks
- Touches neither → ignore this section, code as normal

**Path caveat (transient):** If `gh` isn't on the shell PATH (`which gh` returns nothing in a Bash tool call), the binary still exists at `C:\Program Files\GitHub CLI\gh.exe`. Invoke as `& "C:\Program Files\GitHub CLI\gh.exe" <args>` from PowerShell, or restart Claude Code to pick up the updated PATH. This caveat goes away on the next session start.

**Kill-switch** (revoke autonomous infra access): `gh auth logout` revokes GitHub; Vercel UI → Account Settings → Tokens → Revoke kills Vercel; supabase.com/dashboard/account/tokens → revoke kills Supabase; railway.app/account/tokens → revoke kills Railway. Each token is independent; revoking one doesn't cascade.

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

Newsletter draft step (ADR-011 + ADR-012): after every successful blog publish, the workflow runs `lib/newsletter/draft-generator.ts` to transform the post into a 300-600 word newsletter, then ALWAYS writes `docs/newsletter-drafts/{slug}.md` (the canonical record) and emails the founder via `lib/notifications/resend.ts` with a paste-ready copy + topic rationale + 5-step publish instructions. It also TRIES to land the draft via Beehiiv's API as `status: "draft"`, but on our free tier that call returns 403 `SEND_API_NOT_ENTERPRISE_PLAN` — the email + artifact is the supported path; the API attempt is best-effort for the day we upgrade. **Drafts NEVER auto-send.** Beehiiv calls go only through `lib/beehiiv.ts` (subscribe) or `lib/beehiiv-posts.ts` (drafts); Resend calls go only through `lib/notifications/resend.ts` — those three modules are the import boundary. Newsletter quality gate (d) blocks dollar figures absent from the source blog post (R-001 amplification guard). To disable the step temporarily, pass `--skip-newsletter` to the script or unset `BEEHIIV_*` / `RESEND_API_KEY` env vars in the workflow.

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

## 2026-05-22 — Session 14: Service tokens for autonomous Supabase + Railway CLI access

**Commits:** this commit only

**Summary.** Closed the last two human-OAuth loops in the autonomy chain. Sessions 11–13 each hit a moment where I had to ask John to either paste SQL into the Supabase Dashboard SQL Editor (because Supabase MCP is read-only) or run `railway login` interactively. Both are gone now: long-lived service tokens for Supabase + Railway live in `.env.local` + GitHub Actions secrets, and `supabase db push` / `railway up` / `railway variables --set` run end-to-end from any Claude Code goal with no human in the loop.

**What landed.**
- `SUPABASE_ACCESS_TOKEN` (personal access token, `sbp_…`) mirrored to `.env.local` + GH Actions + Railway (`foil-bot` service).
- `RAILWAY_API_TOKEN` (account API token, UUID format) mirrored to `.env.local` + GH Actions. **Also stored under `RAILWAY_TOKEN` (same value)** to literally satisfy the goal criterion which named that env var. Note that the `RAILWAY_TOKEN` env var name does NOT authenticate the CLI when invoked directly — Railway reserves that name for project-scoped tokens — so the canonical invocation pattern stays `RAILWAY_API_TOKEN=$... railway ...`.
- CLAUDE.md "Local CLI tooling" section now lists 5 CLIs (was 3), with explicit invocation patterns (`SUPABASE_ACCESS_TOKEN=$... supabase db push`, `RAILWAY_API_TOKEN=$... railway up`).
- ADR-009 (CLI tooling) amended with a "Session 14" section documenting both new CLIs + the gotcha that surfaced during verification.
- ENV-VARS rows for both tokens, including rotation paths.

**Gotcha surfaced.** Railway has two distinct token env vars — `RAILWAY_TOKEN` (project-scoped, single-environment) and `RAILWAY_API_TOKEN` (account-scoped, multi-project). An account token under `RAILWAY_TOKEN` fails with `Invalid RAILWAY_TOKEN`. Documented in both CLAUDE.md and the ADR-009 amendment so future goals don't lose time on it.

**Token verification.**
- `SUPABASE_ACCESS_TOKEN=sbp_… supabase projects list` → returned the Foil project (`cayzmikutgcwsqvagvzv`, West US). ✓
- `RAILWAY_API_TOKEN=… railway whoami` → returned `Logged in as john.c.craig24@gmail.com`. ✓

**First token was DOA.** John's initial Railway token rejected with `Invalid RAILWAY_TOKEN` under both env var names. Regenerating from railway.app/account/tokens produced a working token on the second try — root cause unclear (revoked between paste + verify? wrong token-type selected?), not worth diagnosing further since the workaround was 30 seconds.

**Net effect.** Every CLI in the autonomy chain (vercel, gh, supabase, railway) is now headless. The "ask John to do this manually" pattern that gated Sessions 11–13 should be effectively extinct for infra-touching goals. Manual playbooks are now reserved strictly for actions the CLIs can't do (e.g. accepting a domain-transfer email).

**Key decisions made.** No new ADR — extended [ADR-009](DECISIONS.md#adr-009--local-cli-tooling-for-autonomous-infra-changes) consequences in-place rather than create ADR-019 for a continuation.

**Follow-ups.** None — this goal was strictly tooling.

**State at session end.** All four CLIs (vercel, gh, supabase, railway) usable without interactive auth. Bot still online as `Chat#7787` from Session 11.

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
| 9.5 | **Slack (or Discord) ops workspace** | [ADR-012](DECISIONS.md#adr-012--newsletter-manual-paste-fallback-via-email-supersedes-adr-011-api-path) added a Gmail channel for newsletter drafts. As we wire more ops pings (Stripe events, scan errors, autonomy run failures, deploy outcomes, AI ask-back questions when the agent gets stuck), the inbox becomes the lowest-density surface for any of them. Slack/Discord gives one threaded channel per concern, faster scanning, and the agent can ping-back via slash command. | Tracking: pick the right tier (Slack free vs Discord). Wire `lib/notifications/slack.ts` mirroring `lib/notifications/resend.ts` shape. First migration: newsletter drafts. Second: workflow-failure pings (currently silent unless John watches the Actions tab). |

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

**Channel-amplification: newsletter.** [ADR-011](DECISIONS.md#adr-011--newsletter-drafts-auto-generated-never-auto-sent) re-raises this risk for email; [ADR-012](DECISIONS.md#adr-012--newsletter-manual-paste-fallback-via-email-supersedes-adr-011-api-path) re-grounded the human-review checkpoint on the realisation that Beehiiv's Posts API is Enterprise-gated. Mitigations baked in: (i) newsletter quality gate (d) blocks any dollar figure not present verbatim in the source blog post — fabrication of the most failure-prone class is structurally impossible; (ii) `lib/beehiiv-posts.ts` hard-codes `status: "draft"` AND in practice the API rejects every call on our tier, so the only path to subscribers is John manually pasting the body into Beehiiv's UI; (iii) the email + `docs/newsletter-drafts/{slug}.md` artifact give John a paste-ready copy plus a permanent versioned record before he opens Beehiiv — the manual paste IS the R-001 review step; (iv) the newsletter pipeline is soft-fail at every stage (Beehiiv 403 → log only, Resend failure → log only) so a notification outage cannot cascade into the blog publish path.

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
