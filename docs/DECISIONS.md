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

---

## ADR-019 — Idea bank as the 6th second-brain doc

**Date:** 2026-05-22
**Status:** Accepted

**Context.** The five existing second-brain docs (ROADMAP, DECISIONS, SESSION-LOG, ENV-VARS, RISKS) cover *committed* state — work the project has decided to do, has done, or has classified. They don't have a home for **noticed-but-not-yet-decided** state. In practice, the typical Cowork or Discord conversation surfaces 3-5 ideas per hour — feature gaps, competitor observations, monetization levers, content angles — and those ideas live entirely in chat history until they (a) get manually copied into ROADMAP (which forces a triage decision before the queue is even built), (b) get re-derived from memory weeks later, or (c) get forgotten.

This is the same shape as the gap that motivated SESSION-LOG: undocumented context decays fast across sessions. ROADMAP was the wrong place to fix it because ROADMAP is a *commitment* surface — adding an item there implicitly says "we've decided we want this." Most surfaced ideas haven't met that bar yet; they just want to be remembered.

Three options considered:

1. **Stuff ideas into ROADMAP LATER.** Free of new infra, but conflates "we've committed to this eventually" with "we noticed this and want to think about it." Within a month LATER becomes a mixed grab-bag, ROADMAP credibility erodes, and the "this is what's committed" property is gone.
2. **Append ideas to SESSION-LOG entries.** Cheap to land but discoverability dies — a great idea raised on 2026-05-22 is invisible by session 30 unless someone re-reads every session entry.
3. **Standalone IDEAS.md upstream of ROADMAP, with a Sunday review cadence to promote/reject/keep.** Adds one doc + one ritual but cleanly separates "noticed" from "committed" and gives the bot a queryable backlog.

**Decision.** Option 3. New canonical surface at `docs/IDEAS.md`, per-entry YAML frontmatter (`date`, `category`, `status`), 1-3 sentence body + 1-line **Context** trigger. Status starts at `captured`; weekly Sunday review session triages each row — `promoted` (now on ROADMAP), `triaged` (looked at, undecided), `rejected` (with one-line reason), or unchanged (still `captured`). Once a promoted ROADMAP item ships, the source IDEAS row flips to `shipped` so the historical chain is preserved.

Categories are bounded: `product · marketing · content · infra · monetization · ux · growth`. Bounding the set keeps the list groupable in the bot's `/ideas` output and forces clarification when a new category seems necessary.

Bot integration:

- `bot/src/system-prompt.ts::extractRecentIdeas` parses the frontmatter blocks and renders the most-recent 30 entries (capped at 5k tokens of body) into `<foil_context>`. The bot sees the backlog at every turn — so a casual "what should I work on?" question implicitly considers everything in the bank, not just ROADMAP NOW.
- New `/ideas [category]` slash command lists the top-10 captured entries with category badges. Optional category filter narrows to one of the seven values via Discord's `addChoices` option, so the UI auto-validates.

Hard-contract update in CLAUDE.md: every goal (or the conversation that triggered it) that surfaces a non-trivial idea adds an entry to IDEAS.md before session end. Same discipline as SESSION-LOG.

