# Environment Variables Registry

One row per env var. Source-of-truth for "where do I set this?" and "is it safe to log?"

When you add a new env var anywhere in the codebase, add a row here in the same commit. When you remove a var, mark it deprecated rather than deleting — old branches may still reference it.

---

## Active

| Name | Purpose | Configured at | Sensitivity | Required by |
|------|---------|---------------|-------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Public — safe to embed in client bundles. | `.env.local` · Vercel (production + preview) · GitHub Actions (autonomy workflow needs it for data injection) | Public | Auth, DB queries, content engine data injection |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. Public — RLS gates access. | `.env.local` · Vercel (production + preview) | Public | Browser auth flow |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role — bypasses RLS. Used by webhooks + admin tasks + content engine. | `.env.local` · Vercel (production) · GitHub Actions | Secret | Stripe webhook, autonomy data injection, admin scripts |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude Vision + content engine. | `.env.local` · Vercel (production) · GitHub Actions | Secret | Vision identify/confirm/retry passes; content engine `generateWeeklyPost` |
| `POKETRACE_API_KEY` | PokeTrace pricing API key (X-API-Key header). | `.env.local` · Vercel (production) | Secret | `lib/poketrace.ts` |
| `STRIPE_SECRET_KEY` | Stripe secret key — test mode currently; switch to live post-LLC. | `.env.local` · Vercel (production) | Secret | Checkout, customer portal, webhook signature verify |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret. Verifies webhook payloads aren't forged. | `.env.local` · Vercel (production) | Secret | `app/api/webhooks/stripe` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for client checkout redirect. | `.env.local` · Vercel (production + preview) | Public | Client checkout |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for absolute links (sitemap, OpenGraph, JSON-LD `@id`). | `.env.local` · Vercel (production + preview) | Public | Sitemap, JSON-LD, OG metadata |
| `BRAVE_SEARCH_API_KEY` | Brave Search API key for SERP context injection in the content engine. | `.env.local` · Vercel (production — optional) · GitHub Actions (autonomy) | Secret | `lib/seo/serp-fetch.ts`. Engine degrades gracefully without. |
| `AUTO_PUBLISH_WEEKLY_POSTS` | Kill-switch for autonomy. `"false"` reverts to `_pending/` drafts; any other value (or unset) → publish direct to `main`. | GitHub Actions repository **variable** (not secret) | Public | `scripts/generate-weekly-post.ts` |
| `WEEKLY_POST_WEBHOOK_URL` | URL POSTed to on successful publish + on gate-exhaustion failure. Free-form — Discord, Slack, Zapier, n8n. | `.env.local` · GitHub Actions (autonomy) | Secret | `scripts/generate-weekly-post.ts` |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel Deploy Hook URL — POSTed by the autonomous workflow after a successful commit to trigger a production build. Decouples the bot's commit author from Vercel team membership (see [ADR-008](DECISIONS.md#adr-008--vercel-deploy-hook-for-autonomous-content-not-github-integration-auto-deploys)). | GitHub Actions (autonomy workflow only) | Secret | `.github/workflows/weekly-content.yml` — "Trigger Vercel deploy" step |

---

## Pending (referenced in plans, not yet wired)

| Name | Purpose | Trigger to wire | Notes |
|------|---------|----------------|-------|
| `SCRYDEX_API_KEY` | Scrydex per-card endpoint. | [ROADMAP item #9](ROADMAP.md#next--next-2-weeks-2026-05-28--2026-06-10) — Scrydex migration when waitlist hits ~50 OR PokeTrace rate limits bite. | Needs Scrydex account + waitlist approval. |
| `TCGPLAYER_AFFILIATE_ID` | TCGplayer affiliate code appended to outbound "Buy on TCGplayer" links. | When affiliate program approval lands. | Application sent? Track in SESSION-LOG when status changes. |
| `EBAY_CAMPID` | eBay Partner Network campaign ID for outbound "Buy on eBay" links. | EPN application approval. | Same as TCGplayer. |

---

## Local dev tooling note

`.env.local` is the source of truth for local development. `vercel env pull` pulls the Vercel-stored env vars and by default writes them into `.env.local`, OVERWRITING any keys you have set locally for development. To avoid clobbering local dev keys, always pull into a separate file:

```sh
vercel env pull .env.vercel
```

Then diff manually if you want to reconcile: `diff .env.local .env.vercel`. Never run a bare `vercel env pull` in this repo.

## Where to set each scope

- **`.env.local`** — local development. Never committed. Loaded by `next dev` automatically and by scripts via the inline regex parser in each `scripts/*.ts` (see e.g. `scripts/generate-weekly-post.ts`).
- **Vercel (Production / Preview / Development)** — set via Vercel dashboard → Project → Settings → Environment Variables. The 3 environment scopes are independent; staging vs prod differences land here.
- **GitHub Actions (Repository Secrets)** — Settings → Secrets and variables → Actions → Secrets tab. Read by `${{ secrets.NAME }}` in workflow YAML.
- **GitHub Actions (Repository Variables)** — same path, Variables tab. Read by `${{ vars.NAME }}`. Use for non-sensitive config like `AUTO_PUBLISH_WEEKLY_POSTS`.
- **Supabase Edge Functions** — Supabase dashboard → Edge Functions → Secrets. Not currently used; if we add one for notifications later, log the secret here.
- **Stripe Dashboard** — webhook secrets are generated by Stripe; copy from Dashboard → Developers → Webhooks → endpoint.

---

## Sensitivity rules

- **Public** vars start with `NEXT_PUBLIC_` and are inlined into the client JS bundle by Next. Anything in this column shows up in the browser; never put secrets here.
- **Secret** vars are server-side only. Loaded from `process.env.X` in server components, API routes, server actions, and scripts. If you reference one in a client component, build will fail (or worse — silently undefined at runtime).
- When in doubt: secret. The `NEXT_PUBLIC_` opt-in keeps client-bundle leakage explicit.
