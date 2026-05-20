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

Weekly SEO content engine

The content engine drafts a new blog post every Monday from the cluster backlog in docs/seo-strategy.md, then opens a review PR. John reviews in the Vercel preview and merges to publish — or closes the PR to skip the topic.

- node --experimental-strip-types scripts/generate-weekly-post.ts — pick next backlog topic, draft via Claude Sonnet 4.6, write to app/blog/posts/_pending/{slug}.mdx
- node --experimental-strip-types scripts/refresh-internal-links.ts [slug] — scan for incoming + outgoing link opportunities for the most recently shipped post (or the named slug); writes docs/internal-link-suggestions.md
- node --experimental-strip-types scripts/competitive-gap-scan.ts [url ...] — pull competitor URLs, diff headings against Foil's topic coverage, write docs/competitive-gaps.md
- Scheduled run: .github/workflows/weekly-content.yml — Mondays 14:03 UTC, requires repo secret ANTHROPIC_API_KEY (and optionally WEEKLY_POST_WEBHOOK_URL for ping)

Pending posts live under app/blog/posts/_pending/ (underscore prefix → ignored by app/blog/posts-meta.ts so they don't enter generateStaticParams). To publish: git mv app/blog/posts/_pending/{slug}.mdx app/blog/posts/{slug}.mdx, then run refresh-internal-links.

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