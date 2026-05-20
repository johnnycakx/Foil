@AGENTS.md
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