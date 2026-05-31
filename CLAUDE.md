@AGENTS.md
Foil — Pokemon TCG Deal Finder
Foil is a Pokemon TCG deal-finder — buyer-side, eBay-aggregated, per-card landing pages, wishlist email alerts. Tell us a card you want; we find you the best live deal across the major marketplaces, with affiliate-tracked CTAs and an email form to alert you when a watched card hits your target price. Target user: an active Pokemon TCG collector who wants a specific card and doesn't want to scrub eBay for the best listing themselves. Pivot date: 2026-05-23 — see [docs/STRATEGY-PIVOT-DEAL-FINDER.md](docs/STRATEGY-PIVOT-DEAL-FINDER.md) (canonical) and [ADR-020](docs/DECISIONS.md#adr-020--pivot-to-buyer-side-deal-finder-positioning) (formal record). Pre-pivot framing of Foil as a card-valuation scanner is superseded; the scanner code remains in-tree as a V2 surface.
Stack

Next.js 16 (App Router, TypeScript, Tailwind 4, Turbopack, no src/ directory)
Supabase auth (Email magic link, no email confirmation in dev) + Postgres + Storage
Stripe (shipped; primary V1 surface is the $59 lifetime founding-member payment link, deferred — per ADR-020. The original $14.99/mo Pro tier paywall code stays in-tree for V2.)
eBay Browse API (V1 sole live-listing source; TCGplayer affiliate plumbing planned for V1.5 once approval lands)
Pokemon TCG SDK (pokemontcg.io) — canonical catalog of every Pokemon card with images + set codes + metadata; pricing reference via PokeTrace and PriceCharting
Anthropic Claude (Sonnet 4.6 + Opus 4.5) — used by the autonomous content engine; also powers the scanner's vision pipeline preserved in-tree for V2
Resend — wishlist-alert email send path
Beehiiv — newsletter platform (best-deals digest, wishlist-personalized sections)
Vercel hosting; Railway for the Discord ops bot

Tiers (V1 deal-finder)

Free: per-card landing pages, best-listing recommendations, wishlist email alerts, weekly best-deals newsletter, content blog. Affiliate is primary revenue; product surface is mostly free.
Lifetime founding-member ($59 one-time, Stripe payment link): marketed via newsletter launch send. Captures highest-intent prospects at fixed upfront price. Deferred until newsletter list crosses ~100 active subscribers.
Pro power-buyer tier (V2 at earliest, ~$5-10/mo): instant alerts vs hourly batch, multi-marketplace coverage, condition-grade filtering.

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

Design skills (Session 44)

Three design-skill bundles installed under `.claude/skills/` from upstream community authors (Paul Bakaus, Leon Lin, Emil Kowalski). Each ships its own SKILL.md frontmatter; the Skill tool auto-discovers them. When a UI/design task hits one of the triggers below, invoke the matching skill BEFORE writing the code — the prompts encode opinionated design judgment that prevents the generic-AI-template aesthetic we've been actively de-risking since ADR-028 / ADR-029 / ADR-032 / ADR-033.

- **impeccable** (Paul Bakaus, `.claude/skills/impeccable/`) — Structural critique + polish. Invoke when an existing surface needs an audit, hierarchy-fix, typography pass, or "make this feel intentional rather than templated" sweep. Argument-hint covers craft/shape/audit/critique/animate/bolder/colorize/delight/layout/quieter/typeset/clarify/distill/harden/optimize/polish/teach/live. Pair with `npm run design:lint` for the structural drift detector.
- **taste-skill / soft-skill** (Leon Lin, `.claude/skills/{taste-skill,soft-skill}/`) — Aesthetic register selector. Foil's collectible-niche identity (cream + navy + gold per ADR-029) lives in the **soft-skill** register specifically; the other register skills (`brutalist-skill`, `minimalist-skill`) are installed too but should be invoked only when an intentional register break is the goal (e.g. an admin-only debugging view that benefits from brutalism's information density).
- **redesign-skill** (Leon Lin, `.claude/skills/redesign-skill/`) — Repair an existing page that's drifted off-brand or off-purpose. Use this on `/start`, `/cards/[slug]`, or any older surface that pre-dates the Session 39 cream/navy/gold migration when a complete re-layout is on the table (vs. impeccable's polish-in-place).
- **output-skill** (Leon Lin, `.claude/skills/output-skill/`) — Discipline layer that catches placeholder outputs: "lorem ipsum," `<Card>...</Card>` stubs, TODO comments shipped as production text, the AI-template "Subheading goes here" anti-pattern. Run during the closure gate of any goal that touched a public surface.
- **emil-design-eng** (Emil Kowalski, `.claude/skills/emil-design-eng/`) — Motion + micro-interaction review. Invoke on hover states, scroll-triggered reveals, page transitions, and modal/drawer choreography. Pairs with the `prefers-reduced-motion` followup tracked in ADR-029.

