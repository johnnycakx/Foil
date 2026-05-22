# Architecture Decision Records

One ADR per major choice. Format: each decision is a short Markdown section with **Status**, **Context**, **Decision**, **Consequences**. The point isn't completeness — it's preventing "wait, why did we pick X?" three months from now.

Add new ADRs at the bottom. Don't edit historic ADRs except to flip their status (Superseded by ADR-N).

---

## ADR-001 — Domain: `foiltcg.com` over `foil.app`

**Date:** 2026-05-18
**Status:** Accepted

**Context.** The product is a Pokémon TCG scanner. Two viable domains were available: `foil.app` (cleaner, modern-app vibe, $30/yr) and `foiltcg.com` (keyword-rich, $12/yr). SEO target is `pokemon card value calculator` and adjacent long-tails.

**Decision.** Take `foiltcg.com`. The `tcg` substring is a partial-match keyword signal for the entire trading-card-game category, `.com` is the trust default for marketplace/valuation tools, and the cost is one third.

**Consequences.** Slight branding awkwardness — "foiltcg" is harder to say out loud than "foil dot app". For a product with primarily organic + word-of-Twitter acquisition, the SEO + trust gain outweighs the brand cost. If we ever pivot to multi-TCG (parked, see [ROADMAP](ROADMAP.md#parked--explicitly-deferred)), the `tcg` suffix actually still fits.

---

## ADR-002 — Pricing data: PokeTrace + PriceCharting (Scrydex deferred)

**Date:** 2026-05-18
**Status:** Accepted — Scrydex migration tracked in [ROADMAP item #9](ROADMAP.md#next--next-2-weeks-2026-05-28--2026-06-10)

**Context.** Three viable pricing APIs: PokeTrace, PriceCharting, Scrydex. PokeTrace gives multi-source ungraded (eBay + TCGplayer + Cardmarket) and graded ladder. PriceCharting is best-in-class for graded comps with deep history. Scrydex has the cleanest per-card endpoint design but requires application + waitlist.

**Decision.** PokeTrace for ungraded + initial graded surface, PriceCharting for the full graded ladder (PSA 7-10, BGS 9.5/10, CGC 10, SGC 10). Defer Scrydex until we have a real use case (per-card programmatic landing pages) or hit PokeTrace rate limits.

**Consequences.** Two API surfaces means two failure modes — `lib/poketrace.ts` and `lib/pricecharting.ts` both have their own caching and error paths. Worth it because PokeTrace alone is too thin on graded depth. When we migrate to Scrydex it'll be partial — PokeTrace probably stays for the ungraded multi-source rollup.

---

## ADR-003 — Single-card scanning is the V1 primary UX; binder mode is an advanced toggle

**Date:** 2026-05-19
**Status:** Accepted

**Context.** Original V1 design had the upload flow default to "binder page" (multi-card detect → identify pipeline). Real-world testing showed the binder pipeline takes 15-30s and has lower per-card confidence, while the primary use case ("I'm on Marketplace, is this Charizard worth buying?") is exactly one card. The single-card path can skip the detect pass and runs in 6-8s.

**Decision.** `mode=single` is the default in `app/upload/upload-form.tsx`. `mode=binder` is an explicit toggle labeled "advanced — scan up to 50 cards". The UI surface explains the speed trade-off inline.

**Consequences.** Most users never see the binder path. That's fine — binder is a power-user feature and a marketing differentiator, not the conversion-driving flow. The two paths share `runScanPipeline` in `lib/scan-pipeline.ts` so we maintain one identify+price code path with two entry points.

---

## ADR-004 — Brave Search for SERP context injection (2K/mo free fits 2x/week cadence)

**Date:** 2026-05-20
**Status:** Accepted

**Context.** The autonomous content engine needs to know what the top-3 Google results for a target query look like so generated posts can reference and beat them. Options: SerpApi ($50/mo at low tier), Brave Search API (2K queries/mo free, $5/CPM after), DataForSEO ($30/mo + per-call), or scrape Google directly (TOS violation + brittle).

**Decision.** Brave Search API on the free tier. At 2 posts/week × ~4-6 fetches per post (one for primary keyword + scrape top-3 outlines) we're well under 2K/mo even with retries.

**Consequences.** Brave's index is smaller and less authoritative than Google's, so the "top results" may not perfectly match what an actual searcher sees. Acceptable trade-off — the engine uses the outlines as competitive context, not as ground truth. Cache hits via `lib/seo/serp-fetch.ts` 24h cache keep usage well-bounded. Upgrade trigger: cadence change to >4 posts/week OR Brave-Google divergence becomes a measurable content-quality problem.

---

## ADR-005 — Twice-weekly content cadence: Mondays + Thursdays at 14:03 UTC

**Date:** 2026-05-20
**Status:** Accepted

**Context.** Search engines reward update frequency for blogs in the indexing-velocity-sensitive phase (months 0-6 of a new domain). Daily is overkill for a solo founder pre-launch; weekly is fine but slow. Twice-weekly is the sweet spot for indexing signal without burning excessive Claude tokens.

**Decision.** Two cron entries: `'3 14 * * 1'` (Mon) and `'3 14 * * 4'` (Thu), both at 14:03 UTC (09:03 ET / 06:03 PT). The :03 minute mark avoids the global cron stampede at `:00`.

**Consequences.** ~$2/week Claude spend at current draft sizes. Backlog of ~35 cluster topics in `docs/seo-strategy.md` lasts ~17 weeks at this rate before exhaustion (tracked as [ROADMAP item #8](ROADMAP.md#next--next-2-weeks-2026-05-28--2026-06-10)).

---

## ADR-006 — Full autonomy: no human review step, gates as the safety net

**Date:** 2026-05-20
**Status:** Accepted (with known risk — see [RISKS.md R-001](RISKS.md))

**Context.** The prior architecture drafted posts to `_pending/` and opened a review PR. John reviewed in the Vercel preview, merged or closed. That works but adds 5-15 min per post of human time — and the whole point of an autonomous engine is to remove that friction. Two options: keep manual review (safe, slow) or commit to autonomy + lean on quality gates as the structural safety net.

**Decision.** Full autonomy. The workflow commits direct to `main`. 8 quality gates enforce structural properties (word count, dollar figures, recent dates, Foil data citations, banned phrases, schema validity, FAQ length, internal links). If gates fail 3x with re-prompting, the run skips and logs.

**Consequences.** Quality gates check STRUCTURE, not FACTS. Hallucinated prices that have correct dollar formatting pass gate (b). Pre-launch and pre-traffic, this risk is acceptable. The kill switch (`AUTO_PUBLISH_WEEKLY_POSTS=false` repo variable) reverts to `_pending/` drafts. Risk tracked at [RISKS.md R-001](RISKS.md). Mitigation candidates in [ROADMAP item #15](ROADMAP.md#later--1-3-months-2026-06-11--2026-08-20).

---

## ADR-007 — 8 quality gates + 3 retries + skip-on-failure (not fail-the-build)

**Date:** 2026-05-20
**Status:** Accepted

**Context.** When the content engine fails its gates after retries, the workflow could (a) fail loudly so John fixes the prompt, or (b) skip the run silently so the next cron tries a different topic. Option (a) is louder but creates dead Mondays where no post ships if the engine is in a bad state.

**Decision.** Skip-on-failure (option b). The script exits with code 2 on gate exhaustion; the workflow treats exit 2 as "no commit, log a warning, move on." A webhook can optionally fire to alert John.

**Consequences.** If the engine ever enters a sustained bad state, we silently miss posts until John notices. Mitigation: every gate-exhaustion exit logs the full failure list to GitHub Actions output AND optionally POSTs to `WEEKLY_POST_WEBHOOK_URL`. Re-evaluate this trade-off if we ever see ≥2 consecutive skipped runs.

---

## ADR-008 — Vercel Deploy Hook for autonomous content, not GitHub-integration auto-deploys

**Date:** 2026-05-21
**Status:** Accepted — rollout complete 2026-05-21 (Deploy Hook created, `VERCEL_DEPLOY_HOOK_URL` stored as GitHub secret, Ignored Build Step configured to skip `foil-content-bot` commits)

**Context.** The autonomous content workflow (see [ADR-006](#adr-006--full-autonomy-no-human-review-step-gates-as-the-safety-net)) commits as `bot+content@foil.app` via the workflow's configured git identity. Vercel's GitHub integration auto-deploys commits to `main` only when the commit author is on the Vercel team — and the bot identity isn't. The first Thursday cron (2026-05-21) shipped a commit fine but Vercel rejected the deploy and sent a rejection email. Same outcome guaranteed every Monday + Thursday.

Two ways out:

1. **Add `bot+content@foil.app` to the Vercel team.** Works, but couples production deploys to GitHub team membership. If we ever rotate the bot identity, change the email, add a second bot, or remove team access for any reason, deploys silently stop.
2. **Use a Vercel Deploy Hook.** A signed URL Vercel exposes that triggers a production build of a specified branch on POST. Decouples publishing from the commit author entirely — the workflow can curl the hook regardless of who authored the commit, and the kill-switch behavior falls out for free (no commit → no deploy trigger).

**Decision.** Option 2. Add a "Trigger Vercel deploy" step to `.github/workflows/weekly-content.yml` that fires after a successful commit, gated on a new `committed=true` output from the commit step. The hook URL lives in repo secret `VERCEL_DEPLOY_HOOK_URL`. Additionally: configure Vercel's project settings to ignore commits authored by `bot+content@foil.app` from the GitHub integration so the rejection emails stop.

**Consequences.**

- **Pro:** Bot identity stays separate from Vercel team membership. Adding a second automation account (e.g. for syndication later) doesn't require Vercel team changes.
- **Pro:** Kill-switch (`AUTO_PUBLISH_WEEKLY_POSTS=false`) cleanly skips both the commit AND the deploy with the same `if: steps.commit.outputs.committed == 'true'` gate — no separate plumbing.
- **Pro:** Deploy logs in Vercel UI still show the trigger source as "Deploy Hook (weekly-content)" — visibility is preserved.
- **Con:** Manual-commit deploys (someone pushing directly to `main` from a workstation) still flow through the GitHub integration, so if the integration breaks, that path breaks too. Acceptable — manual deploys are the rare path.
- **Con:** If the hook secret is ever lost or rotated, the workflow silently stops deploying. The workflow does log a warning when the secret is unset (so a missing-secret state is detectable in Actions output), but a malformed/expired secret would only surface as repeated non-200 responses. Worth checking the first few runs after rollout.
- **Implementation note:** the workflow's deploy step does NOT fail the run on a non-200 response — it logs a warning. The commit is already on `main` at that point and a manual redeploy from Vercel UI is always available as a fallback. Failing the run would mark every Monday red in the Actions tab for what's really an "ops issue, not a content issue."

**Manual rollout steps** (these can't be automated from the workflow itself — captured here so they're not lost):

1. Vercel UI → project settings → Git → Deploy Hooks → Create Hook. Name: `weekly-content`. Branch: `main` (the production branch).
2. Copy the generated URL. Add as a GitHub Actions repository secret named `VERCEL_DEPLOY_HOOK_URL`.
3. Vercel UI → project settings → Git → "Ignored Build Step" (or equivalent commit-filter setting). Add a rule that skips builds for commits authored by `bot+content@foil.app`. This stops the rejection emails on every cron.

## ADR-009 — Local CLI tooling for autonomous infra changes

**Date:** 2026-05-21
**Status:** Accepted

**Context.** [ADR-008](#adr-008--vercel-deploy-hook-for-autonomous-content-not-github-integration-auto-deploys) shipped the workflow + docs for the Vercel Deploy Hook, but the rollout blocked for ~50 minutes inside Claude Code because the acceptance criteria required Vercel UI actions and a GitHub-Secrets UI action that the agent couldn't perform autonomously. The agent's only escape valves were (a) John clicks through the UI, (b) John pastes a Vercel token, or (c) defer the goal to ROADMAP tracking. The stop hook fired ~10 times before John could complete the clicks. That's not a one-off — every future goal that touches Vercel project settings, env vars, deploy hooks, domains, GitHub secrets, workflow dispatch, or PR ops would hit the same wall.

Two ways out:

1. **Keep writing manual rollout playbooks for John.** Cheap to implement (it's what we already do), but every goal that needs infra changes pays a ~30-60min "click through the UI" tax on top of the actual work. The Stop hook loop also burns Claude Code tokens for nothing while waiting on human action.
2. **Install local CLIs that authenticate to those services and let Claude Code drive them.** Higher one-time cost (install + auth + add to PATH + grant token scopes), but every future infra change becomes a one-shot Bash call instead of a playbook handoff.

**Decision.** Option 2. Installed today:

- `vercel` CLI (`npm i -g vercel`), authenticated as `johnnycakx`, project linked to `team_MYkF82HXU8It3L9TjpJia1zB / prj_0FH8NcWH3AIRUI6FnF719QaEC4ug` (foil). `.env.local` was preserved during `vercel link` — not overwritten.
- Vercel Plugin for Claude Code — installed during `vercel link`. Surfaces ~30 `vercel:*` skills (vercel:env, vercel:deploy, vercel:env-vars, vercel:deployments-cicd, etc.) that wrap CLI flows with platform-specific guardrails.
- `gh` CLI v2.92.0, authenticated as `johnnycakx` via web browser, HTTPS protocol, git authentication enabled. Scopes: gist, read:org, repo, workflow.

Future goals MUST prefer `vercel ...` / `gh ...` calls over writing manual UI playbooks. The routing rule is in CLAUDE.md → "Local CLI tooling for autonomous infra changes".

**Consequences.**

- **Pro:** Goals that previously needed UI clicks now autonomous end-to-end. ADR-008's rollout, repeated against the new tooling, would have been a `gh secret set VERCEL_DEPLOY_HOOK_URL` + `vercel deploy-hooks create` + `vercel project update --ignored-build-step '...'` in 30 seconds.
- **Pro:** Stop hook loops on "criteria not satisfied because they require UI actions" should be effectively extinct for Vercel + GitHub surfaces.
- **Con:** Two more credential surfaces to manage. Both are token-based and revocable (kill-switch documented in CLAUDE.md).
- **Con:** The `vercel:*` plugin skills shift the project's session-skills surface — there are now ~30 more skills competing for attention. Future "should I use a skill?" decisions need to be more careful about which skill is the right tool, since the surface is denser.
- **Caveat:** On first install, `gh` may not be on the shell PATH that Claude Code's spawned subprocesses see. Workaround documented in CLAUDE.md (invoke via full path or restart Claude Code). This is transient — goes away on the next session start.
- **Caveat:** Goals that touch *destructive* infra (delete a Vercel project, revoke production env vars, force-push tags) should still pause and confirm before executing — having the CLIs available doesn't change the underlying carefulness rule.

**Kill-switch.** `gh auth logout` revokes GitHub access. Vercel UI → Account Settings → Tokens → Revoke kills Vercel access. Both are session-scoped credentials with no machine-wide effect beyond their respective CLI scopes.

**2026-05-22 amendment (Session 14): Supabase + Railway service tokens added.** Per the original ADR's "Future goals MUST prefer CLI calls over manual UI playbooks" rule, two more CLIs joined the tooling chain:

- `supabase` CLI v2.101.0, authenticated via long-lived **personal access token** (`SUPABASE_ACCESS_TOKEN` env var). Replaces the manual "paste this SQL into the dashboard" step that's been the bottleneck in Sessions 11–13 (Supabase MCP is read-only by design). Migrations now apply via `SUPABASE_ACCESS_TOKEN=$... supabase db push` from any Claude Code goal.
- `railway` CLI v4.59.0, authenticated via long-lived **account API token** (`RAILWAY_API_TOKEN` env var — **NOT** `RAILWAY_TOKEN`, which is reserved for project-scoped tokens that fail account-level calls). Replaces the interactive `railway login` step that gated Session 11's first deploy. Bot deploys + env-var pushes now run headless.

**Gotcha surfaced.** Railway has two token env vars — `RAILWAY_TOKEN` (project-scope, single-environment) and `RAILWAY_API_TOKEN` (account-scope, multi-project). The CLI rejects an account token under `RAILWAY_TOKEN` with `Invalid RAILWAY_TOKEN`. Documented in CLAUDE.md's CLI section so future goals don't lose 5 minutes diagnosing it.

**Net effect.** Every CLI in the toolkit (vercel, gh, supabase, railway) is now usable without interactive auth. The "ask John to run `railway login` from his terminal" loop from Session 11 is gone. Any goal that touches infrastructure runs end-to-end from Claude Code.

**2026-05-22 amendment (Session 15): 3rd tier — vendor CLIs that *assume* an interactive shell get bypassed via their REST/GraphQL API.** Session 15 surfaced the underlying shape of the problem the Session 14 amendment was patching around. The Railway CLI authenticates fine with a service token (`whoami` returns the right account), but commands that need project/service context (`status`, `list`, `link`, `service`, `logs --service ...`) keep asking the agent for things only a TTY can give them: a workspace pick, a project pick, an environment pick, a directory-linked `.railway` file. Setting `RAILWAY_TOKEN` instead of `RAILWAY_API_TOKEN` re-introduces the gotcha documented in the Session 14 amendment. The CLI assumes a *human* is at the prompt — that's the design intent, not a bug.

This is the third tier in the routing rule:

1. **Action runs on a directory + a credential, no link state required** → use the CLI (`gh secret set`, `vercel env add`, `supabase db push`). These work cleanly headless.
2. **Action requires "which project are we talking about?" handshake state** → the CLI works for a human but fights an agent. **Use the REST/GraphQL API directly via a thin `lib/<vendor>-api.ts` wrapper.** Bearer token in, JSON out, no link files. Railway is the first example; future Linear/Stripe/etc. integrations should follow the same shape.
3. **Action is something only a UI can do** (accept a domain-transfer email, click through Stripe Connect onboarding) → manual playbook for John. The set of actions that genuinely require this is small and shrinks over time.

**Decision (Session 15).** `lib/railway-api.ts` is the single import boundary for `backboard.railway.com`. The thin GraphQL wrapper exposes `railwayGraphql` (raw POST + soft-fail) and `getServiceStatus(serviceId)` (returns `{ deploymentId, status, createdAt, commitSha }`). Goals that need to confirm a Railway deploy went green call this — not `railway logs --service foil-bot` and not `railway status`.

Triggering Railway deploys is unchanged: a `git push origin main` fires Railway's GitHub integration. The CLI was never the trigger path; this ADR amendment only changes the *verification* path.

**Consequences (Session 15).**
- **Pro:** Status checks return a typed JSON shape instead of streamed CLI text the agent has to scrape. Easier to assert in CI and in tests.
- **Pro:** No more `RAILWAY_TOKEN` vs `RAILWAY_API_TOKEN` gotcha — the wrapper takes a bearer token directly and there's only one accepted name (`RAILWAY_API_TOKEN`).
- **Pro:** The 3rd-tier pattern is reusable. The next vendor whose CLI fights headless use gets the same `lib/<vendor>-api.ts` treatment instead of another round of "let me try `--non-interactive` flags."
- **Con:** Adds a wrapper to maintain. Mitigated by keeping it thin (only the fields the project actually needs).
- **Caveat:** The `railway` CLI is **not** removed from the toolkit. Deploys (`railway up`), env-var pushes (`railway variables --set`), and one-shot bucket operations still work cleanly through it. The carve-out is specifically the read-side / status / logs surface where the link-state handshake is hostile to headless use.

---

## ADR-010 — Beehiiv for newsletter list management: official SDK, single-field form, server-side key

**Date:** 2026-05-21
**Status:** Accepted

**Context.** Blog posts ship twice a week via the autonomous content engine ([ADR-006](#adr-006--full-autonomy-no-human-review-step-gates-as-the-safety-net)) but there's no surface that lets a reader keep up without re-checking the feed. The waitlist sign-up form on the homepage captures launch-intent leads, not "I want to keep reading" leads — different funnel, different list. Beehiiv was already set up as the newsletter host (publication `pub_8bc42240-1964-4252-b798-7e0a6f135526`, domains `newsletter.foiltcg.com` + `mail.foiltcg.com` verified end-to-end with SPF/DKIM/DMARC). 13 dead-list subscribers from prior experimentation are still on the publication — they'll get scoped out via a future segment, tracked separately.

Three implementation options:

1. **Beehiiv embed form (iframe)** — fastest to ship, but breaks the design system, slows pages, and routes through `embeds.beehiiv.com` which gets ad-blocked.
2. **Direct browser → Beehiiv API call** — looks clean from a UX perspective but Beehiiv's CORS policy blocks browser origins entirely. The browser also can't safely hold the API key.
3. **Form → Server Action → official `@beehiiv/sdk`** — server-side key, no iframe, native form styling, sets us up to call other Beehiiv endpoints (segments, posts) from the same wrapper later.

**Decision.** Option 3. Single shared `lib/beehiiv.ts` is the only place that imports `@beehiiv/sdk` (so the CORS constraint becomes a structural one, not a code-review one). `subscribeEmail({ email, source })` is the only export today; future Posts API + segments work extends the same wrapper. UTM payload is fixed per ADR-010: `utm_source="foil-blog"`, `utm_medium="email-capture"`, `utm_campaign={source}`, `referring_site="foiltcg.com"`. `reactivate_existing=true` so previously-unsubscribed visitors get re-added cleanly; `send_welcome_email=false` because there's no automation wired yet and the welcome flow ships in a later goal. The Server Action returns generic copy on failure — Beehiiv error text never reaches the user.

Newsletter draft generation via Beehiiv's Posts API is **deferred until ≥50 signups** — it's not worth building a draft pipeline for an audience that's still effectively pre-launch. Cross-refs [ADR-008](#adr-008--vercel-deploy-hook-for-autonomous-content-not-github-integration-auto-deploys) (the deploy-hook plumbing that makes the blog content reliable enough to be worth subscribing to) and [ADR-009](#adr-009--local-cli-tooling-for-autonomous-infra-changes) (which gave us `vercel env add` so this goal could mirror keys end-to-end without UI clicks).

**Consequences.**

- **Pro:** Email capture renders inline with the blog's design tokens. No iframe, no third-party styling, no ad-blocker exposure on the form itself.
- **Pro:** API key is never shipped to the client bundle. Audit boundary lives at the import — anything importing `@beehiiv/sdk` outside `lib/beehiiv.ts` is the bug.
- **Pro:** Server Action piggy-backs on the host page's URL (`/blog/[slug]`, `/blog`), both already in `PUBLIC_ROUTES`. No new auth-gate surface to maintain.
- **Con:** Reactivation vs. new-create is opaque from the response shape — we collapse both to `{ ok: true, status: "subscribed" }`. If we ever want different copy for "welcome back" vs. "you're in", we'd need to call `subscriptions.getByEmail` first. Not worth the extra round-trip today.
- **Con:** No welcome automation yet — first email a subscriber sees is the next scheduled post. Acceptable until the welcome-flow goal ships.
- **Caveat:** Sender currently shows as the default Beehiiv address. Change to `john@mail.foiltcg.com` is deferred to a future config goal (Beehiiv UI; CLI doesn't expose it).

---

## ADR-011 — Newsletter drafts auto-generated, never auto-sent

**Date:** 2026-05-21
**Status:** Superseded by [ADR-012](#adr-012--newsletter-manual-paste-fallback-via-email-supersedes-adr-011-api-path) for the Beehiiv Posts API write path. The R-001 amplification reasoning + quality-gate design + `lib/newsletter/` pipeline still stand — ADR-012 only changes what happens with the gate-passing draft.

**Context.** [ADR-010](#adr-010--beehiiv-for-newsletter-list-management-official-sdk-single-field-form-server-side-key) wired Beehiiv subscribe capture; [ADR-006](#adr-006--full-autonomy-no-human-review-step-gates-as-the-safety-net) wired full-autonomy blog publishing twice a week. The natural next step is companion newsletters — every blog post becomes an email teaser, which roughly doubles the value of the content engine for a marginal-cost generation step. But the email channel re-raises the fabrication risk ([R-001](RISKS.md#r-001--content-engine-fabrication)) in a non-trivial way:

- Subscribers grant the channel more trust than a SERP result. A wrong PSA pop count or fabricated $30,000 sale in a newsletter is read as "the team confirmed this to me directly".
- Email is harder to retract than a blog post. The blog can be corrected in place; an inbox copy can't be recalled.
- Newsletter subjects + previews are pre-rendered in inbox lists, so even unopened mistakes leak.

Three architecturally distinct options:

1. **Full autonomy parity** — auto-publish newsletters at the same cadence as blog posts. Highest leverage, highest blast radius. The blog's gates don't transfer cleanly (different word-count band, different link contract), and the fabrication amplification above makes this a bad fit pre-launch.
2. **Manual newsletters** — John writes each one. Best quality control, zero leverage; the whole point of the content engine is to remove this kind of weekly drag.
3. **Auto-draft, never auto-send** — engine generates a draft + 3 subject candidates, lands them in Beehiiv's drafts list, sends a webhook ping; John reviews + sends manually. Keeps the leverage (no blank-page writing) while preserving a human checkpoint before the email actually moves.

**Decision.** Option 3. Newsletters are generated automatically from each blog publish via the content engine's autonomy workflow (`scripts/generate-weekly-post.ts` → `lib/newsletter/draft-generator.ts` → `lib/beehiiv-posts.createDraftPost` with `status: "draft"`). Drafts NEVER send without explicit human review in Beehiiv's UI. The contract is enforced architecturally:

- `lib/beehiiv-posts.ts` is the ONLY module allowed to call `client.posts.create`. The `status` field is hard-coded to `"draft"` — there is no code path in this repo that passes any other value.
- The newsletter step is soft-fail in the workflow: a Beehiiv outage, a quality-gate exhaustion, or an SDK breaking change cannot undo a successful blog publish.
- Six quality gates run before the draft is created: (a) word count 300-600, (b) ≥1 link to `/blog/{slug}`, (c) ≥1 link to `foiltcg.com/upload`, (d) **no dollar figures absent from the source blog post** (R-001 guard), (e) no banned phrases (same list as blog gates), (f) subject 30-65 chars. Up to 3 retries with the failure list passed back to Claude.
- Subject lines are produced 3-at-a-time in the same JSON output as the body — one Claude call per attempt, not two. Best candidate becomes the subject; second feeds the inbox preview text; third is kept for a future A/B-test goal.

The newsletter draft generator deferral noted in ADR-010 ("until ≥50 signups") is **lifted** by this ADR. Cost-benefit reassessment: generating a draft costs ~$0.02 per call, the draft sits in Beehiiv's UI until John reviews, and zero subscribers see it without his explicit send action — so the "wait until audience exists" trigger doesn't apply when the audience risk is bounded by manual review.

**Consequences.**

- **Pro:** Newsletter copy auto-generated for every blog post starting Mon 2026-05-25. John's marginal cost per email drops to "open Beehiiv → read → edit subject → send".
- **Pro:** The fact-grounding gate (newDollarFigures check against blog content) makes fabrication a structural impossibility for the most failure-prone class of newsletter mistake — invented prices. Subject + opener can still drift in tone, which is exactly what manual review catches.
- **Pro:** Workflow soft-fail design means the newsletter pipeline is fully optional from the blog pipeline's perspective. If Beehiiv's Posts API breaks (it's flagged "beta / Enterprise" in their SDK docs), the blog autonomy keeps running.
- **Pro:** The 3-subject-candidates pattern sets up cheap future A/B testing — pick at random per send, attribute opens.
- **Con:** Drafts pile up if John doesn't review them. Mon + Thu cadence means 8 unsent drafts per month at minimum. Mitigation: webhook notification on draft creation gives John a Discord/Slack ping; if drafts age >7d, that's a signal the cadence is wrong.
- **Con:** Posts API may not be available on our Beehiiv tier (the SDK docstring flags it as Enterprise / beta). If it's not, `createDraftPost` will fail with 401/403 and the workflow will soft-log "newsletter step skipped" indefinitely until the tier changes. This is acceptable: the blog pipeline is unaffected, the failure mode is visible in workflow logs, and we'll know what to do when the tier signal comes back.
- **Con:** Newsletter prompt is a second LLM surface to maintain. The DUD framework on the blog side and the "fact-grounding" rule on the newsletter side need to stay in sync if we ever change the underlying tone/voice — drift will compound across both channels.

**Cross-refs.** [R-001](RISKS.md#r-001--content-engine-fabrication) (amplification rationale), [ADR-006](#adr-006--full-autonomy-no-human-review-step-gates-as-the-safety-net) (the autonomy pattern this borrows from), [ADR-010](#adr-010--beehiiv-for-newsletter-list-management-official-sdk-single-field-form-server-side-key) (the import-boundary contract; this ADR adds `lib/beehiiv-posts.ts` to the same boundary).

---

## ADR-012 — Newsletter manual-paste fallback via email (supersedes ADR-011 API path)

**Date:** 2026-05-21
**Status:** Accepted — supersedes the API-write path in [ADR-011](#adr-011--newsletter-drafts-auto-generated-never-auto-sent). ADR-011's R-001 amplification reasoning + the 6 newsletter quality gates + `lib/newsletter/draft-generator.ts` remain in force; the only change is what happens with the gate-passing artifact.

**Context.** [Session 9's end-to-end verification](SESSION-LOG.md) confirmed that Beehiiv's `POST /v2/publications/:id/posts` endpoint is gated behind an Enterprise tier (`HTTP 403 SEND_API_NOT_ENTERPRISE_PLAN`). The autonomous pipeline currently generates a publishable draft, then bounces off the API and logs a warning. Acceptable as a transitional state but the leverage of the engine is wasted — John has no easy path from "draft exists in the workflow logs" to "draft scheduled in Beehiiv". Three options to close the loop:

1. **Pay for Beehiiv Enterprise.** Solves the API issue; ~$X00/mo on a tier that includes lots of features we don't need today (custom CSS, white-labeling, etc). Wrong order of operations pre-launch.
2. **Re-architect onto another newsletter platform** (Resend Audiences, Substack, Buttondown). Throws away ADR-010's Beehiiv setup + the 13 legacy subs + the verified domains.
3. **Generate the draft as today + ship it to John via email + version-control a paste-ready repo artifact.** John pastes into Beehiiv's UI manually, schedules, sends. Zero new infra beyond a Resend account.

**Decision.** Option 3. The manual paste step is a feature, not a bug — it IS the [R-001](RISKS.md#r-001--content-engine-fabrication) human-review checkpoint that ADR-011 envisioned would happen inside Beehiiv's draft UI. Specifically:

- `lib/notifications/resend.ts` is the second transactional channel (joining `lib/beehiiv.ts` for subscribes). Free Resend tier (3K emails/mo) is plenty for 2 sends/week. Sender is `onboarding@resend.dev` — no DNS configuration needed because the destination is `john.c.craig24@gmail.com` (founder inbox, self-to-self).
- After the newsletter passes its 6 quality gates, the autonomy script ALWAYS:
  1. Writes `docs/newsletter-drafts/{slug}.md` — paste-ready Markdown with full YAML frontmatter (subject, preview text, word counts, topic rationale, Beehiiv status, optional email message id).
  2. Sends the email via Resend with 4 labeled sections: (a) WHY THIS TOPIC, (b) NEWSLETTER PREVIEW (subject + preview + body), (c) HOW TO PUBLISH (5 numbered steps), (d) SOURCE BLOG POST (slug, URL, word counts).
- `lib/beehiiv-posts.createDraftPost` is downgraded from "expected to succeed" to "best-effort". The 403 path now logs an informational line ("Posts API Enterprise-gated; falling back to manual-paste path") rather than a warning — that's the steady-state outcome on our tier, not an exception.
- The Resend send is itself soft-fail. If Resend's API is down or returns non-2xx, the .md artifact still lands and the workflow exits successfully. The artifact is the canonical record; the email is the immediate ping.
- The auto-commit step in `.github/workflows/weekly-content.yml` includes `docs/newsletter-drafts/` automatically (its parent `docs/` is already staged), so the artifact lands on `main` alongside the blog post in the same commit.
- Topic rationale is captured by a new `pickNextCandidateWithRationale` helper in `lib/seo/keyword-backlog.ts` — same selection logic, returns a human-readable explanation ("Selected from the X pillar. This was rank #N of M, …") alongside the chosen candidate. Threaded through `generateWeeklyPost` → script → email + artifact.

**Consequences.**

- **Pro:** John gets a paste-ready draft in his Gmail inbox within ~2-3 minutes of each blog publish. Same R-001 review opportunity as ADR-011 envisioned — he reads it, edits if needed, pastes, sends.
- **Pro:** The repo artifact (`docs/newsletter-drafts/{slug}.md`) is the permanent record. If the email is lost, the artifact is recoverable; if both are lost, the source blog post is still on the site and the generator is deterministic enough to recreate from frontmatter.
- **Pro:** Email + artifact + workflow logs is a triple-record: ops visibility doesn't depend on any one channel staying up.
- **Pro:** The fallback works regardless of Beehiiv tier — if/when we move to Enterprise later, `createDraftPost` will start succeeding and the artifact/email will mark `beehiivStatus: "auto-drafted"` instead of `"deferred-manual-paste"`. No code change required.
- **Con:** Two ops surfaces (email + Beehiiv UI) instead of one. Slack/Discord ops workspace would consolidate, tracked in [ROADMAP NEXT](ROADMAP.md#next--next-2-weeks-2026-05-28--2026-06-10).
- **Con:** Resend free tier caps at 100 emails/day. Mon + Thu cadence × 2 emails/week = 8/month, leaves 2,992 of monthly headroom. Comfortable until we add other transactional surfaces (waitlist confirmations, scan-result notifications).
- **Caveat:** The default Resend sender (`onboarding@resend.dev`) lands in Gmail's Promotions tab unless John whitelists it. Acceptable since the recipient is John himself and he can drag the first one to Primary. Replacing with a custom-domain sender (`autonomy@mail.foiltcg.com`) is deferred to a future config goal — needs DKIM+SPF setup that already partially exists from Session 7's mail-domain work.

**Cross-refs.** [ADR-011](#adr-011--newsletter-drafts-auto-generated-never-auto-sent) (the architectural contract this supersedes for the write path; R-001 reasoning + gates still in force), [R-001](RISKS.md#r-001--content-engine-fabrication) (the human-review checkpoint is now manual paste, not Beehiiv-UI review of an API-created draft), [ROADMAP](ROADMAP.md#next--next-2-weeks-2026-05-28--2026-06-10) (Slack/Discord ops workspace would let us consolidate this email channel with deploy, subscriber, and error pings).

---

## ADR-013 — Foil HQ Discord bot: persistent-memory ops chat with curated tools

**Date:** 2026-05-21
**Status:** Accepted

**Context.** [ROADMAP NEXT #9.5](ROADMAP.md#next--next-2-weeks-2026-05-28--2026-06-10) flagged the ops-channel sprawl problem: newsletter drafts in Gmail (ADR-012), workflow failures buried in GitHub Actions tab, Beehiiv stats in a separate UI, Stripe events in Stripe's own dashboard. Each surface is fine in isolation; the union is hard to scan, and there's no first-class place for me (Claude) to ask John questions or share progress. Three architectural options:

1. **Path 1 — Web ops dashboard inside the Foil Next.js app.** Lowest infra cost (no new service); same domain, same auth. But everything that ships there gets baked into the main app and shares its deploy cadence; private surfaces still need auth wiring; chat-with-an-agent is awkward inside a web view that isn't a chat-first UI.
2. **Path 2 — Discord bot + persistent memory + curated tools.** Discord is a real-time chat-first UI optimized for threaded ops channels. Channels naturally split into content / subscribers / errors / general. Bots can stream replies, react to messages, drop into voice (future). Persistent memory in Supabase + Foil-docs grounding means the bot can answer "what's on the roadmap?" or "what did we ship last session?" without a web round-trip.
3. **Path 3 — Slack workspace.** Same shape as Discord but Slack's free tier caps DMs/message history at 90 days and the bot API is more bureaucratic. Discord's free tier is more generous and the audience (developer-aligned founder) prefers it.

**Decision.** Path 2. Discord bot lives in a new `bot/` subtree at the Foil repo root; deploys to Railway. Architecture:

- **Memory** — Supabase Postgres + pgvector. New `bot_messages` table (channel_id, user_id, role, content, created_at) + `bot_embeddings` sidecar (1536-dim vector + HNSW index). Isolated schema, service-role-only, no FK to main app tables. Migration in `bot/migrations/001_bot_memory.sql`.
- **Embeddings** — deterministic SHA-256 → 1536-float placeholder for now. Anthropic doesn't expose embeddings; Voyage AI or OpenAI's `text-embedding-3-small` is the right substitute, deferred to Goal B. `bot_embeddings.embedding` shape is already 1536-dim so the swap is config-only.
- **Grounding** — `bot/src/system-prompt.ts` reads `../docs/BRIEFING.md` + ROADMAP NOW/NEXT + RISKS High/Medium + the latest SESSION-LOG entry at startup. Wrapped in `<foil_context>`. Cached via `cache_control: { type: "ephemeral" }` on every Anthropic call so multi-turn conversations within ~5 minutes pay the discounted rate.
- **Channel personas** — four shipped: content lead (#content-engine), growth (#subscribers), on-call eng (#errors), default helper (#general). Each persona biases tone + focus area; all share the underlying tools.
- **Tools (curated, not full MCP)** — `read_file`, `search_codebase`, `get_recent_subscribers`, `get_publication_stats`, `get_session_log`. Read-only; no writes to repo, Postgres, or external services. Full MCP integration is Goal B.
- **Model selection** — `claude-opus-4-5` by default (long-context reasoning on Foil docs). Prefix `/sonnet` switches to `claude-sonnet-4-6` for a single turn (~5× cheaper, 2× faster — good for "ping"-shaped questions).
- **Slash commands** — `/reset` (wipe channel memory), `/recall <query>` (top-5 semantic search), `/help` (list tools + commands). Guild-scoped registration on startup.
- **Deploy** — Railway, Docker. Build context is the repo root (not `bot/`) so the image can include `docs/` for runtime grounding. `railway.json` at repo root, `bot/Dockerfile` at the subdirectory.

**Consequences.**

- **Pro:** Ops channel sprawl collapses to one chat UI. The bot itself becomes the first place to forward subscriber pings, deploy notifications, error alerts (Goal C wires the outbound notifications).
- **Pro:** Persistent memory across restarts + channel-scoped recall means John can ask "what did we decide about X last week?" and get a grounded answer, not a re-derived guess.
- **Pro:** Foil docs are the source of truth for the bot's worldview, so improvements to the second-brain (ROADMAP, SESSION-LOG, RISKS, DECISIONS) automatically improve the bot's accuracy. No prompt-engineering loop required.
- **Pro:** The `/sonnet` opt-in caps cost on quick questions while keeping Opus 4.5 as the default for hard reasoning. Empirically, "ping" and "what time is X" are the most common turns — Sonnet handles them fine.
- **Pro:** Curated tools (5) are auditable in one file (`bot/src/tools/index.ts`). MCP would expose hundreds of capabilities; we don't need that surface area pre-launch and the narrower interface is easier to reason about.
- **Con:** Two CLIs now in the ops toolkit (Railway joins Vercel + GH). Each token is a credential surface. Kill-switch: `railway logout` or revoke the project token from Railway's dashboard.
- **Con:** Hash-placeholder embeddings give lexical-ish recall, not true semantic. `/recall` will work for exact-ish substrings but miss synonyms. Goal B fix.
- **Con:** Discord rate-limits message.edit to ~5/5s per channel, so progressive-edit streaming debounces hard (1.2s). Long replies feel choppy at the start.
- **Caveat:** The bot has the Administrator permission inside Foil HQ (per John's setup). That's fine for a private server; not for any future public-server invite. If we ever invite this bot to a community server, scope the permission to `Send Messages + Read Messages + Use Slash Commands` only.

**Cross-refs.** [ADR-012](#adr-012--newsletter-manual-paste-fallback-via-email-supersedes-adr-011-api-path) (the email channel this Discord bot will consolidate with via Goal C), [ROADMAP NEXT #9.5](ROADMAP.md#next--next-2-weeks-2026-05-28--2026-06-10) (this ADR closes that item), [ROADMAP LATER → Goal B] (full MCP integration), [ROADMAP LATER → Goal C] (outbound webhook notifications for deploys/content/subscribers/errors).

---

## ADR-014 — Outbound Discord notifications: per-channel webhooks, soft-fail, single import boundary

**Date:** 2026-05-22
**Status:** Accepted — partial-Goal-C delivery. Closes the "outbound notifications" follow-up flagged in [ADR-013](#adr-013--foil-hq-discord-bot-persistent-memory-ops-chat-with-curated-tools) consequences.

**Context.** [ADR-013](#adr-013--foil-hq-discord-bot-persistent-memory-ops-chat-with-curated-tools) made Foil HQ Discord the in-channel ops surface. The bot itself handles INBOUND chat (John @mentions, bot replies). It doesn't address the symmetric problem: how does the rest of the stack tell the channels what just happened — blog publishes, new subscribers, scan errors, deploy outcomes? Three architectural options:

1. **Bot polls** — content-engine writes to a queue table; the bot polls every 30s and posts. Decouples but adds latency, infrastructure, and a queue surface to maintain.
2. **Each event source POSTs directly to Discord webhook URLs.** No queue, no polling, no service. Discord webhook URLs are essentially channel-scoped POST endpoints; nothing to host.
3. **Single notification micro-service** that every event source calls. Adds a hop without offering more capability than option 2 today.

**Decision.** Option 2 with a shared library. One file (`lib/notifications/discord.ts`) is the import boundary; every event source calls its `postWebhook` / `postSubscriberJoined` / `postContentPublished` / `postError` helpers. Channels map to event types:

| Channel | Webhook env var | Event source(s) |
|---|---|---|
| `#deploys` | `DISCORD_WEBHOOK_DEPLOYS` | Vercel native Discord integration (set up via Vercel dashboard; not used from code today) |
| `#content-engine` | `DISCORD_WEBHOOK_CONTENT_ENGINE` | `scripts/generate-weekly-post.ts` on successful blog + newsletter draft |
| `#subscribers` | `DISCORD_WEBHOOK_SUBSCRIBERS` | `app/actions/subscribe.ts` on successful Beehiiv subscribe |
| `#errors` | `DISCORD_WEBHOOK_ERRORS` | Content engine on gate-exhaustion / newsletter-step failure; subscribe action on Beehiiv failure; GH Actions workflow on any step failure (covered by an `if: failure()` step with `jq`-shaped payload + `curl`) |

**Three architectural rules the shared library enforces:**

1. **Soft-fail.** `postWebhook` never throws. Every failure path logs and returns `{ok:false,error:...}`. Notifications must NEVER block business logic — a Discord outage cannot undo a blog publish or a subscribe.
2. **Single import boundary.** `lib/notifications/discord.ts` is the only place that imports the Discord webhook URL or calls `fetch("https://discord.com/api/webhooks/...")`. Audit grep: any other module referencing `discord.com/api/webhooks` is the regression. The GH Actions workflow's `if: failure()` step is the one exception (raw curl + `jq`), justified because the Node script is exactly what failed and we can't depend on its libraries.
3. **Email-masking on subscriber events.** `postSubscriberJoined` masks the local part of every email (`john.craig@gmail.com` → `j***@gmail.com`) before it lands in the channel. The `maskEmail` helper is the only place this transformation lives; tests pin the masking rule.

**Consequences.**

- **Pro:** Zero infrastructure for ops notifications. Adding a new event source is `import { postX } from "@/lib/notifications/discord"` + one call. Removing one is deleting the call.
- **Pro:** Channel topology lives in environment variables, not code. Renaming `#content-engine` → `#content-pipeline` is a UI rename + a webhook URL swap; no PR required.
- **Pro:** Retry-on-429-with-`retry_after` handling matches Discord's documented contract, so we don't trip the rate-limit penalty under bursty traffic (a publish + several subscriber pings in the same minute).
- **Pro:** The bot's `lib/beehiiv.ts`-style import boundary pattern (from ADR-010) extends cleanly to a fourth boundary (`lib/notifications/discord.ts`). Same architecture, same audit story.
- **Con:** Per-event flooding is possible. 100 subscribers signing up in a 5-minute promotion would post 100 messages. Mitigation tracked as Goal C (daily-digest aggregator that batches events by channel + time window).
- **Con:** Discord webhook URLs ARE the credential. Anyone with the URL can post — Discord doesn't gate webhook URLs by source IP or signing key. Mitigation: webhook URLs are stored as secrets across all three surfaces (`.env.local`, Vercel envs, GH Actions secrets, Railway envs). Rotation = generate a new webhook URL in the Discord channel's Integrations panel and `gh secret set` / `vercel env add` / Railway dashboard.
- **Con:** Vercel deploy notifications still require manual UI setup in `Vercel dashboard → Integrations → Discord` because Vercel has no CLI for that flow. We have the `DISCORD_WEBHOOK_DEPLOYS` URL ready; John installs the Marketplace integration once.
- **Caveat:** OpenAI text-embedding-3-small was wired alongside this ADR (replaces the hash placeholder from ADR-013). Mentioned here because the same goal landed both pieces, but the embeddings change is a separate concern from notifications — `bot/src/embed.ts` is its own module with its own LRU cache.

**Cross-refs.** [ADR-013](#adr-013--foil-hq-discord-bot-persistent-memory-ops-chat-with-curated-tools) (the inbound side this complements), [ADR-010](#adr-010--beehiiv-for-newsletter-list-management-official-sdk-single-field-form-server-side-key) (the import-boundary pattern this borrows from), [ADR-008](#adr-008--vercel-deploy-hook-for-autonomous-content-not-github-integration-auto-deploys) (the Vercel Deploy Hook step that triggers `#deploys` events).

---

## ADR-016 — Vercel deploys → Discord via code-controlled webhook proxy (not Marketplace install)

**Date:** 2026-05-22
**Status:** Accepted — supersedes the "manual Vercel Marketplace install" caveat in [ADR-014](#adr-014--outbound-discord-notifications-per-channel-webhooks-soft-fail-single-import-boundary).

**Context.** ADR-014 mapped four Discord channels to event sources but left `#deploys` as a "John installs the Vercel→Discord Marketplace integration once" footnote. Two problems with that posture:

1. **Opaque + not version-controlled.** The Marketplace integration's filtering, formatting, and target URL all live in Vercel's UI. We can't diff it, can't re-create it from CI, can't tune it without clicking through dashboards.
2. **Autonomy-first principle.** Every other notification on Foil is wired in code through `lib/notifications/discord.ts`. The `#deploys` exception was a wart — the one channel where "what gets shown" wasn't readable in the repo.

Three options to close the gap:

1. **Install the Marketplace integration.** Done in 2 minutes; never touched again; opaque.
2. **Use a generic webhook-routing service** (e.g. n8n on the existing self-hosted setup). Another moving part; introduces a hop with its own credentials.
3. **Code-controlled proxy endpoint** — Vercel posts deploy events to a route we own, we validate the signature, filter, format, and forward to Discord ourselves.

**Decision.** Option 3. `app/api/webhooks/vercel-deploys/route.ts`:

- Validates `X-Vercel-Signature` against the raw request body (HMAC-SHA1 with `VERCEL_WEBHOOK_SECRET`). The signature header IS the auth — the route is on `PUBLIC_ROUTES` via the existing `/api/webhooks` prefix.
- Filters to `deployment.succeeded`, `deployment.error`, `deployment.canceled`. Skips the noisy `deployment.created` + `deployment.ready` events that fire on every push.
- Maps the payload → Discord embed with green/red/yellow color, commit SHA, branch, author, first-line of commit message. Posts via `lib/notifications/discord.ts::postWebhook` — same shared lib every other notification uses.
- Always returns 200 to Vercel (even if Discord is down) so Vercel doesn't retry. A Discord outage doesn't help by being retried; the same outage will reject the retry.

Registered via the Vercel CLI:
```
vercel webhooks create https://foiltcg.com/api/webhooks/vercel-deploys --event deployment.succeeded --event deployment.error --event deployment.canceled
```
The CLI returns a signing secret — we mirror it to `.env.local` + Vercel envs + GH Actions secrets (the workflow doesn't use it, but future scripts that simulate webhooks for testing might).

**Consequences.**

- **Pro:** Every notification on Foil — content engine, subscribers, errors, deploys — is now in code. Diff, review, version-control, test.
- **Pro:** Adding a new deploy-event filter (say, only ping when `target === "production"`) is a one-line change in `buildEmbed` + a test, not a UI hunt.
- **Pro:** Signature verification with `timingSafeEqual` defeats timing attacks. Bad-secret + bad-length + non-hex header all fail closed.
- **Pro:** Tests pin the embed shape per event type. Future Vercel payload changes will break the contract tests; a Marketplace integration would silently change format.
- **Con:** We own the failure mode. If our deploy of the proxy itself fails, no deploy notifications. Acceptable: the proxy is a thin pure-function route — if it breaks, the rest of the site is more broken anyway.
- **Con:** The Vercel webhook secret is now a credential. Stored as secret across `.env.local` + Vercel + GH Actions. Rotation = `vercel webhooks remove` + `vercel webhooks create` again; mirror the new secret.

**Cross-refs.** [ADR-014](#adr-014--outbound-discord-notifications-per-channel-webhooks-soft-fail-single-import-boundary) (the shared notification lib this builds on), [ADR-008](#adr-008--vercel-deploy-hook-for-autonomous-content-not-github-integration-auto-deploys) (the existing Deploy-Hook integration that triggers production builds — separate flow; this ADR is about observability, ADR-008 is about triggering).

---

## ADR-017 — Beehiiv tools via REST, not OAuth-based MCP

**Date:** 2026-05-22
**Status:** Accepted

**Context.** The Foil HQ bot ([ADR-013](#adr-013--foil-hq-discord-bot-persistent-memory-ops-chat-with-curated-tools)) shipped 5 curated tools, two of which (`get_recent_subscribers`, `get_publication_stats`) talk to Beehiiv. With Goal C we wanted to expand the bot's Beehiiv surface (list_posts, status-filtered subscribers) and the obvious-looking move was to install Beehiiv's official MCP server in the bot's tool layer. Three options reviewed:

1. **Beehiiv MCP server.** Maintained by Beehiiv. Uses OAuth — first call prompts an interactive consent flow. Designed for human-in-the-loop agents (Claude.ai web, Cursor).
2. **Direct REST API via `BEEHIIV_API_KEY` (the same key we already use for subscribe + draft writes).** Stable, key-auth only, no consent flow.
3. **Wrap the Beehiiv MCP server in a server-side adapter** that handles the OAuth handshake out-of-band. High effort for a feature surface (read-only list/get) we don't need MCP's "full discovery" for.

**Decision.** Option 2. Three new tool defs live in `bot/src/tools/beehiiv.ts` (mirrored audit boundary to `lib/beehiiv.ts` + `lib/beehiiv-posts.ts` from ADR-010 and ADR-011):

- `beehiiv_list_subscriptions(status?, limit?)` — Beehiiv `/v2/publications/:id/subscriptions`. Masks emails before returning to the bot.
- `beehiiv_get_publication_stats()` — Beehiiv `/v2/publications/:id?expand=stats`. Returns active/total counts.
- `beehiiv_list_posts(status?, limit?)` — Beehiiv `/v2/publications/:id/posts`. Lets the bot answer "what drafts are queued?".

The legacy `get_recent_subscribers` + `get_publication_stats` tools from Session 11 stay registered as aliases — they overlap with the new tools but breaking them would force a system-prompt rewrite. The system prompt now lists the new `beehiiv_*` names first; the model gravitates to those.

**Consequences.**

- **Pro:** Zero OAuth complexity. The bot runs headless on Railway; an OAuth consent flow would require either a web callback URL the bot doesn't serve or a manual one-time token mint per restart.
- **Pro:** Single auth credential (`BEEHIIV_API_KEY`) covers subscribe writes (`lib/beehiiv.ts`), draft writes (`lib/beehiiv-posts.ts`), AND read queries (`bot/src/tools/beehiiv.ts`). One rotation point.
- **Pro:** Tests pin the REST endpoint + auth header shape. If Beehiiv changes their URL structure we break loudly with a test diff, not silently with an MCP discovery mismatch.
- **Pro:** Email masking centralized to the tool layer. The bot never sees raw subscriber emails; what gets piped into Claude's context is `j***@example.com`. Reduces the surface area for accidental PII surfacing in transcripts.
- **Con:** We have to hand-write each tool def. Beehiiv MCP would auto-discover a dozen endpoints; we ship three because that's what John would actually use. If we ever need a fourth tool (`beehiiv_get_post_content`, say), it's another hand-roll.
- **Con:** We don't get Beehiiv's tool-naming evolution for free. If Beehiiv ships a new "smarter" subscriber-segmentation endpoint, we have to notice and wrap it.
- **Caveat:** If a future Anthropic SDK adds a hosted MCP client with a manageable headless-OAuth path, revisit this ADR. We're 12 months ahead of that today.

**Cross-refs.** [ADR-013](#adr-013--foil-hq-discord-bot-persistent-memory-ops-chat-with-curated-tools) (bot's tool architecture), [ADR-010](#adr-010--beehiiv-for-newsletter-list-management-official-sdk-single-field-form-server-side-key) (Beehiiv import boundary — this ADR adds `bot/src/tools/beehiiv.ts` to the same boundary).

---

## ADR-018 — Daily-digest queue: opt-in noise control via DIGEST_MODE

**Date:** 2026-05-22
**Status:** Accepted — sets the default to `realtime` for now; pivot to `daily` is a one-env-var flip.

**Context.** Per-event Discord pings work fine when subscriber and content velocity are low (today: 0-2 events per week). They will not scale. Two failure modes anticipated:

1. **Subscriber bursts.** A blog post going viral could trigger 100+ signups in an hour. Per-event pings = 100+ embeds = inbox-tab DDoS.
2. **Error storms.** A Beehiiv outage triggering N subscribe failures all firing `postError` simultaneously. Same problem.

Options considered:

1. **Hard rate-limit the channel via Discord's per-channel cap** (5 msgs / 5 sec). Cheap but loses the messages that overflow.
2. **Daily-digest table + batch summary embed per channel.** One row per event in `digest_events`; once a day a cron walks each `channel_target`, collapses N rows into one summary embed, marks them digested.
3. **External queue (BullMQ / Redis).** Way more infrastructure than the volume needs.

**Decision.** Option 2 with an opt-in switch. `DIGEST_MODE=realtime` (default) → existing per-event ping path. `DIGEST_MODE=daily` → call `queueEvent` instead. The producer side decides; the consumer cron runs unconditionally and is a no-op when the queue is empty.

Layout:

- `supabase/migrations/20260522020000_digest_events.sql` — `digest_events` table (id, event_type, payload jsonb, channel_target, created_at, digested_at). Partial index on `(channel_target, created_at) where digested_at is null` keeps the working set small.
- `lib/notifications/digest.ts` — `queueEvent` + `flushDigest(channelTarget)`. The latter posts ONE embed grouped by event_type, marks the rows digested AFTER the Discord post returns 2xx (an outage leaves them queued for retry next run).
- `scripts/flush-digest.ts` — walks every channel target; idempotent.
- `.github/workflows/daily-digest.yml` — cron at 09:00 UTC daily + manual `workflow_dispatch` for ops.
- `app/actions/subscribe.ts` is the first wired producer: reads `DIGEST_MODE`, branches between queueEvent and `postSubscriberJoined`.

**Consequences.**

- **Pro:** No infrastructure burden today. Queue is a single Postgres table; flush is a 10-line script. If queue depth ever becomes a real problem, the cron can run more frequently (`*/30 * * * *`) without code changes.
- **Pro:** Mode flip is one env var on Vercel. `vercel env add DIGEST_MODE daily production --yes` is the entire toggle.
- **Pro:** Digest embed groups by event_type, so a "9 subscriber_joined + 1 subscribe_failed" hour reads as two fields, not ten messages.
- **Pro:** Failed Discord post leaves rows undigested → next run retries naturally. We don't need a separate retry queue.
- **Con:** When DIGEST_MODE=daily, John doesn't see new subscribers in real time — he sees them tomorrow morning. Acceptable when signup volume is high enough that "right this second" loses meaning; not acceptable at <10/day. Default kept at `realtime` to match the current state of the world.
- **Con:** Only the subscribe action is wired so far. Content engine + errors + deploys still post in real time even when `DIGEST_MODE=daily`. Wiring the others is a small follow-up when the volume justifies it.
- **Caveat:** Subscriber threshold alerts (50/100/500) are a separate goal — the digest doesn't address "ping me on milestones", only "summarize firehose".

**Cross-refs.** [ADR-014](#adr-014--outbound-discord-notifications-per-channel-webhooks-soft-fail-single-import-boundary) (the per-event notification surface this batches), [ADR-008](#adr-008--vercel-deploy-hook-for-autonomous-content-not-github-integration-auto-deploys) (the GH Actions cron pattern — same infra).

## How to add an ADR

1. Pick the next number (don't reuse).
2. Title: short, specific. The choice + the rationale, not the topic.
3. Sections: Status (Accepted / Superseded / Deprecated), Context (what was true that forced the choice), Decision (what we chose, concretely), Consequences (what now follows — costs, constraints, follow-ups).
4. If superseding an old ADR, edit the old one to add "Superseded by ADR-N" to its Status — don't delete it.