**Cross-refs.**
- [ADR-006](#adr-006--full-autonomy-no-human-review-step-gates-as-the-safety-net) — the autonomy-first stance that makes the bot the highest-leverage integration point for the idea bank. The bot doesn't *consume* the bank passively; it surfaces ideas proactively when a question maps onto an entry.
- [ADR-013](#adr-013--foil-hq-discord-bot-persistent-memory-ops-chat-with-curated-tools) — the bot grounding pattern this extends. Same `<foil_context>` injection mechanism, one more section.
- `docs/PATTERNS.md` (separate file) — cross-cutting engineering patterns. Distinct from IDEAS: PATTERNS holds "how to build" observations promoted from second instances; IDEAS holds "what to build" surfaces awaiting triage.

**Consequences.**
- **Pro:** The idea bank survives across sessions. A great idea raised in week 3 doesn't have to compete with whatever fired the Stop hook in week 12.
- **Pro:** ROADMAP stays credibly *committed*. Triage happens at the IDEAS → ROADMAP boundary, not inside ROADMAP itself.
- **Pro:** Bot grounding gets a strategically-loaded slice of the backlog at every turn. "What's the most underrated idea on the list?" becomes a real query, not a fishing expedition.
- **Pro:** The format is explicit enough (frontmatter) that future tooling (e.g. a static-site idea-board) can consume it without re-parsing free text.
- **Con:** Adds a doc to maintain. Mitigated by the lightweight format — three frontmatter lines + one sentence + Context line per idea.
- **Con:** Adds the Sunday review ritual. If it slips, the backlog grows but doesn't rot — every entry is still discoverable.
- **Caveat:** The bot reads IDEAS.md at *process start*, same as the other grounding docs. New ideas added mid-session require a bot restart to land in `<foil_context>` (the `/ideas` slash command reads on-demand and is unaffected).

---

## ADR-020 — Pivot to buyer-side deal-finder positioning

**Date:** 2026-05-23
**Status:** Accepted — supersedes the product framing implicit in pre-2026-05-23 CLAUDE.md and ROADMAP NOW. See [STRATEGY-PIVOT-DEAL-FINDER.md](STRATEGY-PIVOT-DEAL-FINDER.md) as the canonical source-of-truth document for the new direction; this ADR is the formal architectural record.

**Context.** The pre-pivot product framing positioned Foil as a seller-side card valuation tool: "scan a card, get a multi-source valuation in <10 seconds." That framing accumulated 14 sessions of build (Sessions 1–19) — scanner pipeline, PokeTrace integration, autonomous content engine, Beehiiv newsletter, Discord ops bot, Vercel + Railway deploy chain. The strategy review on 2026-05-23 (captured in `docs/STRATEGY-PIVOT-DEAL-FINDER.md`) reframes the unit economics: a valuation user comes 3-4 times to value cards they already own, then leaves; a buyer-side deal-finder user returns weekly with direct purchase intent on every visit, and every click is monetizable through eBay affiliate. The conversion math is the load-bearing reason — search-page affiliate URLs convert at 2-3%; algorithmically-selected best-listing recommendations convert at 8-15%, and wishlist-anchored alerts convert at 15-25%. Three structural advantages compound the shift: the Pokemon TCG deal-aggregator niche is genuinely empty (Eyevo + PokeTrace are valuation tools, PokeCenter is sealed-product drop alerts); the Level-4 TCGplayer Verified Seller credibility wedge holds and arguably strengthens for buyer-side authority; and 25K cards × one indexable per-card landing page = a long-tail SEO surface that compounds defensibly over 6-18 months.

**Alternatives considered.**

1. **Full pivot to deal-finder.** V1 ships as buyer-side, eBay-only, per-card landing pages, wishlist email alerts. Scanner functionality stays in the codebase as "coming soon" but isn't launch-load-bearing.
2. **Parallel valuation + deals surfaces.** Keep the scanner as primary, add deal-finder pages as a secondary surface. Trades focus for hedging.
3. **Reframe wrapper only.** Keep the scanner-first product but re-skin the home page and content to buyer-intent language. Cheapest but defeats the unit-economics thesis — the affiliate revenue still has nowhere to land without per-card pages.

**Decision.** Option (1) — full pivot. The strategy doc's argument is that the unit-economics gap between valuation and deal-finder is so large (3-4 lifetime visits vs. weekly recurring visits with purchase intent on every visit) that hedging the framing is materially worse than committing. The scanner work is preserved, not deleted — it ships as a V2 product surface once the deal-finder funnel is producing affiliate revenue. eBay is the sole live-listing source for V1 (the "one source done well beats two sources done halfway" principle); TCGplayer affiliate approval lands as a V1.5 upgrade rather than a launch blocker, plumbed through the existing `lib/affiliate/links.ts` boundary when it arrives.

**Consequences.**

- **Scanner code remains in tree but is no longer V1 surface.** `app/upload/`, `lib/vision*.ts`, `lib/poketrace.ts`, the detect/identify/confirm pipeline, the per-card crop tooling — all preserved. Documented as "V2 — scanner" in the LATER bucket of [ROADMAP.md](ROADMAP.md). The vision pipeline rules in CLAUDE.md ("return null over guess," 3-letter set codes atomic, etc.) remain authoritative — they'll re-load when scanner becomes V2 launch scope.
- **Content engine reframes, not rebuilds.** The autonomous content pipeline (ADR-005, ADR-006, ADR-007, ADR-011, ADR-012) stays intact end-to-end — gates, retry loop, Beehiiv draft step, Mon/Thu cron, full-autonomy commit-to-main. What changes is the topic backlog in `docs/seo-strategy.md` and the SYSTEM_PROMPT framing in `lib/seo/content-engine.ts` — from "Pokemon TCG market analysis" to "Best [card name] deals this week" auto-regenerating posts that pull current pricing on each Mon/Thu fire. The newsletter (ADR-010, ADR-011, ADR-012) follows the same reframing — market-commentary digests become weekly best-deals digests with wishlist-personalized sections.
- **The autonomy + ops stack is fully preserved.** Beehiiv subscribe path (ADR-010), Discord ops bot (ADR-013), the four outbound notification channels (ADR-014), Vercel webhook proxy (ADR-016), Beehiiv REST tools in the bot (ADR-017), daily-digest queue (ADR-018), idea bank (ADR-019), Railway GitHub auto-deploy (Session 19 closure) — none of this is renegotiated. They were built to be product-direction-agnostic and continue to serve the deal-finder framing without modification. The Discord ops bot grounds on these docs and will pick up the new framing on its next Railway redeploy (next push to main triggers it).
- **V1 scope is explicit.** Top 200-500 most-searched cards → one `/cards/[card-slug]` page each → above-the-fold: image, name, set, current best eBay listing (price + condition + seller + shipping + affiliate-wrapped CTA) + wishlist-alert email form. Below: condition breakdown, related cards, programmatic internal links, schema.org Product markup. V1 *defers*: TCGplayer aggregation (Scrydex dependency; affiliate-only fallback works), Mercari/COMC/Cardmarket, price history charts, Pro subscription tier, login-gated wishlist dashboard, cross-listing condition matching.
- **Revenue model shifts to affiliate-primary.** eBay affiliate commissions on Foil-attributed clicks become the primary monetization. Secondary paths: lifetime founding-member tier ($59 Stripe payment link, marketed via newsletter launch send), newsletter sponsorships (deferred until ~1K subscribers), premium tier for power buyers (V2). The pre-pivot `$14.99/mo Pro tier` referenced in CLAUDE.md no longer maps to V1 — Stripe wiring stays (it's already shipped) but the active product surface for it shifts to the founding-member lifetime tier.
- **Risk concentration: eBay 1-day affiliate term clause.** eBay can drop commission rate or change attribution with one day's notice. Mitigation is to diversify affiliate sources as soon as V1 stabilizes — TCGplayer when approved, then Mercari, then COMC. During the eBay-only launch window this is a real concentration risk; flagged in [RISKS.md](RISKS.md) as a follow-up to capture.
- **Founder-voice work becomes near-term.** The content engine and newsletter need a defined voice that matches the founder's natural writing style — captured for a near-term goal (likely Session 22 or 23) via the `brand-voice:guideline-generation` skill. Two-paragraph implication: the auto-generated post review currently sitting in ROADMAP NOW item #4 carries extra weight now, because those posts are the calibration corpus for the voice work that follows.

**Cross-refs.**

- [STRATEGY-PIVOT-DEAL-FINDER.md](STRATEGY-PIVOT-DEAL-FINDER.md) — canonical strategy doc; this ADR is the formal record but defers all reasoning to that file.
- [ADR-005](#adr-005--autonomous-content-engine--no-human-review-step) through [ADR-007](#adr-007--gates-as-the-safety-net) — content engine architecture, preserved.
- [ADR-010](#adr-010--beehiiv-as-the-single-newsletter-import-boundary) through [ADR-012](#adr-012--newsletter-manual-paste-fallback-via-email-supersedes-adr-011-api-path) — newsletter stack, reframes content but pipeline preserved.
- [ADR-013](#adr-013--foil-hq-discord-bot-persistent-memory-ops-chat-with-curated-tools) — Discord ops bot, will re-ground on these docs at next Railway deploy.
- [ADR-019](#adr-019--idea-bank-as-the-6th-second-brain-doc) — the IDEAS row promoting this pivot is the first non-Sunday-review promotion since the bank was introduced.

---

## ADR-021 — EPN as V1 live-listing source (Browse API deferred)

**Date:** 2026-05-23
**Status:** Accepted — first V1 surface (Session 21). Browse API deferred pending appeal in [ROADMAP NOW #8](ROADMAP.md#now--this-week--2026-05-27).

**Context.** [ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning) committed Foil to a buyer-side deal-finder framing with V1 shipping per-card landing pages backed by live eBay listing data. The natural API choice was eBay's **Browse API** — it has rich listing fields (seller feedback %, item condition NM/LP/MP, shipping cost breakdown, return policy, ships-from) and a clean OAuth shape. Foil's developer-account application for Browse API access was auto-rejected on the first submission, and eBay's appeal site was down at the time of [the resubmission attempt captured 2026-05-23](ROADMAP.md#now--this-week--2026-05-27). The V1 launch can't wait on the appeal turnaround.

The alternative is **eBay Partner Network (EPN)** — Foil's affiliate-program account, already approved, with its own API surface (Products search + Tracking Links). EPN's data is shallower than Browse — typically title + image + price + URL, without the seller-rating / condition-grade fields — but it's *enough* to render a credible "best current listing" block on a per-card page when paired with text-pattern parsing of the listing title.

A third option was considered and rejected: scrape eBay search-result HTML directly. eBay's 2025 License Agreement update explicitly treats automated scraping as a violation; even if technically feasible, it's an existential risk to the affiliate account.

**Alternatives considered.**

1. **Wait on Browse API appeal.** Cleanest data, but ships V1 weeks late. The unit-economics case in ADR-020 doesn't justify the delay; "one source done well beats two sources done halfway" applies to time-to-first-revenue too.
2. **EPN Products API + manual affiliate-URL builder.** Shallower data than Browse but unblocks V1 today.
3. **Scrape eBay search HTML.** Rejected for License Agreement risk.
4. **PokeTrace `byCondition` listings.** Already wired in the codebase but those are reference *prices*, not live *listings* — no item URL to wrap with affiliate, no real-time inventory shape.

**Decision.** Option 2 — EPN Products + manual affiliate URL builder for V1. The Browse API moves into ROADMAP NEXT once the appeal lands; the existing `lib/affiliate/epn.ts` import boundary will accommodate a second provider through the same `getBestListing` contract.

**Compliance posture (encoded directly into the architecture).** The 2025 eBay License Agreement update places hard constraints on how Foil can hold and present listing data. These are encoded into `lib/affiliate/epn.ts` and `app/cards/[slug]/page.tsx`, not just documented in a wiki:

- **Server-side fetch only, render-time, `cache: "no-store"`.** `searchProducts()` passes `cache: "no-store"` on every fetch; the per-card page is `export const dynamic = "force-dynamic"`. We never persist a raw listing payload — there's no `cached_listings` table and there won't be one.
- **No AI-generated copy that pre-bakes claims about specific listings or prices.** The editorial paragraphs below the fold on `/cards/[slug]` describe the card itself (set, print run, why it matters), not the live listing. The live block self-describes from the EPN response on every load.
- **Affiliate URLs always include `EBAY_CAMPAIGN_ID` + `customid=foil-card-page`.** `buildAffiliateUrl()` enforces this; if `EBAY_CAMPAIGN_ID` is missing it returns the URL UNWRAPPED rather than break navigation (soft-fail preserves UX at the cost of attribution — the failure mode is "we miss a commission," not "user sees a broken link").
- **Single import boundary.** Only `lib/affiliate/epn.ts` constructs raw affiliate URLs (`mkevt`/`campid`/`customid` param assembly) or hits `api.partner.ebay.com`. Audit grep: if those strings appear elsewhere in the repo, that's the regression.

**Consequences.**

- **V1 ships behind a thinner data surface.** Until the Browse API appeal lands, the "best listing" picker can only sort by price; no seller-feedback floor (≥98%) and no condition-grade filter (NM/LP/MP). Mitigation: the editorial-content copy on `/cards/[slug]` is explicit about pricing-only sort, and the daily best-deals newsletter copy adapts the same caveat. Once Browse API lands, the same `getBestListing()` contract enriches with the additional fields.
- **Soft-fail is structural.** If EPN is down or misconfigured, `getBestListing()` returns `null`, and the per-card page renders a fallback "Browse {Card} listings on eBay" CTA via `affiliateSearchUrl()`. The page is robust to EPN downtime by construction; we never 500 a public landing page.
- **R-008 (License Agreement compliance) added to RISKS.** Tracks the no-cache + no-AI-claims + affiliate-URL contracts as a Medium risk so a future refactor can't silently violate them.
- **R-007 (eBay affiliate term concentration) added to RISKS.** Tracks the surface ADR-020 flagged: eBay can change commission rate / attribution with one day's notice. V1's eBay-only posture is the concentration; mitigations are TCGplayer affiliate (V1.5) and other affiliate sources downstream.
- **Single-source boundary keeps the diversification path cheap.** When TCGplayer affiliate approval lands, `lib/affiliate/tcgplayer.ts` mirrors the EPN shape and a thin `lib/affiliate/index.ts` selects the best across both. The page code doesn't change.

**Cross-refs.**

- [STRATEGY-PIVOT-DEAL-FINDER.md](STRATEGY-PIVOT-DEAL-FINDER.md) — canonical strategy doc; this ADR is the V1 implementation record.
- [ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning) — the parent pivot decision; ADR-021 is the first concrete implementation of it.
- [R-007](RISKS.md#r-007--ebay-affiliate-term-change-concentration) + [R-008](RISKS.md#r-008--license-agreement-aiowindowed--no-cache-of-listing-data) — both added in the same commit; ADR-021 is the architectural surface, RISKS rows are the monitoring posture.
- [ROADMAP NOW #5, #6, #7](ROADMAP.md#now--this-week--2026-05-27) — the three Session-20-promoted V1 build items this ADR closes.
- [ROADMAP NOW #8](ROADMAP.md#now--this-week--2026-05-27) — the Browse API appeal, the trigger for revisiting EPN-vs-Browse choice.

### Amendment (Session 21 follow-up, 2026-05-23): EPN credentials do not authenticate any product-search API. Browse API appeal is load-bearing.

The original ADR-021 framing treated EPN's Account SID + Auth Token as if they unlocked an "EPN Products" search endpoint that could substitute for Browse API. **They do not.** Investigation against the eBay developer portal and EPN help center clarified the actual surface area for the credentials Foil has approved:

- **Transaction Detail Report (TDR) API** — affiliate-side reporting. Clicks, conversions, commissions, per-period totals. This is what EPN's Account SID + Auth Token authenticate. Not product/listing search.
- **Smart Links / Tracking Links** — URL-wrapping only; no API call needed. Already implemented via `buildAffiliateUrl()` and `affiliateSearchUrl()` in `lib/affiliate/epn.ts`; these functions work today without EPN credentials being involved (the credentials in `.env.local` are aspirational for the reporting integration that lands later).
- **EPN Data Feeds** — CSV bulk-download of category-level listing data, downloadable on a periodic refresh cycle. Not real-time. A possible interim path for a slow-refresh per-card catalog (4-hr TTL would still satisfy R-008's no-AI-claims-of-listings constraint as long as the catalog metadata is treated separately from the live "current best listing" claim). Worth a separate ADR if it becomes the V1 path.

The two natural real-time product-search endpoints sit outside EPN's credential surface:

- **Finding API** — decommissioned February 5, 2025. The historical App-ID-authenticated keyword search endpoint that would have been the right fit. Gone.
- **Browse API** (`api.ebay.com/buy/browse/v1`) — the documented replacement. Requires a Buy APIs application + approval; auth is OAuth client-credentials with eBay developer-account credentials, NOT EPN's Account SID + Auth Token. Foil's first developer-account application was auto-rejected; appeal sits in [ROADMAP NOW #8](ROADMAP.md#now--this-week--2026-05-27).

**What this means for V1.** The original ADR-021 decision tree — "EPN sufficient for V1; Browse API needs appeal" — assumed EPN had a product-search surface. It does not. The accurate reframing: **EPN unlocks affiliate URL wrapping and post-hoc reporting (both already working); the real-time listing surface needed for `getBestListing()` requires Browse API approval.** That moves the Browse API appeal from "nice to land before scale" to "load-bearing for the V1 best-listing curation."

**Wrapper status.** `lib/affiliate/epn.ts` is not retrofitted this turn. The function shape (`searchProducts` → `getBestListing` → soft-fail) is correct; the test contract still applies. When the Browse API appeal lands, the swap is:

- Endpoint: `api.partner.ebay.com/v1/{AccountSID}/products` → `api.ebay.com/buy/browse/v1/item_summary/search?q=...`
- Auth: `Bearer ${EBAY_EPN_AUTH_TOKEN}` → OAuth client-credentials access token from developer-account creds (new env vars: `EBAY_DEVELOPER_APP_ID`, `EBAY_DEVELOPER_CERT_ID`, with the access token fetched via a `getOauthToken()` helper)
- Response parsing in `parseProductHits()` — `itemSummaries[]` rather than `products[]`/`items[]`, slightly different field shape
- The compliance posture (`cache: "no-store"`, single import boundary, no listing-specific AI claims) carries forward unchanged

**Interim state (today).** Per-card pages stay in production with the affiliate-tracked fallback CTA (`affiliateSearchUrl`) doing real work — visitors who click through and convert still drive affiliate revenue. The "Best current listing" block reads as degraded on every load. Watchlist captures continue working (Supabase row insert path doesn't depend on listing data) — the dormant piece is the wishlist alert cron, which needs `getBestListing()` to be returning real prices before it can fire alerts.

**Action items.**
1. **ROADMAP NOW #8** reframes from "appeal when you remember" to "appeal blocks V1's best-listing surface — try every 24h until accepted." This is now the highest-priority manual item.
2. **Data Feeds investigation** as a parallel path for slow-refresh catalog data. Worth a separate ADR if it becomes the V1 path before Browse API approval lands.
3. **The wishlist alert cron ([ROADMAP NEXT #9](ROADMAP.md#next--next-2-weeks-2026-05-28--2026-06-10)) is now blocked on the same trigger** as the best-listing surface. Both unblock together when Browse API approval lands.

This amendment closes the gap between ADR-021's original framing and the realities of the EPN surface. ADR-021 itself is preserved (the compliance posture and architectural shape are unchanged); the discovery is the EPN credentials are necessary but not sufficient.

---

## ADR-022 — Marketplace Account Deletion compliance via subscribe path over exemption

**Date:** 2026-05-24
**Status:** Accepted

**Context.** The eBay developer-account `foil` production keyset was successfully created during Session 24 follow-up, then immediately landed in a disabled state with the banner *"you need to either subscribe to eBay Marketplace User Account Deletion notifications or apply for an exemption."* Without this, the App ID + Cert ID can't be used to fetch a Browse API OAuth access token — meaning [ROADMAP NOW #8](ROADMAP.md#now--this-week--2026-05-27) (the load-bearing surface for V1's best-listing curation per the [ADR-021 Session 21 amendment](#adr-021--epn-as-v1-live-listing-source-browse-api-deferred)) stays blocked.

eBay offers two paths to enable a disabled keyset:

1. **Subscribe** — host a public webhook at a stable URL, register it with eBay's Alerts & Notifications portal, and let eBay POST account-deletion events to it. The endpoint must handle a one-time GET challenge to prove ownership (compute `sha256(challenge_code + verification_token + endpoint_url)` and answer in JSON) and verify every subsequent POST's HMAC signature.
2. **Exemption** — submit a written attestation to eBay that we don't store eBay-sourced user data. eBay reviews and may approve (timeline opaque), or come back with follow-up questions.

**Alternatives considered.**

- **Apply for the exemption.** Foil genuinely does not persist any eBay-sourced user data — R-008's "no `cached_listings` table, render-time fetch, `cache: "no-store"`" posture meets the exemption criterion on the merits. But the review queue timeline is opaque and exemption approval is reversible at eBay's discretion (a future product surface that *might* store user-shaped data would force re-applying). Faster on paper if approved fast; brittle as a long-term posture.
- **Wait for Browse API appeal queue.** Independent of the deletion-compliance question — the appeal blocks the OAuth credentials being approved at all, not just enabled. Doesn't address the disabled-keyset banner. Orthogonal item, kept in ROADMAP NOW #8 as the next step after compliance.

**Decision.** Subscribe path. Wire `app/api/webhooks/ebay-marketplace-deletion/route.ts` as a thin Next.js adapter over pure helpers in `lib/ebay-marketplace-deletion.ts`; mirror the new `EBAY_DELETION_VERIFICATION_TOKEN` to Vercel prod + dev + GH Actions; pin the GET challenge format and POST signature gate in tests. John submits the verification form at developer.ebay.com once the endpoint is live — eBay fires the GET challenge, our endpoint returns the correct hash, eBay flips the keyset to "compliant," and the Cert ID becomes visible.

**Why subscribe wins.**

1. **Predictable timeline.** The webhook handshake is mechanical — once deployed, the GET challenge resolves the keyset state in seconds. The exemption queue is opaque (could be days, could be weeks).
2. **Durable insurance independent of eBay review queues.** A subscribed webhook stays subscribed; we never reapply for compliance regardless of future product surfaces. The exemption is bound to a specific attestation that future surfaces could invalidate.
3. **Fits the existing webhook pattern.** Two production webhooks already wire the same shape — `app/api/webhooks/stripe/route.ts` (Stripe HMAC) and `app/api/webhooks/vercel-deploys/route.ts` (Vercel HMAC). The deletion endpoint slots in alongside them; pure helpers in `lib/ebay-marketplace-deletion.ts` mirror `lib/vercel-webhook.ts` for testability.

**Architectural posture (mirrors ADR-016 + ADR-021 boundaries).**

- **Pure helpers + thin Next.js adapter.** The hash + signature gate logic lives in `lib/ebay-marketplace-deletion.ts` so `node:test` can pin both. Route file is ~50 lines of Next.js glue.
- **Synchronous handlers — no I/O on either path.** eBay rejects responses slower than ~3s. GET reads a query param, computes a SHA-256, returns JSON. POST reads the raw body, runs HMAC-verify, returns 200/401. Zero DB writes. Zero outbound fetches. Discord notifications are deliberately omitted from this handler; if we add them later, they must be fire-and-forget per ADR-014 and never block the eBay response.
- **R-008 reinforcement — we acknowledge and discard.** The POST handler returns `{ acknowledged: true }` and never inspects the payload body beyond the HMAC verify. No log line includes the eBay-sourced username or any user-identifying field. The compliance posture from ADR-021 (no persistence of eBay-sourced user data) extends directly into this surface.
- **Public route via existing `/api/webhooks` prefix.** No change to `lib/supabase/proxy.ts` PUBLIC_ROUTES needed — the prefix already covers it. Pinned in `lib/__tests__/proxy.test.ts` so a future refactor swapping the prefix for exact rules can't silently gate the endpoint.

**Consequences.**

- **Unblocks ROADMAP NOW #8.** Once John submits the form at developer.ebay.com → Alerts & Notifications → foil → Production and eBay fires the GET challenge, the keyset flips to compliant. The Cert ID becomes visible and gets mirrored to `EBAY_DEVELOPER_CERT_ID`. The Browse API OAuth `client_credentials` flow becomes available in the next goal.
- **Adds 3 new env vars.** `EBAY_DELETION_VERIFICATION_TOKEN` (the shared secret baked into the hash + HMAC), `EBAY_DEVELOPER_APP_ID` (already captured: `JohnCrai-foil-PRD-4183f64d5-2a0e777e`), `EBAY_DEVELOPER_CERT_ID` (pending compliance). All mirrored across `.env.local` + Vercel (prod + dev) + GH Actions per the standard secret-mirror pattern.
- **No new permanent runtime state.** The webhook is stateless. No new tables, no new caches, no new dependencies. If we ever need to retain deletion-event records for audit, that's a separate ADR.
- **Carved out for the next goal.** Browse API client implementation, OAuth `client_credentials` helper, `lib/affiliate/ebay-browse.ts`, the `lib/affiliate/links.ts` multi-source selector, the TCGplayer plumbing, and the wishlist alert cron all stay out of scope. This goal is the compliance gate; the Browse API client is the downstream consumer.

**Cross-refs.**

- [ADR-021 Session 21 amendment](#adr-021--epn-as-v1-live-listing-source-browse-api-deferred) — established the Browse API appeal as load-bearing; ADR-022 is the prerequisite that unblocks the keyset.
- [ADR-014](#adr-014--outbound-discord-notifications-per-channel-webhooks-soft-fail-single-import-boundary) — the soft-fail / single-import-boundary posture extends to this webhook if Discord pings get added.
- [ADR-016](#adr-016--vercel-deploys--discord-via-code-controlled-webhook-proxy-not-marketplace-install) — the pure-helper + thin-adapter shape is borrowed from here.
- [R-008](RISKS.md) — the no-persistence posture on eBay-sourced user data is reinforced by this handler's "acknowledge and discard" contract.
- [ROADMAP NOW #8](ROADMAP.md#now--this-week--2026-05-27) — stays Pending in this goal; closes in the goal that confirms keyset compliant after John submits the form.

---

## ADR-023 — Browse API client ships; `lib/affiliate/links.ts` multi-source selector deferred until TCGplayer access lands

**Date:** 2026-05-24
**Status:** Accepted

**Context.** The eBay Marketplace Account Deletion webhook ([ADR-022](#adr-022--marketplace-account-deletion-compliance-via-subscribe-path-over-exemption)) flipped the disabled `foil` production keyset to compliant — `EBAY_DEVELOPER_CERT_ID` became visible in the eBay developer dashboard and the Browse API OAuth `client_credentials` flow is now usable. The [ADR-021 Session 21 amendment](#adr-021--epn-as-v1-live-listing-source-browse-api-deferred) had already specified the exact code swap:

- Endpoint: `api.partner.ebay.com/v1/{AccountSID}/products` → `api.ebay.com/buy/browse/v1/item_summary/search`
- Auth: `Bearer ${EBAY_EPN_AUTH_TOKEN}` → `Bearer ${oauthAccessToken}` from `client_credentials` against `api.ebay.com/identity/v1/oauth2/token`
- Response parsing: `products[]` → `itemSummaries[]` with stringified `price.value`

What the Session 21 amendment did NOT settle: whether to land a multi-source selector (`lib/affiliate/links.ts`) wrapping both EPN-fallback and Browse-primary call sites in the same goal — anticipating the TCGplayer affiliate-program approval that's still pending ([ROADMAP LATER #26](ROADMAP.md#later--1-3-months-2026-06-11--2026-08-20)).

**Alternatives considered.**

1. **Build `lib/affiliate/links.ts` now as the single getBestListing facade across EPN + Browse.** Cleaner abstraction up-front. But there's currently only one provider that returns real data (Browse) — EPN never resolved to a real listing surface (per Session 21 amendment — EPN credentials authenticate the affiliate reporting API, not product search). A "multi-source selector" wrapping one real source plus the placeholder EPN module is premature abstraction with no immediate consumer.
2. **Build `links.ts` and `lib/affiliate/tcgplayer.ts` as a hypothetical second source.** Same problem — TCGplayer's affiliate-program approval hasn't landed, and writing a client against an unknown API shape is speculative. The TCGplayer goal will define both modules together when the credentials arrive.
3. **Land `lib/affiliate/ebay-browse.ts` only and have the per-card page import getBestListing from it directly.** No new abstraction; the swap is a one-line import change. EPN's `affiliateSearchUrl` + `buildAffiliateUrl` stay where they are (the affiliate-URL boundary is unchanged — it's only the listing-search surface that swaps).

**Decision.** Option 3. `lib/affiliate/ebay-browse.ts` lands now; the per-card page swaps `getBestListing` import from `@/lib/affiliate/epn` to `@/lib/affiliate/ebay-browse`; `affiliateSearchUrl` (the fallback) and `buildAffiliateUrl` (the affiliate-URL construction primitive) stay imported from `epn.ts`. The multi-source selector is deferred — when TCGplayer affiliate access lands, that goal will wire `lib/affiliate/tcgplayer.ts` AND `lib/affiliate/links.ts` together, with `links.ts::getBestListing` calling both providers in parallel + comparing results.

**Why not link the abstraction in now.** The premature-abstraction failure mode is real: writing a selector before the second provider exists locks in assumptions that the actual TCGplayer API shape may not match. Three similar lines is better than a premature abstraction (per CLAUDE.md "Doing tasks" rule #4). When TCGplayer lands, the selector design will be informed by that API's actual response shape — not extrapolated from a single source.

**Architectural posture (inherits from ADR-021 unchanged).**

- **Server-side fetch only, render-time, `cache: "no-store"`.** Both `lib/affiliate/ebay-oauth.ts::getAccessToken` (the OAuth POST) and `lib/affiliate/ebay-browse.ts::searchItems` (the Browse GET) pass `cache: "no-store"`. The per-card page is `force-dynamic`. We never persist a raw listing payload.
- **Soft-fail at every layer.** `getAccessToken` returns null on missing creds / 4xx / 5xx / network / bad JSON / malformed response body. `searchItems` returns `{ ok: false }` on the same failure modes plus the missing-OAuth result. `getBestListing` returns null on any soft-fail. The page renders the fallback "browse on eBay" CTA via `affiliateSearchUrl` and never 500s.
- **Affiliate URL construction stays in `lib/affiliate/epn.ts`.** `buildAffiliateUrl` (the `mkevt`/`campid`/`customid` primitive) is imported by `ebay-browse.ts` rather than reimplemented. Single import boundary preserved — only `epn.ts` constructs raw affiliate URLs anywhere in the repo.
- **OAuth token cached in-process.** Module-level cache in `ebay-oauth.ts` keyed on `expiresAt`. Refresh when remaining TTL drops below 60s. Each Fluid Compute instance refetches once per 2-hour window. eBay's OAuth endpoint has generous rate limits; the cache exists for latency, not quota.

**Compliance posture (R-008 unchanged).** Browse API responses are read render-time and discarded. No `cached_listings` table. No AI-generated copy describes specific live listings. The editorial paragraphs below the fold continue to describe the card itself, not the listing.

**Consequences.**

- **Closes ROADMAP NOW #8.** Once the live-verification step confirms three /cards/[slug] pages render the curated "Best current listing" block (not the fallback CTA), NOW #8 moves to Done.
- **Adds 3 new env vars** at the module-required level: `EBAY_DEVELOPER_APP_ID`, `EBAY_DEVELOPER_CERT_ID`, plus the `EBAY_DELETION_VERIFICATION_TOKEN` that ADR-022 already landed. All mirrored across `.env.local` + Vercel (prod + dev) + GH Actions.
- **EPN module stays in-tree.** `lib/affiliate/epn.ts::searchProducts` is no longer called from any page-render path, but `buildAffiliateUrl` + `affiliateSearchUrl` stay actively imported. When/if the multi-source selector lands, `searchProducts` becomes a candidate for deletion (EPN's product-search surface was never load-bearing per Session 21 amendment).
- **The wishlist alert cron ([ROADMAP NEXT #9](ROADMAP.md#next--next-2-weeks-2026-05-28--2026-06-10)) is now unblocked** at the data layer — `getBestListing()` returns real prices end-to-end. That cron is now buildable in a follow-up goal.
- **`lib/affiliate/links.ts` is the next session of next-greatest-leverage** after TCGplayer affiliate access lands. Tracked as ROADMAP LATER #26.

**Cross-refs.**

- [ADR-021 Session 21 amendment](#adr-021--epn-as-v1-live-listing-source-browse-api-deferred) — specified the swap shape; ADR-023 is its implementation record.
- [ADR-022](#adr-022--marketplace-account-deletion-compliance-via-subscribe-path-over-exemption) — the compliance webhook that unblocked the keyset, prerequisite for ADR-023.
- [R-008](RISKS.md) — compliance posture inherited end-to-end.
- [ROADMAP NOW #8](ROADMAP.md) — closes in the SESSION-LOG entry of the goal that lands this ADR.
- [ROADMAP LATER #26](ROADMAP.md#later--1-3-months-2026-06-11--2026-08-20) — TCGplayer affiliate plumbing, which will trigger `lib/affiliate/links.ts`.

---

## ADR-024 — Wishlist alert cron on Vercel Cron Jobs (vs GitHub Actions or Supabase Edge Functions)

**Date:** 2026-05-24
**Status:** Accepted

**Context.** With [ADR-023](#adr-023--browse-api-client-ships-libaffiliatelinksts-multi-source-selector-deferred-until-tcgplayer-access-lands) landing the Browse API client, `getBestListing()` returns real prices end-to-end. The watchlists table ([Session 21 migration `20260522223417_watchlists.sql`](../supabase/migrations/20260522223417_watchlists.sql)) has been collecting rows since the per-card watchlist form shipped. The data layer is unblocked; what's missing is the cadence — something that walks the table hourly, asks Browse "is the current best ≤ this target," and emails via Resend when yes.

Three viable schedulers were available:

1. **Vercel Cron Jobs** — declared in `vercel.json` `crons[]`; invokes a GET on a route in the same deployment. Auth via `Authorization: Bearer ${CRON_SECRET}` (Vercel reads the env var and stamps the header).
2. **GitHub Actions** — existing `.github/workflows/weekly-content.yml` proves the pattern works for autonomous workloads. A new `wishlist-alerts.yml` could `curl` an unauthenticated endpoint on an hourly cron.
3. **Supabase Edge Functions** — pg_cron + an edge function that talks to the watchlists table directly. Same database; lowest network hops.

**Alternatives considered.**

- **GitHub Actions** would mean the cron lives outside the Next.js app's deployment unit — a schedule change requires a PR to `.github/workflows/`, not a `vercel.json` edit. The autonomy workflow is fine there because it's a multi-step generation pipeline that benefits from GH's job/step model. The wishlist cron is one HTTP call; the overhead is wrong-shaped.
- **Supabase Edge Functions** would couple the cron deploy to a separate deploy surface (`supabase functions deploy`). The wishlist alert logic depends on `lib/affiliate/ebay-browse.ts` + `lib/cards/catalog.ts` + `lib/notifications/resend.ts` — porting all that to Deno-runtime edge functions would either duplicate code or fight the Deno/Node module split. Net: more friction for no measurable benefit.
- **External cron service (Render / Trigger.dev / Hookdeck)** — adds a third deploy surface and a new env var to mirror. Premature for one cron.

**Decision.** Vercel Cron Jobs. `vercel.json` `crons[]` entry pointed at `/api/cron/wishlist-alerts` on the hourly mark; the route handler does its own `Authorization: Bearer ${CRON_SECRET}` gate. Schedule + secret + handler all live inside the Next.js project boundary; schedule changes are part of normal `git push`-driven deploys.

**Why this wins.**

1. **Native to the project boundary.** The schedule is declared in `vercel.json` next to other Vercel config; the route lives next to `/api/webhooks/*` (Stripe, Vercel deploys, eBay deletion). One repo, one deploy unit, one auth model.
2. **Auth via env-var is the supported shape.** Vercel's Cron Jobs runner reads `CRON_SECRET` from the project env and stamps the bearer header on every cron invocation — no manual secret-passing inside `vercel.json`. The same env value is what John uses for manual `curl` testing.
3. **Deploy ↔ schedule coupled.** When the cron route changes (new query shape, new email composer), the schedule re-applies to the same deployment in one push. No "code lives in `main` but workflow is still pointed at last week's commit" drift.
4. **Soft-fail surface matches the rest of the app.** Same Discord summary post pattern as the content engine (`lib/notifications/discord.ts::postWishlistAlertRun`); same Resend wrapper (`lib/notifications/resend.ts::sendTransactionalEmail`); same Supabase admin client (`lib/supabase/admin.ts`).

**Architectural posture.**

- **Pure orchestrator + thin Next.js adapter.** `lib/wishlist/scan-batch.ts::scanWatchlists` accepts injected `supabase`, `getBestListing`, and `sendEmail` shapes and returns an aggregated result. The route handler in `app/api/cron/wishlist-alerts/route.ts` is the ~30-line adapter that wires the live primitives in. Tests pin the orchestrator end-to-end via stubs without next/server.
- **Dedup by `card_slug`.** Many rows may watch the same card. The orchestrator groups rows by `card_slug` and issues exactly one Browse call per slug per run, then checks each row's `target_price_cents` against the current price independently. This keeps the Browse-API quota linear in unique slugs, not total rows.
- **24-hour per-row cooldown.** `last_notified_at` stamps after a successful send; the next run's SQL filter (`last_notified_at IS NULL OR last_notified_at < now() - interval '24 hours'`) skips it for the next 24h. Cool-off lives in SQL — not the orchestrator — so a new instance picks it up immediately on deploy.
- **Browse-call cap = 200.** Math: eBay's Browse API daily quota for "Buy APIs" application access is 5,000 calls/day for new keysets (verify if/when it changes). Hourly cron × 200 calls = 4,800/day, leaving 200-call headroom for per-card page renders. Production hits this cap if the catalog ever exceeds 200 distinct slugs in active watchlists — `capHit` returns `true` in the Discord summary so we notice before requests fail.

**Compliance posture (inherits from ADR-021 / ADR-023 unchanged).** Browse responses are read render-time and discarded. No `cached_listings` table. The cron stamps `last_notified_at` on the row that fired but the listing payload itself never persists.

**Consequences.**

- **Closes ROADMAP NEXT #9** — the wishlist alert cron is the last piece of the V1 deal-finder data loop.
- **Adds one env var** (`CRON_SECRET`) mirrored across `.env.local` + Vercel (prod + dev) + GH Actions.
- **Adds one Vercel cron schedule** visible in the Vercel dashboard → Project → Cron Jobs. Disable temporarily by removing the `crons[]` entry from `vercel.json` and redeploying.
- **Surfaces a Discord summary** to `#content-engine` (using `DISCORD_WEBHOOK_CONTENT_ENGINE` — co-tenant with content-engine pings; if signal-to-noise gets bad we'll split off a `#alerts` channel later).
- **Application Growth Check on the eBay developer account becomes load-bearing** when active watchlists begin to exceed ~200 distinct slugs — at the current 5,000/day Browse quota and hourly cron cadence, 208 calls/run is the headroom. Tracked in IDEAS for the Sunday-review surface; the right trigger is the first Discord summary with `capHit: true`.
- **Per-Pro-tier "instant alerts" feature stays carved out.** This goal is the free-tier hourly batch shape only.

**Cross-refs.**

- [ADR-021](#adr-021--epn-as-v1-live-listing-source-browse-api-deferred) + [ADR-023](#adr-023--browse-api-client-ships-libaffiliatelinksts-multi-source-selector-deferred-until-tcgplayer-access-lands) — the live-listing data dependency.
- [ADR-014](#adr-014--outbound-discord-notifications-per-channel-webhooks-soft-fail-single-import-boundary) — the Discord post-pattern this cron follows.
- [ROADMAP NEXT #9](ROADMAP.md) — closes in the SESSION-LOG entry of the goal that lands this ADR.

---

## ADR-025 — Browse call telemetry: operational metadata only, no listing payload

**Date:** 2026-05-24
**Status:** Accepted

**Context.** [ADR-024](#adr-024--wishlist-alert-cron-on-vercel-cron-jobs-vs-github-actions-or-supabase-edge-functions) established the per-run Browse-call cap (200) and the `capHit: true` signal in the Discord cron summary as the trigger to submit eBay's Application Growth Check. To actually submit it, we need numbers: actuals for daily Browse usage, the surface distribution (per-card page renders vs the wishlist cron), success rate over time. We also need the same numbers internally to know when we're approaching the 5,000/day ceiling BEFORE the wishlist cron starts shedding work.

The natural shape is a small append-only table: one row per Browse call, with the call's call-site tag, success bool, and latency. The tension is R-008 (eBay 2025 License Agreement) — the agreement prohibits storing listing payloads (titles, prices, item URLs, card identifiers). A naïve telemetry table that captures "what we searched for" or "what came back" trips that. The narrow path: operational metadata only.

**Alternatives considered.**

1. **Scrape Vercel function logs.** Free, no schema. Brittle (log format can change), high-latency (logs are 5-15min behind realtime), and adds a separate log-scraping infrastructure surface. Rejected — telemetry as a side-effect of logging is not durable.
2. **Track only an in-memory counter per instance.** Resets on every cold start; multi-instance Fluid Compute makes the count fragmentary. Rejected — useless for daily aggregation.
3. **Persist call metadata + a hash of the search query.** Slightly richer signal (could deduplicate identical queries), but a query hash is borderline-card-identifying and adds a R-008 compliance risk for vanishingly little value. Rejected — out of an abundance of caution.
4. **Persist call metadata + a query length bucket.** Same tradeoff as #3 with less value. Rejected.

**Decision.** A `browse_calls` table with exactly four columns of operational metadata:

```sql
browse_calls (
  id          bigserial primary key,
  called_at   timestamptz not null default now(),
  surface     text not null check (surface in ('page_render', 'wishlist_cron', 'manual')),
  success     boolean not null,
  latency_ms  integer not null
);
```

That's it. No query column, no card_slug column, no result-count column. The `lib/telemetry/browse-calls.ts::logBrowseCall` API enforces the boundary at the type level — there's no parameter that lets a caller pass a price, title, or URL.

**Architectural posture.**

- **Single import boundary** — only `lib/telemetry/browse-calls.ts` writes to `browse_calls`. Two writers (Browse client + cron-route purge) call into it via `logBrowseCall` / `purgeOlderThan`.
- **Fire-and-forget at the call site** — `lib/affiliate/ebay-browse.ts::searchItems` calls `void logBrowseCall({...}).catch(() => {})` so a Supabase outage cannot block a page render. The hot path never awaits the insert.
- **No client-side telemetry** — the Browse client only runs server-side. Telemetry inherits the same boundary.
- **90-day rolling retention** — the daily cron route runs `purgeOlderThan(90, ...)` in the same invocation as the rollup. Long enough to cite trends in a Growth Check application; short enough to keep the table bounded at hundreds of thousands of rows in the worst case (5,000/day × 90d ≈ 450K rows ≈ trivial for Supabase).
- **Two read functions** — `aggregateLast24h` (per-surface counts + success rate + percent of 5,000 ceiling + approaching-ceiling flag) and `aggregateLast7Days` (per-day totals for the embed's text chart). Both bound by the `(called_at desc)` index.

**Compliance posture (R-008 reinforced).**

- **No listing payload persists.** The schema lacks columns for it; the logBrowseCall API lacks parameters for it.
- **No card-identifying fields persist.** Even the `surface` column is one of three enum values — it identifies the CALL SITE, not the card.
- **Telemetry data is internal — never surfaced through any public API.** The route is gated by `CRON_SECRET`; the aggregate posts to a private Discord channel.

**Consequences.**

- **Adds ~5,000 rows/day to Supabase at full quota** — bounded by the 90-day retention sweep. Storage cost negligible at this volume on Supabase's Pro tier (already enabled).
- **Adds one Discord post per day** to `#content-engine` (the cron's webhook target). Co-tenant with the wishlist-cron summary; signal-to-noise is fine at 2 posts/day combined.
- **Surfaces the Application Growth Check submission trigger early.** When yesterday's 24h Browse count crosses 80% of 5,000, the Discord embed flips red + prepends "⚠ Approaching daily ceiling." That's the same evidence we cite in the Growth Check application — internal signal and external submission both grounded on the same numbers.
- **Unlocks future operational dashboards.** When the dataset is meaningful enough to graph (likely 30+ days in), wiring a simple table view at `/admin/telemetry` is a thin layer over `aggregateLast24h` + `aggregateLast7Days`.
- **No latency added to page renders.** The Browse client measures `Date.now()` deltas and emits the insert via `void`. Cold path: ~0.1ms of CPU. Hot path: unchanged.

**Cross-refs.**

- [ADR-024](#adr-024--wishlist-alert-cron-on-vercel-cron-jobs-vs-github-actions-or-supabase-edge-functions) — the cap that motivates the telemetry.
- [R-008](RISKS.md) — the compliance posture this ADR reinforces by example.
- IDEAS row "eBay Browse API Application Growth Check" — telemetry IS the evidence for that submission.

---

## ADR-026 — Quality-aware listing picker (replaces lowest-price-wins)

**Date:** 2026-05-25
**Status:** Accepted

**Context.** [ADR-021](#adr-021--epn-as-v1-live-listing-source-browse-api-deferred) → [ADR-023](#adr-023--browse-api-client-ships-libaffiliatelinksts-multi-source-selector-deferred-until-tcgplayer-access-lands) shipped a Browse-API live-listing surface where `getBestListing` selected by absolute-lowest-price across all hits returned by `item_summary/search`. This shipped a real product bug: the 2026-05-25 22:00 UTC wishlist-alert cron emailed a subscriber recommending a **$1.75 "Venusaur ex 151 NEAR MINT" listing** when real market for that card is $40-80. The listing was a keyword-stuffed accessory (sleeve / holder) whose title matched every search keyword, but whose price reflected the accessory, not the card. Same failure mode poisoned every `/cards/[slug]` page render — lowest-price-wins surfaces keyword-stuffed garbage whenever it exists in the result set.

This isn't a tuning problem; it's a structural one. eBay's `item_summary/search` does no quality filtering on its end — it returns title-keyword matches, period. Foil owns the curation responsibility. Without curation, "the deal-finder" surface is structurally untrustworthy on every page on every load.

R-010 amplifies the lesson: the Session-25 / 26 tests for `getBestListing` were self-consistent (they pinned that the selector picks the lowest of N hand-crafted prices) but didn't anchor on real catalog behaviour. The bug was invisible to CI because no test asserted against a real eBay junk pattern. Session 36's fixtures (`lib/__fixtures__/ebay-listings/`) directly close that gap — every fixture's `_observed` field cites the production case it derives from.

**Alternatives considered.**

1. **Tune the search query instead.** Add filters like `categoryIds=2611` (Pokémon Individual Cards) to the Browse API call to narrow what eBay returns upstream. Promising but partial — even within the Pokémon-cards category, keyword-stuffed listings exist. Worth doing as a *complement* to picker filtering, not a replacement. Tracked as a followup (out of scope for this goal).
2. **Multi-factor weighted scoring.** Combine price, seller rating, condition, recency, image-presence into a score. More sophisticated than threshold gating but adds complexity, depends on more fields than `item_summary` reliably populates, and over-fits before we have signal data. Defer until threshold tuning has measurable rejection-rate telemetry.
3. **Cache historical median prices per card and reject sub-30% outliers absolutely.** A statistical baseline keyed on PokeTrace data would catch the $1.75 case sharply. Two problems: PokeTrace tier-cost (we'd need to extend the cache surface) and the R-008 implications of storing aggregate price signals tied to eBay listings. Future direction once PokeTrace Scale tier is in play; not for Session 36.
4. **Lowest-price among only the top-3-by-search-relevance.** eBay's `item_summary` doesn't expose a relevance score, and `sort=BestMatch` (the default) is opaque. Rejected — we'd be assuming eBay's sort already does what it observably doesn't.

**Decision.** Implement a pure-function 4-stage picker in `lib/affiliate/listing-picker.ts::pickBestListing`. Stages, in order:

1. **Outlier rejection.** Compute median price across all hits. Reject any hit priced below `max(median * 0.30, $3.00)`. The 30% ratio keeps the picker permissive when the catalog is genuinely cheap (commons, modern singles) and aggressive when the catalog is expensive (vintage holos, graded slabs). The $3 absolute floor catches "herd of junk" cases where the median itself is dragged low.
2. **Title quality.** Reject (case-insensitive substring) any title containing `lot`, `bulk`, `commons`, `collection`, `job lot`, `proxy`, `fake`, `reproduction`, `custom`, `fan art`, OR titles with > 1 `pokemon`/`pokémon` mention (a strong multi-card signal).
3. **Condition.** Reject (case-insensitive substring) titles containing `damaged`, `poor`, `for parts`, `heavily played`, `dmg`, `creased`, `bent`, `ripped`, `burn`, `ink`, `water damage`, plus the regex `/\bHP\b(?!\s*\d)/i` (the Pokémon HP stat is always followed by a number; the heavily-played "HP" abbreviation never is — see deviation below).
4. **Lowest-price among survivors.** The original behaviour, narrowed.

If every hit is filtered out, return `null` and let the calling page fall back to `affiliateSearchUrl` — strictly better than surfacing a curated junk card.

**Threshold choices — explicit, not magical.**

- **`OUTLIER_RATIO = 0.30`.** Chosen as a balance between (a) the $1.75 Venusaur case (~3% of credible median = aggressive reject) and (b) the legitimate "$15 LP Charizard" case (~30% of NM median = keep). First-cut value; tuning belongs in the followup.
- **`ABSOLUTE_PRICE_FLOOR = $3.00`.** Catches the case where the herd of junk pulls the median down (e.g., all hits are $1-2 sleeve listings). The picker returns null and the page falls back to the sponsored search CTA.
- **`POKEMON_MENTION_CAP = 1`.** Legitimate single-card titles say "Pokemon Card" once; multi-card lots repeat the word for keyword density.

**Deviation from goal text — `" HP "` regex over literal substring.** The goal listed `" HP "` (with surrounding spaces) as a condition-junk keyword. A literal substring match would false-positive on virtually every Pokémon card title that lists the HP stat (`"Charizard HP 120 Base Set"`). The Pokémon HP stat is ALWAYS followed by a number; the heavily-played "HP" abbreviation NEVER is. The implementation uses `/\bHP\b(?!\s*\d)/i` — word-boundary HP not followed by optional whitespace + a digit. Pinned by a test that asserts "Charizard HP 120 Base Set" passes and "in HP condition" / "NM/HP" reject. Documented for the follow-on tuning goal so it can be revisited if the regex over-rejects.

**Architectural posture.**

- **Pure function.** `pickBestListing` takes `EpnProductHit[]`, returns `EpnProductHit | null`. No I/O, no async, no env dependencies. Test surface is the whole behaviour.
- **R-010 anchor.** Fixtures in `lib/__fixtures__/ebay-listings/` derive from real production observations. Every fixture file's `_observed` field cites its source.
- **Soft-fail preserved.** When all hits filter out, `getBestListing` returns `null` and `app/(site)/cards/[slug]/page.tsx` already falls back to `affiliateSearchUrl(...)` — no caller-side change needed.
- **Telemetry posture preserved.** `pickBestListing` operates *after* the Browse call, so the `browse_calls` row is logged for every search regardless of whether the picker found something credible. The picker's rejection decisions are NOT persisted in this iteration — telemetry on rejection-rate-by-reason is the followup goal.

**Consequences.**

- **Wishlist alerts now surface only credible deals.** The Session-36 production case ($1.75 Venusaur email) cannot repeat for this failure mode.
- **`/cards/[slug]` pages may show the fallback CTA instead of a curated listing more often.** A page that previously surfaced a junk card now shows the sponsored search CTA — a strict UX improvement (a sponsored search is honest about being a search; a junk-card recommendation is dishonest about being a deal).
- **Affiliate-click conversion may shift.** Junk-card click-throughs likely converted at near-zero rate anyway; the fallback CTA at least starts a credible search. Net effect probably-positive but unmeasurable until we have per-card click telemetry.
- **Thresholds may need tuning.** First-cut values. The followup tracks "rejection rate by reason" — too-many rejections on a card suggests a too-tight gate; too-few suggests too-loose. Land that telemetry before tightening anything.
- **One new `api.ebay.com` boundary file? No.** The picker is pure; it doesn't call `api.ebay.com`. No update to `EBAY_API_ALLOWED_FILES` needed.

**Cross-refs.**

- [ADR-021](#adr-021--epn-as-v1-live-listing-source-browse-api-deferred) — establishes the live-listing surface this ADR refines.
- [ADR-023](#adr-023--browse-api-client-ships-libaffiliatelinksts-multi-source-selector-deferred-until-tcgplayer-access-lands) — the Browse-API selector that this ADR's picker plugs into.
- [R-010](RISKS.md#r-010--self-consistent-unit-tests-do-not-prove-spec-conformance) — the meta-lesson this ADR's fixtures + production-anchored tests close on the picker boundary.
- [STRATEGY-PROGRAMMATIC-SEO.md](STRATEGY-PROGRAMMATIC-SEO.md) — names this work as "Task #17 picker fix" and the precondition for the catalog expansion sprint sequence.

**Followup tasks (out of scope for Session 36).**

1. Picker-decision telemetry — extend `browse_calls` (or add a sibling table) to record rejection counts by reason. Operational-metadata-only, R-008 compliant.
2. Threshold tuning — once rejection-rate-by-reason data exists, revisit `OUTLIER_RATIO`, `ABSOLUTE_PRICE_FLOOR`, and the keyword lists.
3. Seller-rating filter — add a `seller.feedbackPercentage` check once we extend the Browse parse to read it from `item_summary`.
4. Multi-factor weighted scoring — when the threshold model can't keep up with adversarial title patterns.

---

## ADR-027 — Unified email capture across three surfaces; default-checked newsletter opt-in on the watchlist form

**Date:** 2026-05-25
**Status:** Accepted

**Context.** Per [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md), the owned email list is Foil's deepest moat — it survives algorithm changes, platform pivots, and competitor entry in ways no SEO surface ever can. Every Twitter follower routed into a newsletter signup is worth ~70x of the Twitter-only relationship over time. The funnel-architecture analysis in that doc identifies the email-signup step as the highest-leverage conversion gate in the entire product — every gram of friction removed there is worth disproportionately a lot.

Pre-Session-37 architecture had two email surfaces (the watchlist form on `/cards/[slug]` and the newsletter `EmailCapture` component used on the blog) writing to two different lifecycle outcomes (watchlist alerts vs. weekly newsletter), with no path from a watchlist signup to the newsletter list. A high-intent buyer who set a watchlist on Charizard would never see Foil's market commentary again unless they manually subscribed elsewhere. The strategy doc names three surfaces that all need to write to the same Beehiiv list with source tags for segmentation: watchlist form (high-intent buyer), `/newsletter` landing page (Twitter-CTA target), and a footer email capture (passive capture).

The legal question for the watchlist form's newsletter opt-in: default-checked vs. default-unchecked. Default-checked is legal under US CAN-SPAM if the box is **visible and uncheckable before submit** (which it is). Default-checked is NOT legal under GDPR for EU residents. Foil's V1 audience is US-focused Pokémon TCG buyers, primarily US/UK/AU/CA English-speaking. The strategy doc explicitly calls this question out and lands on default-checked.

**Alternatives considered.**

1. **Default-unchecked checkbox.** Strictly GDPR-safe and the safer long-term default. Lower per-signup newsletter-list growth — best industry estimates suggest a 30-50% lift on opt-ins when the box is default-checked vs unchecked. The strategy doc's "every gram of friction removed is worth disproportionately a lot" argument is the directional decider here.
2. **Separate-form newsletter signup with no watchlist coupling.** Cleanest from a consent-clarity standpoint but loses the cross-pollination entirely. A high-intent buyer's newsletter signup probability is highest at the moment they're setting a watchlist; deferring the prompt to a separate visit drops the cross-pollination rate by ~80%.
3. **Mandatory newsletter signup with the watchlist** (no checkbox). Tempting from a list-growth perspective, fails CAN-SPAM's "explicit opt-in" requirement when the user hasn't been told a newsletter exists — and would generate spam-complaint storms.
4. **Double opt-in confirmation flow** for the newsletter portion. Strictly safer but adds a confirmation-email round-trip that 30-50% of users don't complete. Beehiiv's free tier doesn't support double opt-in flows natively without lifecycle automation (V2+). Defer.

**Decision.** Three email-capture surfaces, all writing to the same Beehiiv list, tagged by source for downstream segmentation:

| Surface | Source tag | Default behaviour |
|---|---|---|
| Watchlist form on `/cards/[slug]` | `watchlist-form` | Single email field + price target + opt-in newsletter checkbox (**default-checked**, label: "Also send me Foil's weekly deals newsletter (~1 email/week, unsubscribe anytime)") |
| `/newsletter` landing page | `newsletter-landing` | Single email field, sample newsletter excerpts, social proof |
| Footer email capture (every `(site)` page) | `footer` | Compact single-line form |

All three call `lib/beehiiv.ts::subscribeEmail(email, source)`. The watchlist route soft-fails the subscribe call (Beehiiv failure must not block the watchlist insert — the watchlist row is the high-value primitive). The newsletter landing and footer surfaces use the existing `subscribeAction` Server Action via `EmailCapture` component.

**Deliverability requirements bundled in.** Bulk-mail deliverability (Gmail, Yahoo, Apple Mail) now requires RFC 8058 one-click unsubscribe headers in every transactional / newsletter email. The same goal lands:

- HMAC-signed unsubscribe tokens at `lib/unsubscribe-token.ts` (base64url(payload)`.`base64url(signature); secret `UNSUBSCRIBE_TOKEN_SECRET`).
- `/api/unsubscribe` route handling both GET (visible-link confirmation page) and POST (RFC 8058 List-Unsubscribe-Post: List-Unsubscribe=One-Click).
- `lib/notifications/resend.ts::sendTransactionalEmail` injects `List-Unsubscribe` + `List-Unsubscribe-Post` headers when the token can be minted (soft-fail to no-header if the secret is missing — sending a non-functional link is worse than sending none).
- Wishlist alert email body gets a visible "Unsubscribe in one click" link in the footer.
- Beehiiv's `subscriptions.update(id, { subscription_status: "inactive" })` is the actual remove-from-list call, behind the HMAC verify. Soft-fail — even on Beehiiv outage the confirmation page renders.
- A DMARC TXT record (`_dmarc.foiltcg.com = "v=DMARC1; p=none;"`) is required for sender-policy alignment; goal can't touch Vercel DNS UI, so it's a manual founder step flagged in SESSION-LOG.

**Architectural posture.**

- **Single import boundary preserved.** `lib/beehiiv.ts` remains the only module that imports `@beehiiv/sdk` (ADR-010 boundary). The watchlist route imports `subscribeEmail` from `@/lib/beehiiv` rather than touching the SDK directly.
- **Soft-fail discipline.** The watchlist insert succeeds whether or not the Beehiiv subscribe does; the newsletter signup Server Action soft-fails the Discord notification; the unsubscribe route renders success whether or not the Beehiiv unsubscribe lands. Failures are logged, never raised to the user.
- **Source tags are stable.** `watchlist-form` / `newsletter-landing` / `footer` are pinned by `lib/__tests__/email-capture.test.ts` — a rename requires a deliberate test update, not a silent drift.
- **HMAC token is stateless.** Verification is signature compare + payload parse; no DB lookup. A 2-year-old unsubscribe link still works (until UNSUBSCRIBE_TOKEN_SECRET is rotated, which would be a deliberate operational decision documented in SESSION-LOG).

**Privacy / ToS bundled in.** [`/legal/privacy`](../app/(site)/legal/privacy/page.tsx) + [`/legal/terms`](../app/(site)/legal/terms/page.tsx) ship in the same goal — plain-language, single-page each, content sourced from `lib/legal/policy-content.ts`. Privacy explicitly states: no sell/share/AI-training; no eBay listing data persisted (R-008 echo); how to unsubscribe + delete. Terms include the FTC affiliate disclosure (eBay Partner Network) and the as-is listing-accuracy disclaimer.

**Consequences.**

- **Newsletter list growth lift expected.** Best industry estimates suggest 30-50% per-watchlist-signup lift from default-checked vs unchecked; actual lift TBD from real cohorts.
- **Spam-complaint rate to monitor.** Default-checked opt-in generates higher unsubscribe rates than default-unchecked. The honest label ("~1 email/week, unsubscribe anytime") sets expectations. Trigger to flip: per-subscribe unsubscribe rate exceeding 30% over a 14-day rolling window.
- **Unsubscribe latency.** Beehiiv's free-tier unsubscribe API may not be instant; mail clients expect ≤24h. The HMAC route returns immediately; the actual Beehiiv list state may lag.
- **DMARC manual step is a goal-scope leak.** The DNS TXT record can't be touched without Vercel DNS UI access; the goal flags this for the founder.
- **Lifecycle automation is V2.** Welcome series, re-engagement, dormant-subscriber recovery all defer until the list crosses ~1K subscribers and there's real engagement signal to segment on. The source-tag plumbing in this goal is the prerequisite.
- **GDPR re-evaluation trigger.** If/when EU expansion becomes a focus, flip the watchlist checkbox to default-unchecked and add a per-page geo-detection layer. Tracked as a parked item.

**Cross-refs.**

- [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md) — the *why* for this decision.
- [ADR-010](#adr-010--beehiiv-for-newsletter-list-management) — the Beehiiv vendor choice and `lib/beehiiv.ts` import boundary.
- [ADR-024](#adr-024--wishlist-alert-cron-on-vercel-cron-jobs-vs-github-actions-or-supabase-edge-functions) — the wishlist alert cron that the unsubscribe footer link applies to.
- [R-008](RISKS.md#r-008--ebay-2025-license-agreement-ai-output--no-cache-compliance) — the no-listing-persistence rule echoed in the privacy policy.
- [R-009](RISKS.md#r-009--envlocal-entries-can-disappear-during-multi-tool-sessions) — UNSUBSCRIBE_TOKEN_SECRET is a new env var added to the rotation discipline.

**Followup (out of scope for Session 37, tracked as Task #19).**

1. Lifecycle email automation — welcome series (day 0), re-engagement (day 7 no-opens), dormant-subscriber recovery (day 30). Beehiiv automation primitives + source-tag segmentation.
2. Sender-reputation work — DKIM rotation, BIMI logo, DMARC alignment from p=none → p=quarantine after warm-up.
3. Engagement metrics dashboard — open rates / click rates / per-source LTV. Currently visible only in Beehiiv UI; surface in `/admin/email-metrics` once data justifies.
4. EU GDPR-specific consent path — default-unchecked + double-opt-in when geo is EU.

---

## ADR-028 — Aceternity-UI patterns: code-owned, no npm vendor, niche visual identity

**Date:** 2026-05-25
**Status:** Accepted

**Context.** Per [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md) the audience moat requires *niche-distinctive* visual identity — Foil should not look like a generic dark-product SaaS. Pokémon TCG buyers come from a category with strong visual cues (holographic foil, card-binder hover gestures, set-symbol typography). The previous homepage was a clean generic dark-product layout — competent, but indistinguishable from any startup hero.

[Aceternity UI](https://ui.aceternity.com/components) is an MIT-licensed library of "copy-paste" React components that have become the canonical pattern for niche-distinctive interactive UI: 3D Card Effect (perspective tilt on hover), Background Gradient Animation (drifting blurred color blobs with goo-filter merging), Magnetic Button (pointer-following CTA), Sparkles (twinkling accent dots). They're all visually striking AND framework-portable.

The library distributes via copy-paste rather than npm; the documented expectation is "drop the source file into your `components/` tree and customize." This is intentional — Aceternity wants users to OWN the code, not depend on a vendor's release cadence.

**Alternatives considered.**

1. **Install via npm (`aceternity-ui` is not on npm; community ports like `aceternity-ui-react` exist but are unmaintained forks).** Rejected — copy-paste is the documented distribution model, and forks add untracked drift.
2. **Use a different library (shadcn/ui, Magic UI, Origin UI, etc.).** shadcn/ui is the dominant pattern for *primitive* components (Button, Dialog) which we don't need — we have working primitives. Magic UI overlaps Aceternity but is less Pokémon-niche-fit. Origin UI is editorial. Aceternity's holographic-card aesthetic IS the niche fit.
3. **Build the same effects from scratch with no reference library.** This is effectively what we did anyway (see "Implementation deviation" below) — but starting from the Aceternity patterns gives us a shared visual vocabulary the broader ecosystem recognizes.
4. **Install framer-motion to support the Aceternity components verbatim.** Adds ~120KB to the client bundle for effects that can be implemented in CSS-only. Rejected — pure-CSS implementations are lighter and equally good for our use cases (no sequenced enter/exit animations, no scroll-triggered timelines).

**Decision.** Ship four Aceternity-pattern components as **code-owned MIT-licensed source files** in `components/aceternity/`. Implement them with pure CSS + minimal React state (no framer-motion dependency). Tune the color defaults to Foil's brand palette so the holographic effect reads as "Pokémon TCG foil card under a light," not "generic SaaS gradient."

Component inventory:

| File | Pattern | Used where |
|---|---|---|
| `components/aceternity/background-gradient-animation.tsx` | Four blurred RGB blobs drift across the container; SVG goo filter makes them merge instead of overlap. | Homepage hero backdrop. |
| `components/aceternity/card-3d.tsx` | Pointer-tracked perspective tilt; `Card3DBody` + `Card3DItem` for layered-depth children. | Reserved for `/cards` thumbnails + per-card related-cards block (deferred to follow-up — landed the homepage + /start surfaces this session). |
| `components/aceternity/magnetic-button.tsx` | CTA shifts up to ±12px toward the pointer within an 80px radius. Sibling `MagneticLink` for `<a>` semantics. | Primary "Start tracking cards →" CTA on the hero. |
| `components/aceternity/sparkles.tsx` | N twinkling dots positioned by deterministic PRNG; CSS keyframe twinkle with randomized delays. | Behind the hero headline for holographic shimmer. |

**Implementation deviation — pure CSS, not framer-motion.** Aceternity's reference implementations use framer-motion (~120KB on the client). Foil's implementations use:
- Plain `useState` + `useRef` for pointer tracking.
- Inline `style` transforms (no animation library).
- CSS `@keyframes` (in `<style jsx>` blocks) for the perpetual loops (gradient drift, sparkles twinkle).

The result is bundle-light, framework-portable, and visually equivalent for our use cases.

**Cabinet Grotesk substitution.** The goal text named Cabinet Grotesk as the display font. Cabinet Grotesk is a Fontshare release and isn't on Google Fonts; using `next/font/local` would require self-hosting a font file. The substitute is **Bricolage Grotesque** (Google Fonts, variable axes for width + weight), which has comparable geometric-display feel without the self-hosting surface. Documented here so a future migration to Cabinet Grotesk via `next/font/local` is a one-line change in `app/layout.tsx`.

**Architectural posture.**

- **Code-owned, MIT.** Aceternity's MIT license permits copy-paste use; our header comment in each file credits the pattern + names the decision (ADR-028). The components are now Foil source — no vendor release dependency.
- **No npm dependency added.** No `framer-motion`, no `clsx`, no `tailwind-merge` — all the dependencies the original Aceternity components carry are avoided by the pure-CSS rewrite.
- **Brand-tuned defaults.** The four-color holographic palette (`#FF6B5C` primary + teal + violet + amber) is the niche-distinctive choice. `lib/__tests__/aceternity-components.test.ts` pins these defaults so a refactor can't quietly drift the palette away from the holographic-foil signal.
- **Drift guards in CI.** `aceternity-components.test.ts` asserts each file exports the named API, the SVG goo filter is intact (BackgroundGradientAnimation), the three-piece Card3D API stays composable, the magnet defaults hold, and the homepage hero composes the right components.

**Consequences.**

- **Niche-distinctive homepage.** The hero now reads as "Pokémon TCG holographic foil" rather than "generic SaaS dark mode." This is the entire point of the goal.
- **Light client bundle.** No framer-motion → the new hero adds <5KB gzipped to the page weight (the four component files combined). A framer-motion-based implementation would have added 100KB+.
- **Browser-quirk surface.** SVG goo filters render slightly differently in Safari vs Chrome (Safari's blur radius interpolation lags). The visual is degraded gracefully on Safari (blobs look softer / less merged) — never broken. If founder observes a real Safari regression in production, we tune the blur stdDeviation.
- **Future Aceternity components can land cheap.** Adding a new component is a ~150-line file copy + a tuned color default. The drift-guard pattern is replicable.
- **prefers-reduced-motion is NOT yet honored.** The gradient drift + sparkle twinkle + magnetic motion all play regardless of OS-level reduce-motion setting. A11y followup (out of scope this session): wrap each component in a `@media (prefers-reduced-motion: reduce)` guard that freezes the animation.
- **/cards thumbnail 3D wrap is deferred.** Card3D ships in the codebase; the per-card-thumbnail composition is a thin follow-up that can land in any future polish goal. The Card3D-component drift guard pins the API so the follow-up doesn't require re-writing the primitive.

**Cross-refs.**

- [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md) — names the niche-distinctive visual identity requirement.
- [STRATEGY-PROGRAMMATIC-SEO.md](STRATEGY-PROGRAMMATIC-SEO.md) — the catalog-expansion sprints depend on per-card pages reading as distinctive at scale; the visual identity from this ADR generalises across all 5K pages.
- Aceternity UI MIT license — preserved as the header credit in each component file.

**Followups (out of scope for Session 38).**

1. `/cards` + `/cards/[slug]` thumbnail wraps in Card3D (the components ship; the wrap is a thin polish goal).
2. `prefers-reduced-motion` honoring on the gradient + sparkle + magnetic components.
3. Aceternity Text Hover Effect variant for set-name typography on `/cards/sets/<id>`.
4. Cabinet Grotesk via `next/font/local` if the founder wants to revisit the substitution.

---

## ADR-029 — Cream + navy + gold visual identity for collector-niche distinctiveness

**Date:** 2026-05-26
**Status:** Accepted (supersedes the holographic-rainbow palette from [ADR-028](#adr-028--aceternity-ui-patterns-code-owned-no-npm-vendor-niche-visual-identity) for default surfaces; the Aceternity component scaffolding from ADR-028 remains in place and is *retuned*, not replaced)

**Context.** Session 38 ([ADR-028](#adr-028--aceternity-ui-patterns-code-owned-no-npm-vendor-niche-visual-identity)) shipped the Aceternity-pattern interactive primitives (`BackgroundGradientAnimation`, `Card3D`, `MagneticButton`/`MagneticLink`, `Sparkles`) on top of a dark `#0B1428` / coral `#FF6B5C` palette. Founder design review concluded the result still read as "competent indie-SaaS template" rather than "Pokémon TCG collector niche." The blocker: a rainbow-blob full-page backdrop + a high-saturation coral primary on dark = generic 2024-era SaaS aesthetic. Pokemon TCG collectors visually identify with cream/parchment card faces, navy ink, gold foil accents — a palette that pre-dates the SaaS visual canon by decades.

The decision needed to land before the Twitter pinned-post launch.

**Alternatives considered.**

1. **Keep the dark/coral palette, swap fonts only.** Rejected — typography alone can't move a layout that reads as a SaaS template into "niche-distinctive."
2. **Adopt the v0 / shadcn slate palette (zinc + emerald + accent).** Rejected — that IS the generic SaaS visual canon. Every YC company ships some variant of it.
3. **High-saturation maximalist (e.g. ColorMagic or '90s-PokeRetro pastel pop).** Rejected — too kitsch, signals "fan project" not "buyer-grade product."
4. **Cream + navy + gold + restricted accent.** **Adopted.** Cream as page surface, navy as text + primary CTA bg, gold as premium / foil / live-indicator accent, coral demoted to hover-state-only. Matches the Pokémon TCG card face's own cream + navy + foil-gold visual vocabulary. Plenty of premium consumer brands sit in this palette (Letterboxd, Substack, Hardcover.app) without losing distinctiveness.

**Decision.** Lock the palette as five `--color-foil-*` tokens declared in `app/globals.css` `@theme inline` so they auto-generate Tailwind utility shorthands (`bg-foil-cream`, `text-foil-navy`, `border-foil-gold`, etc.):

| Token         | Hex       | Role                                                       |
|---------------|-----------|------------------------------------------------------------|
| `foil-cream`  | `#F8F5F0` | Page BG (every public surface)                             |
| `foil-navy`   | `#0F1E3A` | Primary text + CTA bg                                      |
| `foil-slate`  | `#4A5568` | Secondary text, mutes                                      |
| `foil-gold`   | `#C9A24B` | Premium / foil / live-indicators / hover ring              |
| `foil-coral`  | `#FF6B5C` | **Hover-state ONLY** — never default                       |

**Aceternity primitives retuned, not replaced.** The four components shipped by ADR-028 stay in `components/aceternity/` with the same API. Three changes:

- **`BackgroundGradientAnimation` gains a `variant` prop.** New default `"corner-shimmer"` renders 1–2 low-opacity gold/navy blobs anchored to the bottom-right corner. Legacy `"full"` mode kept for back-compat. Default `containerBg` flips cream; palette flips gold + navy. The full-page rainbow goes away.
- **`MagneticButton` + `MagneticLink` ship default hover-ring + shadow-expansion.** The magnetic translate is the engagement signal; on top of it every Magnetic CTA gets a 2px gold hover-ring and shadow-lift. Default callsite chrome (bg/text/padding) still flows from `className` so the API stays compositional.
- **`Card3D` adds default shadow + gold hover-ring.** Soft `shadow-foil-navy/10` baseline, `hover:ring-foil-gold/30` on engage. The hover-ring rotates with the card's perspective tilt — reads as "holographic card under a binder sleeve."
- **`Sparkles` recolors default to gold and is removed from the hero JSX.** Component stays exported + tested in case a future surface wants it; the homepage no longer renders it (the 8-card grid is the visual interest now, not the sparkle overlay).

**Coral hover-only rule.** Coral (`foil-coral` / `#FF6B5C`) appears nowhere as a default state. Defense-in-depth: `lib/__tests__/visual-regression.test.ts` walks every public-surface file and asserts that every `bg-foil-coral` and `ring-foil-coral` occurrence is preceded by `hover:` or `group-hover:`. A raw `#FF6B5C` hex anywhere in the public-surface set fails the test. Coral becomes the "premium hover signal" — the same way native consumer apps reserve their brand color for the engaged state.

**Typography.** Bricolage Grotesque (already loaded as `--font-display` per ADR-028) gets `tracking-[-0.02em]` and weight 700 on every editorial headline — h1, h2, section labels. Geist stays for body. The aesthetic shift is palette + tracking; the type face itself was already the right choice.

**/start UX fix.** The pre-Session-39 onboarding form labelled steps "1. / 2. / 3." but section 2 only rendered conditionally on card selection, so first-time visitors saw "1 → 3" with no 2. The fix drops numbering entirely and uses named section headers ("Tell me a card", "Set target prices", "Where to email you"). Section 2 stays conditional but the lack of number eliminates the visible gap.

**Architectural posture.**

- **Tokens, not literals.** Every cream/navy/gold/coral reference lives in Tailwind class form (`bg-foil-cream`) rather than as a raw `#F8F5F0`. Future palette tweaks are one edit to `globals.css`. The visual-regression test pins this — raw hex literals in any public-surface file fail.
- **No new components.** ADR-028's four primitives + the existing PlanCard / EmailCapture / WatchlistForm composition is enough. Session 39 retunes the chrome; the structure stays.
- **No dark-mode override.** `globals.css` no longer responds to `prefers-color-scheme: dark`. Cream is the identity across light/dark OS prefs — collectors don't expect a "dark mode" card-shop, and forking the palette doubles the maintenance surface.
- **Drift guards in CI.** `aceternity-components.test.ts` updates pin the new gold/navy defaults; `visual-regression.test.ts` (new) pins the no-coral-default rule + token-not-hex rule across 15 public-surface files.

**Consequences.**

- **Niche-distinctive identity locks in.** The homepage now reads as "Pokemon TCG card shop with editorial polish" rather than "AI startup CTA." This is the entire point of the goal.
- **Twitter pinned-post unblocked.** John can paste the bio + foiltcg.com/start CTA and the landing page converts.
- **Bundle stays the same.** The retune is pure-CSS / token edits — no new runtime dependencies, no measurable client-bundle delta.
- **`prefers-reduced-motion` still NOT honored.** Carry-over from ADR-028. A11y followup still deferred.
- **The pre-Session-39 darker-coral hover (`#FF8775`) is dropped.** Hover state is now `foil-coral` on its own; the gold hover-ring provides additional state signal.
- **Per-card best-listing block changes appearance.** What was a coral-bordered gradient panel becomes a gold-bordered cream panel with a navy price + navy Buy CTA. The "live" affordance moves from coral pulse-dot to gold pulse-dot. R-008 caching posture unchanged — only visual chrome.
- **Blog prose chain rewritten for cream.** Drops `prose-invert`, switches every prose-* override to the new tokens. Existing posts inherit the new look on next render with no per-post edits.

**Cross-refs.**

- [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md) — names the niche-distinctive visual-identity requirement that ADR-028 + ADR-029 close.
- [ADR-028](#adr-028--aceternity-ui-patterns-code-owned-no-npm-vendor-niche-visual-identity) — Aceternity component scaffolding; this ADR retunes the palette on top of it.

**Followups (out of scope for Session 39).**

1. ~~`prefers-reduced-motion` honoring on the gradient + magnetic components (still carried from ADR-028).~~ **Partially resolved (Session 45, 2026-05-28).** A global `@media (prefers-reduced-motion: reduce)` reset in `app/globals.css` now freezes CSS animations/transitions site-wide (the live-dot `animate-ping`, the corner-shimmer keyframes), and JS event-handler guards were added to the inline-transform components a CSS reset can't catch — `MagneticButton`/`MagneticLink`, `Card3D`, and the `full`-mode `BackgroundGradientAnimation` rAF loop. `Card3D`'s `ease-linear` was also corrected to `ease-out`. The global reset covers every surface; the JS guards cover the motion components wherever they're imported. Considered honored for V1; revisit only if a new pointer-driven motion component ships without its own guard. See [SESSION-LOG Session 45](SESSION-LOG.md).
2. Per-card thumbnail `Card3D` wrap on `/cards/[slug]` and `/cards/sets/<id>` (carried from ADR-028 — primitive already shipped, composition is thin polish).
3. Cabinet Grotesk via `next/font/local` if the founder wants to revisit the Session-38 substitution.

(The Session-38-noted `images.scrydex.com` remotePatterns gap closed in commit `b67ed97` before Session 39 started — no longer a followup.)

---

## ADR-030 — Per-card page reference-data layer: PokeScope-inspired additions atop the existing buyer's-action layer

**Date:** 2026-05-26
**Status:** Accepted

**Context.** `/cards/[slug]` is the surface every Twitter visitor will land on. The Session-37/38/39/40 stack turned it into a competent **buyer's-action page** — live best-listing, conditioned badge, wishlist form, related cards. But a competent collector landing on it from a tweet has a parallel reference workflow: *what type is this card, who illustrated it, what's the range of recent prices across variants, when was the set printed, what's the rarity?* Sites like PokeScope, Cardmarket, and the Pokemon TCG SDK explorer all serve that workflow well; Foil currently lifts none of it.

The risk of skipping this layer: a collector visiting from Twitter cross-references in another tab, anchors their mental price on that other tab's data, and treats Foil's CTA as "another affiliate page." Adding a reference-data layer makes Foil a **strict superset** of the typical Pokemon-card reference site — same data, plus a curated buy CTA on top.

**Alternatives considered.**

1. **Skip the reference layer, double down on listings.** Rejected — competitors are already strong at listings (TCGplayer, eBay search itself). The differentiation is "best curated listing + complete reference," not "marginal listing quality."
2. **Reference layer as a sub-page (e.g. /cards/[slug]/reference).** Rejected — every cross-link is a chance for the collector to leave. One page, full data, single conversion surface.
3. **External link to PokeScope / Cardmarket.** Rejected — same problem; bouncing the visitor out of Foil before they hit the buy CTA is exactly what we shouldn't do.
4. **Reference layer with full pricing data baked into the JSON.** Rejected — pricing data updates frequently; if we bake it, the per-card pages serve stale data for the full ISR window. The TCGplayer prices come from the SDK's `tcgplayer.prices` field which the SDK refreshes daily — fetching at render time is the right call.

**Decision.** Compose five new reference components on `/cards/[slug]`, in this order:

1. **`<Breadcrumb>`** — `Home / Cards / <Set> / <Card>` at the top. Visual breadcrumb + schema.org `BreadcrumbList` JSON-LD, shared from the same `items` array so visual + structured-data can't drift.
2. **Variant badges next to the H1** — types (e.g. "Fire") + subtypes (e.g. "Stage 2") rendered as small foil-gold-bordered chips. At-a-glance card identity.
3. **`<CardVariantsSection>`** — TCGplayer Low/Mid/High range per printing (Normal / Holofoil / Reverse Holo / etc), with the current eBay best-listing price marked on each bar for direct comparison. The highest-`market` variant gets a "Highest value" badge.
4. **`<LiveTimestamp>`** — small "Live · X seconds ago" chip with gold pulse dot, ticking every 10s via setInterval. Signals that the data on this page is fresh-from-this-render, not cached at our edge.
5. **`<CardMetadataBlock>`** — Type, Subtype, HP, Series, Artist, Release year, Rarity (key/value grid) + Attacks (with cost + damage) + Weaknesses chips. Two columns on desktop, one on mobile.

The buyer's-action layer (best-listing block + watchlist form + related cards) remains exactly as-is. The reference layer is **additive** — it surrounds and supports the CTA, never displaces it.

**SDK extension.** [`lib/cards/sdk.ts`](../lib/cards/sdk.ts) `CardMetadata` gained: `series`, `types`, `subtypes`, `hp`, `artist`, `attacks` (with cost + damage + text), `weaknesses`, `tcgplayerPrices` (keyed by variant slug), `tcgplayerUpdatedAt`. All optional in shape, with `[]` / `null` / `{}` defaults so a soft-fail minimal-record card still renders the page (the new sections gracefully return `null` when their data is missing).

The `loadBakedSnapshot()` normalizer fills these defaults into pre-Session-41 baked entries so older snapshots don't carry undefined-property holes into the rendering path.

**Architectural posture.**

- **No new data sources.** The reference data all lives in the existing Pokemon TCG SDK response — we just weren't extracting it. Zero new external API dependencies.
- **All new components are Server Components except `<LiveTimestamp>`.** The live timestamp needs `useEffect` + `setInterval` for the relative-time update; everything else can SSR cleanly.
- **Graceful degradation throughout.** Each section checks its input and returns `null` when it has nothing to render — the page never carries empty headings.
- **Schema-org breadcrumb is wired through the existing schemaGraph chain.** No new JSON-LD `<script>` tag; the BreadcrumbList drops into the page's existing structured-data envelope alongside the Product schema.
- **Drift guards in CI.** [`lib/__tests__/card-page-enhancements.test.ts`](../lib/__tests__/card-page-enhancements.test.ts) pins each new component's behavior (rows rendered, null-safety branches, hover/aria attributes) and the page-level composition.

**Consequences.**

- **Strict superset of competing reference sites.** A collector who would otherwise check Cardmarket or PokeScope for the same card now sees the same data on Foil — plus a curated buy CTA.
- **More raw real-estate per page.** The page is taller now (5 new sections). Mobile readability stays good (single-column metadata grid, stacked variant cards), but bounce rate on mobile is worth watching post-launch.
- **TCGplayer price freshness is upstream-controlled.** When the SDK's `tcgplayer.prices.<variant>.{low,mid,high,market}` is stale, our visualization is stale too. We can't ground-truth this; the `tcgplayerUpdatedAt` caption is the user-facing honest signal.
- **Variant section gracefully degrades for cards with no TCGplayer data.** Trainer cards, energies, and pre-2003 sets often lack `tcgplayer.prices` — the section returns `null` rather than rendering an empty panel.
- **Page is now legitimately reference-grade for collectors.** That's the goal.

**Cross-refs.**

- [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md) — names the "win the collector niche by being indispensable on a per-card basis" requirement that ADR-030 closes.
- [ADR-026](#adr-026--quality-aware-listing-picker-replaces-lowest-price-wins) — the buyer's-action layer (best-listing picker) that the reference layer surrounds.

**Followups (out of scope for Session 41).**

1. Graded prices section (PSA 10 / BGS 9.5 / CGC 9.5) — requires a sold-comps integration we don't have yet. The variant section's "highest value" badge is a partial proxy until then.
2. TCGplayer affiliate row — waiting on V1.5 affiliate approval.
3. Cardmarket prices integration (the SDK exposes `cardmarket.prices` too) — second cluster of variant bars once we know whether collectors find the TCGplayer row enough.
4. Re-run `npm run bake:cards` periodically so the baked fallback picks up the new SDK fields (the existing snapshot has them normalized as empty; live-SDK calls populate them in real time).

---

## ADR-031 — MDX component palette discipline: tokens only, contrast-tested at the component layer

**Date:** 2026-05-26
**Status:** Accepted

**Context.** Session 39 ([ADR-029](#adr-029--cream--navy--gold-visual-identity-for-collector-niche-distinctiveness)) migrated every public surface to the cream/navy/gold palette and pinned the no-coral-default invariant with `lib/__tests__/visual-regression.test.ts`. The invariant covered 15 page-level surfaces. It did NOT cover `mdx-components.tsx` — the custom components rendered INSIDE blog-post bodies (`<Callout>`, `<FAQ>`, `<CardScannerEmbed>`, `<TopicLink>`, the `pre`/`code` MDX overrides). Those components still carried the pre-Session-39 dark-mode palette: callout variants used `bg-sky-500/5 text-sky-100` (info), `bg-amber-500/5 text-amber-100` (warning), `bg-emerald-500/5 text-emerald-100` (tip) — all light text on light-tinted backgrounds. The CardScannerEmbed used `bg-gradient-to-br from-[#101D38] via-[#0B1428]` with `text-white` and a coral CTA. Once the page chrome flipped cream, the Callout body text rendered as washed-out pastel on cream — the "Heads up" warning callout in `how-much-is-my-pokemon-card-worth-a-60-second-checklist.mdx` was effectively invisible. Blog posts are linked from the footer's "Field notes" surface, so the bug blocked the Twitter pinned-post launch.

**The meta-lesson.** Page-level visual-regression doesn't catch component-level color drift. Components imported INTO a page render their own classNames, which the page's surface-list grep can't see. The fix needed both layers: extend the file allowlist to include `mdx-components.tsx`, AND pin component-specific invariants (Callout body uses `text-foil-navy` not `text-zinc-*`, FAQ question/answer use foil-* tokens, pre/code overrides match the prose-* chain).

**Decision.** Three policies for MDX components going forward:

1. **Token-only colors.** `mdx-components.tsx` may reference colors ONLY via the canonical 5 Tailwind foil-* tokens (`foil-cream`, `foil-navy`, `foil-slate`, `foil-gold`, `foil-coral`). No raw hex literals, no Tailwind palette colors (`zinc-*`, `sky-*`, `amber-*`, `emerald-*`, `slate-*`). The visual-regression test pins this via `text-zinc-\d+`/`text-sky-\d+`/`text-amber-\d+`/`text-emerald-\d+` doesNotMatch assertions on the file.

2. **Contrast at the component layer, tested.** Each component must explicitly set a foreground color class on every text node it renders — no relying on inherited prose chain (because `not-prose` callouts opt OUT of the chain). The test asserts each known text-bearing node anchor (e.g. Callout body wrapper is `<div className="text-foil-navy …">`, FAQ answer is `<p … text-foil-navy/85>q.answer</p>`).

3. **Variant accent mapping.** Three Callout variants ship today: `info` (gold-subtle, tag "Note"), `warning` (gold-accent, tag "Heads up"), `tip` (gold-prominent, tag "Pro tip"). All three use the gold family. **Coral remains hover-only at the component layer too** — the visual-regression test's existing `bg-foil-coral` / `ring-foil-coral` hover-only invariants now extend to `mdx-components.tsx`. If a future post needs a true alarm-tone callout, add a new `warn` variant with `border-foil-coral/40` (stripe) + `text-foil-coral` (label) — coral on border + label is permitted, coral as background fill is not. The visual-regression test already encodes that asymmetry.

**Pre/code parity with the prose chain.** The MDX `pre` and `code` overrides previously SHADOWED the prose-pre / prose-code styling declared in `app/(site)/blog/[slug]/page.tsx`. Two different style declarations for the same elements led to drift potential — fix the MDX override to match the prose chain (navy bg + cream text for `pre`; navy/10 bg + navy text for `code`), so a future change in one surface naturally syncs the other.

**Variant naming exception ("Heads up" = gold).** The pre-Session-42 code mapped variant `warning` to a coral display tag "Heads up". The user-facing "Heads up" string is closer to a heads-up note than a critical-warning siren. Per spec, it renders gold-accent. The variant *key* (`warning`) stays so existing posts don't need editorial edits; only the *accent* changes. If a future post needs a stronger alarm tone, add a new `warn` variant beside the three existing ones — don't overload `warning`-as-heads-up.

**Consequences.**

- **Blog posts now read on cream.** Every `<Callout>` body renders foil-navy on foil-cream — legible. The `how-much-is-my-pokemon-card-worth` "Heads up" callout, the launch-blocking case, is fixed.
- **Visual-regression test now catches MDX drift.** A future PR that adds a Callout variant using `text-white` or `bg-amber-500/5` trips the existing `mdx-components.tsx`-scoped negative assertions.
- **One narrow asymmetry vs ADR-029.** Coral can appear in `border-foil-coral/40` + `text-foil-coral` on a Callout variant without `hover:` prefix (state-signal, not default fill). The visual-regression test was already permissive about `text-foil-coral` (error/state indicator); ADR-031 extends the same logic to `border-foil-coral`. Background coral on a default state still trips the test.
- **No new components, no new tokens.** Strictly scoped to fixing the contrast bug and pinning the invariant. The 5 foil-* tokens remain the canonical set.

**Cross-refs.**

- [ADR-029](#adr-029--cream--navy--gold-visual-identity-for-collector-niche-distinctiveness) — the original cream/navy/gold lock; this ADR extends its enforcement to MDX components.
- `lib/__tests__/visual-regression.test.ts` — `PUBLIC_SURFACES` list now includes `mdx-components.tsx`. Component-specific assertions live in the same file.

**Followups.** None planned. The single "Watch out" / coral-stripe variant isn't needed by any current post; add when content requires it.

---

## ADR-032 — Brand mark: gold rhombus as foil-facet shorthand

**Date:** 2026-05-27
**Status:** Superseded by [ADR-036](#adr-036--home-page-warmth-pass-fraunces-display-spark-mark-pricing-removal-lighter-scrim) (Session 46) — the rhombus read as a folder/square at favicon size; replaced by the holofoil "spark" mark. The foil-facet *intent* (a holographic glint) carries forward into the spark.

**Context.** Between Sessions 39-42 the SiteHeader rendered the wordmark "Foil" preceded by a 8px gold round dot with a ping animation. The dot read as the generic SaaS-template "live-status indicator" pattern — exactly the visual cliché [ADR-029](#adr-029--cream--navy--gold-visual-identity-for-collector-niche-distinctiveness) named as the failure mode the cream/navy/gold palette was supposed to defuse. A round dot is also semantically null: it doesn't say "this brand is about Pokemon TCG," "this brand is about deals," or anything specific to Foil. With the Twitter launch hitting the homepage as the first impression surface, the brand mark needed to do work the dot wasn't doing.

**Design constraints (founder design call, 2026-05-27).**

1. Stay in the cream/navy/gold palette — no new tokens.
2. Keep it geometric — a literal pokeball or card-back illustration would over-commit the visual to a Pokemon-only product, and we want the door open for multi-TCG later.
3. The glyph must be reducible to a favicon-sized primitive (16-32px) without losing identity.
4. The "Foil" wordmark stays in display typeface (Bricolage Grotesque), navy. Only the glyph changes.
5. Must read as "premium / collector / foil" at first glance.

**Decision.** Replace the round dot with a **gold rhombus** — a single rotated parallelogram (12px square rotated 15°). Three rationales:

1. **Foil-facet shorthand.** A tilted parallelogram reads as a card corner caught in light, a holofoil facet, a refracted-light glint. The mark IS the product name visualized — what a holofoil card looks like when light hits a corner.
2. **Geometric primitive, scales cleanly.** SVG `<rect>` rotated 15° survives downscaling to 16px favicon without anti-aliasing degradation. No detail to lose.
3. **Three-stop linear gradient internal to the rhombus** suggests holofoil shimmer (deeper gold top-left → cream-tinted highlight mid → canonical foil-gold bottom-right). At 12px it reads as "premium fill"; at 64-180px favicon size the gradient itself is legible. The gradient stops use `#a07d2c` (deeper gold) → `#e6c170` (highlight) → `#c9a24b` (canonical `foil-gold`). The third stop is the canonical foil-gold hex; the first two are tonal shifts of the same hue, not new palette tokens.

**Component shape ([`components/brand/logo.tsx`](../components/brand/logo.tsx)).**

- `<LogoGlyph size>` — the rhombus only. Used as the favicon primitive and any "icon without wordmark" surface (footer column header, share buttons, etc.).
- `<Logo size withWordmark>` — glyph + wordmark in an inline-flex row. Used in the SiteHeader (size="md"). `withWordmark={false}` collapses to just the glyph.
- `size: "sm" | "md" | "lg"` — 10px / 12px / 20px glyph respectively; text-sm / text-lg / text-2xl wordmark. The single sizing ladder means header / footer / future hero use the same component without per-call tweaks.

**Favicon + icon + apple-touch-icon + OG.** Four static assets land in `/public`:

- `/favicon.svg` — 64×64, cream bg + 44×44 rhombus rotated 15°, gold gradient. Browser tab + bookmark.
- `/icon.svg` — 240×80, cream bg + rhombus left + "Foil" wordmark right. Higher-density alternate icon, also serves as the rich-share fallback for systems that ignore `og:image`.
- `/apple-touch-icon.png` — 180×180, generated via `sharp` from the same SVG template. iOS home-screen icon.
- `/og-image.png` — 1200×630, generated via `sharp`. Includes glyph + wordmark + tagline. Used in `og:image` + `twitter:image` so every share renders the new brand surface.

`app/layout.tsx` `metadata` updated to reference all four. The pre-Session-43 `metadata` still pointed at the old "Snap a Pokémon card, get a multi-source valuation" description — that description was the pre-pivot ([ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning)) scanner framing and was wrong for the deal-finder product. ADR-032 brings the root-layer metadata into alignment with the deal-finder positioning along the way.

**Drift guards ([`lib/__tests__/visual-regression.test.ts`](../lib/__tests__/visual-regression.test.ts)).** `components/brand/logo.tsx` is added to `PUBLIC_SURFACES` so the existing no-coral-default + no-raw-hex invariants apply. Three new component-specific assertions pin: glyph rotation (`transform: rotate(15deg)`), the canonical foil-gold hex `#c9a24b` in the gradient, the SVG `<linearGradient id="foil-rhombus-gradient">` shape, the wordmark's `font-display` + `text-foil-navy` tokens, and the header's `<Logo size="md" />` import.

**Consequences.**

- **Brand surface upgrade.** The header now reads as collector-niche rather than indie-SaaS-template. Same single-line silhouette (glyph + 4-letter wordmark), so layout doesn't shift.
- **Favicon now renders in browser tabs.** Pre-Session-43 the repo shipped no `favicon.svg`; browsers showed a generic icon. The launch surface gets a real bookmark glyph.
- **OG/Twitter shares carry the brand mark.** Every Twitter share of a Foil URL now renders the gold rhombus + wordmark + tagline at 1200×630 — a much higher-recognition share image than nothing.
- **Single sizing ladder.** Adding a `<Logo size="lg" />` to a future hero/marquee surface needs no per-call CSS — the ladder picks up automatically.
- **Wordmark+typeface unchanged.** Bricolage Grotesque, font-bold, foil-navy. Only the glyph mutates between sessions.
- **No new tokens introduced.** The two additional gradient stops (`#a07d2c`, `#e6c170`) are tonal shifts of foil-gold, not palette additions. They never appear outside the glyph SVG.

**Cross-refs.**

- [ADR-029](#adr-029--cream--navy--gold-visual-identity-for-collector-niche-distinctiveness) — the cream/navy/gold lock that ADR-032 extends into the brand mark.
- [ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning) — the deal-finder positioning that the new metadata description aligns with.
- [ADR-033](#adr-033--homepage-hero-card-backdrop-treatment-grail-row-behind-frosted-cream) — the coupled hero treatment that shipped in the same session.

**Followups.**

1. Hand-design a true wordmark glyph (a custom "F" lockup, or a custom Foil monogram) once the brand has revenue to justify a designer. The rhombus is the right primitive for now; a custom wordmark is the post-launch polish.
2. Apple-touch-icon at higher resolutions (167×167, 152×152) if iOS share quality on Pad/iPhone shows the 180px scaling badly.
3. Dark-mode favicon variant — currently the favicon assumes a light-mode browser chrome; if Foil ever ships a dark surface, we'd want a dark-bg favicon SVG via `prefers-color-scheme`.

---

## ADR-033 — Homepage hero card backdrop treatment: grail row behind frosted cream

**Date:** 2026-05-27
**Status:** Partially superseded by [ADR-036](#adr-036--home-page-warmth-pass-fraunces-display-spark-mark-pricing-removal-lighter-scrim) (Session 46) — opacity bumped 0.28 → 0.5, blur softened, and the scrim made asymmetric so the grails showcase rather than ghost. The grail-seed-list rationale and the headline-protection principle carry forward.

**Context.** Sessions 38-40 evolved the homepage hero through three iterations. Session 38 ([ADR-028](#adr-028--aceternity-ui-patterns-code-owned-no-npm-vendor-niche-visual-identity)) introduced the 8-card binder backdrop. Session 40 added depth (shadow + opacity tuning + scrim) to fix a "gray placeholder" failure mode. Session 42 ([ADR-031](#adr-031--mdx-component-palette-discipline-tokens-only-contrast-tested-at-the-component-layer)) shipped MDX-component cream-palette parity. By Session 43 the hero card grid was visible but **competing for attention** with the H1 — first-time visitors' eye went to the cards first, the headline second. With the Twitter launch hitting the homepage as the first-impression surface, the hero needed the H1+CTA to win the visual hierarchy unambiguously.

A separate failure mode: the card seed list itself ([Session 38](SESSION-LOG.md)) was vintage-heavy — Base Set Charizard/Blastoise/Venusaur, Neo Genesis Lugia, two 151 cards. That seed was good for "we cover vintage too" reassurance but bad for the audience moat. The audience-moat strategy ([STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md)) targets active Pokemon TCG collectors who chase modern alt-art grails — Umbreon VMAX Alt Art (Moonbreon), Rayquaza VMAX Alt Art, Charizard VMAX Rainbow, Giratina/Lugia alt arts, Mew VMAX alt art. The pre-Session-43 backdrop didn't include a single one of those cards. A modern grail collector landed on Foil and saw a row of 90s holos — first impression: "this is for vintage collectors, not me."

**Decision.** Two coupled changes:

### 1. Card backdrop treatment — opacity + filter + cream scrim

The cards drop to **opacity: 0.28**, gain `filter: blur(0.5px) saturate(0.65)`. Effect: the card row reads as *atmospheric texture* — a binder behind frosted glass, sensed rather than studied. The H1+lead paragraph now win the visual hierarchy unambiguously.

A **cream scrim layer** sits ABOVE the card row and BELOW the headline container (z-index ordering: cards `-z-10`, scrim `-z-[5]`, headline default):

- **Mobile (default):** `bg-gradient-to-b from-foil-cream via-foil-cream/85 to-foil-cream/40`. A top-down linear cream fade — the top half (where H1+lead paragraph sit) is fully cream-opaque, the bottom half tapers to 40% cream so the cards remain visible below the fold of the headline zone.
- **Desktop (sm: breakpoint):** Replaced by a radial-gradient anchored at top-left: `radial-gradient(ellipse_at_top_left, var(--color-foil-cream) 0% → 92% cream at 28% → 55% cream at 55% → transparent at 85%)`. The headline+CTA region (top-left) is fully scrimmed; cards stay visible on the right side of the viewport.

The asymmetric mobile-vs-desktop scrim handles the layout-rotation reality: on mobile, headline + cards are vertically stacked (cards below in z-order, but the headline floats above its full width), so a top-down linear scrim works. On desktop, headline + cards spatially overlap (cards spread across the full max-w-6xl container, headline occupies left ~60%), so a radial-from-top-left scrim is the right shape.

Inline `style={{ opacity: 0.28, filter: "..." }}` is used because Tailwind has no arbitrary-filter chain shorthand for `blur(0.5px) saturate(0.65)`. The opacity could ride a Tailwind class but is colocated with the filter for read-clarity (the two values define the treatment together).

### 2. Card seed list — 8 modern grails (with 1 vintage anchor)

`HERO_CARDS` swapped to:

| ID | Card |
|---|---|
| `swsh7/215` | Umbreon VMAX Alt Art (Moonbreon) — Evolving Skies |
| `swsh7/218` | Rayquaza VMAX Alt Art — Evolving Skies |
| `swsh35/74` | Charizard VMAX Rainbow Rare — Champions Path |
| `swsh11/186` | Giratina V Alt Art — Lost Origin |
| `swsh12/186` | Lugia V Alt Art — Silver Tempest |
| `swsh8/269` | Mew VMAX Alt Art — Fusion Strike |
| `swsh4/188` | Pikachu VMAX Rainbow — Vivid Voltage |
| `base1/4`   | Charizard, Base Set (vintage anchor) |

Seven modern alt-art / rainbow chase cards (the actual grails 2026 collectors chase) + one vintage anchor (the universally-recognized headline of the original Base Set). The mix says "we cover the cards you actually want, anchored to the heritage."

Each of the 7 new IDs was missing from `lib/cards/baked-metadata.json`. Two layers:

1. Hero-image rendering works without baked-metadata — `<Image src="https://images.pokemontcg.io/<setId>/<n>_hires.png" />` hits the SDK CDN directly.
2. But the same cards belong in `CARD_CATALOG` so the live catalog at `/cards/[slug]` resolves them with full metadata. Added to `lib/cards/catalog.ts` and re-baked via `npm run bake:cards` so the seven new IDs land in the baked snapshot too.

**Drift guards ([`lib/__tests__/visual-regression.test.ts`](../lib/__tests__/visual-regression.test.ts)).** Three new Session 43 invariants:

1. `opacity: 0.28` + `filter: "blur(0.5px) saturate(0.65)"` present in `app/(site)/page.tsx` — pinning the inline-style atom.
2. Mobile scrim: `bg-gradient-to-b from-foil-cream via-foil-cream/85 to-foil-cream/40`. Desktop scrim: `radial-gradient(ellipse_at_top_left, var(--color-foil-cream)…`.
3. All 8 grail IDs present in `HERO_CARDS` — pinning the modern-grail seed against a future "let's freshen the hero" refactor that silently re-vintageizes the row.

**Consequences.**

- **Visual hierarchy reads cleanly.** The H1 wins on first impression; the cards function as atmospheric texture. A first-time visitor's eye lands on "Tell me a Pokémon card. I'll email you when it drops." before noticing the binder backdrop.
- **Audience-moat signal upgraded.** Moonbreon and friends are present at first glance. A modern grail collector sees their cards immediately; the brand signals "we know what you actually chase."
- **Vintage signal preserved.** Base Set Charizard remains in the row as the anchor — "we cover the heritage" without making the hero a 90s-throwback.
- **No layout shift.** Cards are still `aspect-[5/7] w-20 sm:w-24 md:w-28`. The CSS treatment is purely visual; the bounding boxes are unchanged.
- **Live-verify at three breakpoints.** Tested at 375px (iPhone SE), 414px (iPhone 14 Pro Max), 1280px (desktop) — headline reads cleanly against the scrim at all three.
- **Catalog grew by 7 entries.** `CARD_CATALOG` is now 207 entries; `/cards/[slug]` resolves the seven new grail pages with full SDK metadata. The page template itself was not touched (per scope discipline).
- **No CSS-filter regression.** `filter: blur(0.5px) saturate(0.65)` is supported in all modern browsers and degrades gracefully (cards just appear at 0.28 opacity without blur on a browser that ignores the filter property).

**Cross-refs.**

- [ADR-028](#adr-028--aceternity-ui-patterns-code-owned-no-npm-vendor-niche-visual-identity) — the original 8-card hero backdrop.
- [ADR-029](#adr-029--cream--navy--gold-visual-identity-for-collector-niche-distinctiveness) — the cream/navy/gold palette the scrim works within.
- [ADR-032](#adr-032--brand-mark-gold-rhombus-as-foil-facet-shorthand) — the coupled brand mark upgrade that shipped in the same session.
- [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md) — the audience the grail seed list is calibrated to.

**Followups.**

1. **`prefers-reduced-motion`** — the corner-shimmer + the Card3D hover-tilt remain. They were already on the radar from ADR-028 / ADR-029. Adding a `@media (prefers-reduced-motion: reduce)` block to disable both will land in a later session.
2. **Variant selector** — Task #27 (Session 44). A "Normal / Holofoil / Reverse Holo / 1st Edition" toggle on `/cards/[slug]` so the variant grail-row implies you can drill into. Scoped out of Session 43 to keep the change ALL-VISUAL.
3. **Twitter share image refresh** — `/public/og-image.png` currently shows glyph + wordmark + tagline. Future iteration: a 1200×630 variant that includes the grail row in the background, so a Twitter share previews the hero rather than a wordmark slab.

---

## ADR-036 — Home page warmth pass: Fraunces display, spark mark, pricing removal, lighter scrim

**Date:** 2026-05-28 (Session 46)
**Status:** Accepted (font + pricing parts). The **mark** (holofoil spark) is superseded by [ADR-038](#adr-038--pokeball-as-the-brand-mark--section-pattern--bullet-accent) (Session 47.1 — navy pixel Pokeball). The **hero backdrop/scrim** part is superseded by [ADR-037](#adr-037--hero-rework-cards-above-the-headline--floral-section-distinction) (Session 47 — cards moved to a full-opacity foreground showcase, scrim deleted). Partially supersedes [ADR-028](#adr-028--aceternity-ui-patterns-code-owned-no-npm-vendor-niche-visual-identity) (Bricolage display font), [ADR-032](#adr-032--brand-mark-gold-rhombus-as-foil-facet-shorthand) (rhombus mark), and [ADR-033](#adr-033--homepage-hero-card-backdrop-treatment-grail-row-behind-frosted-cream) (hero backdrop opacity/scrim). The cream/navy/gold palette + Coral-Hover-Only discipline ([ADR-029](#adr-029--cream--navy--gold-visual-identity-for-collector-niche-distinctiveness)) are unchanged.

(ADR-034 and ADR-035 are intentionally unallocated; this session was numbered 036 by the goal that commissioned it, and the code/tests/SESSION-LOG all cite ADR-036.)

**Context.** Session 45 closed the home page at 34/40 on the impeccable critique — accessible and focused, but the surface still read a touch cool/templated. The "trusted collector concierge" personality (PRODUCT.md) wanted *warmth* without a redesign or a palette change. Four specific frictions: (1) the deferred Founding Member pricing section (ADR-020 defers it until the newsletter crosses ~100 subs) was shipping a $59 price the product can't yet take; (2) the Bricolage Grotesque display font (ADR-028) read as geometric/SaaS, not warm; (3) the gold rhombus mark (ADR-032) read as a folder/square at 16px favicon size; (4) the 0.28-opacity heavily-blurred hero backdrop (ADR-033) ghosted the grail cards that are the surface's best asset.

**Decision.**
1. **Deleted the Founding Member pricing section** (the `FoundingMember`/`PlanCard`/`FeatureIcon` block + the $59 H2, paragraph, and footnote), plus the orphaned "Founding" references in the example bullets and final CTA. Pricing returns when ADR-020's newsletter threshold is met. Pinned removed via `visual-regression.test.ts`.
2. **Swapped the display font Bricolage Grotesque → Fraunces** (variable humanist serif; `opsz` + `SOFT` axes). `font-optical-sizing: auto` adapts the cut across sizes; a `SOFT 30` value (set in `globals.css` without `wght`, so font-weight utilities still compose) warms the terminals. Display weight dropped 700 → 600 and tracking loosened −0.02em → −0.01em so the serif feels warm, not heavy. Body stays Geist Sans.
3. **Replaced the rhombus brand glyph with a holofoil "spark"** — a four-point sparkle + two shimmer accents (`components/brand/logo.tsx`), gold gradient retained. Favicon/app-icon get a navy field for 16px legibility (the old cream-bg gold mark was ~2.2:1). Raster assets regenerated from `scripts/gen-brand-assets.mjs` (sharp): `favicon.svg`, `icon.svg`, `apple-touch-icon.png`, `og-image.png`.
4. **Hero backdrop: opacity 0.28 → 0.5, blur 0.5px → 0.25px, saturate 0.65 → 0.9**, and the scrim made **asymmetric** (solid cream left, transparent right) so the grails showcase. HERO_CARDS reordered so Moonbreon/Rayquaza/Giratina land on the right (the clear zone).
5. **Light decorative card peeks** — two single-card watermarks (~15% opacity, ~6° tilt, desktop-only, aria-hidden) bridging the section seams. Moderate warmth, explicitly NOT a full-page background or border.

**Consequences.**
- **Home page is launch-complete.** The warmth pass + Session-45 a11y/focus pass close the home-page track for V1; ROADMAP marks it done and drops the founding-member-tier home dependency.
- **Fraunces composes weight + SOFT.** The `.font-display` rule sets `font-variation-settings: "SOFT" 30` without `wght`, relying on modern-browser composition so `font-semibold`/`font-bold` still drive weight. Verified at build.
- **One scoped asymmetry vs ADR-033.** ADR-033 pinned a 0.28 ghosted backdrop "so cards don't compete for attention." ADR-036 deliberately reverses that for the showcase, but keeps the headline protected via the left-heavy scrim — text legibility is unchanged, the cards just earn their visibility.
- **prefers-reduced-motion still honored** (ADR-029 / Session 45): the decorative peeks are static, and the hero Card3D/animate-ping guards are untouched.
- **No palette, register, or scope change.** Strictly home page. `/start`, `/upload`, `/cards/[slug]`, and blog surfaces are untouched.

**Cross-refs.** [ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning) (pricing deferral), [SESSION-LOG Session 46](SESSION-LOG.md), `lib/__tests__/visual-regression.test.ts`, `scripts/gen-brand-assets.mjs`.

---

## ADR-037 — Hero rework (cards above the headline) + floral section distinction

**Date:** 2026-05-28 (Session 47)
**Status:** Accepted (hero card-fan layout). The **floral section pattern** is superseded by [ADR-038](#adr-038--pokeball-as-the-brand-mark--section-pattern--bullet-accent) (Session 47.1 — navy Pokeball pattern). Supersedes the hero-backdrop half of [ADR-036](#adr-036--home-page-warmth-pass-fraunces-display-spark-mark-pricing-removal-lighter-scrim) and the remaining [ADR-033](#adr-033--homepage-hero-card-backdrop-treatment-grail-row-behind-frosted-cream) backdrop treatment. Fraunces display, the removed pricing section, and all a11y work from ADR-036 are unchanged.

**Context.** Through ADR-033 → ADR-036 the grail cards lived *behind* the headline as a scrimmed backdrop. Even at the ADR-036 0.5-opacity / asymmetric-scrim treatment the cards still read as a ghosted texture rather than a showcase, and the page was a single undifferentiated cream column (sections felt the same). Two coupled complaints: "cards still look ghosted" and "sections feel undifferentiated."

**Decision.**
1. **Hero cards moved ABOVE the headline as a full-opacity foreground showcase.** A fanned row of the 8 `HERO_CARDS` (overlapping via negative margins, each keeping its tilt) sits at the top at `opacity: 1`, no blur, no desaturation, large (`w-24` mobile → `lg:w-40`). The pitch block (live pill, H1, trust pill, body, CTAs) sits **centered beneath** the fan.
2. **Deleted the scrim entirely** — cards no longer overlap text, so there is nothing to scrim.
3. **Removed Card3D + MagneticLink from the hero.** With cards as foreground, the constant 3D-tilt and magnetic-cursor motion were distracting; the showcase is static with a subtle CSS hover lift only (the reduced-motion reset still applies). The CTA is now a plain `Link` with a hover lift. (`Card3D` / `MagneticButton` remain in-tree, just unused on the home page.)
4. **Floral section distinction.** An inline SVG `<pattern>` of gold (#c9a24b) vines + leaves, rendered as an absolute overlay at ~9% (mobile) / ~12% (desktop) opacity, applied to the **"How it works" section only**. It creates one deliberate textured band; the hero, "What you actually see", and the final CTA stay clean cream. Verified the text-over-pattern contrast holds (navy/slate on cream + 12% gold texture is unaffected).

**Consequences.**
- **The grail row finally does its job** — it reads as an actual showcase of the cards Foil watches, not wallpaper.
- **One textured band, not a uniform column.** "How it works" is now visually distinct without a palette or layout change elsewhere.
- **Hero text centered** (was left-aligned). A centered pitch pairs with the symmetric card fan; measures kept tight (H1 `max-w-3xl`, body `max-w-xl`) for readability.
- **Cards remain `aria-hidden`** (decorative showcase); screen readers go straight to the H1.
- **Perf note carried forward.** The 8 `unoptimized` hi-res PNGs are now above the fold; not preloaded (`priority={false}`) to avoid 8 preloads. Optimizing the card images stays an open follow-up (first raised in the Session-45 audit).
- **No scope creep.** Strictly the home page. No palette/register/font/logo change; floral is the one section only.

**Cross-refs.** [ADR-036](#adr-036--home-page-warmth-pass-fraunces-display-spark-mark-pricing-removal-lighter-scrim), [ADR-033](#adr-033--homepage-hero-card-backdrop-treatment-grail-row-behind-frosted-cream), [SESSION-LOG Session 47](SESSION-LOG.md), `lib/__tests__/visual-regression.test.ts`.

---

## ADR-038 — Pokeball as the brand mark + section pattern + bullet accent

**Date:** 2026-05-28 (Session 47.1)
**Status:** Accepted. Supersedes the **mark** of [ADR-036](#adr-036--home-page-warmth-pass-fraunces-display-spark-mark-pricing-removal-lighter-scrim) (holofoil spark) and the **floral** of [ADR-037](#adr-037--hero-rework-cards-above-the-headline--floral-section-distinction), and removes the [ADR-029](#adr-029--cream--navy--gold-visual-identity-for-collector-niche-distinctiveness) corner-shimmer gradient from the hero. The **section pattern's shape/density/opacity were iterated by [ADR-039](#adr-039--pokeball-section-pattern-shape--density--opacity-iteration)** (Session 47.2) then [ADR-040](#adr-040--brand-glyph-is-the-classic-redwhite-pokeball-section-pattern-density-reduced) (Session 47.3, density). The **brand glyph color** (navy monochrome) is superseded by [ADR-040](#adr-040--brand-glyph-is-the-classic-redwhite-pokeball-section-pattern-density-reduced) (classic red/white). Fraunces display, the ADR-037 hero card-fan layout, the deleted pricing, and the cream/navy/gold palette for chrome+text are unchanged.

**Context.** Live-reviewing the Session-47 home page, the founder made a brand call and flagged three issues: (a) the two Session-46 floating card "peek" watermarks read as "weird cards in the background"; (b) the brand should commit to a **Pokeball** identity (this reverses ADR-036's explicit "NOT a Pokeball" — that call was mine; the founder owns the brand and reconsidered); (c) a stray amber glow sat in the hero's bottom-right (the leftover ADR-029 corner-shimmer `BackgroundGradientAnimation`).

**Decision.**
1. **Deleted both orphan `CardPeek` watermarks** (component + invocations).
2. **Brand glyph → navy 8-bit pixel Pokeball** (`components/brand/logo.tsx`, `PokeballMark` on a 7×7 grid: navy top + band, navy/75 bottom, cream center button; crisp-edges rendering). No red, no white (the cream button is the only non-navy, reading as the clasp). Regenerated `favicon.svg`, `icon.svg`, `apple-touch-icon.png`, `og-image.png` (cream field so the navy mark reads). Verified the 16px favicon reads as a Pokeball, not a smudge. Fraunces "Foil" wordmark unchanged.
3. **Pill bullets → ~11px navy Pokeball.** The Live pill (lost its gold `animate-ping` dot) and the Verified-Seller pill now use `<PokeballMark px={11} />`. The numbered "1/2/3" circles in How-it-works stay numbered.
4. **Section pattern: gold floral → navy Pokeball.** New `PokeballPattern` (inline SVG `<pattern>`, same pixel Pokeball silhouette, half-drop stagger) at ~4.5% mobile / ~6% desktop on the **"How it works" section only**. Floral component deleted. AA contrast verified (navy/slate text over ≤6% navy texture is unaffected).
5. **Removed the hero corner-shimmer gradient.** Hero is solid `foil-cream`, no overlays, no glow. (The `BackgroundGradientAnimation` component stays in-tree, unused on the home page.)

**Consequences.**
- **Single committed brand symbol.** Logo, favicon, bullets, and section texture are now one Pokeball motif — coherent and unmistakably Pokémon-niche.
- **ADR-036's "not a Pokeball" reasoning is explicitly reversed.** Recording it plainly: the rhombus→spark progression was avoiding the obvious category symbol; the founder decided the obvious symbol is the right brand call. The spark's "reads at 16px" requirement still governed the Pokeball design (hence the coarse 7×7 pixel grid + cream button).
- **Hero is genuinely clean cream** — the amber-tint complaint is resolved at the source (the gradient is gone, not masked).
- **No scope creep.** Home page only; no Pokeball on other sections, no extra accents (footer/dividers), no palette/font/register change.

**Cross-refs.** [ADR-036](#adr-036--home-page-warmth-pass-fraunces-display-spark-mark-pricing-removal-lighter-scrim), [ADR-037](#adr-037--hero-rework-cards-above-the-headline--floral-section-distinction), [SESSION-LOG Session 47.1](SESSION-LOG.md), `components/brand/logo.tsx`, `scripts/gen-brand-assets.mjs`, `lib/__tests__/visual-regression.test.ts`.

---

## ADR-039 — Pokeball section pattern: shape + density + opacity iteration

**Date:** 2026-05-29 (Session 47.2)
**Status:** Accepted (shape). The **density** was further loosened by [ADR-040](#adr-040--brand-glyph-is-the-classic-redwhite-pokeball-section-pattern-density-reduced) (Session 47.3 — "too many pokeballs"). Iterates the **section pattern** of [ADR-038](#adr-038--pokeball-as-the-brand-mark--section-pattern--bullet-accent) (the rest of ADR-038 — logo glyph, pill bullets, hero cleanup — is unchanged). Same navy + white palette; this is a shape/density/opacity fix, not a color change.

**Context.** ADR-038's "How it works" Pokeball pattern used a coarse 7×7 silhouette (single navy tone, no visible button or two-tone) at 5-7% opacity. At that size and opacity it read as **polka dots, not Pokeballs**. The founder shared a reference: a tightly-packed pixel Pokeball with visible top/bottom halves, a distinct center band, a white center button, and blocky 8-bit line work — and asked to match the *line work*, keeping navy + white.

**Decision.**
1. **Redrew the pixel Pokeball on a 16×16 grid** (`PokeballPattern` in `app/(site)/page.tsx`): navy (#0f1e3a) dome + center band + 1px outline, **white (#ffffff) bottom half** inset 1px so the navy outline survives, and a **white center button** (`<rect x=7 y=7 w=2 h=2>`) ringed by the navy band. On the cream surface the navy carries the line work and the white reads as the light lower half — the classic two-tone Pokeball, now identifiable at every size.
2. **Density up**: tightly packed half-drop stagger, ball diameter = tile pitch (34px) so balls near-touch. The second-row ball is drawn on both vertical tile edges so it reads whole across the seam.
3. **Opacity up**: 14% mobile / 20% desktop (from 5-7%). Verified WCAG AA holds — worst case (slate body directly over a solid-navy pixel at 20%) computes to ~4.6:1, above the 4.5 AA floor; the section heading is large navy (far above 3:1). Capped at 20% (not the 25% top of the requested range) to keep the slate intro safely AA.

**Consequences.**
- **Reads as Pokeballs.** Rendered the tile + a single ball at 4× and confirmed the dome/band/button/outline all read; the pattern is a recognizable Pokeball field, not dots.
- **Still "How it works" only.** Hero / "What you actually see" / final CTA stay clean cream. Logo glyph + pill bullets unchanged (different design layer — brand chrome, not section decoration).
- **White on cream is faint by design.** At ≤20% the white bottom ≈ cream, so the navy line work dominates; that's the intended two-tone read on a cream page, and it keeps text contrast safe.
- **No scope creep.** No classic-red, no logo/bullet recolor, no palette change.

**Cross-refs.** [ADR-038](#adr-038--pokeball-as-the-brand-mark--section-pattern--bullet-accent), [SESSION-LOG Session 47.2](SESSION-LOG.md), `app/(site)/page.tsx`, `lib/__tests__/visual-regression.test.ts`.

---

## ADR-040 — Brand glyph is the classic red/white Pokeball; section pattern density reduced

**Date:** 2026-05-29 (Session 47.3)
**Status:** Accepted. Supersedes the **brand-glyph color** of [ADR-038](#adr-038--pokeball-as-the-brand-mark--section-pattern--bullet-accent) (navy monochrome → classic red/white) and iterates the **section-pattern density** of [ADR-039](#adr-039--pokeball-section-pattern-shape--density--opacity-iteration) (denser → looser). The Pokeball *geometry* (ADR-038/039), Fraunces wordmark, navy pill bullets, and the cream/navy/gold palette for chrome + text are unchanged.

**Context.** Two pieces of founder feedback after Session 47.2: (a) the brand mark should be the **classic Pokémon red/white Pokeball**, not navy monochrome — the obvious, recognizable symbol; and (b) the "How it works" Pokeball pattern was still "too many pokeballs" at near-touching density.

**Decision.**
1. **Brand glyph → classic tri-color Pokeball.** `PokeballMark` gained a `tone` prop: `"classic"` = red top (#e63946), white bottom, navy "black" outline + center band, white center button; `"navy"` (default) = the prior navy monochrome. `LogoGlyph` (header / footer / favicon / app icons) uses `tone="classic"`. Regenerated `favicon.svg`, `icon.svg`, `apple-touch-icon.png`, `og-image.png`. Verified the 16px favicon reads as a red/white Pokeball.
2. **Palette exception, scoped to the glyph.** ADR-029's cream/navy/gold discipline holds for all chrome, text, and UI. The brand glyph is the **one** sanctioned exception: a Pokeball only reads as a Pokeball in red/white, so the mark carries red (#e63946) — but nothing else does. "Black" on the glyph is rendered as foil-navy (#0f1e3a), the brand's near-black, to stay coherent and avoid a pure-#000 lint flag.
3. **Pill bullets stay navy.** The Live + Verified-Seller pill bullets call `PokeballMark` with the default `tone="navy"` — small inline text accents, a separate design layer from the brand mark, kept on-palette.
4. **Section pattern density reduced ~50%.** The `<pattern>` tile went from 34×68 (ball diameter = pitch, near-touching) to **48×96** (~1.4× ball-width pitch), so the balls breathe. Opacity unchanged (14% mobile / 20% desktop) — it was density, not opacity, that was loud. Pattern stays navy/white, "How it works" only. WCAG AA still holds (fewer navy pixels = same-or-better worst case; slate-over-navy ≈4.6:1).

**Consequences.**
- **Instantly recognizable brand mark.** The red/white Pokeball is unmistakable at favicon size; the wordmark + chrome stay restrained cream/navy.
- **One documented palette break.** Red lives only in the glyph (logo/favicon/og). A visual-regression assertion pins the classic tone on the glyph and the navy default for bullets, so a refactor can't bleed red into chrome or recolor the bullets.
- **Calmer section.** ~50% fewer Pokeballs in the "How it works" band; the texture reads as a light brand watermark, not wallpaper.
- **No scope creep.** No pill-bullet recolor, no pattern on other sections, no chrome/text/UI palette change.

**Cross-refs.** [ADR-038](#adr-038--pokeball-as-the-brand-mark--section-pattern--bullet-accent), [ADR-039](#adr-039--pokeball-section-pattern-shape--density--opacity-iteration), [ADR-029](#adr-029--cream--navy--gold-visual-identity-for-collector-niche-distinctiveness), [SESSION-LOG Session 47.3](SESSION-LOG.md), `components/brand/logo.tsx`, `scripts/gen-brand-assets.mjs`.

## ADR-042 — PokeTrace per-variant UUID caching (search-then-bake) + variant-aware sold-history

**Date:** 2026-05-29 (Session 49)
**Status:** Accepted. New surface (per-card sold-history reference layer). Doesn't supersede prior ADRs.

**Context.** PokeTrace (sold-price source) identifies cards by **UUID** (`019bff77-…`), not by Pokemon TCG SDK id, so there's no direct lookup from our catalog. Worse, a single Foil catalog card maps to **several** PokeTrace UUIDs — one per print edition/finish (Base Set Charizard = Unlimited Holo + Shadowless Holo + … ; Gym/Neo holos = 1st Edition + Unlimited). Empirically verified against the live API (Session 49): PokeTrace has **no edition field**; card keys are exactly `id, name, cardNumber, set, variant, rarity, productType, productFamily, image, game, market, currency, refs, prices, lastUpdated`. Editions are encoded as (a) distinct **set slugs** (`base-set` vs `base-set-shadowless`) and (b) the **`variant` string** (`Holofoil` / `Unlimited_Holofoil` / `Reverse_Holofoil` / `Normal`). Each `prices[source][tier]` snapshot carries `avg / low / high / avg1d / avg7d / avg30d / median3d/7d/30d / saleCount`.

**Decision.**
1. **Search-then-bake.** `scripts/bake-poketrace-uuids.ts` (npm `bake:poketrace-uuids`) searches PokeTrace by name per catalog card and writes a `variants[]` array onto the card in `lib/cards/baked-metadata.json`. Idempotent (`--refresh` re-bakes); misses + ambiguous matches logged to `docs/poketrace-bake-misses.md`; paced ~200ms/req (under the 60/10s Scale burst).
2. **Matcher (`lib/poketrace/variant.ts`, pure + unit-tested).** Accept a candidate when its **numerator** matches AND (its **denominator == our SDK set total** OR its **set name matches exactly** OR its **set slug ends with our slugified set name**). The denominator gate disambiguates vintage reprints (Base Set 102 vs Base Set 2 130) and naturally groups editions (Shadowless is also 004/102); the exact-name / slug-suffix gates rescue modern alt-arts whose printed denominator diverges from the SDK total (215/203 vs SDK 237). `deriveVariant` parses `set.slug` + `variant` into a canonical `variantKey` + `{isHolo,isFirstEdition,isShadowless,isUnlimited}` (slug-based edition wins over the variant string — PokeTrace's shadowless card mislabels its variant "Unlimited_Holofoil").
3. **Read layer.** `lib/poketrace/by-uuid.ts::getSoldHistory(uuid)` fetches `/v1/cards/{uuid}`, returns a simplified `SoldHistory` (per source per tier: avg/low/high/avg1d/avg7d/avg30d/saleCount), with **1h stale-while-revalidate** in-process cache. Sold averages don't move minute-to-minute; live *listings* stay eBay-Browse-rendered (R-008) — this is the "what it's been selling for" layer, not a listing cache. `CardMetadata.variants` is a baked-only field; `getCardMetadata` attaches it from the baked snapshot even on the live-pokemontcg.io path.
4. **Render.** `components/cards/sold-history-panel.tsx` (Server Component, SSR-only) shows a variant selector (chips are `?v=<key>` links that re-render the page; default = most-traded by saleCount×avg), a 30-day sold-avg headline + 7-day trend arrow, and a per-tier table (raw NM→DMG + top graded). Cream/navy/gold tokens, Pokeball pill bullet. Graceful degradation: no variants → muted "Live sold data not yet available"; a variant with no data → "—". Mounted between the Session-41 variants section and the buy-now CTA on `/cards/[slug]`.

**Consequences.**
- **Coverage: 207/207 catalog cards baked** (Session 49 search matched 199; Session 49.1 added 6 SV-151 via overrides; Session 49.2 added the last 2 EU-only cards). No true misses remain.
- **Override layer (Session 49.1 / 49.2).** `lib/cards/poketrace-overrides.json` (keyed by catalog slug) holds hand-resolved UUIDs for cards the search heuristic can't reach: the SV-151 SIRs (SDK total 207 vs PokeTrace denom 165; set name "151" too short for the slug-suffix gate) + the 2 EU-only cards. The bake script consults overrides **before** the search heuristic; they win unconditionally.
- **PokeTrace is market-partitioned (Session 49.2).** Some printings (vintage holos like LC Muk, Celebrations Mew #11) are **EU-only** — never under `market=US`, carrying `eu_…` IDs and **cardmarket-only** prices in a single `AGGREGATED` tier (no eBay/TCGplayer, no per-condition tiers, no saleCount). So (a) the bake `searchCards` walks a **US → EU → no-market** fallback ladder, and (b) the read path (`by-uuid.ts` + `SoldHistoryPanel`) treats `cardmarket` as a third `SoldSource` and renders the `AGGREGATED` "Market average" row when no per-condition tier exists. `getSoldHistory`'s `?market=US` fetch still returns the cardmarket block for EU UUIDs, so no per-variant market is stored.
- **AGENTS.md discipline.** The goal's original premise (a per-edition `isFirstEdition`/`isShadowless` field) did not exist; the schema was verified by live probe before any baking, and the derivation was adapted to the real fields (confirmed with the user).
- **Re-bake cadence.** UUIDs are stable; re-run `bake:poketrace-uuids --refresh` only when the catalog grows or PokeTrace re-IDs a card.
- **Out of scope (Session 49b):** the watchlist write path — per-variant DB migration, eBay query augmentation per variant, and alert-email update — is deferred.

**Cross-refs.** `lib/poketrace/variant.ts`, `lib/poketrace/by-uuid.ts`, `scripts/bake-poketrace-uuids.ts`, `components/cards/sold-history-panel.tsx`, `lib/cards/baked-metadata.json`, `docs/poketrace-bake-misses.md`, [SESSION-LOG Session 49](SESSION-LOG.md), [ADR-021](#adr-021--epn-as-v1-live-listing-source-browse-api-deferred) (R-008 no-cache for listings — sold averages are distinct).

---

## ADR-043 — Variant + condition watchlist data model + eBay query augmentation

**Date:** 2026-05-29 (Session 49b)
**Status:** Accepted. Completes the write side of ADR-042's per-variant read layer.

**Context.** Session 49 (ADR-042) shipped the per-variant sold-history *display* (one PokeTrace UUID per print edition/finish, variant selector on `/cards/[slug]`). But a watchlist row could still only say "alert me on this card at $X" — no way to target a *printing* ("1st Edition Holofoil") or a *grade* ("PSA 10"). The alert cron queried a bare `cardName + setName` and the alert email named only the card. So a collector watching a $4,000 PSA-10 Charizard and one watching a $90 raw Unlimited copy got the same undifferentiated alert off the same query.

**Schema-shape reality.** The goal spec assumed a `user_id`-keyed table and a `UNIQUE (user_id, card_slug)` to drop. The live `watchlists` table is **email-anchored** — no `user_id`, no auth in V1 ([ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning)), and the only pre-existing index was `watchlists_card_target_idx`. Adapted accordingly (confirmed against the live schema + the ROADMAP NOW #7 note "Email-anchored (no auth in V1)").

**Decision.**
1. **Data model.** Migration `20260529120000_watchlist_variant_condition.sql` adds `variant TEXT NOT NULL DEFAULT 'default'` + `condition TEXT NOT NULL DEFAULT 'any-raw'` (existing rows backfill via the defaults), de-dupes any pre-existing `(email, card_slug, 'default', 'any-raw')` collisions (keep the lowest target), then adds `UNIQUE (email, card_slug, variant, condition)` — the natural identity of a watch in an auth-free product. A repeat submit **UPSERTs** the `target_price_cents` (shared `lib/wishlist/upsert.ts`, `onConflict` byte-identical to the migration).
2. **Tokens.** `lib/cards/conditions.ts` is the single source of truth for the 17-token closed set (6 raw + 11 graded), human labels, and per-token eBay include/exclude keyword maps. `variant.ts` gains `deriveAvailableVariants(card)` (the "default" sentinel + the card's real baked variantKeys) and `variantEbayKeywords(variantKey)` (parses the key into include/exclude phrases). Both validators run before any DB write.
3. **eBay query augmentation.** `buildEbayQuery({cardName,setName,variant,condition})` merges the two keyword maps, appends the **include** phrases (quoted) to the Browse `q` to bias the search, and returns the merged include/exclude sets. The picker (`listing-picker.ts`) gains a **5th gate** (`rejectByKeywords`): a hit survives only if its title carries ≥1 include keyword (when any) AND no exclude keyword. Excludes are enforced *post-fetch* in the gate, not injected into `q` — the title gate is authoritative and avoids relying on eBay `q` negation semantics we haven't verified. A played/damaged target relaxes the ADR-026 condition-junk gate (else "Damaged" would self-filter to zero). An un-targeted call (page render, no variant/condition) is a pure pass-through — page behaviour unchanged.
4. **Write path.** Per the coding conventions ("Server Actions for mutations"), the per-card form now posts via `app/actions/create-watchlist.ts` (a Client Component `watchlist-form.tsx` using `useActionState`). Variant + condition are **URL state** (`?v=` / `?c=`), the same pattern as the variant selector — `components/cards/condition-picker.tsx` (mounted in the sold-history panel) writes `?c=` via a soft `router.replace` so the typed email survives a condition switch; the form reads both params. The legacy `/api/watchlist` JSON route is kept for backward compat and shares the same validator + upsert helper.
5. **Alert path.** `scan-batch.ts` groups rows by **(slug, variant, condition)** — each combo is a distinct query, so it can't dedup the way two default rows do; metadata is still fetched once per slug, Browse once per combo, all under `MAX_BROWSE_CALLS`. The alert email (`alert-email.ts`) injects a `variant (condition)` qualifier into the subject + a "Tracking: …" body line; both are **omitted for the all-defaults watch**, so a generic alert is byte-identical to pre-49b.

**Consequences.**
- **Behaviour change for backfilled rows.** Existing rows default to `condition='any-raw'`, which now **excludes graded slabs** from their alerts (a raw buyer shouldn't get a $4k PSA-10 surfaced as "their" deal). Defensible and aligned with the feature, but it is a change from the prior "match any listing" behaviour. Documented here deliberately.
- **Browse-call volume can rise** when many rows watch the same slug across different variant/conditions — bounded by `MAX_BROWSE_CALLS` (200) + the per-row 24h cooldown.
- **Known limitation.** The merged include set is an OR (≥1) bias, not a strict per-facet AND; discrimination comes mainly from the exclude gate + the biased `q`. The keyword maps are conservative (substring collisions like `BGS 9` ⊂ `BGS 9.5` are handled in `conditions.ts`), but title-only matching is inherently fuzzy — eBay exposes no structured condition field on the V1 Browse surface (same constraint as ADR-026). A future tightening (per-facet AND, structured condition once available) is a followup.
- **R-008 reconfirmed.** No new eBay persistence; every Browse fetch stays `cache: "no-store"`; compliance invariants 6/6.

**Cross-refs.** `lib/cards/conditions.ts`, `lib/poketrace/variant.ts`, `lib/affiliate/ebay-browse.ts`, `lib/affiliate/listing-picker.ts`, `lib/wishlist/{upsert,validate,scan-batch,alert-email}.ts`, `app/actions/create-watchlist.ts`, `components/cards/{condition-picker,watchlist-form}.tsx`, `supabase/migrations/20260529120000_watchlist_variant_condition.sql`, [ADR-042](#adr-042--poketrace-per-variant-uuid-caching-search-then-bake--variant-aware-sold-history), [ADR-026](#adr-026--quality-aware-listing-picker-replaces-lowest-price-wins), [ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning).

---

## ADR-044 — Reactive sold-history headline + a daily price-history line chart (real PokeTrace history)

**Date:** 2026-05-29 → 2026-05-30 (Session 49c)
**Status:** Accepted. Builds on ADR-042/043.

**Context — the bug.** Session 49's `SoldHistoryPanel` headline + trend were locked to the variant's first raw tier (NM) regardless of the Session 49b condition picker. Picking PSA 10 / BGS 9.5 / CGC 9.5 left the headline showing the NM raw value while only the per-condition table reacted.

**Context — a probe error to learn from (AGENTS.md).** My first 49c probe concluded "PokeTrace has no daily series" and I shipped a 3-point trailing-average chart as an honest fallback. **That conclusion was wrong** — I probed `/cards/{id}/history`, `/price-history`, `/prices/history`, and `?history=true`, but NOT the **tier-scoped** path. The user corrected me; re-probing `GET /v1/cards/{uuid}/prices/{tier}/history?period={7d|30d|90d|1y|all}&limit={n}` returns **real daily rows**: `{ date, source, avg, low, high, saleCount, approxSaleCount, median3d, median7d, median30d }` (newest→oldest, with `pagination`). Verified live 2026-05-30: PSA_10 90d → dated rows back to March; NEAR_MINT all → 168 daily rows across eBay + TCGplayer. **Lesson: probe the *tier-scoped* sub-resource, not just the card-level paths, before declaring an endpoint absent.** The Scale-tier key covers access.

**Decision.**
1. **Bug fix (reactive headline).** `conditions.ts::conditionToTier` maps each token to a PokeTrace tier or an aggregate marker (`raw-agg` / `graded-agg`). The panel takes `selectedCondition` (`?c=`, plumbed in 49b) and resolves the headline stat: a specific tier → that tier's stat; `any-raw` → a saleCount-weighted aggregate over the 5 raw tiers (NM-dominated, falling back to the EU `AGGREGATED` roll-up); `any-graded` → a weighted aggregate over the graded tiers present. The label gains the condition suffix ("30-day sold avg · Holofoil · PSA 10"). The table now renders whenever the variant has **any** data (decoupled from the selected condition), so picking a grade the card lacks can't blank it.
2. **Real daily chart.** New `lib/poketrace/price-history.ts::getPriceHistory({uuid, tier, period})` hits the tier-scoped endpoint, parses `{date, avg, median7d, low, high, saleCount, source}`, **dedups same-date rows preferring eBay** (Foil's buyer-side primary signal), sorts oldest→newest, soft-fails to null (missing key / 404 / plan / parse), and caches 1h stale-while-revalidate. `components/cards/sold-history-chart.tsx` is an inline-SVG line (no charting library) plotting **median7d** (PokeTrace's recommended, anomaly-filtered line; falls back to the raw daily `avg`) + navy area fill + trend-coloured endpoint dot (gold up / coral down) + hover tooltip (date + price + sale count). The server fetches the full series once (`period=all`); the client slices it per range, so range switches never refetch.
3. **5-range selector.** 7D / 1M / 3M / 1Y / MAX (→ PokeTrace 7d/30d/90d/1y/all), `?r=` URL state, **default 1M**. A range with fewer than two points in its window is disabled ("Limited history"). The chart resolves which single tier to plot from the selected condition (specific → its tier; `any-raw` → NEAR_MINT; `any-graded` → the card's top graded tier).

**Consequences.**
- Real daily history — the chart is a genuine Robinhood-style line, not a fallback. median7d smooths anomalies; sparse-history cards degrade to "Price history accumulating".
- One extra PokeTrace call per panel render (the history fetch), 1h-cached; soft-fails so an outage never breaks the page.
- Existing condition table (Session 49) preserved; variant selector, condition picker, and the 49b write path untouched. The interim trailing-average shim (`priceSeriesFromStat`, the by-uuid `getPriceHistory`) was removed.
- **Process note / supersedes the interim approach.** This ADR replaces the trailing-average fallback committed earlier in 49c (`a59c2b3`) once the real endpoint was confirmed. Out of scope (per goal): sales-volume strip + multi-condition overlay (Session 49d); the daily-snapshot accumulator is no longer needed (PokeTrace already serves history).

**Cross-refs.** `lib/poketrace/price-history.ts`, `components/cards/sold-history-chart.tsx`, `components/cards/sold-history-panel.tsx`, `lib/cards/conditions.ts` (`conditionToTier`), [ADR-042](#adr-042--poketrace-per-variant-uuid-caching-search-then-bake--variant-aware-sold-history), [ADR-043](#adr-043--variant--condition-watchlist-data-model--ebay-query-augmentation).

---

## How to add an ADR

1. Pick the next number (don't reuse).
2. Title: short, specific. The choice + the rationale, not the topic.
3. Sections: Status (Accepted / Superseded / Deprecated), Context (what was true that forced the choice), Decision (what we chose, concretely), Consequences (what now follows — costs, constraints, follow-ups).
4. If superseding an old ADR, edit the old one to add "Superseded by ADR-N" to its Status — don't delete it.