The other taste-skill register bundles (`gpt-tasteskill`, `image-to-code-skill`, `imagegen-frontend-mobile`, `imagegen-frontend-web`, `stitch-skill`, `taste-skill-v1`, `brandkit`, `brutalist-skill`, `minimalist-skill`) ship for completeness — the auto-discovery surfaces them in the Skill picker when an explicit register break makes them the right call. Avoid invoking them on the buyer-side deal-finder surfaces; the soft-skill register is canonical for V1.

Closure-gate hook (R-011-adjacent discipline): before claiming a UI goal closed, run `npm run design:lint` AND check that the structural drift guards in `lib/__tests__/visual-regression.test.ts` extended for the new surface still pass. Lint failures or unguarded surfaces are a goal-blocker, not a followup.

Design Context (impeccable — Session 44.x `/impeccable teach`)

`PRODUCT.md` (strategic) and `DESIGN.md` (visual, Google Stitch format) at the repo root are the canonical design context, read by every `.claude/skills/impeccable/` command and any DESIGN.md-aware tool. Read them before a UI/design task; they encode the brand line so output doesn't drift toward the generic-AI aesthetic ADR-028/029/032/033 de-risked.
- **PRODUCT.md** — register (`brand` default; gated app surfaces override to `product` per-task), users, purpose, "trusted collector concierge" personality, the four anti-references (generic AI SaaS template / loud crypto-hype / sterile enterprise dashboard / bargain-bin coupon), 5 design principles, WCAG AA + reduced-motion bar.
- **DESIGN.md** — the locked cream/navy/gold system (ADR-029) as tokens + named rules: Coral-Hover-Only, Scarce Gold (≤10%), No-Pure-Black-Or-White, Display-for-Headlines, Navy-Tinted Shadow, Flat-At-Rest. Mirrors the `--color-foil-*` tokens in `app/globals.css` and the Bricolage Grotesque / Geist pairing in `app/layout.tsx`. Sidecar `.impeccable/design.json` carries tonal ramps, shadow/motion tokens, and drop-in component snippets.
Regenerate via `/impeccable document` (visual) or `/impeccable teach` (strategic) when the system drifts; don't hand-edit them to diverge from the code.

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
- **`railway` CLI** — v4.59.0. Use service-token auth (see "Service tokens" below) for the *write* surface only: env vars (`railway variables --set`) and bucket ops. **Do not use for status checks, logs, or `list`/`link`/`service` — those flows assume an interactive TTY and will fight a headless agent (see [ADR-009 Session 15 amendment](docs/DECISIONS.md#adr-009--local-cli-tooling-for-autonomous-infra-changes)).** Use `lib/railway-api.ts` for status. Deploys go through `git push` → Railway's GitHub auto-deploy, not the CLI.
- **`lib/railway-api.ts`** — thin GraphQL wrapper around `backboard.railway.com/graphql/v2` with `RAILWAY_API_TOKEN` bearer auth. Exposes `getServiceStatus(serviceId)` returning `{ deploymentId, status, createdAt, commitSha }`. Use for "did the post-push deploy succeed?" checks.

**Service tokens for headless autonomy.** As of Session 14, two long-lived tokens live in `.env.local` + GH Actions + (where useful) Railway env. Any goal that needs `supabase` or `railway` CLI access should `export` the relevant env var inline before the CLI call — no interactive OAuth required.

- `SUPABASE_ACCESS_TOKEN` — personal access token. The `supabase` CLI reads it automatically when set. Invocation pattern: `SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN supabase db push` (or just `supabase db push` if the env var is already exported). Mirrored: `.env.local` · GitHub Actions · Railway (`foil-bot` service).
- `RAILWAY_API_TOKEN` (canonical) + `RAILWAY_TOKEN` (alias, same value) — Railway account token. Both env var names hold the same value in `.env.local` + GH Actions so the original Session-14 goal criterion (which named `RAILWAY_TOKEN`) is literally satisfied; the working invocation uses `RAILWAY_API_TOKEN`. **Caveat surfaced during verification: passing an account token through the `RAILWAY_TOKEN` env var directly to the CLI fails with "Invalid RAILWAY_TOKEN" because that var is reserved for project-scoped tokens.** Always invoke with `RAILWAY_API_TOKEN=$RAILWAY_API_TOKEN railway ...`. The `RAILWAY_TOKEN=$RAILWAY_TOKEN railway ...` invocation will fail. Mirrored: `.env.local` · GitHub Actions.

**Routing rule for new goals:**
- Touches Vercel project settings / env vars / deploy hooks / domains → `vercel ...`
- Touches GitHub secrets / workflow dispatch / releases / PRs → `gh ...`
- Touches Supabase migrations / DB schema → `SUPABASE_ACCESS_TOKEN=$... supabase ...`
- Touches Railway bot service:
  - Deploy → `git push origin main` (Railway's GitHub integration auto-deploys; no CLI step)
  - Env var write → `RAILWAY_API_TOKEN=$... railway variables --set ...`
  - Status / logs / "did the deploy go green?" → `import { getServiceStatus } from "@/lib/railway-api"` (NOT `railway status` / `railway logs`)
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

The repo carries six docs under docs/ that persist context across Claude Code sessions. Ideas, decisions, and risks discussed in chat get lost between sessions; these docs are how we stop that.

- docs/ROADMAP.md — NOW / NEXT / LATER / PARKED. The "what's next" backlog (committed work).
- docs/IDEAS.md — idea bank upstream of ROADMAP. Captures every non-trivial idea from Cowork / Discord / threads before it's been triaged. See [ADR-019](docs/DECISIONS.md#adr-019--idea-bank-as-the-6th-second-brain-doc) for the format + Sunday review cadence.
- docs/DECISIONS.md — one ADR per major architectural choice with Context + Decision + Consequences. "Why did we pick X?" lives here.
- docs/SESSION-LOG.md — reverse-chronological per-session log. Each entry: date, commits, summary paragraph, key decisions, follow-ups added to ROADMAP, state at session end.
- docs/ENV-VARS.md — registry of every env var, where it's configured, and whether it's public or secret.
- docs/RISKS.md — known risks with severity + status + trigger-to-escalate + mitigation plan.

Separately, docs/PATTERNS.md tracks cross-cutting *engineering* patterns spotted during build (not product ideas) — promote a pattern entry to a dedicated ADR after the second instance lands.

**Hard contract for every goal:**

1. **Read** docs/ROADMAP.md and docs/SESSION-LOG.md AT THE START of work, before touching code. Surface anything relevant to the current goal — pending items, blockers, related prior sessions.
2. **Update** docs/SESSION-LOG.md with a one-paragraph summary AND any new ROADMAP items discovered during the goal, BEFORE committing the goal's work. The session-log entry is part of the goal's commit (or a follow-on commit in the same push).
3. **If the goal addresses a RISKS.md entry,** update its Status field (e.g. `monitoring` → `mitigating` → `resolved`) and add a sentence on what changed. Don't delete resolved rows — the history is the point.
4. **If the goal introduces a non-obvious architectural choice,** add an ADR to docs/DECISIONS.md in the same commit.
5. **If the goal adds or removes any env var,** update docs/ENV-VARS.md in the same commit.
6. **If the goal (or the conversation that triggered it) surfaces a non-trivial idea** — a feature, marketing play, competitive observation, monetization lever, etc. — add an entry to docs/IDEAS.md before session end. Same discipline as SESSION-LOG. The idea is the unit of work; capturing it is the contract. The idea bank is what lets a future Sunday review session triage what made it through the week.

This contract is non-negotiable. Skipping it loses context across sessions and the build drifts. If a goal claims to be too small to log — log it anyway in one sentence. Future-you will thank you.

Hard rules for new /goal commands

Every goal opens with a P0 premise check, BEFORE the first work phase. If you see (a) a better path to the same outcome, (b) data contradicting a load-bearing premise of the goal, or (c) a phase that's already de facto done, stop and surface it to John in one honest, evidence-cited paragraph (no theorizing) before proceeding. Yield if convinced; hold and briefly say why if not. This caught a self-defeating fix in Session 47.4 (the deploy "ignore command" wasn't the cause — ADR-045) and an infeasible ranking premise (PokeTrace can't sort by sale volume — ADR-046) before either burned a cycle. The premise check is cheap; a goal built on a wrong premise is not.
Any goal touching identification must read docs/foil-card-id-framework.md first.
Every goal ends with npm test passing AND npx tsc --noEmit clean AND a /security-review pass with no High-severity findings before commit. The /security-review skill (claude-code-security-review) is the closure-gate's "second AI brain" check on the work the goal-running agent just produced — it catches injection risks, secret-exposure paths, error-handling gaps, and architectural anti-patterns that tests don't pin. Medium/Low findings get triaged inline (fix-or-document-why-not in the SESSION-LOG entry); a High finding blocks the commit until resolved.
Conventional commit prefixes only: feat:, fix:, docs:, test:, refactor:.
Never git push --force on main. Never rewrite history.
When fixing a bug surfaced by a real upload, add a fixture to lib/__fixtures__/cards/ and a test that pins the fix.

Shipped commits (May 18–19, 2026)

997f73f — feat(vision): apply Pokemon Card Identification Framework (null-over-guess)
25ce6a1 — feat(vision): visual confirmation pass + reference images
877c841 — feat(poketrace): cacheCardImage — Supabase Storage cache
f8046a5 — fix(vision): gate low-confidence matches behind visual confirm + fix stat counting
e16c1e4 — feat: detect filter + PokeTrace images + per-card condition picker