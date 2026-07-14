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
**Status:** **Superseded by [ADR-045](#adr-045--autonomous-commits-use-a-team-associated-author-email-so-vercel-doesnt-block-the-deploy) (2026-05-30).** Both mechanisms here failed: Vercel blocks any deploy whose committer isn't a GitHub user on the team (`COMMIT_AUTHOR_REQUIRED`), and the `bot+content@foil.app` committer email maps to no GitHub user — so the deploy hook (which deploys the same commit) was blocked too, and every autonomous post produced BLOCKED deploys, no Ready. ADR-045's actual fix is to commit autonomous posts with the team owner's GitHub email; the hook + the author-ignore build command are removed. Original entry retained below for history.

~~**Status:** Accepted — rollout complete 2026-05-21 (Deploy Hook created, `VERCEL_DEPLOY_HOOK_URL` stored as GitHub secret, Ignored Build Step configured to skip `foil-content-bot` commits)~~

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
**Status:** Accepted — supersedes the product framing implicit in pre-2026-05-23 CLAUDE.md and ROADMAP NOW. See [STRATEGY-PIVOT-DEAL-FINDER.md](STRATEGY-PIVOT-DEAL-FINDER.md) as the canonical source-of-truth document for the new direction; this ADR is the formal architectural record. **PUBLIC-SURFACE FRAMING SUPERSEDED 2026-06-13 by [ADR-060](#adr-060--vending-host-lead-gen-pivot-public-surface--vending-deal-finder-dormant)** — the public site is now vending host lead-gen and the deal-finder is dormant (code/data preserved in-tree). The deal-finder architecture documented below remains accurate for the dormant surface.

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
**Status:** Accepted (supersedes the holographic-rainbow palette from [ADR-028](#adr-028--aceternity-ui-patterns-code-owned-no-npm-vendor-niche-visual-identity) for default surfaces; the Aceternity component scaffolding from ADR-028 remains in place and is *retuned*, not replaced). **REGISTER SUPERSEDED 2026-06-13 for the vending surfaces by [ADR-061](#adr-061--vending-register-evolve-the-quiet-backroom-canon-for-the-b2b-host-audience)** — `/`, `/host`, `/faq`, `/service-areas` now use the evolved "confident local operator" register (cream↔navy alternation, subtle resting elevation, gold as a structural accent). The palette/fonts/coral-hover/no-pure-black-white rules below are unchanged; this ADR still governs the dormant deal-finder surfaces.

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
**Status:** **Superseded by [ADR-055](#adr-055--fredoka-foiltcg-wordmark--foil-corner-card-mark-pokeball-retired) (2026-06-05)** — the entire Pokeball brand-glyph lineage (ADR-036 spark mark → ADR-038 → ADR-039 → ADR-040) is retired for an owned Fredoka "FoilTCG" wordmark + foil-corner card mark, because the Pokeball is Nintendo/Pokémon trade dress (a pre-PokeBeard-launch IP-exposure blocker). Original status: Accepted — superseded the brand-glyph color of ADR-038 (navy → classic red/white) and iterated the ADR-039 section-pattern density; Fraunces display + the cream/navy/gold palette for chrome + text carry forward into ADR-055 unchanged.

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

## ADR-045 — Autonomous commits use a team-associated author email so Vercel doesn't block the deploy

**Date:** 2026-05-30 (Session 47.4)
**Status:** Accepted. Supersedes the deploy-hook + ignore-command mechanism of [ADR-008](#adr-008--vercel-deploy-hook-for-autonomous-content-not-github-integration-auto-deploys).

**Context.** Autonomous posts landed on `main` (workflow green) but never reached production: the 2026-05-28 post (`677adeb`) showed two BLOCKED Vercel deploys, zero Ready.

**Diagnosis (Session 47.4, empirical — and a corrected first hypothesis).** First pass: I found the project's `commandForIgnoringBuildStep` was `if [ "$VERCEL_GIT_COMMIT_AUTHOR_EMAIL" = "bot+content@foil.app" ]; then exit 0; else exit 1; fi` (ADR-008, `exit 0` = skip build) and hypothesized it was blocking both the git-integration deploy and the hook deploy. I removed it and removed the now-redundant hook step. **The smoke test disproved that hypothesis:** the next autonomous commit (`1dc2cca`) was *still* BLOCKED with the command already cleared. Querying the deployment detail gave the real reason:

> `readyState=BLOCKED`, `readyStateReason="The Deployment was blocked because GitHub could not associate the committer with a GitHub user."`, `seatBlock.blockCode=COMMIT_AUTHOR_REQUIRED`.

**Root cause:** Vercel blocks any deployment whose Git committer can't be associated with a GitHub user on the team (a seat/authorship protection). The workflow committed as `foil-content-bot <bot+content@foil.app>` — an email tied to **no GitHub account** — so every autonomous deploy was blocked. This is ADR-008's *original* premise after all (author-not-on-team), but neither ADR-008 mechanism ever addressed it: the deploy hook builds the same bot-authored commit, so it hit the identical block. Confirmed by contrast: all ~19 `john.c.craig24@gmail.com` commits (the team owner's GitHub email) deploy `READY`.

**Decision.**
1. **Commit autonomous posts with John's GitHub-associated email** — `git config user.email "john.c.craig24@gmail.com"` in the workflow's "Configure git author" step (committer NAME stays `foil-content-bot` so history still marks them autonomous). The committer now associates with `johnnycakx` (the Vercel team owner), so Vercel authorizes the deploy. **This is the actual fix.**
2. **Remove the "Trigger Vercel deploy" hook step** — with the deploy unblocked, the `git push` deploys via the standard git integration like every other commit; the hook only ever created a redundant (also-blocked) second deploy. `VERCEL_DEPLOY_HOOK_URL` is now unused (retained inert; revocable — see ENV-VARS.md).
3. **Removed `commandForIgnoringBuildStep`** from the Vercel project (REST API). It was *not* the cause, but it's now moot (it matched the old bot email, which no longer appears) and removing it keeps the config clean — one less thing to misfire.

**Consequences.**
- **Attribution:** autonomous posts now show `johnnycakx` as the GitHub author (email association) with committer name `foil-content-bot`; the commit message (`autonomous weekly post …`) still signals automation. Acceptable — John is the publisher/owner. The separate-bot-identity goal of ADR-008 is dropped as unworkable (Vercel requires a team-associated committer).
- **Pro:** One deploy path for all commits; no hook secret on the hot path; no author-ignore command.
- **Lesson (AGENTS.md):** "BLOCKED" is not self-explanatory — query `readyStateReason` / `seatBlock.blockCode` from the Vercel API before theorizing. My first fix shipped on an unverified hypothesis and the smoke test caught it; the deployment-detail field gave the unambiguous cause.
- **Kill-switch** (`AUTO_PUBLISH_WEEKLY_POSTS=false`) still works: no commit → no push → no deploy.
- **Self-healing (deferred):** poll the Vercel API post-push, ping `#errors` on a non-Ready deploy. Needs a Vercel read token in CI; deferred. Tracked in [RISKS R-011](RISKS.md#r-011--autonomous-deploy-plumbing-fails-silently).

**Verification.** Re-smoke-tested via `gh workflow run weekly-content.yml` after the email fix: the autonomous commit produced a **Ready** production deploy. See [SESSION-LOG Session 47.4](SESSION-LOG.md).

**Cross-refs.** `.github/workflows/weekly-content.yml` ("Configure git author"), [ADR-008](#adr-008--vercel-deploy-hook-for-autonomous-content-not-github-integration-auto-deploys), [ADR-006](#adr-006--full-autonomy-no-human-review-step-gates-as-the-safety-net), [RISKS R-011](RISKS.md).

---

## ADR-046 — Tiered per-card rendering + catalog expansion to ~1,000 cards

**Date:** 2026-05-30 (Session 47.4)
**Status:** Accepted.

**Context.** `/cards/[slug]` is `force-dynamic` and fetches a live eBay best-listing (one Browse call) on every render. That's fine at 207 curated cards but doesn't scale — at 1,000+ cards with crawler/user traffic it would multiply Browse calls against eBay's default 5,000/day ceiling, and R-008 forbids caching listing data. We want to expand the catalog (creator sponsorships dispatch in ~4 weeks; the deal-finder needs depth) without that quota blow-up and without shipping thin pages.

**Decision — two parts.**

1. **Render tier.** `CatalogEntry.tier?: "curated" | "longtail"` (absent = curated). `curated` cards fetch the live eBay best-listing as before. `longtail` cards **skip `getBestListing` entirely** — they render the PokeTrace sold-history panel + a `<LongTailListingFallback>` (an affiliate *search* CTA, which is a link, not a Browse call → R-008-safe). Schema: longtail omits the live `Offer` and emits an `AggregateOffer` from the baked TCGplayer price range when present, so Product keeps a price signal. `/cards/[slug]` stays `ƒ (Dynamic)` for both tiers (confirmed in the build route table) — nothing is frozen to build-time data.

2. **Expansion pipeline.** `scripts/rank-candidate-cards.ts` + `scripts/expand-catalog.ts` grow the catalog. The hand-curated 207 live in `CURATED_CATALOG`; the expansion lives in the generated `lib/cards/catalog-longtail.generated.ts` (spread into `CARD_CATALOG`), so the curated set stays pristine and regeneration is a clean overwrite. First wave: 207 → **1,007** (800 long-tail).

**Ranking pivot (the load-bearing correction — AGENTS.md).** The goal spec ranked candidates by PokeTrace `totalSaleCount × topPrice`. Empirically that's **infeasible**: PokeTrace's list endpoint (`/v1/cards`) exposes neither field (both `undefined` on list rows — they exist only on per-card detail) nor a working sale-sort (`sort=-totalSaleCount` returns insertion order). Scoring that way needs a per-card *detail* fetch across the whole ~20k catalog (hours). Pivoted to ranking by the **Pokémon TCG SDK's inline TCGplayer market price**, scoped to the sets already in the catalog (commercially proven) — one cheap SDK query per set. This is strictly better: it sidesteps the infeasible ranking AND **guarantees non-thin pages** — every ranked card has a TCGplayer price by construction, so its page renders real `AggregateOffer` + variants pricing even when PokeTrace has no sold-history.

**Consequences.**
- **eBay quota bounded:** only curated pages call Browse; the 800 long-tail pages make zero Browse calls. Verified: long-tail render path has no `getBestListing`.
- **Coverage:** first wave matched **1006/1007** cards to PokeTrace (99.9%; 1 transient `fetch failed`, not a data gap), 1567 variants. Build stays `ƒ (Dynamic)`, 2.9min (under the ≤2×~3min guardrail). 616/616 tests after catalog-test updates.
- **Indexing is the real bottleneck, not page count** — see the [STRATEGY-PROGRAMMATIC-SEO 40%-gate amendment](STRATEGY-PROGRAMMATIC-SEO.md): per-card pages carry unique PokeTrace + TCGplayer data, so indexing is tracked as a *signal*, not a hard pre-expansion gate.
- **Quota concentration risk** at 1K routes tracked as [RISKS R-012](RISKS.md).
- **Second wave (1,008 → 2,000)** is gated on first-wave indexing + Browse telemetry (ROADMAP).
- **Re-run:** `node --experimental-strip-types scripts/rank-candidate-cards.ts` → `… scripts/expand-catalog.ts --n N` → `bake:cards` + `bake:poketrace-uuids --refresh`.

**Amendment (Session 47.5 / [ADR-047](#adr-047--ssgisr-hybrid-rendering--metadata-only-tier-for-the-18k-long-tail)).** A third tier — **`metadata-only`** — was added for the 18K long tail: `tier: "curated" | "longtail" | "metadata-only"`. It skips BOTH `getBestListing` AND the sold-history panel (no eBay, no PokeTrace) and renders SDK metadata (image / set / rarity / artist) + an eBay affiliate-search CTA + a TCGplayer link; schema is `Product` with no offers. It's the tier for cards with no priced/sold data — cheap to render (no network at render: SDK metadata is baked locally; measured ~0.46s on production vs ~4s for a PokeTrace-fetching longtail page). (The ADR-047 plan was to ISR-cache it; that was reverted — see the ADR-047 "Runtime reality" amendment — but it renders dynamically anyway because the page is force-dynamic. metadata-only is still the cheapest tier; it just isn't *cached*.)

**Cross-refs.** `lib/cards/catalog.ts`, `lib/cards/catalog-longtail.generated.ts`, `scripts/{rank-candidate-cards,expand-catalog}.ts`, `app/(site)/cards/[slug]/page.tsx`, `components/cards/long-tail-listing-fallback.tsx`, [ADR-042](#adr-042--poketrace-per-variant-uuid-caching-search-then-bake--variant-aware-sold-history), [ADR-021](#adr-021--epn-as-v1-live-listing-source-browse-api-deferred) (R-008 no-cache), [ADR-047](#adr-047--ssgisr-hybrid-rendering--metadata-only-tier-for-the-18k-long-tail), [RISKS R-012](RISKS.md).

---

## ADR-047 — SSG+ISR hybrid rendering + metadata-only tier for the 18K long tail

**Date:** 2026-05-31 (Session 47.5)
**Status:** Partially accepted, partially reverted (see the **Runtime reality** amendment below). The **metadata-only tier** + **resumable bake** shipped and stuck; the **SSG+ISR hybrid** and the **sitemap split** were reverted after P6 production verification surfaced two breakages. Extends ADR-046; constrained by [R-008](RISKS.md#r-008--ebay-2025-license-agreement-ai-output--no-cache-compliance).

> **⚠️ Runtime reality (the amendment that matters — read this first).** The SSG+ISR hybrid below was *designed* and *built*, passed the build + 626 tests, then **failed in production**: every `/cards/[slug]` returned HTTP 500 with digest `DYNAMIC_SERVER_USAGE`. Root cause: the page reads **`searchParams`** server-side (the `v`/`c` variant+condition URL state from [ADR-043](#adr-043--variant--condition-aware-watchlist)), which forces dynamic rendering and is **fundamentally incompatible with ISR** (`revalidate`). The build never caught it because an empty `generateStaticParams` prerenders nothing — the conflict only manifests at request time in production mode. **Fix-forward:** reverted to `export const dynamic = "force-dynamic"` (the pre-goal known-good mode and the R-008 mechanism), dropped `revalidate` + `connection()` + the empty `generateStaticParams`. Separately, the **sitemap split** (`generateSitemaps`) was reverted: per the official Next 16 docs, `generateSitemaps` serves children at `/sitemap/[id].xml` and emits **no index** at `/sitemap.xml`, so robots.txt's `Sitemap:` line 404'd; the child shards were *also* blocked 307→`/login` by the default-deny auth proxy (PUBLIC_ROUTES allowlists `/sitemap.xml`, not `/sitemap/*`). At ~1,100 URLs we're far under Google's 50K limit, so the split was premature. **Net of this ADR: the metadata-only tier (cheaper renders, no eBay/PokeTrace for zero-data cards) + the resumable bake survived; ISR rendering and sitemap splitting are deferred to Goal C and gated on a client-side variant/condition refactor (so `searchParams` leaves the server render) — tracked in [R-013](RISKS.md#r-013--isr-cold-render-latency-at-scale) + [R-014](RISKS.md).** The original (now-superseded) design follows for the record.

**Context.** The catalog will grow toward ~18K cards (all SDK printings). The build *prerenders the long tail*: measured 789ms@207 cards → 2.9min@1,007 (the 800 longtail pages prerender at ~150ms each; curated's `no-store` eBay fetch already opts the 207 curated *out* of prerender → they're `ƒ Dynamic`). Extrapolated, prerendering 18K pages is ~25-30min — under Vercel Pro's 45-min cap but wasteful, since most of those are zero-data metadata-only pages with minimal traffic.

**Load-bearing constraint (R-008).** The **curated** tier renders a live eBay best-listing via `getBestListing` → `cache: "no-store"`. R-008 forbids caching eBay listing data, so curated pages **must not** be SSG-prerendered or ISR-cached. (They can't be anyway — a `no-store` fetch forces per-request dynamic rendering.) SSG/ISR therefore applies only to the **no-eBay tiers** (longtail's sold-history is PokeTrace = cacheable; metadata-only is pure SDK metadata).

**Decision.**
1. **Drop `export const dynamic = "force-dynamic"`** from `app/(site)/cards/[slug]/page.tsx`; set **`export const dynamicParams = true`** + **`export const revalidate = 3600`** (1h ISR). `generateStaticParams` returns an **empty set** — no card page is prerendered at build. (Initially it returned the curated tier, but measuring showed that made Next prerender-*attempt* each curated page at build, firing ~1 build-time eBay Browse call per curated card for output that's discarded — build grew 2.9→4.3min with zero runtime benefit, since curated is dynamic-by-R-008 regardless. Empty is correct: curated renders dynamically on request; the long tail renders on-demand via ISR.) Build time is now **flat at any catalog size** (no card prerender) and makes **zero build-time eBay calls**.
2. **Curated stays dynamic + R-008-safe — explicitly.** The page is ISR-enabled (`●`) for the no-eBay tiers, so to guarantee the curated tier is NEVER ISR-cached (which would cache the live eBay listing), the curated branch calls **`await connection()`** (next/server) before `getBestListing` — that forces those renders to runtime (excluded from prerender/ISR). Belt-and-suspenders with `getBestListing`'s own `cache: "no-store"`. R-008 mitigation #2 updated to record this. (Relying on the no-store fetch alone was deemed insufficiently explicit for a license-compliance line.)
3. **Third tier `metadata-only`** (see ADR-046 amendment) for the zero-data long tail.

**Consequences.**
- Build no longer scales with catalog size (the long tail isn't prerendered) — the 18K-build concern is removed at the source.
- **ISR cold-render latency** is the new thing to watch (first hit of an uncached long-tail page renders on-demand). Verified p95 < 3s on preview; tracked as [R-013](RISKS.md#r-013--isr-cold-render-latency-at-scale).
- R-008 posture is *preserved and re-grounded*: curated is dynamic via `no-store`; the cached tiers touch no eBay data. The audit trigger (eBay fetch without `no-store`) is unchanged.
- Trade-off: removing `force-dynamic` means the explicit "this file is dynamic" signal is gone; the guarantee now rests on the `no-store` fetch. A future curated-path change that drops `no-store` would silently make curated cacheable — guarded by the R-008 invariant test + the updated mitigation note.

**Cross-refs.** `app/(site)/cards/[slug]/page.tsx`, [ADR-046](#adr-046--tiered-per-card-rendering--catalog-expansion-to-1000-cards), [R-008](RISKS.md#r-008--ebay-2025-license-agreement-ai-output--no-cache-compliance), [R-013](RISKS.md), [R-014](RISKS.md), `app/sitemap.ts`.

### v2 amendment (2026-06-28) — client-hydrate the live eBay block so the curated render is fast + crawlable (the SEO crawlability fix)

**Status:** Accepted + Built. Implements `docs/goals/seo-crawlability-indexing-health.md`. Does NOT reopen the reverted SSG/ISR hybrid above — `force-dynamic` stays.

**Context (measured, not hypothesized).** GSC baseline 2026-06-28 (sitemap-filtered Pages report): **Indexed 16 · "Discovered – currently not indexed" 1,007 · "Crawled – not indexed" 0.** Discovery works (the sitemap surfaced all URLs); crawling is throttled, and "Crawled – not indexed = 0" means no quality/dup rejection — when Google crawls, it indexes. Live timing pinned the cause: the **sitemap is healthy** (0.42s, 1,224 URLs, all `https://foiltcg.com` — the "180s" was a transient build hiccup, not the live asset), but **cold curated `/cards/[slug]` pages as Googlebot measured 3.7s and 37.9s TTFB** — the `force-dynamic` render blocked its HTML on the live eBay `resolveVerifiedListing` (`no-store`, multi-`getItem`). A 38s response reads as server distress and throttles the **whole domain's** crawl rate, stranding even the fast long tail. (Tier mix: 207 curated/eBay, 980 longtail/PokeTrace-sold ~0.9–1.6s, 3 metadata-only ~0.5s. The evergreen `getCardMetadata` is a baked in-memory snapshot — already fast. John chose the lower-risk "dynamic-but-fast" path over the spec's full static/ISR rebuild.)

**Decision.** Move the live eBay block OFF the server critical path, keeping `force-dynamic` (so the `searchParams` read is untouched — no ISR/DYNAMIC_SERVER_USAGE landmine reopened):
1. **New `app/api/listing/[slug]/route.ts`** (GET, `force-dynamic`, `no-store`) runs the curated-tier `resolveVerifiedListing` + `computeCardBuySignal` and returns only DISPLAY fields + the buy-signal + the honest-null fallback URL. The full getItem aspect map stays server-side + transient (R-008: never returned/persisted). Curated-gated; non-curated → `{verified:null}`.
2. **`components/cards/live-listing-section.tsx`** (client) fetches that endpoint after mount, shows a skeleton, then renders the best-listing block + buy-signal (or honest-null). The volatile affiliate listing now hydrates per-visitor and **leaves the crawled DOM entirely.**
3. **`app/(site)/cards/[slug]/page.tsx`** no longer fetches eBay at all — it renders fast evergreen HTML (baked metadata, sold-history, variants, metadata block, related) + `<LiveListingSection>` for curated. **Server JSON-LD now always uses the STABLE baked TCGplayer `AggregateOffer`** (the volatile live eBay `Offer` left the structured data — better for rich-result eligibility AND R-008-tidier). The variants-panel live "current best" marker (which depended on the verified listing) is dropped from SSR (a Tranche-A nicety; true per-variant resolution is the unchanged Tranche B #5).
4. **`/api/listing` added to `PUBLIC_ROUTES`** (prefix) — deliberately NOT under `/api/cards` so it can't open the rest of `/api/cards/*` (which stays gated; `/api/cards/search` stays the lone exact allowlist). Same anonymous-read posture as the card page (ADR-020).

**Consequences.** Curated server TTFB drops from ~38s to sub-second (no eBay in the render) → Google should lift the domain crawl throttle so the already-fast 980 longtail pages get crawled + indexed. R-008 preserved: the eBay fetch is `no-store` in the route, nothing cached, aspects never leave the server. SoldHistoryPanel stays server-side (PokeTrace, in-process SWR-cached, ~1.5s — measured acceptable; moving it was deemed unnecessary + risky given its `?v=`/`?c=` accuracy coupling, so it was deferred). Internal-linking verified intact (`/cards → /cards/sets/[set] → /cards/[slug]`; no orphans). **Verification boundary:** the crawl-speed win is confirmed post-deploy (John reviews, then re-measures GSC in 30/60 days against the baseline above); content-marker live verification (ADR-049) runs post-deploy with `CONTENT_VERIFY_BASE_URL`.

**Cross-refs.** `app/api/listing/[slug]/route.ts`, `components/cards/live-listing-section.tsx`, `app/(site)/cards/[slug]/page.tsx`, `lib/supabase/public-routes.ts`, [R-013](RISKS.md#r-013--long-tail-per-card-render-cost-isr-blocked-by-searchparams), [R-008](RISKS.md#r-008--ebay-2025-license-agreement-ai-output--no-cache-compliance), `docs/goals/seo-crawlability-indexing-health.md`.

## ADR-048 — Brand-voice integration into the autonomous content + newsletter pipelines

**Date:** 2026-05-31 (Session 47.5 / Goal V)
**Status:** Accepted.

**Context.** The autonomous blog + newsletter generators had a tone section ("direct, declarative") but were not grounded in a real, written voice. Three voice sources existed but were uncodified: John's actual hooks/bio/hero ([STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md)), the "trusted collector concierge" personality + 4 anti-references ([PRODUCT.md](../PRODUCT.md)), and a Cowork voice-research synthesis (Matt Levine × Morning Brew × active-seller composite + a ban list). Worse, the content `SYSTEM_PROMPT`'s Information-Gain mandate literally instructed the model to emit a `"Foil's scan data: ..."` citation — the exact pattern that produced the Session 47.4 fabrications (a fake "~18% spread"). Structural gates count tokens, not voice or truth ([PATTERNS I-004](PATTERNS.md)), so nothing stopped hype words, vague numbers, or unsourced proprietary stats.

**Decision.**
1. **[docs/BRAND-VOICE.md](BRAND-VOICE.md)** is the canonical voice doc, synthesized from the four sources (the 3 real hooks as the tuning fork; the exact-numbers / grounded-claims / personality-felt / dry-humor rules; the compiled ban list; the four real fabrications as annotated negative examples).
2. **Expand `BANNED_PHRASES`** (`lib/seo/quality-gates.ts`) with 7 brand-voice bans (dive in, game-changer, to the moon, navigate the landscape, delve, tapestry, in today's market). The live gate (e) — used by BOTH the blog and newsletter pipelines — now auto-fails them.
3. **Ground both system prompts** in BRAND-VOICE.md: a "Brand voice" section (voice DNA + the non-negotiable rules), the expanded inline ban list, and "no em dashes". **Fixed the IG mandate** so a Foil-data citation must trace verbatim to the supplied data block (never invented to satisfy the mandate) — closing the prompt-level root cause of the 47.4 fabrications.
4. **`lib/seo/voice-check.ts`** — a verification *lens* (3 detectors: unsourced proprietary stat, vague/hedged number, ban phrase). **Deliberately NOT a runtime generation gate:** detector A would false-positive on a *legitimate* sourced Foil-data citation, which quality-gate 10 already validates with provenance context. The voice check is for tests + manual/CI voice linting; live ban-phrase enforcement runs through gate (e).
5. **R-010 test** (`lib/__tests__/seo-voice-check.test.ts`) anchored on the four real fabricated paragraphs (from commit `d09638b^`) — all four must fail, a clean in-voice baseline must pass.

**Consequences.**
- Future generations are grounded in the real voice; the prompt no longer encourages the fabrication pattern.
- **Honest limit:** the voice check is a tone/trust-signature net, not a fact-checker. It catches *unsourced proprietary stats* and *vague numbers* (the writing signatures of fabrication-prone copy) + ban phrases — it cannot know "Gardevoir ex SAR from 151" is factually wrong (that's gates 9/10 + human review). Documented in BRAND-VOICE.md §6.
- **P5 finding:** running the check on the four *corrected* live posts shows they STILL fail — on vague-number hedges ("approximately $2,100", "around $9", "~270 gsm") and one "as a collector", none of which are fabrications, so the 47.4 fact-check correctly left them. This is pre-existing **voice debt**, not a regression; surfaced as a ROADMAP cleanup item. It demonstrates the new layer is stricter than the prior gates.
- The "active seller" anchor only stays authentic if John writes the "from my store" line himself per the Cowork caveat; the composite voice is v1, iterating toward his real voice is v2.

**Cross-refs.** `docs/BRAND-VOICE.md`, `lib/seo/voice-check.ts`, `lib/seo/quality-gates.ts` (BANNED_PHRASES), `lib/seo/content-engine.ts` (SYSTEM_PROMPT), `lib/newsletter/draft-generator.ts` (NEWSLETTER_SYSTEM_PROMPT), `lib/__tests__/seo-voice-check.test.ts`, [ADR-046 gates 9+10](#adr-046--tiered-per-card-rendering--catalog-expansion-to-1000-cards), [PATTERNS I-004](PATTERNS.md), R-001, R-010.

## ADR-049 — Content-pipeline write/read pinning + content-marker verification as a standing closure gate

**Date:** 2026-05-31 (Session 47.5 / Goal V.2)
**Status:** Accepted. Resolves [R-015](RISKS.md#r-015--content-engine-write-path--blog-read-path-autonomous-posts-dont-go-live).

**Context.** Goal V.1 discovered that the autonomous content engine WROTE posts to `app/blog/posts/` while the live blog route READ from `app/(site)/blog/posts/` (two different directories). Consequence: every autonomously-generated post silently never went live, and Session 47.4's fact-check edited the dead dir too, so its corrections never reached production (the live Moonbreon post still served the `$120-140` fabrication). The directories had diverged because the `(site)` route-group migration (`922ff8a`) copied posts into `(site)` but never re-pointed the engine. Two failure modes compounded: (1) the writer/reader split itself, and (2) every prior verification checked HTTP status (200 OK), never the rendered *content* — so a 200 serving stale fabrications looked healthy.

**Decision.**
1. **One canonical directory constant.** `lib/blog/posts-dir.ts` exports `POSTS_DIR = app/(site)/blog/posts` (the dir the route reads). Every writer + reader imports it: `posts-meta.ts`, `generate-weekly-post.ts`, `content-engine.ts`, `refresh-internal-links.ts`, `competitive-gap-scan.ts`. No module hardcodes a posts path anymore.
2. **Pin writer === reader.** `lib/__tests__/posts-dir-consistency.test.ts` asserts the shared value resolves to `app/(site)/blog/posts` AND that every consumer imports it (and hardcodes no competing path). The split cannot silently recur.
3. **Delete the orphan + guard.** Removed `app/blog/posts/` (verified byte-identical to the live copies first) and the unlinked `hello-world.mdx` placeholder. `lib/__tests__/no-duplicate-blog-paths.test.ts` fails the build if `app/blog/posts/` ever reappears.
4. **Content-marker verification as a standing closure gate.** `lib/__tests__/content-marker-verification.test.ts` curls each live blog post + a card page and asserts the rendered content is correct (fabrications/dead-links absent, the corrected `$2,100` present, `japanese-sar` 200). It SKIPS offline (`CONTENT_VERIFY_BASE_URL` unset) and RUNS against the deploy when set. Promoted in CLAUDE.md to a closure-gate step alongside `/security-review`. This extends [PATTERNS I-006](PATTERNS.md) from "is it 200?" to "is the content right?".

**Consequences.**
- Autonomous Mon/Thu posts now land where the site reads them; the engine's investment (ADR-006) is no longer silently defeated.
- A new content directory or a re-pointed writer that drifts from the reader fails the build (P2 + P4 tests), not silently in production.
- The closure gate now catches the class of bug where HTTP is green but content is wrong. Cost: the live content check needs a deploy URL, so it's a post-deploy step (skipped in the offline unit run by design).
- The brand-voice rule still applies site-wide: chrome em dashes (header `aria-label`, a CardScannerEmbed tagline) remain a separate follow-up; the gate intentionally scopes to post-body markers, not chrome.

**Cross-refs.** `lib/blog/posts-dir.ts`, `lib/__tests__/{posts-dir-consistency,no-duplicate-blog-paths,content-marker-verification}.test.ts`, [R-015](RISKS.md), [PATTERNS I-008 + I-006 + I-003](PATTERNS.md), [ROADMAP #33](ROADMAP.md), ADR-006.

## ADR-050 — Creator-content ingestion + attribution gate

**Date:** 2026-06-01 (Session 47.5 / Goal C.1)
**Status:** Accepted (pilot). 1-session, 5-channel validation of feeding creator commentary to the content engine before automating further (Path A from the IDEAS entry).

**Context.** PokeTrace's `avg30d` is a lagging signal; Pokémon TCG YouTubers react in days to set drops, anniversaries, leaks, and viral spikes. Feeding a synthesized digest of curated-creator commentary gives the content engine market-sentiment color it can't get from price data — and surfaces pre-release/leak signal that leads PokeTrace by weeks. The risk is twofold: copyright (don't reproduce creators' words) and shill-pollution (don't launder hype into "card-data"). Both are handled by ingestion filtering + an attribution gate + treating hype as *speaker-data*.

**Decision.**
1. **Curated whitelist** (`docs/creator-whitelist.md`, John owns it): 5 channels for C.1. A parse contract lets the ingestion read `active` rows. Channels are verified (handle resolves + auto-subs fetch) before landing.
2. **Ingestion** (`scripts/ingest-transcripts.ts` + `lib/seo/transcript-clean.ts`): yt-dlp `--write-auto-subs --skip-download` for the last 30 days → clean VTT to deduped text → redact (R-008 eBay refs + URLs stripped; BRAND-VOICE.md AI-tell phrases stripped; market-hype words PRESERVED as signal) → gitignored `docs/transcripts/`. Idempotent.
3. **Digest** (`scripts/transcript-digest.ts`): committed `docs/transcript-digests/{date}.md`. Card pulse (freq-ranked nickname mentions + cited prices + hype markers + speculator-spike candidates = nickname-near-hype, a contrarian-SELL watch) and a cross-channel **Upcoming-set pulse** (set lexicon + leak/upcoming markers; 3+ channels + markers = HIGH pre-release signal).
4. **Content engine** (`content-engine.ts`): SYSTEM_PROMPT "Creator commentary context" (synthesize never copy; >25-word verbatim cap; attribute by name; hype = speaker-data not card-data). `loadLatestCreatorDigest()` injects the newest digest per generation.
5. **Gate 11** (`quality-gates.ts`): 11a fails an unattributed collective claim ("creators are saying" with no named whitelisted creator within 50 chars); 11b fails any >25-consecutive-word run copied verbatim from the transcript corpus. 11b runs only when the corpus is supplied (transcripts gitignored → skipped in unit runs).
6. **Daily ingestion** (`.github/workflows/transcript-ingestion.yml`, 06:00 UTC, kill-switch `AUTO_INGEST_TRANSCRIPTS`).

**Pilot measurement (P6, honest).** Ran the real auto-pick generation with the digest injected (routed to `_pending`, not published): the post cited **2 creators with full attribution** ("Pirate King Investments mentioned in a recent video that…", "PokeBeard flagged that…"), Gate 11a = **0 violations**, and referenced digest signal (Moonbreon). The current live posts cite **0** creators — so the lift (attributed market-sentiment color) is real. **Negative:** the draft still failed `voiceCheck` (1 "roughly 4" hedge + 22 em dashes) because voiceCheck/em-dash detection is NOT a hard pipeline gate — the model ignored the prompt's no-em-dash rule. Follow-up: wire voiceCheck into the engine's gate set or rely on the `_pending` review step.

**Consequences.**
- Copyright posture: synthesis + named attribution = standard journalism shape (Money Stuff / PokeBeach). The >25-word cap + Gate 11 enforce it structurally.
- Shill-pollution defense ([R-017](RISKS.md#r-017--creator-shill-pollution-of-the-content-engine)): hype is filtered/labeled at ingestion + treated as speaker-data; a creator's "$2,000" is never a citable price (Gate 10 + the prompt rule).
- **CI bot-block risk ([R-018](RISKS.md#r-018--ci-youtube-bot-block-on-transcript-ingestion)):** yt-dlp verified from a residential IP; GitHub Actions datacenter IPs are often bot-blocked. The workflow soft-fails (digest runs on existing transcripts). Mitigations: cookies secret, residential scheduled box, or proxy.
- Voice gate gap surfaced (above) is the main quality follow-up.

**Cross-refs.** `docs/creator-whitelist.md`, `lib/seo/transcript-clean.ts`, `scripts/{ingest-transcripts,transcript-digest}.ts`, `lib/seo/content-engine.ts`, `lib/seo/quality-gates.ts` (Gate 11), `.github/workflows/transcript-ingestion.yml`, [R-017](RISKS.md) + [R-018](RISKS.md), [PATTERNS I-009](PATTERNS.md), IDEAS "Creator-content ingestion".

## ADR-051 — Wiring voiceCheck into the content-engine gates: em dash HARD, hedge SOFT

**Date:** 2026-06-01 (Session 47.5, post-C.1)
**Status:** Accepted. Closes the gap [ADR-050](#adr-050--creator-content-ingestion--attribution-gate)'s pilot surfaced (the generated draft shipped 22 em dashes because nothing gated them). [ROADMAP #34](ROADMAP.md).

**Context.** `lib/seo/voice-check.ts` has detectors for ban phrases, em dashes, vague-number hedges, and unsourced proprietary stats. It was a verification *lens* (used in tests + manual linting), not wired into the generation pipeline, so the model could ignore the SYSTEM_PROMPT's "no em dashes" rule with no consequence. The question was which detectors can safely become hard gates (block + trigger a retry) without false-positive-rejecting legitimate copy.

**Decision — split by false-positive risk.**
- **Em dash → HARD gate (Gate 12 in `runQualityGates`).** The em-dash character (`—`) is unambiguous: BRAND-VOICE.md rule 7 bans it outright, en dashes (`–`) in numeric ranges stay legal, and detection is a literal character match with **zero false positives**. So it can reject the draft. (Implemented as a direct check in `quality-gates.ts`, not by importing `voiceCheck`, to avoid a circular import — `voiceCheck` imports from `quality-gates`.)
- **Vague-number hedge → stays SOFT (NOT gated).** The hedge detector flags "around/approximately/roughly/~/(approximate)" + a number. That **false-positives on legitimate sourced citations** like "approximately $2,100 (PokeTrace n=363)" — a real, honest figure where "approximately" is correct (a 30-day median is genuinely approximate). Hard-gating it would reject good copy and push the model toward false precision. It remains available via `voiceCheck` for manual/CI linting, but never blocks generation.

**Consequences.**
- Generated drafts can no longer ship em dashes (the C.1 failure mode). The brand voice's most mechanical rule is now enforced where it's written.
- Sourced hedging is tolerated by design; the honest-number cases the V.1 voice pass worried about (real PokeTrace medians) won't be rejected.
- Existing `passingDraft` test fixture had 3 em dashes (recast to commas/parens) so the "passes every gate" test still holds — confirming the gate bites real content.
- This is the general principle for promoting a lint to a gate: **hard-gate only detectors with zero false-positive risk; keep judgment-call detectors soft.** Newsletter gates are a separate set (`runNewsletterQualityGates`) and were left unchanged this round.

**Amendment (2026-06-01).** The newsletter gate set now has parity: `runNewsletterQualityGates` gained the same HARD em-dash gate (gate g), checking both the plain-text and HTML bodies, with an anchored test (em-dash newsletter → FAIL) and the newsletter `passingDraft` fixture recast. The hedge detector stays soft on the newsletter side too.

**Cross-refs.** `lib/seo/quality-gates.ts` (Gate 12), `lib/seo/voice-check.ts`, `lib/__tests__/attribution-gate.test.ts`, [ADR-050](#adr-050--creator-content-ingestion--attribution-gate), [ADR-048](#adr-048--brand-voice-integration-into-the-autonomous-content--newsletter-pipelines), [ROADMAP #34](ROADMAP.md).

## ADR-052 — Transcript ingestion on a residential scheduled box (Path B)

**Date:** 2026-06-01 (post-C.1)
**Status:** Accepted (pilot). Resolves [R-018](RISKS.md#r-018--ci-youtube-bot-block-on-transcript-ingestion) after Path A + A.5 were empirically ruled out.

**Context.** The creator-commentary digest ([ADR-050](#adr-050--creator-content-ingestion--attribution-gate)) needs daily YouTube auto-subs. GitHub Actions runs on datacenter IPs that YouTube bot-walls at the **player API** (the per-video metadata call, before subtitles). Two cheap mitigations were tried and disproven with verbose CI runs:
- **Path A (cookies alone)** — run `26778566985`: a valid 3399-byte `cookies.txt` authenticated (slower handshake) but every video still returned `Sign in to confirm you're not a bot` → 0 transcripts.
- **Path A.5 (cookies + `player_client=web_safari,web,tv,mweb`)** — run `26779657010`: all four clients rejected identically. The block is IP-level, independent of cookies and client.

**Decision — Path B: run ingestion COOKIELESS on John's residential machine.**
1. `scripts/ingest-and-push.ps1` (Windows): `git pull --ff-only` → `ingest-transcripts.ts --days 30 --max 30` (cookieless) → `transcript-digest.ts` → commit+push `docs/transcript-digests/` to `main`. **The residential IP alone clears the bot wall** — no cookies, **no secret, no rotation.** Verified on the setup run (10 new transcripts fetched + pushed, plus the original 74-transcript C.1 run, both cookieless from this box).
2. **Cookieless, not `--cookies-from-browser chrome`:** the setup run proved `--cookies-from-browser chrome` fails on Windows with `Could not copy Chrome cookie database` while Chrome is running (yt-dlp #7271), and it's unnecessary residentially. The script still *supports* `--cookies-from-browser <browser>` (CLI + `YT_DLP_COOKIES_FROM_BROWSER` env, precedence over the cookies-file path, pinned by test) as a fallback if the residential IP ever gets blocked — run with Chrome closed.
3. Windows Task Scheduler job `FoilTranscriptIngest`, daily 06:00 local. Runbook: `docs/runbooks/local-ingest-cron.md`.
4. The content engine reads the digest from `main` on its Mon/Thu CI run, so it's irrelevant that the residential box (not CI) produced it.

**Consequences.**
- Ingestion now actually refreshes signal (residential IP works; the original 74-transcript run proved it). No secret to rotate.
- Dependency on a residential box being up at 06:00. Pilot failure mode is benign: a missed/failed run fetches 0 → the digest clobber-guard skips the write → last good digest stays, nothing committed. No alerting in the pilot (check `%LOCALAPPDATA%\Foil\ingest.log`).
- The CI workflow + `YT_DLP_COOKIES` secret are **retained, dormant** (cookieless CI = green no-op via clobber-guard) as the reactivation point for **Path C (residential proxy)** if box uptime disappoints — add `--proxy` + a proxy secret to the workflow.
- Trade-off accepted: a daily commit to `main` from the box (one small digest file; triggers a cheap Vercel deploy), same shape as the autonomous blog posts.

**Cross-refs.** `scripts/ingest-and-push.ps1`, `scripts/ingest-transcripts.ts` (`--cookies-from-browser`), `docs/runbooks/local-ingest-cron.md`, `.github/workflows/transcript-ingestion.yml` (dormant), [R-018](RISKS.md#r-018--ci-youtube-bot-block-on-transcript-ingestion), [ADR-050](#adr-050--creator-content-ingestion--attribution-gate).

## ADR-053 — Buy-signal MVP + Gate 13 anti-hype

**Date:** 2026-06-01 (Session 45)
**Status:** Accepted. Implements ROADMAP #32 (Goal B).

**Context.** Foil's job-to-be-done is "should I buy this card now?", but the per-card page only displayed prices. The buy signal turns price display into a buy read. The naive spec assumed a per-sale feed (`Sale[]` → median); the **P0 premise check found PokeTrace exposes only aggregated 30-day averages + a sale count per condition tier, not individual sales.** Shipping a median over data we don't have would be a fabricated precision, which the brand voice (no hype, no fake confidence) forbids.

**Decision.**
1. **Two-layer compute (`lib/buy-signal/compute.ts`, pure/sync/dependency-free).** `classifyBuySignal({askPrice, reference, sampleSize})` is the threshold core used in production today, fed the aggregate 30-day average. `computeBuySignal({sales, askPrice})` is the spec's true-median-over-individual-sales function, fully tested and ready for the day a per-sale feed exists. Thresholds: BELOW < ref×0.90, ABOVE > ref×1.10, AT within ±10%, **UNKNOWN when sampleSize < 5** (a thin sample is a coincidence, not a market read). `deltaPercent` is the exact distance, one decimal.
2. **Reference resolver (`lib/buy-signal/reference.ts`).** saleCount-weighted 30-day average across `RAW_POKETRACE_TIERS` only — **graded slabs excluded by construction** (a PSA 10 trades at many times raw). Imports the same `RAW_POKETRACE_TIERS` constant the `SoldHistoryPanel` uses so the comparison universe can't drift (PATTERN I-008 guard). Picks the same default variant the panel headlines (?v= match, else most-traded). Soft-fails to a zero-sample reference → UNKNOWN → no badge.
3. **Badge (`components/buy-signal-badge.tsx`).** BELOW muted green, AT neutral gray, **ABOVE amber not red** (above-market is information, not alarm), UNKNOWN → null. Copy is "Below / At / Above 30-day sold" — **"sold," not "median,"** because the reference is honestly an average today; **no "deal"/"discount" framing.** Whole badge links to `/pricing-methodology`; CSS-only hover/focus tooltip shows sample size + window. No emoji, no exclamation marks.
4. **`/pricing-methodology` public page (598 words).** Documents the window, thresholds, condition filter, sample floor, the UNKNOWN state, and the known limitations — including the honest admission that the reference is currently an average, not a median. Content lives in `lib/buy-signal/methodology-content.ts` so the quality gates scan it in tests. Linked from the blog post footer. Added to PUBLIC_ROUTES.
5. **Gate 13 (anti-hype) in `lib/seo/quality-gates.ts`.** Same severity model as Gate 12 (HARD blocks, SOFT warns). HARD-bans hype terms ("steal", "must-buy", "guaranteed", "easy money", "to the moon", "no-brainer", "amazing deal", …) + any emoji (`\p{Extended_Pictographic}`). Bare "moon" is deliberately excluded so "Moonbreon" doesn't false-match. SOFT-warns unquantified superlatives ("huge", "massive", "tons") with no nearby number. Defensibility lives in the calm, numeric voice; the gate enforces it structurally on all generated copy.
6. **Scope:** curated tier only (the only tier with a live eBay ask), single card surface above the sold-history chart. Rollout to listing/search/watchlist is B.1+.

**Consequences.**
- R-008 held: the eBay ask is the live, force-dynamic, no-store `best.price`; only the PokeTrace sold side (already SWR-cached, legal to cache) feeds the reference.
- The "average not median" reality is documented, not hidden; the true-median path is one data-source swap away (flip `reference.ts` to feed `computeBuySignal`).
- Real-card smoke (Charizard Base $373.54 n=168, Venusaur $207.59 n=32, Mewtwo $34.49 n=142) classified all three tiers correctly with healthy samples; the n≥5 floor behaved as intended.
- +three test files (`buy-signal`, `buy-signal-reference`, `copy-gate-anti-hype`); badge added to `visual-regression` PUBLIC_SURFACES.

**Amendment (2026-06-01, same day, post-deploy verification) — live badge mount DISABLED pending a condition-matched rewire (ROADMAP #32.1).** Verifying the deployed badge against *real* listings (not the synthetic ±20% asks used in the step-9 smoke) showed a systematic failure: the badge fired a large BELOW on every curated card (Charizard −88.5%, Venusaur −75.9%, Mewtwo −39.1%). Root cause is a comparison-basis mismatch, not a compute bug: `getBestListing` returns the *cheapest quality-surviving* listing (any/unknown condition — the live Charizard ask was a ~$43 "Base Set Holo！！！" played/junk listing), while `resolveSoldReference` returns the **Near-Mint-dominated** saleCount-weighted raw average (~$374). Cheapest-any-condition vs NM-weighted-average is structurally guaranteed to read BELOW, presenting as a hype "amazing deal" — the exact failure the brand voice + Gate 13 exist to prevent. The synthetic smoke couldn't catch this because its asks were derived *from* the reference. **Decision:** remove the badge mount from `app/(site)/cards/[slug]/page.tsx` (keep all the lib/compute/reference/component/methodology/Gate-13 code). #32.1 re-enables it once the reference is condition-matched to the listing's inferred condition AND an outlier guard suppresses implausible asks below the lowest raw tier (a junk/fake listing the picker accepted — ties to [ADR-026](#adr-026--quality-aware-listing-picker-replaces-lowest-price-wins) / R-010). **Lesson:** a real-ask verification (not a reference-derived synthetic) is mandatory closure for any signal that compares two independently-sourced numbers.

**Closing amendment (2026-06-01, #32.1) — condition-matched comparison + outlier guard + live-smoke; badge RE-MOUNTED.** The disable was resolved by fixing the comparison basis, not by widening any threshold.
- **`lib/buy-signal/condition-infer.ts` (new, pure):** infers the live listing's condition from its title — graded grades (PSA/BGS/CGC/SGC + number), explicit raw phrases (Near Mint / Lightly Played / …), and abbreviations (NM/LP/MP/HP/DMG), with market/lot/proxy guards that run *first*. Conservative by construction: foreign-market, multi-card/lot, reproduction, vague-wear ("played" with no degree), or no-keyword titles all return `UNKNOWN`/low. A `{tier, confidence, evidence}` shape; the inline table documents precedence.
- **`lib/buy-signal/reference.ts`:** `resolveConditionMatchedReference` returns the 30-day avg for the *matched* PokeTrace tier only (GRADED → saleCount-weighted graded aggregate). It **never** falls back to a different tier — that cross-condition fallback was the bug. Also exposes `lowestRawReferenceFromHistory` for the guard. (Premise confirmed: PokeTrace exposes per-tier `avg30d`, so step-3's "STOP if only aggregate" branch did not trigger.)
- **`lib/buy-signal/compute.ts::classifyConditionMatched`:** UNKNOWN (with a `reason`) when the listing tier is UNKNOWN, when there's no matched-tier sold data, or when the ask is below `OUTLIER_FLOOR_FRACTION` (0.5) × the lowest raw-tier sold avg — a sub-half-of-lowest ask is a damaged/mislabeled/junk/fake listing the quality picker accepted (the $43 "Base Set Charizard" case; ties to ADR-026 / R-010), not a deal.
- **`lib/__tests__/buy-signal-live-smoke.test.ts` (new, standing): the I-009 codification.** Runs the full pipeline (infer → matched reference → classify) against the REAL live ask for the three flagship cards and asserts no large-false-BELOW signature (< −50% BELOW). Creds-gated (skips credentialless CI; the closure gate runs it with `--env-file=.env.local`).
- **Live verification:** the three flagships now read **UNKNOWN** because their current eBay listings carry no condition keyword in the title — so no badge renders, which is the correct, honest outcome (a missing badge beats a confident-wrong one). The badge will appear only on a listing whose condition we can confidently match, above the outlier floor, with ≥5 matched-tier sales.

**PATTERN I-009 (codified):** code-passing gates don't catch signal-*semantics* bugs, and a smoke test using *reference-derived* synthetic asks (ask = ref × k) structurally cannot catch a condition mismatch — only a real-ask, full-pipeline live-smoke can. That live-smoke is now a standing test.

**Cross-refs.** `lib/buy-signal/{compute,reference,condition-infer,methodology-content}.ts`, `components/buy-signal-badge.tsx`, `app/(site)/pricing-methodology/page.tsx`, `app/(site)/cards/[slug]/page.tsx`, `lib/seo/quality-gates.ts` (Gate 13), `lib/__tests__/buy-signal-live-smoke.test.ts`, ROADMAP #32 + #32.1, PATTERNS I-009, [ADR-026](#adr-026--quality-aware-listing-picker-replaces-lowest-price-wins), [R-008](RISKS.md).

## ADR-054 — "Today's best deals" leaderboard: precompute-and-cache derived metadata, never persist eBay listing data

**Date:** 2026-06-05
**Status:** Accepted. Implements ROADMAP B.4. Builds on [ADR-053](#adr-053--buy-signal-mvp--gate-13-anti-hype) (buy-signal compute) + [ADR-024](#adr-024--wishlist-alert-cron-on-vercel-cron-jobs-vs-github-actions-or-supabase-edge-functions) (cron auth) + [ADR-046](#adr-046--tiered-per-card-rendering--catalog-expansion-to-1000-cards) (curated tier).

**Context — R-008 is the gating question.** The public `/deals` board ("Today's best deals", the screenshot surface for the X content bot) ranks curated cards by how far below their condition-matched sold price the best live eBay listing is. eBay's 2025 License Agreement ([R-008](RISKS.md#r-008--ebay-2025-license-agreement-ai-output--no-cache-compliance)) forbids caching/persisting listing data. A public, bot-screenshotted board CANNOT fire a Browse call per page view (that's the [R-012](RISKS.md#r-012--ebay-browse-quota-concentration-at-1k-routes) quota-concentration trap the per-card P0 check already held the badge-grid rollout against), so it must read from a precomputed cache — which collides head-on with "don't persist listing data." The P0 premise check resolved the collision rather than blocking the build.

**Decision — persist the SIGNAL, discard the listing.**
1. **Daily cron `/api/cron/deals-refresh`** (Vercel cron, `0 8 * * *`; bearer-`CRON_SECRET` gate, same contract as the wishlist cron). Walks the **curated** catalog only (the only tier with a live ask), and for each card fetches the live eBay best listing via the existing `lib/affiliate/ebay-browse` boundary (`cache:"no-store"`), classifies it with the shared `computeCardBuySignal`, then **discards the eBay listing.** Bounded concurrency (6) + a hard `MAX_DEALS_BROWSE_CALLS` (240) cap so the run fits the function timeout and stays well under the eBay ceiling. New telemetry surface `deals_cron` so these calls are attributed in `browse_calls` (R-012 gauge).
2. **`buy_signals` cache table stores ONLY derived/non-eBay fields:** `card_slug`, the Foil-derived `signal` + `delta_pct`, the PokeTrace (non-eBay) `sold_reference` + `sold_sample_size` + `matched_tier`, the Pokemon TCG SDK catalog display fields `card_name`/`set_name`/`image_url`, and `computed_at`. **There is deliberately NO column for an eBay item id, listing title, seller, listing image, listing URL, or raw ask price.** The schema *is* the guard; the refresh-batch test asserts the upsert row's key set carries none of those. RLS service-role only.
3. **The board (`/deals`) renders entirely from the cache** — one DB read, zero Browse calls at view time. Columns (per `docs/website-copy-deal-finder.md`): Card · Recent sold (condition-matched, PokeTrace) · **Below by %** (the hook, most-prominent) · See it on eBay. The live listing resolves only on a **"See it on eBay" affiliate CTA click** (`affiliateSearchUrl` via the epn.ts boundary — a navigable client link, the same compliant mechanism as the per-card sponsored fallback). The board shows the date + `foiltcg.com` in-frame for clean self-branding screenshots.
4. **The literal "Live ask" column from the copy is intentionally NOT shown.** Displaying a cron-time eBay price would be a *stale* republished listing price (worse than the per-card page's live force-dynamic ask) — so we show the derived delta + the PokeTrace sold reference and let the CTA resolve the current listing live, the pattern the goal's premise check pre-authorized.
5. **Shared orchestrator `lib/buy-signal/card-signal.ts::computeCardBuySignal`** — the per-card page badge and the leaderboard cron now call ONE function (infer condition → matched reference → classify), so the badge and the board can never silently disagree (PATTERN I-008 guard). The page was refactored onto it with identical behavior.

**R-008 honesty note (the residual nuance, stated not hidden).** `delta_pct` + `sold_reference` are together sufficient to *reconstruct* the compute-time ask (ask ≈ sold × (1 + delta/100)). We persist them anyway because: (a) both are Foil-derived analytics / PokeTrace data, not eBay content; (b) the row carries **no eBay listing identity** — no item, title, seller, image, or URL, so it is not a re-distribution vector or a competing-dataset seed; (c) it is timestamped and **refreshed daily**, not a durable listing store; (d) the board links out **live**. This is exactly the "derived metadata, NOT raw listing data persistence" architecture ROADMAP B.4 specified and flagged for R-008 verification. The eBay ask field itself is never written. Recorded so a future audit sees the call was made consciously.

**Consequences.**
- Compliance invariants stay 6/6: no new `api.ebay.com` caller (cron uses the Browse boundary), no raw `mkevt`/`campid`/`customid` assembly (uses `buildCustomId`/`affiliateSearchUrl`), and the `browse_calls` forbidden-column guard is untouched (the new table is `buy_signals`). A new EBAY-COMPLIANCE.md row (#13) documents the cron + cache.
- Quota: +≤240 Browse calls/day, once daily, attributed to `deals_cron`. Within the ~5,000 ceiling alongside the wishlist cron's real (~tens) daily volume; revisit if `browse_calls` approaches 70% (R-012 trigger).
- Free + affiliate, no paywall; links from the header nav + the homepage primary CTA.
- Live-verify is a post-deploy step (the board is empty until the first cron run): after deploy, hit `/api/cron/deals-refresh` with the bearer, then confirm `/deals` renders ranked BELOW rows. Not pushed without John.
- Follow-ups: a Discord ops summary for the deals cron (skipped for launch — `browse_calls` already logs the calls); revisit a literal live-ask column only if a compliant cacheable-market-read variant is ever justified.

**Cross-refs.** `app/api/cron/deals-refresh/route.ts`, `app/(site)/deals/page.tsx`, `components/deals/deals-board.tsx`, `lib/deals/{leaderboard,refresh-batch}.ts`, `lib/buy-signal/card-signal.ts`, `supabase/migrations/20260605120000_buy_signals.sql`, `docs/website-copy-deal-finder.md`, [R-008](RISKS.md), [R-012](RISKS.md), EBAY-COMPLIANCE.md row #13.

## ADR-055 — Fredoka "FoilTCG" wordmark + foil-corner card mark (Pokeball retired)

**Date:** 2026-06-05
**Status:** Accepted. **Supersedes the entire Pokeball brand-glyph lineage** — [ADR-036](#adr-036--home-page-warmth-pass-fraunces-display-spark-mark-pricing-removal-lighter-scrim) (Foil Spark mark) → [ADR-038](#adr-038--pokeball-as-the-brand-mark--section-pattern--bullet-accent) → [ADR-039](#adr-039--pokeball-section-pattern-shape--density--opacity-iteration) → [ADR-040](#adr-040--brand-glyph-is-the-classic-redwhite-pokeball-section-pattern-density-reduced). The cream/navy/gold palette ([ADR-029](#adr-029--cream--navy--gold-visual-identity-for-collector-niche-distinctiveness)) + Fraunces *display* font for headlines ([ADR-036](#adr-036--home-page-warmth-pass-fraunces-display-spark-mark-pricing-removal-lighter-scrim)) are unchanged — this changes only the brand mark + adds a wordmark font.

**Context.** The live brand glyph was a literal pixel-art Pokémon **Pokeball** (ADR-040) in the header, favicon, OG, and as the hero pill bullet + "How it works" section watermark. A Pokeball is registered Nintendo/Pokémon **trade dress** sitting in the brand position of a buyer-side affiliate business — an IP-exposure flagged in the 2026-06-02 IDEAS entry and made urgent by the imminent paid-creator (PokeBeard) traffic push. Retiring it was a pre-launch blocker.

**Decision.**
1. **Wordmark "FoilTCG" in Fredoka 700** (`next/font/google`, `--font-wordmark` → the `font-wordmark` Tailwind utility). "Foil" navy (`tone="onCream"`, default header) or cream (`tone="onNavy"`, footer/OG/dark); "TCG" gold with a restrained vertical sheen gradient (Gold → Gold-Light → Gold) clipped to the text. Bold, rounded, confident — not glossy-toy 3D. Accessible name `"FoilTCG home"` (no em dash, Gate 12).
2. **Foil-corner card mark (`FoilCornerMark`)** — an abstract navy rounded-rect card with a folded top-right corner revealing a two-tone gold foil back (bright flap `#c9a24b` + sheen over a darker underside `#a8842f`). Geometry-only + isolated so John can swap it later. Reused as the lockup icon, the favicon (`public/favicon.svg` + `public/icon.svg`), the apple-touch-icon (regenerated 180×180 PNG via sharp), and a faint `FoilCornerPattern` "How it works" watermark.
3. **No Pokémon trade dress** anywhere: no Pokeball, no Pokémon-trademark shape, and deliberately NOT the Pokémon yellow+blue palette — fully in cream/navy/gold.
4. **OG/social rebuilt** — `app/opengraph-image.tsx` now renders the wordmark lockup on navy (Fredoka loaded best-effort via the Google Fonts CSS API with a graceful Satori-default fallback so it never 500s); `app/twitter-image.tsx` reuses it. The retired static `public/og-image.png` + the stale pre-pivot/coral scanner OG copy are gone; the static `app/favicon.ico` Pokeball is deleted (the SVG favicon is canonical).

**Consequences.**
- **Zero Pokeball remnants** in `app/`, `components/`, `public/` (grep gate; the only "Pokeball" strings left are comments documenting the removal). Drift guards rewritten in `visual-regression.test.ts` (mark = no `#e63946` / `function PokeballMark`; wordmark = `font-wordmark` + `aria-label` + both tones; assets carry the fold path / wordmark) + the `sold-history-panel` bullet test flipped to `FoilCornerMark`.
- WCAG AA holds: navy-on-cream (`#0f1e3a` on `#f8f5f0`) and gold-on-navy (`#c9a24b` on `#0f1e3a`) both clear AA; the "TCG" sheen carries a solid-gold fallback color for the pre-clip paint + unsupported clients.
- Fredoka is a second brand-font network dependency at build (next/font self-hosts it, so no runtime fetch); the OG-route Fredoka fetch is best-effort + falls back.
- One drift I introduced in the prior B.4 goal surfaced + was fixed here: EBAY-COMPLIANCE.md row #13 had no mirror in `lib/legal/ebay-compliance-content.ts` (the `/legal/ebay-api-compliance` page); added so the drift test passes.
- Follow-up: John may swap the foil-corner mark for a designer mark later — it's isolated to `FoilCornerMark` + the two SVGs + the apple-touch PNG.

**Cross-refs.** `components/brand/logo.tsx`, `app/layout.tsx`, `app/globals.css`, `app/(site)/page.tsx`, `app/opengraph-image.tsx`, `app/twitter-image.tsx`, `components/cards/sold-history-panel.tsx`, `public/{favicon,icon}.svg`, `public/apple-touch-icon.png`, `DESIGN.md` §5, `lib/__tests__/visual-regression.test.ts`, IDEAS "IP risk: live logo is a Pokeball" (flipped to shipped).

### Amendment (2026-06-28) — OG/social image now features a Pokémon card hero fan (edge-inlined JPEG)

**Status:** Accepted + Built. Implements `docs/goals/og-image-card-hero-art.md`.

**Context.** The shared link-preview card (`app/opengraph-image.tsx`, re-exported by `twitter-image.tsx`) was the flat navy wordmark card — no card art. To make a shared `foiltcg.com` link stop the scroll, it should mirror the landing hero (holo cards + brand).

**The feasibility decision (webp → jpeg, build-time inline).** `opengraph-image.tsx` renders via `next/og` (Satori) on the **edge runtime**, which has no `fs`/`sharp` at request time, and Satori's **WebP support is unreliable** — but the hero art in `public/hero/` is `.webp`. So a new committed build-time script (`scripts/generate-og-card-art.ts`, `npm run og:cards`) converts the chosen cards webp → optimized **JPEG** (Satori-reliable; cards are rectangular scans, no alpha needed; 380px wide, q82, ~184KB total) and base64-inlines them into a committed generated module (`app/og-card-art.generated.ts`). The edge renderer just imports those string constants — deterministic, no runtime fetch of our own origin, no fs/sharp at the edge.

**The card.** A fan of 3 recognizable holos — `base1-4` (Charizard, the anchor) + `swsh7-215` (Umbreon VMAX alt) + `swsh4-188` (Charizard VMAX) — over the navy field with a scarce gold glow + navy-tinted card shadows, beside the FoilTCG wordmark lockup + one value line ("The best price on any Pokémon card."). **Never-500 soft-fall preserved + extended:** empty generated art → the left column goes full-width text-only (the prior card); font fetch failure → Satori default font.

**Consequences.** `twitter-image.tsx` inherits automatically (still re-exports the renderer — the single source). Structurally pinned (`lib/__tests__/og-image.test.ts`: the card-art fan `<img>`, the wordmark, the soft-fall path, + the generated module's data-URL shape/size); Satori can't render under `node --strip-types`, so final fidelity is John eyeballing the deployed `https://foiltcg.com/opengraph-image`. **Caching reality:** X retired its Card Validator + caches og:image aggressively, so this does NOT change the already-posted launch thread's preview or existing shares — it upgrades FUTURE link shares as caches expire (a compounding brand improvement, not a live-post fix). Regenerate the card selection by editing the `CARDS` list + `npm run og:cards`.

## ADR-056 — Click-time deal redirect (/go/deal/[slug]) + self-hosted homepage hero images

**Date:** 2026-06-05
**Status:** Accepted. Follow-up to [ADR-054](#adr-054--todays-best-deals-leaderboard-precompute-and-cache-derived-metadata-never-persist-ebay-listing-data) (the /deals leaderboard). Conversion + reliability polish before driving creator traffic.

**Context.** Two pre-traffic issues on the leaderboard surface:
1. **Conversion:** the /deals "See it on eBay" buttons linked to a card-name **search** affiliate URL (`affiliateSearchUrl`), dumping the buyer on an eBay search page rather than the specific below-market listing the board promised. The board can't resolve the specific item at render time — that would fire a Browse call per row per view (R-008/R-012, the whole reason ADR-054 precomputes).
2. **Homepage "broken image row":** the P0 premise check could NOT reproduce a 404 — all 8 homepage images return 200, and they're the **hero card fan** (top of page), not a "bottom row." The real exposure: the hero used `unoptimized` external hi-res PNGs from `images.pokemontcg.io`, a CDN this codebase already documents as flaky (`next.config.ts` comment + `lib/cards/sdk.ts` retry logic). When it hiccups, the whole hero row renders broken. (Premise corrected in the SESSION-LOG.)

**Decision.**
1. **Click-time redirect route `/go/deal/[slug]`** (`app/go/deal/[slug]/route.ts`). On GET it runs a **LIVE `getBestListing`** for the card and 302-redirects to that specific item's affiliate URL (`EpnBestListing.affiliateUrl`, already `buildAffiliateUrl`-wrapped), falling back to the affiliate **search** url when no confident listing exists at click time. **One Browse call per CLICK** — bounded by clicks, not views (the board still makes zero Browse calls per view). R-008: compute at click, persist nothing. New `deals_redirect` `BrowseSurface` for quota attribution.
2. **Pure resolver `lib/deals/redirect.ts::resolveDealDestination`** (injectable, unit-tested): validates the slug against the catalog (`getCatalogEntry`), returns `{ok:false,"unknown_slug"}` for an unknown slug, else an `item`/`search` eBay URL. **No open-redirect surface:** the destination is ALWAYS an internally-built eBay URL (a Browse item or an `affiliateSearchUrl`), never user input; an unknown slug bounces to the internal `/deals`.
3. **Attribution:** the redirect uses the leaderboard-distinct `deals` tier customid (`dl-<slug>`) via `buildCustomId`, so EPN segments leaderboard-driven revenue from card-page (`cp-`) revenue. The board's button now points at the internal `/go/deal/[slug]` (it no longer builds the affiliate URL itself).
4. **Self-hosted hero images:** the 8 homepage hero cards were downloaded once, resized to small local **webp** (`public/hero/*.webp`, ~664KB total for 8), and the hero `<Image>` now serves `/hero/<id>.webp` with `unoptimized` dropped (Next optimizes the local files). The hero no longer depends on the external CDN, so it cannot render broken. A structural test pins every `HERO_CARDS` id to an existing local file + asserts no `https://images.pokemontcg.io` fetch remains on the homepage.

**Consequences.**
- Compliance stays 6/6: the redirect route calls `getBestListing` (the existing `api.ebay.com` boundary) and `buildAffiliateUrl`/`affiliateSearchUrl` (the `mkevt`/`campid`/`customid` boundary) — no new allowlist entries needed. R-008 held (no persistence; live compute at click).
- `/go` added to `PUBLIC_ROUTES` (+ proxy test); `deals_redirect` added to the `BrowseSurface` union (telemetry + types + epn input + telemetry test).
- Quota: redirect Browse calls scale with leaderboard clicks (low pre-launch) under the same ~5,000/day ceiling tracked by R-012; attributed separately as `deals_redirect`.
- Hero images are now a committed binary asset set (8 webp); refreshing the grail seed list means regenerating them (a throwaway sharp script, deleted after use).

**Cross-refs.** `app/go/deal/[slug]/route.ts`, `lib/deals/redirect.ts`, `components/deals/deals-board.tsx`, `lib/__tests__/deals-redirect.test.ts`, `public/hero/*.webp`, `app/(site)/page.tsx`, `lib/supabase/public-routes.ts`, `lib/telemetry/browse-calls.ts`, [ADR-054](#adr-054--todays-best-deals-leaderboard-precompute-and-cache-derived-metadata-never-persist-ebay-listing-data), [R-008](RISKS.md), [R-012](RISKS.md).

## ADR-057 — Buy-signal like-for-like via eBay item specifics: condition coverage + language/market gate

**Date:** 2026-06-05
**Status:** Accepted. Hardens [ADR-053](#adr-053--buy-signal-mvp--gate-13-anti-hype) (buy-signal) / PATTERN I-009. Correctness fix before the X bot posts live.

**Context.** The buy signal inferred the listing's condition from the eBay **title** only. Two failure modes: (1) **cross-market false deals** — a Japanese-market listing whose title has no language word (live example: Alakazam ex item `358584162488`, title `"…SV2a: Pokemon Card 151 203/165 NM"`) was scored against the **English** PokeTrace sold reference, flashing a fake "below sold" deal; (2) **coverage loss** — listings whose condition lives only in eBay item specifics (not the title) read as UNKNOWN. **P0 live probe (2026-06-05) confirmed:** `item_summary/search` exposes **no** item specifics (only a coarse top-level `condition`); only **`getItem.localizedAspects`** returns `Card Condition`, `Language`, `Graded`/`Grade`, `Country/Region` — and the Japanese Alakazam's `Language` aspect is `Japanese` despite the English-looking title. PokeTrace's sold reference is region-partitioned (our path fetches `?market=US`), so the English reference must only be compared to English listings.

**Decision.**
1. **Read item specifics at compute time** (`lib/affiliate/ebay-browse.ts::getListingAspects`) — a `getItem` call for the chosen best listing, flattened to a name→value map. `EpnBestListing` now carries `itemId` for this. **R-008:** `cache:"no-store"`, response read then discarded, nothing persisted (same posture as the search call).
2. **Pure aspect reader** (`lib/buy-signal/aspects.ts`): `marketFromAspects` (v1 gate: `Language` must be explicitly `English`; missing/other → exclude) + `conditionFromAspects` (maps the eBay raw `Card Condition` enum — "Near Mint or Better"→NM, "Lightly Played (Excellent)"→LP, … — and graded slabs → grade-specific `PSA_10` etc. from `Graded`/`Professional Grader`/`Grade`).
3. **Aspect-first inference** (`condition-infer.ts`): when aspects are supplied they're authoritative — **language gate first** (non-English → UNKNOWN), then **prefer the Card Condition/Grade aspect**; if English but no structured condition aspect, **fall through to title parsing** (market already gated, so a title-derived condition is still same-market — preserves coverage). `aspects===null` (getItem failed) → UNKNOWN (never a false deal); `aspects===undefined` → title-only (back-compat). The existing condition + symmetric outlier guards are unchanged — language is an ADDITIONAL like-for-like gate.
4. **Wired** into both compute sites: the per-card page (`page_render`) and the deals-refresh cron (`deals_cron`) fetch aspects for the best listing and pass them to `computeCardBuySignal`.

**MEASURE (PATTERN I-009, live before/after over 207 curated cards).** BEFORE (title-only): **5 BELOW**. AFTER (aspect-gated): **3 BELOW**. Two false positives dropped: a `base6-6-dark-persian` whose best listing was actually a **Flareon multi-card lot** (BELOW→AT), and a `swsh12pt5-18-charizard-v` whose listing had **no confirmable Language** (BELOW→UNKNOWN, the conservative exclude). 0 new deals gained this run; the Japanese Alakazam's current best listing reads `Language: Japanese` → correctly excluded. **The board honestly shrinks 5→3** — fewer deals we can vouch for, which is the point.

**Consequences.**
- Quota (R-012): the buy-signal path now makes **2 Browse calls per compute** (search + getItem) instead of 1 — deals cron ~414/day (was ~207), per-card page +1 per curated render. Still well under the ~5,000/day ceiling; attributed under the existing surfaces. The redirect path is unchanged (1 call, no aspects).
- Compliance stays 6/6: `getListingAspects` lives in the allowed `ebay-browse.ts`, uses `cache:"no-store"`, persists nothing (EBAY-COMPLIANCE maintenance-log entry added).
- The English Charizard probe had **no** Card Condition aspect → the title-fallback (within the English gate) is load-bearing for vintage coverage.
- **Fixed a latent gate gap:** `npm test` is a hardcoded file list; the B.4/B.6 deals tests + this goal's aspect test were never added, so they weren't running in CI. Added all four — suite 781→**812**.
- Follow-up (F4): a same-language reference for non-English markets would let Japanese listings be classified against Japanese sold data instead of excluded; v1 is English-only.

**Cross-refs.** `lib/buy-signal/aspects.ts`, `lib/buy-signal/condition-infer.ts`, `lib/buy-signal/card-signal.ts`, `lib/affiliate/ebay-browse.ts` (`getListingAspects`), `lib/affiliate/epn.ts` (`itemId`), `lib/deals/refresh-batch.ts`, `app/(site)/cards/[slug]/page.tsx`, `app/api/cron/deals-refresh/route.ts`, `lib/__tests__/buy-signal-aspects.test.ts`, `lib/__tests__/buy-signal-live-smoke.test.ts`, [ADR-053](#adr-053--buy-signal-mvp--gate-13-anti-hype), [R-008](RISKS.md), [R-012](RISKS.md), PATTERN I-009.

## ADR-058 — Daily X content bot: dry-run-first, own-posts-only, Satori image (not Playwright)

**Date:** 2026-06-05
**Status:** Accepted. Built dry-run-default. Mirrors the never-auto-send posture of [ADR-011](#adr-011--newsletter-drafts-auto-generated-never-auto-sent) / [R-001](RISKS.md#r-001--content-engine-fabrication). New risk [R-019](RISKS.md#r-019--x-automation-tos--api-cost-runaway).

**Context.** Drive daily X traffic by posting a branded image of the live deal data + rotating angles, from the Foil account. Three premise realities surfaced in the P0 check that reshaped the literal spec:
1. **Playwright doesn't run in a Vercel cron** without a heavy serverless-chromium dep (`@sparticuz/chromium`, ~50MB, 250MB-function-limit blast radius) — for a dry-run feature that may never go live.
2. **A Vercel cron can't write to `docs/social-drafts/`** (read-only fs except `/tmp`).
3. **X creds are absent**, and posting needs **user-context** auth (app-only Bearer can't post); a post **with a URL costs $0.20** (pay-per-use, 2026).

**Decision.**
1. **Image via `next/og` (Satori), not a Playwright screenshot.** The codebase already renders serverless images this way (`app/opengraph-image.tsx`). `lib/social/post-image.tsx` composes a 1080×1350 portrait from the **buy_signals cache** (deals board) or the PokeTrace sold reference (spotlight) — visually equivalent (date + foiltcg.com + "below by %" in-frame), deterministic, zero heavy deps, **R-008-safe** (no eBay listing data rendered or persisted).
2. **Rotating angles** (`lib/social/angles.ts`, pure): deal-of-day → price-spotlight → educational, by UTC day, with graceful fallback when the board is thin.
3. **Voice-gated text** (`lib/social/post-text.ts`): one Sonnet call, re-prompted on any `voiceCheck` violation (Gate 12 no-em-dash + Gate 13 anti-hype), char-limited, "as of today" on prices, ends with the link. Posts link to foiltcg.com (our own site, which carries the affiliate disclosure near its CTAs), so no in-tweet FTC disclosure is required.
4. **Single posting boundary** (`lib/social/x-client.ts`): the ONLY module that calls the X API — POST `/2/tweets` + v1.1 media upload, OAuth 1.0a user-context, soft-fail. Flagged verify-on-enable (X media-upload auth is migrating).
5. **Dry-run default + kill-switch** (`lib/social/bot.ts`, `X_BOT_LIVE` env, default false). `runXBot` invokes the X poster **only** when `live === true`; dry-run routes the draft to Discord `#content-engine` (text + the actual PNG via multipart) for review. A unit test pins "live=false never calls the poster." Setup + enablement in [docs/runbooks/x-bot.md](runbooks/x-bot.md).
6. **Cron** `/api/cron/x-post` daily 14:00 UTC (after deals-refresh), bearer-gated, soft-fail. Local `scripts/x-post-dryrun.ts` writes text drafts to `docs/social-drafts/` (gitignored) where disk works.

**Consequences.**
- No code path posts to X while `X_BOT_LIVE !== "true"` (test-pinned). John reviews drafts, completes the X-app + spending-cap setup, smoke-tests the poster once, then flips the switch.
- Satori vs Playwright: composed, not a literal page screenshot. Reassess if a true screenshot is ever needed (would require the chromium dep or the residential box).
- Cost is bounded by 1 post/day + a console spending cap (R-019); ToS posture is own-account scheduled posts only, no engagement automation.
- New env: `X_BOT_LIVE` + `X_API_KEY`/`X_API_SECRET`/`X_ACCESS_TOKEN`/`X_ACCESS_SECRET` (ENV-VARS). New `npm test` entry `x-bot.test.ts`.

**Amendment (2026-06-06) — Satori-only confirmed after a brief Playwright round-trip.** To satisfy the goal's literal "headless-browser screenshot" wording, a Playwright path (`lib/social/screenshot.ts` via `playwright-core` + `@sparticuz/chromium`, screenshot-primary with Satori fallback) was added, then **removed by an explicit follow-up decision**: the ~50MB chromium dep + Vercel function-size/deploy risk isn't worth it for a dry-run feature whose composed Satori card is visually sufficient. The Satori `renderDealsImage`/`renderSpotlightImage` is now the SOLE image source for every angle; `screenshot.ts` + both deps are deleted. (Note: the 2 moderate npm vulns observed during that round-trip are PostCSS-via-Next, pre-existing and unrelated to chromium — not cleared by the uninstall, not in scope to force-fix.)

**Cross-refs.** `lib/social/{angles,post-text,post-image,x-client,bot,data}.ts(x)`, `app/api/cron/x-post/route.ts`, `lib/notifications/discord.ts` (`postSocialDraft` + `postDiscordImage`), `scripts/x-post-dryrun.ts`, `docs/runbooks/x-bot.md`, [ADR-011](#adr-011--newsletter-drafts-auto-generated-never-auto-sent), [ADR-054](#adr-054--todays-best-deals-leaderboard-precompute-and-cache-derived-metadata-never-persist-ebay-listing-data), [R-001](RISKS.md), [R-008](RISKS.md), [R-019](RISKS.md).

## ADR-059 — Utility-first positioning + subscription-ready (not paywalled)

**Date:** 2026-06-06
**Status:** Accepted. Strategy record, not a code change. Refines [ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning) (buyer-side deal-finder) without superseding it. Sources: [PLAN-2026-06-05.md](PLAN-2026-06-05.md), [BUSINESS-MODEL-2026-06-05.md](BUSINESS-MODEL-2026-06-05.md), [CONTEXT-HANDOFF-2026-06-05.md](CONTEXT-HANDOFF-2026-06-05.md).

**Context.** The `/deals` board shipped with only ~3–4 trustworthy deals (honest after condition+language gating), which prompted the right question: how does Foil actually make money long-term? The answer, worked out in the 2026-06-05 Cowork strategy session: the product is **largely built** — ~1,007 per-card best-listing + affiliate pages, the deals board, the buy-signal differentiator, the content/newsletter engine, EPN tracking. The bottleneck is **not features, it is traffic/distribution** (GSC showed ~7 of 220 pages indexed; organic traffic near zero). Two further realities: (a) affiliate is a thin, high-volume game — ~$10 RPM, so ~150,000 visitors/mo for $1,500/mo; (b) the **same $1,500/mo is ~150 subscribers at $10/mo** — one paying subscriber ≈ 1,000 monthly affiliate visitors.

**Decision.** Reframe the positioning and the monetization model:
1. **Lead with the utility, not the scarcity.** The headline is "**the best price on any Pokémon card you want, instantly, free.**" The deals board + the X bot are the **hook / traffic engine**, not the whole product. The ~1,007 per-card pages are the **revenue engine** — affiliate earns on *every* card a visitor lands on, not just the few below market. "Best price on any card" is a far bigger TAM than "today's 3 deals," same assets, broader funnel.
2. **Affiliate bootstraps; subscription is the margin lever.** Affiliate (EPN) is the baseline that pays the bills on free/organic traffic. A recurring **instant-alerts subscription (~$10/mo)** is where the margin is, flipped on once an audience exists. Framed "support the site + get deals first," **never** the founder-member tier ([B.5 subsumed](ROADMAP.md)).
3. **Do NOT paywall the free funnel.** The free tier (per-card pages, the deals board, browse/search, the weekly newsletter, hourly/daily watchlist alerts) is what ranks in Google, what the X bot drives traffic to, and what earns trust. It stays free.
4. **Build the subscription SEAM now, flip later.** An entitlement/tier check at the alert-frequency + watch-count boundaries (default free); watchlists stay email-anchored but structured so a user/account + tier flag layers on cleanly; instrument engaged-free-user count + which limits users hit, so the flip is triggered by a measurable demand signal, not a guess. (ROADMAP **SUB** row.)
5. **Board richness comes from catalog scale, never looser filters.** The eBay Growth Check + catalog expansion are the real board-fattening levers; the structured-matching backbone (Set + Number + Finish) tightens accuracy, it does not loosen the bar.

**Consequences.**
- It is a **distribution problem**: effort prioritizes traffic (SEO/indexing, the X bot, the newsletter, catalog scale) over more product. Fix the conversion leaks first (click-time redirect ✅ B.6, F4 coverage ✅) before pouring traffic in.
- The defensible moat is **SEO position + owned email audience + founder credibility + the buy-signal smarts**, not the affiliate links themselves (eBay can change EPN terms on short notice — [R-007](RISKS.md)).
- ROADMAP reconciled this session: utility-first note added to PRODUCT.md; new rows **SM** (structured-matching backbone), **SUB** (subscription seam + instant-alerts wedge, gated), **X-bot go-live** (John-manual); **B.5** clarified as subsumed (recurring sub primary, one-time unlock optional).
- No code or schema change in this ADR — it records the frame the subsequent build goals execute against.

**Cross-refs.** [ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning), [ADR-054](#adr-054--todays-best-deals-leaderboard-precompute-and-cache-derived-metadata-never-persist-ebay-listing-data), [ADR-057](#adr-057--buy-signal-like-for-like-via-ebay-item-specifics-condition-coverage--languagemarket-gate), [ADR-058](#adr-058--daily-x-content-bot-dry-run-first-own-posts-only-satori-image-not-playwright), PLAN-2026-06-05, BUSINESS-MODEL-2026-06-05, [R-007](RISKS.md), [R-012](RISKS.md).

## ADR-060 — Vending host lead-gen pivot (public surface → vending; deal-finder dormant)

**Date:** 2026-06-13
**Status:** Accepted, then **its full-repurpose framing was SUPERSEDED by [ADR-064](#adr-064--dual-track-site-deal-finder-restored-as-primary-indexed-seo-surface-vending-lead-gen-kept-at-host) (2026-06-23)** — the deal-finder is the primary public indexed surface again and vending is a secondary lead-gen track at `/host`. The lead-gen build this ADR shipped (the `host_leads` table, `/host`, `/faq`, `/service-areas`, the lead form) is fully preserved; only the "deal-finder dormant / vending = the whole public site" stance is reversed. Originally: **Supersedes the public-product framing of [ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning)** (buyer-side deal-finder) and **[ADR-059](#adr-059--utility-first-positioning--subscription-ready-not-paywalled)** as the *public* positioning; the deal-finder code, its ADRs, and its data stay intact in-tree (dormant, reversible). Executes Goal A of [docs/vending/03-CLAUDE-CODE-PROMPTS.md](vending/03-CLAUDE-CODE-PROMPTS.md); content source [docs/vending/01-HOST-LOCATION-OFFER.md](vending/01-HOST-LOCATION-OFFER.md); local-SEO architecture [docs/vending/04-LOCAL-SEO-AND-TOOLS.md](vending/04-LOCAL-SEO-AND-TOOLS.md).

**Context.** John decided (2026-06-13, doc 02) to repurpose the public `foiltcg.com` surface *in its entirety* from the Pokémon deal-finder into a **B2B lead-gen site for a Pokémon card vending-machine placement business** — attracting business owners to *host* a machine for a revenue share. The deal-finder is retired from the public surface (code preserved). **Premise-check finding (load-bearing, flagged):** a prior same-week strategy doc, [STRATEGY-VENDING-2026-06-12.md](STRATEGY-VENDING-2026-06-12.md), described the *opposite* — an **additive** model where the deal-finder stays the public core and vending is *added* (`/machines` locator + restock alerts), with lead capture persisting to a `host_leads` table + Discord. That Jun-12 build is **already in the tree, gate-integrated (`package.json` test script), and its migration is applied in prod**. Goal A (06-13) is newer, carries an explicit dated decision, and was invoked by name, so it **supersedes** the 06-12 additive model. This ADR records the reconciliation so the collision is recoverable.

**Decision.**
1. **New public surfaces** (copy strictly from doc 01; unconfirmed facts ship as visible `[PLACEHOLDER]`, never invented): `/` homepage host pitch (hero → value props → how-it-works → operating proof → FAQ teaser → lead form), `/host` long-form pitch + lead form, `/faq` (FAQPage JSON-LD), `/service-areas` hub + `/service-areas/[city]` unique pages for 8 Tier-1 Bay-Area cities. City pages are generated from a structured data file (`lib/vending/cities.ts`) with genuinely distinct local content per city (real public geography, city-specific FAQ) — **not doorway pages** (doc 04 §1). `LocalBusiness` + `Service` JSON-LD (Service-Area Business: `areaServed`, no `streetAddress`) on `/` + each city page; `FAQPage` on `/faq` + the homepage teaser.
2. **Lead capture (reconciled).** Goal A specified Resend **email-only, no DB**. Because the Jun-12 `host_leads` table is already applied in prod, the rewrite makes **Resend email the PRIMARY, required channel** (`app/actions/host-lead.ts` → `lib/notifications/resend.ts`, the single email boundary; recipient `john.c.craig24@gmail.com`, env-overridable via `LEAD_NOTIFICATION_EMAIL`, never derived from form input) and **keeps the DB insert + Discord ping as best-effort secondaries** (durable record, never block success). A submission fails only if no channel accepted it. Tearing out applied, tested infra to satisfy a "no-DB" line whose stated rationale ("avoid schema work") was already moot would have been destructive. Honeypot + per-email 24h rate-limit retained. Security: every field validated/length-capped (`lib/vending/validate.ts`), subject CR/LF-stripped (header-injection guard), HTML body escaped.
3. **Deal-finder dormancy (NOT deletion).** All nav/footer/home links to the deal-finder removed; `robots: { index: false, follow: false }` added to `/cards`, `/cards/[slug]`, `/cards/sets/*`, `/deals`, `/start`, `/pricing-methodology`, `/newsletter`, `/blog`, `/blog/[slug]`, the three marketing pillars, and `/machines` (the buyer-locator, premised on a live machine + the now-dormant finder price view — revives at Phase V-2). Sitemap (`app/sitemap.ts` + `lib/seo/sitemap-landings.ts`) rebuilt to contain **only** the vending routes + city pages (the ~1k `/cards/*` + blog URLs are no longer concatenated on, so they drop out of Google).
4. **Scheduled jobs disabled** so they stop firing against the dead product: `vercel.json` crons emptied (`wishlist-alerts`, `deals-refresh`, `x-post`, `browse-telemetry`); repo variable `AUTO_PUBLISH_WEEKLY_POSTS=false`; `weekly-content.yml` schedule commented out (manual-dispatch only); `X_BOT_LIVE` stays false.
5. **Honesty guardrails (hard).** No earnings guarantees, no fabricated scale/locations/testimonials, no "passive income" vocabulary (FTC), no install-timeline promise. The **insurance/liability** claim doc 01 wanted as a value prop is **not** asserted — the Jun-12 honesty pass correctly flagged it as a fabrication until the policy exists, so it ships as a visible `[PLACEHOLDER]` on `/faq` (filled in Goal B). The published terms are the 10–15% revenue-share band only. Brand keeps the cream/navy/gold system.

**Consequences.**
- The 06-12 additive surfaces (`/machines`, restock alerts, the dual-role `/pricing-methodology` machine-pricing disclosure) are **preserved but dormant** — committed, compiling, gate-passing, noindexed/unlinked — to revive at Phase V-2 when machine #1 lands. The `machine_restock_alerts` + `host_leads` tables stay applied (the lead action uses `host_leads`; restock is V-2).
- The deal-finder's open work (the `"collection"` prefilter fix, Tranche B, X-bot go-live) is **moot for the public product** but code/tests remain. Don't spend cycles on it unless John revives or sells that surface.
- Test guards updated: `sitemap.test.ts` now pins deal-finder routes ABSENT + vending routes present; `visual-regression.test.ts` homepage assertions rewritten for the vending homepage + the host surfaces added to `PUBLIC_SURFACES`; `proxy.test.ts` covers `/faq` + `/service-areas`; `email-capture.test.ts` + `aceternity-components.test.ts` homepage/footer assertions updated. The Jun-12 copy firewall + FTC guards (`vending-surfaces.test.ts`) carry over unchanged.
- **Reversible:** re-pointing the site back to the deal-finder is un-noindexing + restoring the sitemap + re-enabling crons + reverting nav. **If John actually wanted the 06-12 additive model, this is the ADR to read first** — the reconciliation is documented, not silent.
- Follow-ups (John / later goals): Goal B (real photos, finalize `[PLACEHOLDER]`s incl. base city, install timeline, insurance, revenue-share public treatment); Goal C (content engine reframe to vending/local-SEO topics); Goal D (scout/referral page); Google Business Profile setup (highest-ROI local-SEO lever, John-manual, doc 04 §2).

**Cross-refs.** [ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning), [ADR-059](#adr-059--utility-first-positioning--subscription-ready-not-paywalled), [ADR-014](#adr-014--outbound-discord-notifications-per-channel-webhooks-soft-fail-single-import-boundary), [ADR-024](#adr-024--wishlist-alert-cron-on-vercel-cron-jobs-vs-github-actions-or-supabase-edge-functions), [STRATEGY-VENDING-2026-06-12.md](STRATEGY-VENDING-2026-06-12.md), [docs/vending/](vending/).

## ADR-061 — Vending register: evolve the "quiet backroom" canon for the B2B host audience

**Date:** 2026-06-13
**Status:** Accepted. **Supersedes [ADR-029](#adr-029--cream--navy--gold-visual-identity-for-collector-niche-distinctiveness)'s "Dealer's Quiet Backroom" register for the vending surfaces only** (`/`, `/host`, `/faq`, `/service-areas[/city]`). ADR-029 still governs the dormant deal-finder surfaces. Relates to [ADR-060](#adr-060--vending-host-lead-gen-pivot-public-surface--vending-deal-finder-dormant) (the pivot). Executes Goal E of [docs/vending/03-CLAUDE-CODE-PROMPTS.md](vending/03-CLAUDE-CODE-PROMPTS.md).

**Context.** A live design review (John, 2026-06-13) found the vending homepage "overwhelming," the site "lacks contrast / feels bleak," and the hero machine photo "awkward floating on cream." Root cause: the surfaces inherited ADR-029's collector-browsing register — Flat-At-Rest + Scarce-Gold-≤10% + all-cream — which is the right quiet for a deal-finder and the wrong energy for a B2B pitch to business owners. The fix is to evolve the canon for this audience, not to abandon the brand.

**Decision.** New north star for the vending surfaces: **"the confident local operator"** — energetic but not hype. KEEP the cream/navy/gold palette + hex, Fraunces/Geist, Coral-Hover-Only, No-Pure-Black-Or-White, Navy-Tinted-Shadow, and all four anti-references (generic-AI-SaaS / crypto-hype / sterile-enterprise / bargain-bin). CHANGE three rules for these surfaces:
1. **Cream ↔ navy alternation** — dark `bg-foil-navy` feature sections are sanctioned for contrast/rhythm (≥1 per long page; on navy, text is `text-foil-cream`, gold is the accent). Replaces the all-cream surface rule.
2. **Subtle resting elevation** (relaxes Flat-At-Rest) — feature cards may carry a resting `shadow-md shadow-foil-navy/10` and lift on hover; list rows stay flat.
3. **Gold as a structural accent** (relaxes Scarce-Gold ≤10%) — gold may mark eyebrows, step numbers, key figures, and rules on navy, not just one signal per view; it never becomes a large fill or a second button color.

The full evolved canon lives in **DESIGN.md §7** + the vending-audience notes in **PRODUCT.md**. Machine photos sit on a navy panel / device frame (dark-on-dark), neutral model-only captions, never implied installs.

**Consequences.**
- The homepage was redesigned against the evolved canon (Goal E Phase 2): copy trimmed ~40% (value props 6→4, the homepage "Quick answers" FAQ block cut with a link to `/faq`, hero + proof tightened, homepage lead form shortened to the required fields via a `compact` `HostLeadForm` variant; the full form stays on `/host`); a dark-navy "How it works" band with gold step numbers; resting elevation on the value-prop cards; the hero machine photo moved onto a navy device-style frame. The "as placements go live… no testimonials we don't have yet" lines were removed from `/` and `/host` (end on the true credibility line; docs/vending/01 "stay silent on count").
- Social-share images regenerated for the vending brand (Goal E Phase 3): `app/opengraph-image.tsx` + `app/twitter-image.tsx` now render the host pitch (not "the best price on any Pokémon card") with vending alt text; the homepage FAQPage JSON-LD was dropped (the visible FAQ block is gone — structured data must match visible content; `/faq` keeps its FAQPage).
- `visual-regression.test.ts` + the design:lint guards were updated to the evolved rules (the homepage section-spine pin no longer requires the FAQ teaser; navy sections + elevated cards are allowed). The Coral-Hover-Only + No-Raw-Hex invariants are unchanged and still enforced.
- Reversible: the deal-finder surfaces are untouched; reverting is restoring §§1–6 styling on the vending pages.

**Cross-refs.** [ADR-029](#adr-029--cream--navy--gold-visual-identity-for-collector-niche-distinctiveness), [ADR-060](#adr-060--vending-host-lead-gen-pivot-public-surface--vending-deal-finder-dormant), [ADR-036](#adr-036--home-page-warmth-pass-fraunces-display-spark-mark-pricing-removal-lighter-scrim), DESIGN.md §7, PRODUCT.md.

## ADR-062 — Content engine reframe: deal-finder/collector → vending host-acquisition + local SEO

**Date:** 2026-06-15
**Status:** Accepted, then **REVERSED by [ADR-064](#adr-064--dual-track-site-deal-finder-restored-as-primary-indexed-seo-surface-vending-lead-gen-kept-at-host) (2026-06-23)** — the content engine is back to the card-focused `SYSTEM_PROMPT` + gates so new posts feed the now-primary deal-finder. (The card-focused config restored from this ADR's parent `0d38ab3~1`.) Relates to [ADR-060](#adr-060--vending-host-lead-gen-pivot-public-surface--vending-deal-finder-dormant) (the public pivot) and [ADR-061](#adr-061--vending-register-evolve-the-quiet-backroom-canon-for-the-b2b-host-audience) (the "confident local operator" voice). Builds on [ADR-007](#adr-007--8-quality-gates--3-retries--skip-on-failure-not-fail-the-build) (gates + retry architecture) and **retains** [ADR-050](#adr-050--creator-content-ingestion--attribution-gate)'s creator-attribution gate. Executes Goal C of [docs/vending/03-CLAUDE-CODE-PROMPTS.md](vending/03-CLAUDE-CODE-PROMPTS.md). **Does NOT re-enable autonomy** — `AUTO_PUBLISH_WEEKLY_POSTS=false` and the Mon/Thu cron stay commented out (ADR-060 §4); John reviews the `_pending` drafts + decides cadence separately.

**Context.** Post-pivot (ADR-060), the public surface is vending, but the autonomous content engine still targeted deal-finder/collector topics. Its `SYSTEM_PROMPT` framed Foil as a card-valuation scanner (DUD framework, three-field card-id framework, creator-commentary digest); `docs/seo-strategy.md` carried three collector pillars (Japanese cards, valuation, conditions); and **3 of the 10 quality gates were built around deal-finder data**: the 5-unique-dollar-figure gate (b), the Foil-scan-data citation gate (d) + its provenance partner (gate 10), and the gate-9 internal-link resolver that validated `/cards/` slugs. Those topics + gates drew (and would keep compounding) the WRONG audience — collectors searching "near mint vs lightly played," not the business owners who would host a machine. The content channel had to follow the pivot or it keeps feeding search momentum to a dormant product.

**Decision.**
1. **`SYSTEM_PROMPT` rewrite (`lib/seo/content-engine.ts`).** Audience = a Bay-Area business/location owner deciding whether to host a Pokémon card vending machine. Voice = the "confident local operator" (ADR-061): present-tense, calm, no hype. Honesty guardrails baked in (no earnings guarantees, no published revenue-share %, no insurance/liability claim, no fabricated scale/locations/testimonials). Real infrastructure facts (VTM touchscreen, NAYAX cashless, real-time monitoring, guaranteed-drop refund, QR support, ~3–4 sq ft, ~$4/mo power, risk-free trial) anchor credibility. Internal links must include ≥1 conversion link (`/host`, `/faq`, `/service-areas/[city]`); the deal-finder `<CardScannerEmbed>` + `/cards`/`/start`/`/deals` links are banned. The DUD + three-field + creator-digest injection (collector-specific) were removed from the prompt.
2. **Topic backlog (`docs/seo-strategy.md`).** Two vending pillars replace the three collector pillars: **`/host`** (host-acquisition — venue-ROI posts per business type, the revenue-share-hosting explainer, cost/footprint, best-businesses, who-buys) and **`/service-areas`** (local SEO — one post per Tier-1 city, each linking its `/service-areas/[city]` page). 20 cluster candidates parse via the existing `keyword-backlog.ts` (format unchanged).
3. **Quality gates (`lib/seo/quality-gates.ts`).** RETIRED the three deal-finder gates: dollar-figure count (b), Foil-scan-data citation (d) + provenance (gate 10), and the `/cards`-slug branch of the gate-9 resolver (repointed to `/service-areas/[city]`). RELAXED the recent-year gate (c) from 2 → 1 (host content is evergreen, not dated-market-data-led). ADDED four vending gates: **V-benefit** (≥3 distinct host-value-prop signals), **V-geo** (≥1 Bay-Area place), **V-link** (≥1 conversion internal link), **V-honesty** (HARD: no insurance/liability claim, no published revenue-share %). KEPT the audience-agnostic gates: word count (a), banned phrases (e), schema (f), FAQ length (g), internal-link count (h), creator-attribution (11), em-dash (12), anti-hype (13). The Foil-data provenance machinery + dollar-figure helper were deleted; `FOIL_DATA_CITATION_TRIGGERS` moved into `voice-check.ts` (its sole remaining consumer — the newsletter voice lens).
4. **Autonomy stays OFF + a measurement, not a launch.** Three posts were regenerated through the reframed pipeline to `app/(site)/blog/posts/_pending/` (NOT live), satisfying the repo hard rule for prompt changes (a before/after regeneration measurement, reported in [SESSION-LOG 2026-06-15](SESSION-LOG.md)). The Mon/Thu schedule stays commented out and `AUTO_PUBLISH_WEEKLY_POSTS=false`; John reviews the drafts + decides cadence + re-enable.

**Consequences.**
- **Measured delta (before/after, SESSION-LOG 2026-06-15):** topic shape flipped from collector → host-acquisition/local; every draft passed the new gate suite (after retries); the em-dash + anti-hype + currency gates actively caught and drove out AI-slop (one draft opened with 16 em dashes + "guaranteed"; the gates forced a clean final). The V-geo/V-benefit/V-link gates passed naturally on a city post, confirming calibration (no irrelevant-content forcing). No Foil scan-data is injected (the data snapshot is now always empty for vending).
- The deal-finder content infrastructure is untouched: the **newsletter** `draft-generator.ts` keeps its collector voice + its own (unchanged) gate set, and `voice-check.ts` keeps detector A — both are dead while the blog routes to `_pending` and the newsletter step is `BEEHIIV_*`-gated, so this is a clean follow-up (IDEAS 2026-06-15), not a regression.
- The 7 existing live collector blog posts stay in-tree, dormant + noindexed (ADR-060); the reframed engine won't regenerate them.
- **Reversible:** the collector `SYSTEM_PROMPT` + strategy doc + gates are one `git revert` away; the deleted provenance machinery is recoverable from history.
- **Follow-ups (John):** review the 3 `_pending` drafts → keep/edit; then to re-enable autonomy, uncomment the `on.schedule` block in `.github/workflows/weekly-content.yml` AND set the repo variable `AUTO_PUBLISH_WEEKLY_POSTS=true`. Goal D (`/refer` scout page) is still optional/pending.

**Cross-refs.** [ADR-060](#adr-060--vending-host-lead-gen-pivot-public-surface--vending-deal-finder-dormant), [ADR-061](#adr-061--vending-register-evolve-the-quiet-backroom-canon-for-the-b2b-host-audience), [ADR-007](#adr-007--8-quality-gates--3-retries--skip-on-failure-not-fail-the-build), [ADR-050](#adr-050--creator-content-ingestion--attribution-gate), [docs/vending/](vending/).

## ADR-063 — Selective-index vending blog surface (pillar-gated)

**Date:** 2026-06-15
**Status:** Accepted. Re-enables `/blog` (which [ADR-060](#adr-060--vending-host-lead-gen-pivot-public-surface--vending-deal-finder-dormant) made dormant) for the vending posts produced by [ADR-062](#adr-062--content-engine-reframe-deal-findercollector--vending-host-acquisition--local-seo). One-time manual publish of 3 reviewed drafts; does NOT re-enable autonomy.

**Context.** Goal A (ADR-060) made the entire `/blog` surface dormant — `robots:{index:false}` on the index + `[slug]` routes, no nav link, zero blog URLs in the sitemap — because every post was deal-finder/collector content. ADR-062 reframed the content engine and produced three reviewed vending posts (host-acquisition + local SEO). Publishing them onto the dormant `/blog` would do nothing for SEO (noindex + no sitemap + no nav), so re-enabling the blog surface is in-scope. But un-noindexing `/blog` wholesale would resurface the seven dormant deal-finder posts (off-topic for the pivot). Both post classes live in one `POSTS_DIR`, so the re-enable needs a per-post discriminator.

**Decision.** Re-enable `/blog` as a LIVE vending blog with **per-post selective indexing gated on the post's `pillar`** (`app/(site)/blog/posts-meta.ts`):
- `VENDING_PILLARS = { host, service-areas }`; `isVendingPost(post)` is true iff `post.pillar ∈ VENDING_PILLARS`. The dormant deal-finder posts carry the three collector pillars and classify false.
- **Blog index** (`app/(site)/blog/page.tsx`): indexable (robots removed); copy reframed to the host audience; lists `getVendingPosts()` only; the dormant-newsletter `EmailCapture` footer swapped for a `/host` CTA.
- **`[slug]` route**: `robots:{index:false,follow:false}` applied ONLY when `!isVendingPost(post)` (deal-finder posts stay noindexed, still render); `related` filtered to the same class; the inline newsletter `EmailCapture` + the `/pricing-methodology` footer link (both dormant deal-finder funnels) swapped for a `/host` CTA + host-FAQ link **on vending posts only** (deal-finder posts keep the legacy newsletter, untouched). `generateStaticParams` still returns all slugs so deal-finder pages render dormant.
- **Sitemap**: `/blog` index added to `LANDING_PATHS`; `app/sitemap.ts` layers one `/blog/[slug]` per vending post (`getVendingPosts`). Deal-finder posts + the ~1k card pages stay off.
- **Nav/footer**: a `/blog` link added to both (`app/(site)/layout.tsx`).
- **Publish**: the 3 reviewed drafts `git mv`'d from `_pending/` into `POSTS_DIR`; the gas-station post's "25 to 45" age range standardized to "25 to 40".

**Why pillar-gating** (vs. deleting the deal-finder posts, a separate directory, or a per-post `noindex` flag): the content engine already sets `pillar` from `docs/seo-strategy.md`, which now carries only `host` + `service-areas`, so new vending posts auto-classify and a deal-finder post can never accidentally index. It is the smallest, self-maintaining seam and keeps the deal-finder posts in-tree + reversible. A hand-written vending post MUST set `pillar=host|service-areas` to be indexed (documented in `posts-meta.ts`).

**Consequences.**
- Live: `/blog` + the 3 vending posts are indexable, linked (nav + footer), and in the sitemap. All internal links verified against real pages (`/host`, `/faq`, and the `/service-areas/{fairfield,napa,vallejo}` city pages all exist) — no broken links.
- The 7 dormant deal-finder posts still render (preserved) but stay noindexed, unlisted, and off the sitemap — dormancy unchanged, no content touched.
- Tests: `sitemap.test.ts` moves `/blog` to the present set; new `blog-vending-surface.test.ts` pins the pillar partition + that the 3 drafts landed in `POSTS_DIR`; `content-marker-verification.test.ts` extended to verify the 3 live vending posts (200 + a distinctive on-page marker + the 25-to-40 fix) — John runs it post-deploy. `visual-regression` `PUBLIC_SURFACES` unchanged (palette pins still hold on the blog pages).
- Autonomy untouched: `AUTO_PUBLISH_WEEKLY_POSTS=false`, Mon/Thu cron commented out. This is a manual publish, not a cadence change.
- Reversible: re-noindex `/blog` + drop it from `LANDING_PATHS` + revert the nav link.

**Cross-refs.** [ADR-060](#adr-060--vending-host-lead-gen-pivot-public-surface--vending-deal-finder-dormant), [ADR-062](#adr-062--content-engine-reframe-deal-findercollector--vending-host-acquisition--local-seo), [ADR-049](#adr-049--content-pipeline-writeread-pinning--content-marker-verification-as-a-standing-closure-gate), [docs/vending/](vending/).

## ADR-064 — Dual-track site: deal-finder restored as primary indexed SEO surface; vending lead-gen kept at /host

**Date:** 2026-06-23
**Status:** Accepted. **Supersedes the full-repurpose framing of [ADR-060](#adr-060--vending-host-lead-gen-pivot-public-surface--vending-deal-finder-dormant)** (the deal-finder is no longer dormant — it is the primary public, indexed SEO surface again; vending becomes a secondary lead-gen track at `/host`, not the whole site). **Reverses [ADR-062](#adr-062--content-engine-reframe-deal-findercollector--vending-host-acquisition--local-seo)** (content engine back to card-focus). **Keeps [ADR-063](#adr-063--selective-index-vending-blog-surface-pillar-gated)'s** 3 vending blog posts live + indexed (they support `/host` local SEO). Re-establishes the [ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning) public positioning. ADR-061's evolved vending register still governs the `/host`/`/faq`/`/service-areas` surfaces.

**Context.** The vending pivot (ADR-060) made the *entire* deal-finder dormant — `robots:{index:false}` on every card/blog/pillar route, the deal-finder URLs dropped from the sitemap, nav/footer links removed, the homepage swapped for a vending pitch, all crons emptied from `vercel.json`, the weekly-content cron commented out, and the content engine reframed to vending topics (ADR-062). That cut off the organic search traffic the per-card programmatic-SEO surface + the collector blog had been compounding. John's decision (2026-06-23): run a **dual-track site** — the Pokémon-card deal-finder is the primary public indexed surface again, while ALL the vending lead-gen work stays intact and reachable at `/host`. Constraint: PokeTrace + PriceCharting subscriptions were cancelled 2026-06-16 (cost cleanup during the pivot); John is re-subscribing and will re-add valid keys to Vercel.

**Decision.**
1. **Homepage + /host.** The deal-finder homepage is restored at `/` (recovered from the pre-pivot commit `5031bd6`). The vending hero/pitch was already a long-form superset at `/host`; the only homepage-only asset was the **LocalBusiness + Service JSON-LD**, which moved onto `/host` (still `@id`-anchored to the site root, so identity is unchanged). Root `app/layout.tsx` default metadata + the `opengraph-image`/`twitter-image` reverted to the deal-finder brand.
2. **Un-noindex.** Removed `robots:{index:false}` from every dormant deal-finder route (`/cards`, `/cards/[slug]`, `/cards/sets/[set-id]`, `/deals`, `/start`, `/newsletter`, `/pricing-methodology`, the three pillars, `/machines`). The blog `[slug]` pillar-gating (ADR-063) was reversed so **all** posts index (the 7 collector posts + the 3 vending posts); the per-post CTA + related-posts still partition by pillar via `isVendingPost`.
3. **Sitemap (dual-track).** `LANDING_PATHS` carries both tracks' fixed pages; `app/sitemap.ts` layers every `/cards/[slug]` (CARD_CATALOG), every `/blog/[slug]` (all posts), and every `/service-areas/[city]`. **`/machines` is un-noindexed but deliberately omitted from the sitemap** — it shows "no locations live yet" (no machine placed), so it carries no organic value to recover; recommend re-noindexing until machine #1 lands.
4. **Nav/footer** restored to the deal-finder structure (Today's deals / Browse cards / Blog; footer newsletter capture + Methodology) **plus a clear `/host` entry point** in both nav and footer so vending isn't orphaned.
5. **Content engine reverted** (`content-engine.ts`, `quality-gates.ts`, `voice-check.ts`, `seo-strategy.md` + the two seo tests restored from `0d38ab3~1`, the pre-ADR-062 card-focused state). Pipeline machinery re-enabled: the `weekly-content.yml` Mon/Thu cron + the four `vercel.json` crons (`wishlist-alerts`, `browse-telemetry`, `deals-refresh`, `x-post`) restored. **`AUTO_PUBLISH_WEEKLY_POSTS` stays `false` (reviewed mode) — this goal restores machinery only.** The one-line flip to full autonomy: set the repo variable `AUTO_PUBLISH_WEEKLY_POSTS=true` (the cron is already live).
6. **Card-page SEO resilience (confirmed, not changed).** `/cards/[slug]` already soft-fails gracefully: `getSoldHistory`/`getPriceHistory` early-return `null` when `POKETRACE_API_KEY` is unset/invalid, `resolveVerifiedListing` is try/catch-wrapped for eBay, and `getCardMetadata` uses keyless pokemontcg.io with a minimal-record fallback. So a missing/invalid pricing key renders the page **without pricing, never a 500, and without noindex** — a lapsed key never costs the index entry.

**Consequences.**
- **Vending fully preserved:** `/host`, `/faq`, `/service-areas` + the 8 city pages, the `host_leads` table, `app/actions/host-lead.ts`, the lead form, `LEAD_NOTIFICATION_EMAIL`, the 3 live+indexed vending posts, and the `public/vending` GBP assets are all untouched. The copy firewall + FTC guards (`vending-surfaces.test.ts`) stay green; the homepage was dropped from that file's `VENDING_RENDERED_FILES` (it's a deal-finder surface again).
- **Card-page pricing depends on John restoring the keys** (POKETRACE + eBay) to Vercel. Until then card pages re-index and render without the pricing/sold blocks.
- **Tests:** `sitemap.test.ts` rewritten dual-track (deal-finder present + `/machines` out); `visual-regression.test.ts` / `aceternity-components.test.ts` / `email-capture.test.ts` restored to the deal-finder homepage/footer pins with the vending surfaces kept in `PUBLIC_SURFACES`; `seo-quality-gates.test.ts` + `seo-keyword-backlog.test.ts` back to card-focus. `blog-vending-surface.test.ts` still passes (it pins the pillar *classification*, which is unchanged — only the noindex consequence flipped).
- **Reversible:** the inverse of this ADR (re-noindex, vending-only sitemap, re-reframe the content engine) restores the ADR-060 state.
- **Follow-ups (John):** restore POKETRACE/eBay keys to Vercel; review locally via `npm run dev`; push to deploy; resubmit the sitemap in GSC + request reindexing of the top pages; run `CONTENT_VERIFY_BASE_URL=https://foiltcg.com npm test`. Decide whether to flip `AUTO_PUBLISH_WEEKLY_POSTS=true` and whether to re-noindex `/machines` until a machine is live.

**Cross-refs.** [ADR-060](#adr-060--vending-host-lead-gen-pivot-public-surface--vending-deal-finder-dormant), [ADR-062](#adr-062--content-engine-reframe-deal-findercollector--vending-host-acquisition--local-seo), [ADR-063](#adr-063--selective-index-vending-blog-surface-pillar-gated), [ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning), [ADR-061](#adr-061--vending-register-evolve-the-quiet-backroom-canon-for-the-b2b-host-audience).

## ADR-065 — Homepage reorient: email capture is the primary conversion goal; inline capture on the ranking content surfaces

**Date:** 2026-06-24
**Status:** Accepted. Builds on [ADR-064](#adr-064--dual-track-site-deal-finder-restored-as-primary-indexed-seo-surface-vending-lead-gen-kept-at-host) (dual-track restore) and operationalizes [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md) ("Twitter is the discovery layer; the email list is the moat"). Does **not** touch the vending `/host` track.

**Context.** GSC (3-month) shows the traffic that actually lands is research-intent — condition/value queries ("lightly played vs near mint," "near mint foil meaning," "pokemon card value checker," "venusaur 151") — at ~0.7% CTR, avg position ~18.2. For that audience the right conversion is a newsletter signup, not an affiliate click: the owned email list is the committed compounding moat (the 100→1K→10K curve), and every gram of friction removed from email signup is disproportionately valuable. The homepage led with the deal-finder utility and only surfaced email capture in the bottom FinalCTA; the ranking content pages (blog + 3 SEO pillars) are where the impressions land. A **P0 premise-check finding**: the blog post body and all 3 pillars *already* carried an inline `<EmailCapture>` (so this is a refine, not a net-new add), and — load-bearing — **the 3 pillar pages were still on the pre-Session-39 dark palette** (raw `#FF6B5C`/`#101D38`/`#0B1428`, `text-zinc-300` body, `text-white` headings, a dark gradient slab), never migrated and never in `PUBLIC_SURFACES`, so the no-raw-hex/coral-hover guards never fired. On the cream layout that rendered as white/zinc text on cream — a live WCAG-AA contrast bug. John chose to fix it in full while raising capture.

**Decision.**
1. **Homepage (`app/(site)/page.tsx`) — capture-primary.** The hero now leads with knowledge/value + the newsletter promise (H1: "Know what any Pokémon card is really worth — and when it drops.") and renders the existing `<EmailCapture variant="inline" source="homepage_hero">` as the **primary** above-the-fold CTA. The deal-finder buttons (See today's best deals / Browse the catalog / Start tracking cards) are demoted from the navy primary button to **secondary text links** under a "Want to dive in now?" lead — kept, not deleted (they are "the reason to subscribe"). All content sections (HowItWorks / ExampleResult / FinalCTA) stay — this remains a content-rich, indexable page, not a thin squeeze page. The FinalCTA keeps its `source="homepage_final_cta"` capture; its stale "waitlist / early access" copy was updated to the live weekly-newsletter framing.
2. **Content-page capture (refine + segment).** The blog body's non-vending capture was retagged `blog-${slug}` → **`blog_inline`** (one segment for all blog-body signups; the stale "dormant/noindexed" comment was corrected — ADR-064 made these primary). The 3 pillar captures were retagged to distinct `pillar_*` sources (`pillar_condition_guide`, `pillar_value_calculator`, `pillar_japanese_value`) for downstream Beehiiv segmentation. Vending posts + `/host` get **no** capture (host CTA only).
3. **Pillar palette migration.** All 3 SEO pillars ported to cream/navy/gold (DESIGN.md §§1–6): gold eyebrows, Fraunces `font-display` navy headings, `text-foil-navy/85` body, navy+gold-underline links with coral-on-hover, and the dark gradient CTA slab replaced with the cream/gold premium-slab pattern (matching the homepage FinalCTA). Added to `PUBLIC_SURFACES` so the no-raw-hex + coral-hover-only invariants now guard them.
4. **No new backend.** Reuses the existing `EmailCapture` component + the `subscribeAction` → `lib/beehiiv.ts` path. No change to the watchlist form or the three-surface architecture (footer / `/newsletter` / watchlist) — this layers hero + content-page capture on top.

**Consequences.**
- **More capture surface, same list.** Six tagged sources now feed one Beehiiv list (`footer`, `newsletter-landing`, `watchlist-form`, `homepage_hero`, `homepage_final_cta`, `blog_inline`, `pillar_*`), enabling later lifecycle segmentation (STRATEGY-AUDIENCE-MOAT "Out of scope").
- **Live contrast bug fixed.** The 3 pillars were unreadable on cream in production; they now render in-palette and pass AA. This was outside the literal email-capture scope but is a real fix surfaced by the premise check (John approved the full re-migration).
- **Tests:** `visual-regression.test.ts` gains a homepage-primary assertion (hero capture precedes the demoted deal links; `/deals` is no longer the navy primary button) + the 3 pillars in `PUBLIC_SURFACES`; `email-capture.test.ts` gains source-tag drift guards for `homepage_hero` / `homepage_final_cta` / `blog_inline` / `pillar_*`; the `aceternity-components.test.ts` `/start`-link pin holds (its comment updated — `/start` is now a secondary link).
- **Reversible:** revert the hero block + the source-tag renames; the pillar palette migration stands on its own merit regardless.
- **Follow-ups (John):** review via `npm run dev`; push to deploy; after deploy run `CONTENT_VERIFY_BASE_URL=https://foiltcg.com npm test`; map the GSC research-intent queries into the content + newsletter calendar (the strategic point of the reorient).

**Cross-refs.** [ADR-064](#adr-064--dual-track-site-deal-finder-restored-as-primary-indexed-seo-surface-vending-lead-gen-kept-at-host), [ADR-029](#adr-029--cream--navy--gold-visual-identity-for-collector-niche-distinctiveness), [ADR-027](#adr-027--unified-email-capture-across-three-surfaces-default-checked-newsletter-opt-in-on-the-watchlist-form), [ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning), [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md).

## ADR-066 — One email ask per page; the global footer is nav/legal/trust only; finish the "Level-4" removal site-wide

**Date:** 2026-06-24
**Status:** Accepted. Follow-up to [ADR-065](#adr-065--homepage-reorient-email-capture-is-the-primary-conversion-goal-inline-capture-on-the-ranking-content-surfaces) (homepage-v2). **Narrows the "three email-capture surfaces" model in [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md)** — see Reconciliation below. Homepage + global surfaces; the vending `/host` track is left structurally intact (only the jargon phrase stripped).

**Context.** After ADR-065, several pages still asked for an email more than once: the homepage 3× (hero + `FinalCTA` + the global footer form), `/deals` 3× (a section heading wrapping the `EmailCapture` card — a card-in-card with two headings — plus the footer). Redundant asks dilute the one clear action and read as a squeeze page. Separately, the insider "Level-4 TCGplayer (Verified) Seller" credential survived in global/shared files the homepage-only ADR-065 didn't touch (footer copyright, `/deals`, `/start`, `/cards/[slug]`, `/newsletter`, the OG image, `/host`). It means nothing to a cold visitor; the founder presence (a face + plain byline, ADR-065) is the trust replacement.

**Decision.**
1. **One primary email ask per page.** Homepage: removed `ExampleResult` (the Charizard demo) + `FinalCTA` (its second capture) — the hero is the only ask; `HowItWorks` remains as the indexable body. `/deals`: collapsed the redundant nested capture (dropped the outer gold-slab `<section>` + its heading/paragraph; the `EmailCapture` is already a styled card) to a single ask. `/newsletter` stays the dedicated full-capture page.
2. **The global footer is nav/legal/trust only.** Removed the footer `EmailCapture` from `app/(site)/layout.tsx` and **deleted `components/footer-email-capture.tsx`** (the `source="footer"` tag is retired). The footer keeps its nav links — including **Newsletter → `/newsletter`** so intent-driven visitors still reach the full signup — and the copyright line now carries a tiny founder avatar (`public/founder/john-craig.webp`, `alt="John Craig, founder of Foil"`) + "Built by John Craig".
3. **Site-wide "Level-4" removal.** Stripped the credential from every visible surface (footer, `/deals` meta + byline, `/start` meta, `/cards/[slug]` trust line, `/host` who's-behind-it line, `app/opengraph-image.tsx`, `/newsletter` meta + body) plus the code comments that referenced it, so the jargon greps clean. `/newsletter` keeps a plain-English founder line ("from John Craig, who runs a Pokémon card store"). The **blog post** `ebay-sold-averages-vs-tcgplayer-market-…` was a false positive — its "TCGplayer seller(s)" mentions are legitimate marketplace prose, not the credential badge, so it was **not edited** (and the content-marker gate for it is moot).
4. **Standardized the capture promise copy.** Wherever email is asked (homepage hero, `/deals`, `/newsletter`) the supporting line now reads identically: "One email a week: the best live card deals right now, the cards on the move, and one sharp valuation note. No spam." Enabled by a new optional, backward-compatible `subtext?` prop on `EmailCapture` (ADR-065).

**Reconciliation with STRATEGY-AUDIENCE-MOAT "three capture surfaces."** That doc listed three surfaces feeding one list: the watchlist form, `/newsletter`, and a **footer mini-form on every page**. This ADR **retires the footer mini-form** (it competed with each page's primary ask and made every page a multi-ask surface). The model becomes: (a) the **watchlist form** on card pages (a price alert, kept), (b) the **`/newsletter`** dedicated page (kept), and (c) **one contextual ask per marketing page** (the hero or a single CTA — homepage hero, `/deals`). Net capture intent is preserved or improved (one clear ask converts better than three competing ones); only the always-on footer form is gone. The strategy doc's footer-capture row is superseded by this ADR.

**Consequences.**
- **Kept (unchanged):** the `/newsletter` capture, the per-card watchlist form (`source=watchlist-form`), the single blog-body inline capture (`blog_inline`), the homepage hero capture (`homepage_hero`), and the vending `/host` structure.
- **Homepage content footprint is leaner** (hero + HowItWorks). It is not a thin squeeze page — HowItWorks carries indexable body copy and the hero states the value prop — but it is lighter than the ADR-065 "keep all sections" guidance, a deliberate trade for focus.
- **Tests:** removed the now-invalid footer-capture + `homepage_final_cta` + `FooterEmailCapture`-suppression tests; added "homepage renders exactly ONE EmailCapture", "footer renders NO EmailCapture", "footer-email-capture component deleted", and a recursive site-wide guard (`app/` + `components/`) forbidding "Level-4/Level 4 TCGplayer …" / "TCGplayer Verified Seller" — scoped to the jargon, NOT the legitimate bare "TCGplayer seller".
- **Reversible:** re-add the footer form / restore the removed homepage sections from git; the jargon removal stands on its own.

**Cross-refs.** [ADR-065](#adr-065--homepage-reorient-email-capture-is-the-primary-conversion-goal-inline-capture-on-the-ranking-content-surfaces), [ADR-027](#adr-027--unified-email-capture-across-three-surfaces-default-checked-newsletter-opt-in-on-the-watchlist-form), [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md), [ADR-064](#adr-064--dual-track-site-deal-finder-restored-as-primary-indexed-seo-surface-vending-lead-gen-kept-at-host).

## ADR-067 — Ad-hoc single-video transcript ingestion + the `docs/knowledge/` reference base

**Date:** 2026-06-24
**Status:** Accepted. Extends [ADR-050](#adr-050--creator-content-ingestion--attribution-gate) (creator-content ingestion + attribution discipline) with (a) an explicit-video ingestion mode and (b) a new committed reference-base concept under `docs/knowledge/`.

**Context.** The creator-ingestion pipeline (`scripts/ingest-transcripts.ts`) is **channel-level + date-windowed**: it pulls `@handle/videos` for the last N days from the `active` rows of `docs/creator-whitelist.md`, and is built for the recurring Pokémon-market-signal digest. We needed to distill a **newsletter-business knowledge base** from 7 *specific*, evergreen, mixed-channel videos (My First Million, Greg Isenberg, Kit, Matt McGarry, Chris Koerner, Creator Spotlight, Brennan Wells) — which the channel/date model can't address (they're old, off-whitelist, and individually chosen). A P0 premise check confirmed: no single-video path existed; `cleanVtt` + `redactForSynthesis` are pure and reusable; this machine is residential so yt-dlp needs no cookies by default (`python -m yt_dlp` available, v2026.03.17).

**Decision.**
1. **Sibling script `scripts/ingest-videos.ts` (don't touch the channel pipeline).** A `--videos <url1,url2,...>` mode that runs yt-dlp per explicit video (`--write-auto-subs --skip-download --sub-langs en.* --sub-format vtt --no-playlist`, no `--dateafter`/playlist), reuses `cleanVtt` + `redactForSynthesis(…, BANNED_PHRASES)`, and writes cleaned `{video-id}.txt` to `docs/transcripts/_adhoc/` (gitignored, like the rest of `docs/transcripts/`). No cookies by default; `--cookies-from-browser chrome` fallback. Falls back to `python -m yt_dlp` when no bare binary.
2. **Security boundary = a strict video-id parser.** `parseVideoId()` resolves any input (watch URL / youtu.be / shorts / embed / bare id) to a strict `[A-Za-z0-9_-]{11}` id on a YouTube host, or `null`. Only a **canonical `https://www.youtube.com/watch?v=<id>` URL** built from the validated id is passed to yt-dlp, as a single **argv** element via `spawnSync` (never a shell string). So a hostile "URL" can neither inject yt-dlp flags (the element always starts with `https://`, never `-`) nor reach a shell; anything unparseable is skipped, not run. Pure functions (`parseVideoId`, `canonicalVideoUrl`, `buildVideoYtDlpArgs`) are unit-tested with no network (`lib/__tests__/ingest-videos.test.ts`), mirroring `buildYtDlpArgs`.
3. **`docs/knowledge/` reference base (committed).** Distilled, evergreen *operating doctrine* (not session logs, not transcript dumps) lives here. First entry: `docs/knowledge/newsletter-business-playbook.md`, organized by theme (list-growth, monetization economics, cadence, deliverability, subject lines, tooling, benchmarks, mistakes) with **per-claim source attribution** and a **creator-claim vs best-practice** label per ADR-050's discipline. A CLAUDE.md "Knowledge base" pointer directs future sessions (Claude Code + Cowork) to read it before newsletter / list-growth / conversion work.

**Consequences.**
- **Provenance vs commit split:** raw cleaned transcripts stay gitignored under `docs/transcripts/_adhoc/`; only the distilled playbook + the script/test are committed. The distillation paraphrases (ADR-050's >25-word verbatim cap honored); the raw text is retained locally for traceability.
- **Run outcome:** all 7 videos ingested cleanly (2.7k–17.7k words each, ~67k total; 0 captions-disabled failures). Distillation fanned out one reader per transcript, then synthesized — the playbook attributes every non-obvious claim to a titled+URL'd source.
- **Copyright posture unchanged:** same synthesis + named-attribution shape as ADR-050; the ad-hoc mode just changes *which* videos, not the redaction/synthesis rules.
- **Reusable:** future knowledge bases (e.g. local-SEO, paid-acquisition) can be built the same way — ingest specific videos → distill into a new `docs/knowledge/*.md` with attribution.

**Cross-refs.** [ADR-050](#adr-050--creator-content-ingestion--attribution-gate), `scripts/ingest-videos.ts`, `lib/__tests__/ingest-videos.test.ts`, `lib/seo/transcript-clean.ts`, `docs/knowledge/newsletter-business-playbook.md`, [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md), `docs/creator-whitelist.md`.

## ADR-068 — Foil's first lead magnet: the evergreen "Pricing Cheat Sheet" (gated on-page, data-availability-driven choice)

**Date:** 2026-06-24
**Status:** Accepted. Operationalizes `docs/knowledge/newsletter-business-playbook.md` §1 (lead magnets = best 2025 growth channel; gate a real ICP-matched asset, not clickbait). Builds on the email-capture work ([ADR-065](#adr-065--homepage-reorient-email-capture-is-the-primary-conversion-goal-inline-capture-on-the-ranking-content-surfaces) / [ADR-066](#adr-066--one-email-ask-per-page-the-global-footer-is-navlegaltrust-only-finish-the-level-4-removal-site-wide)) + [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md).

**Context + the data-availability premise check.** The goal offered a primary concept — "The Pokémon Cards People Overpay For Most," cards whose live ask sits above recent sold — and an evergreen fallback "Pricing Cheat Sheet," with instructions to pick based on what pricing data is *cleanly* available now. Investigation: the sold reference is sourced from **PokeTrace** (`compute.ts` / `refresh-batch.ts`), which was **cancelled 2026-06-16** (keys not restored in Vercel). A direct query of the `buy_signals` cache showed it was last computed **2026-06-13** (11 days stale, pre-cancellation) with **196 UNKNOWN / 6 BELOW / only 5 usable ABOVE** rows. So the "overpay" data is stale, depends on a cancelled API, would yield a 5-entry list, and would silently rot — failing the goal's "genuinely valuable AND buildable now with real (not fabricated) data" bar. Per the goal's explicit fallback rule, we shipped the **evergreen cheat sheet**.

**Decision.**
1. **The magnet = `/free/pokemon-card-pricing-cheat-sheet`**, an evergreen one-page pricing reference distilled from the *already-published* pillar content (condition guide / value calculator / Japanese value) — every figure (condition multipliers, the 3 fields, the graded ladder, when-to-grade, mistakes) is the same evergreen guidance Foil's pillars already publish, so **zero live-data dependency and zero fabrication**. Cream/navy/gold, founder voice, no em dashes, internally linked to the 3 pillars + `/cards` + `/deals`.
2. **Indexable page; gated reward.** The page ranks on a real preview (intro + "what's inside" + the full condition-multiplier table). The **complete reference reveals on subscribe**, delivered **on-page** (`LeadMagnetGate`, a client component that reuses the existing `subscribeAction` → `lib/beehiiv.ts`). **No Beehiiv send-API dependency** (free tier 403s it), **no redirect** (reveal in place → no open-redirect surface), **no new email backend**. `source="lead_magnet_cheatsheet"`.
3. **Surfaced as the capture CTA on the pillars.** The generic `pillar_*` inline `EmailCapture` on all 3 pillars was **replaced** (not added to — one ask per page, ADR-066) by `LeadMagnetCTA`, a stronger specific offer linking to the magnet page (which carries `id="waitlist"` so the pillars' existing in-body anchors still resolve). Plus one tasteful link from `/newsletter`. `/free/*` added to `PUBLIC_ROUTES` (prefix) + the sitemap.
4. **Honesty discipline (enforced by hand + a test guard).** A real asset, actually delivered. No fake scarcity / urgency / countdown, no fabricated "join N collectors" counts. `lib/__tests__/lead-magnet.test.ts` pins the negatives across the page + gate + CTA.

**Consequences.**
- **The "overpay" magnet is a follow-up,** unblocked once John restores PokeTrace and the `deals-refresh` cron repopulates `buy_signals` with fresh ABOVE rows. At that point "cards people overpay for" becomes a live, defensible, Foil-unique asset (added to ROADMAP).
- **Pillars no longer carry the `pillar_*` inline captures** (replaced by the magnet CTA); the magnet page is the single converting surface for that traffic.
- **Delivery is on-page, not emailed.** Optional John follow-up (manual, not code): wire a Beehiiv welcome automation in the dashboard to also email the asset link.
- **Scope note:** the goal mentioned "the most relevant blog posts" too; this shipped the 3 pricing pillars (the canonical pricing-research pages where the ICP lands) + `/newsletter`. Extending the magnet CTA to specific pricing blog posts is a low-risk follow-up (left to avoid changing the shared blog template for all posts).

**Cross-refs.** [ADR-065](#adr-065--homepage-reorient-email-capture-is-the-primary-conversion-goal-inline-capture-on-the-ranking-content-surfaces), [ADR-066](#adr-066--one-email-ask-per-page-the-global-footer-is-navlegaltrust-only-finish-the-level-4-removal-site-wide), [ADR-054](#adr-054--todays-best-deals-public-leaderboard), [ADR-027](#adr-027--unified-email-capture-across-three-surfaces-default-checked-newsletter-opt-in-on-the-watchlist-form), `docs/knowledge/newsletter-business-playbook.md`, [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md).

**Amendment (2026-06-26, `cheat-sheet-flow-fix`).** The magnet is no longer gated-webpage-text-only; it now ships a **real keepable PDF** at `public/free/foil-pokemon-card-pricing-cheat-sheet.pdf` (Cowork-built, cream/navy/gold, distilled from the same pillar content — no fabricated figures), and delivery is **un-gated for people who already subscribed.** Two changes: (1) the `LeadMagnetGate` success reveal now renders a prominent "Download the cheat sheet (PDF)" button (optional `downloadHref` prop → a same-origin `/public` link, `download` + new tab; still no redirect/new backend, so the no-open-redirect + on-page-delivery invariants of decision #2 hold); (2) the `/free/...` page carries an honest "Already subscribed? Download the PDF" escape hatch near the top — the path the Beehiiv welcome email links to. **The fix John caught:** the welcome email (sent to people who *already* subscribed) pointed at the gate, which asked them to subscribe *again* — a trust-eroding contradiction. The gate stays for cold SEO traffic (the email-capture trade is unchanged); subscribers now have a no-gate route to the asset. The PDF is public on two levels — the `/free/*` `PUBLIC_ROUTES` prefix covers it, AND the `proxy.ts` matcher excludes `.pdf` so static-asset requests bypass middleware entirely (pinned in `proxy.test.ts`). Beehiiv repointing is Cowork's out-of-repo follow-up.

## ADR-069 — Insight-led market-movers / "good buys" signal (aggregate momentum over fragile single listings) + the like-for-like currency gate

**Date:** 2026-06-25
**Status:** Accepted. Implements the insight-led reframe in [STRATEGY-DATA-INSIGHT-ENGINE.md](STRATEGY-DATA-INSIGHT-ENGINE.md). Extends [ADR-054](#adr-054--todays-best-deals-public-leaderboard) (the /deals board) and the ADR-053/ADR-057 like-for-like buy-signal gates.

**Context — the motivating bug.** The live `/deals` board flagged "Umbreon VMAX 215/203 · Near Mint · $2,161 · 31% below sold," but the listing it pointed to was a **£1,000, Lightly Played, UK** card via the Global Shipping Program — an LP/UK/GBP listing scored against an NM/USD comp. A **single-listing** signal is fragile by construction: one mismatched condition/region/currency publishes a *false* deal, which on a trust-first brand is the worst failure mode. The deals batch (`refresh-batch` → cheapest `getBestListing` → `computeCardBuySignal`) had no currency gate, and `marketFromAspects` only checks `Language==="english"` (a UK listing IS English), so a GBP ask flowed straight into a numeric comparison against a USD reference.

**Decision.**
1. **Lead with market-level movement, not single listings.** New PokeTrace-only momentum signal: for each curated card, read the deepest-NM printing's windowed sold averages and compute `momentum = (avg7d - avg30d) / avg30d` at the `NEAR_MINT` tier. Classify **"good buy (down)"** when avg7d is ≥ 8% below avg30d AND `saleCount ≥ 5` (thin/noisy cards excluded); a secondary **"heating up (up)"** list surfaces the inverse. An aggregate cannot break the way one mispriced listing can. `lib/deals/market-movers.ts` is pure + injectable (mirrors `refresh-batch.ts`); momentum spends **no eBay quota** (R-012 N/A).
2. **Persist + cron.** New `market_movers` current-state cache (UPSERT per slug; read filtered to down/up + a 36h freshness window) and an **append-only `market_snapshots`** table (one row per card per day) that seeds the time-series for week-over-week movers later at near-zero cost. New daily cron `/api/cron/market-movers` (09:00 UTC; same bearer-secret contract; a 28-req/10s sliding-window limiter respects the PokeTrace burst ceiling; **curated tier only** — the full catalog exceeds the 300s function budget at a safe rate and expands later off the snapshots).
3. **`/deals` becomes insight-led.** The page leads with "Good buys this week" (the movers board, **card-level eBay BROWSE affiliate-search links**, never single listings) and **demotes** the single-listing "below sold right now" board to a secondary section.
4. **Like-for-like currency gate (the Moonbreon fix).** `computeCardBuySignal` gains a `listingCurrency` pre-gate: a non-USD ask → UNKNOWN (the sold reference is USD; a cross-currency comparison is apples-to-oranges). Threaded from `refresh-batch` (`listing.currency`) and the per-card page (`verified.currency`) — the I-008 shared-classifier location, so both surfaces are covered. R-010 fixture `12-moonbreon-uk-gbp-lp.json` + a test pin that the LP/UK/GBP listing is never flagged.
5. **Newsletter digest.** `lib/newsletter/movers-digest.ts` is a **deterministic** (no-LLM) serializer of the movers signal into a paste-ready `docs/newsletter-drafts/` file — every figure is a real PokeTrace aggregate, so fabrication is structurally impossible (the strongest form of the R-001 honesty discipline). `scripts/generate-movers-digest.ts` is the entry point John runs post-deploy. Card-level browse links + the cheat-sheet lead-magnet CTA; dealer voice; no em dashes.

**Honesty discipline (enforced in code, not by an LLM).** Every number is a real PokeTrace aggregate; sample-size gated; "good buy" is framed as a *candidate trading below its own recent average*, never a guarantee. The digest test asserts every `$`-figure traces to an input aggregate.

**Consequences.**
- **PokeTrace is now CORE, not optional** — the entire insight layer runs on its windowed aggregates. The key (cancelled 2026-06-16, valid ~until July 15) is load-bearing; the signal soft-fails to an empty board/digest without it, and **degrades to empty after ~July 15 unless re-subscribed.**
- **Two surfaces now share the currency gate**; a GBP (or any non-USD) listing can never again be classified as a deal on either the board or a card page.
- **The append-only snapshot store** is the unlock for the deferred week-over-week / longtail-expansion work (compute movers from stored history, far fewer live calls) — gated on accumulation.
- **A 5th Vercel cron** (the project already runs 4, so the plan supports it). The movers cron is independent of `deals-refresh` (different data source + failure mode).
- **Follow-ups:** longtail momentum expansion off the snapshots; week-over-week "cards on the move"; feeding the X bot the movers board; the recurring auto-digest (full auto-send stays manual — free-tier Beehiiv send API is blocked).

**Cross-refs.** [STRATEGY-DATA-INSIGHT-ENGINE.md](STRATEGY-DATA-INSIGHT-ENGINE.md), [ADR-054](#adr-054--todays-best-deals-public-leaderboard), [ADR-053](#adr-053--buy-signal-mvp--gate-13-anti-hype), [ADR-057](#adr-057--buy-signal-like-for-like-via-ebay-item-specifics-condition-coverage--languagemarket-gate), [ADR-068](#adr-068--foils-first-lead-magnet-the-evergreen-pricing-cheat-sheet-gated-on-page-data-availability-driven-choice), [R-008](RISKS.md), [R-012](RISKS.md).

## ADR-070 — Modern-set catalog expansion (unblocked by the PokeTrace-only movers signal) + the volume/materiality filter

**Date:** 2026-06-25
**Status:** Accepted. Implements the "Catalog coverage" section of [STRATEGY-DATA-INSIGHT-ENGINE.md](STRATEGY-DATA-INSIGHT-ENGINE.md). Builds on [ADR-069](#adr-069--insight-led-market-movers--good-buys-signal-aggregate-momentum-over-fragile-single-listings--the-like-for-like-currency-gate) (the movers signal) + [ADR-046](#adr-046--tiered-per-card-rendering--catalog-expansion-to-1000-cards) (the rank/expand pipeline).

**Context.** The catalog skewed vintage WOTC + 2021–23; the only SV-era set was `sv3pt5` (151). Modern SV/Mega-era sets are where search + sales volume actually are. The old expansion was gated on the **eBay Browse quota** — but the new movers signal is **PokeTrace-only**, so that gate is **moot for the insight product** (per-card pages are demand-driven; movers spends no eBay quota). Separately, the board surfaced sub-$3 bulk ("Shaymin V down 17%" = a $0.34 move), which made "good buys" feel weak.

**Decision.**
1. **Expand into modern high-demand sets, materiality-floored.** Verified the **exact SDK set IDs** against pokemontcg.io before adding (per AGENTS.md — no guessing): Prismatic Evolutions `sv8pt5`, Surging Sparks `sv8`, Mega Evolution `me1`, Journey Together `sv9`, Destined Rivals `sv10`, Stellar Crown `sv7`. Ranked by SDK TCGplayer price and appended the **183 cards ≥ $5** (the chase: Prismatic eeveelution ex SIRs, Surging Sparks Pikachu ex, etc.) to the long-tail. **Chaos Rising `me4` is in the SDK but has 0 priced cards yet** (released 2026-05-22; TCGplayer prices haven't populated) — deferred, listed in the mover-set allowlist for when prices land. Extended `scripts/expand-catalog.ts` with **`--append`** (preserves the existing 800 long-tail entries — no live `/cards/[slug]` URL is dropped, an SEO regression) + **`--min-score`**. Re-baked SDK metadata (1189/1190) + PokeTrace UUIDs for the new cards.
2. **Volume/materiality filter on the movers signal.** `classifyMomentum` keeps the `saleCount ≥ 5` gate AND adds `MOVER_MIN_NM_VALUE = $10`: a card whose NM 30-day average is under $10 never surfaces (a "good buy" there is a sub-dollar move — not material, and it makes the board read as bulk). The 30-day average (not the volatile 7-day) is the value baseline.
3. **Movers universe = curated + modern chase.** The cron's universe widened from curated-only to `curated ∪ {cards in MODERN_MOVER_SET_IDS}` (~210 + 183 ≈ 393), bounded by `MAX_MOMENTUM_CARDS = 460` so it fits one ~300s run at the safe PokeTrace rate (~500–600 calls / 2.8 req/s ≈ 180–210s). No pagination needed at this size.
4. **Affiliate-tagged browse links (verified, folds in the earlier finding).** The board + digest "Browse on eBay" search URLs already route through `affiliateSearchUrl → buildAffiliateUrl`, which stamps the EPN `campid` (`EBAY_CAMPAIGN_ID`, configured in Vercel prod+dev) + a per-card `customid`. A new test pins that the digest's links carry `campid`/`customid`/EPN params when the env var is set — so the "affiliate" disclosure is accurate (clicks actually earn). No false disclosure.

**Consequences.**
- **Catalog: 1,007 → ~1,190 cards** (210 curated + ~983 long-tail), now spanning the modern chase. More SEO surface + a movers universe with liquid modern cards.
- **The eBay-quota gate on expansion is retired for the insight product** (movers = PokeTrace-only). ROADMAP #29 updated.
- **Runtime is now PokeTrace-bound** (~180–210s/run); a much larger future expansion would need pagination (rolling window) + a wider freshness window — a tracked follow-up.
- **`me4` (Chaos Rising) auto-joins** once TCGplayer prices populate and a re-rank/expand picks it up (it's already in the allowlist).
- **PokeTrace remains load-bearing** (key valid ~until July 15); the signal soft-fails to empty without it.

**Cross-refs.** [ADR-069](#adr-069--insight-led-market-movers--good-buys-signal-aggregate-momentum-over-fragile-single-listings--the-like-for-like-currency-gate), [ADR-046](#adr-046--tiered-per-card-rendering--catalog-expansion-to-1000-cards), [ADR-047](#adr-047--ssgisr-hybrid-rendering--metadata-only-tier-for-the-18k-long-tail), [STRATEGY-DATA-INSIGHT-ENGINE.md](STRATEGY-DATA-INSIGHT-ENGINE.md).

## ADR-071 — X content-bot APPROVAL mode (auto-draft → owner approves in Discord → auto-post)

**Date:** 2026-06-26
**Status:** Accepted. Extends [ADR-058](#adr-058--daily-x-content-bot-dry-run-first-own-posts-only-satori-image-not-playwright) (the daily X bot). Implements `docs/goals/x-approval-gate.md`.

**Context.** ADR-058's bot was binary: `dry_run` (drafts to Discord, never posts) or `X_BOT_LIVE=true` (auto-posts, no review). John wants "I'll approve, but I won't write or post them myself" — a human-in-the-loop gate that's neither writing nor full-auto. Needed: a third mode where the bot drafts daily, the owner approves with one Discord action, and only then does the bot post.

**Decision.**
1. **Three modes via `X_BOT_MODE` = `dry_run | approval | live`** (`lib/social/mode.ts`). Precedence: `X_BOT_MODE` wins when valid (case-insensitive); else the legacy `X_BOT_LIVE=true` still maps to `live` (back-compat); else `dry_run` (safe default). `runXBot` (`lib/social/bot.ts`) switched from `live: boolean` to `mode`. The safety invariant holds and widened: `deps.post` (the X boundary) is called ONLY in `live`; in `approval` the cron NEVER posts — it persists + asks.
2. **Mechanism = the Foil HQ Discord bot (`bot/` subtree), not a Next interaction-webhook.** The bot already has a live gateway + slash-command infra + the owner's Discord identity. Owner-gated `/approve <id>` and `/skip <id>` slash commands relay the decision to a bearer-secured Next endpoint. Rejected the interaction-webhook alternative: it needs Ed25519 signature verification AND a bot application to attach button components (plain webhooks can't), so it's strictly more complex; the slash command also can't be auto-triggered by URL prefetch the way an "approve link" could.
3. **The X boundary stays on ONE runtime (Vercel).** The bot is a thin relay: it POSTs `{id, action, actor}` to `/api/x/approve` (Bearer `X_APPROVE_SECRET` — a DEDICATED secret, not `CRON_SECRET`, so the bot's blast radius is X-approvals only), which calls `postToX` (`lib/social/x-client.ts`, still the sole X caller). X creds never leave Vercel; Railway never touches the X API.
4. **The persisted draft IS the posted draft.** New `x_post_drafts` table (service-role only, RLS-isolated like `bot_messages` per ADR-013) holds the exact text + the rendered portrait (base64). In approval mode the cron persists this, then sends an approval-request embed (with the draft id) to `#content-engine`. The approve path posts the persisted bytes verbatim — never re-generates — so the approved post can't drift from the shown one even if the deals data moves between draft and approval.
5. **Safety rails, enforced in code + tested.** Owner-only (`isApprovalOwner` is fail-closed — unset `X_BOT_OWNER_DISCORD_ID` locks everyone out). Pending drafts expire after `DEFAULT_APPROVAL_EXPIRY_HOURS = 12` → auto-skip, NEVER auto-post on timeout (the cron sweeps stale drafts, and `claimForPosting` is expiry-guarded). Idempotent: `claimForPosting` is an ATOMIC conditional update (`pending` + not-expired → `posting`) returning the row, so a double-approve/retry claims at most once; a post that then fails RELEASEs back to `pending` for a clean re-approve.

**Consequences.**
- **Enablement is multi-surface** (John, at deploy): apply the migration (`supabase db push`); set `X_BOT_MODE=approval` + `X_APPROVE_SECRET` on Vercel; set `X_APPROVE_SECRET` + `X_BOT_OWNER_DISCORD_ID` (+ optional `FOIL_APP_URL`, defaults `https://foiltcg.com`) on the bot's Railway env; redeploy the bot (`git push` → Railway) so the new slash commands register. See `docs/runbooks/x-bot.md`.
- **The approve path is testable end-to-end** without Discord/Supabase/X: `processApproval` + `InMemoryDraftStore` + an injected poster. `lib/__tests__/x-bot-approval.test.ts` pins mode precedence, never-post-without-approval, post-the-persisted-bytes, expiry auto-skip, double-approve-posts-once, skip, and post-failure-release. The bot owner-gate + relay are pinned in `bot/src/__tests__/approve-command.test.ts`.
- **`live` (full auto) stays available** as the later graduation once John trusts the voice; flipping `X_BOT_MODE=live` (or the legacy `X_BOT_LIVE=true`) is the one-line change.
- **Two posting runtimes are NOT introduced** — only Vercel posts. The bot can only *ask* Vercel to post, via the authenticated endpoint.

**Amendment (2026-06-27) — enablement completed; the `/approve`+`/skip` commands weren't registered in prod.** Symptom: John ran `/approve <id>` and the bot showed only `/reset`,`/recall`,`/help`. Diagnosis (evidence, not theory): the handler code + `COMMAND_DEFS` already included `approve`/`skip` (commit `935ed6a`) and were on `origin/main`, but the running bot was **stale** — Railway's GitHub auto-deploy had not fired the new code until the current session's push redeployed it (foil-bot now SUCCESS at the HEAD commit; the old `redeploy-railway.ts` "auto-deploy isn't firing" note is itself stale — the integration is connected again). Railway env was checked via `lib/railway-api.ts` GraphQL: `X_APPROVE_SECRET` (64-char) + `X_BOT_OWNER_DISCORD_ID` (18-digit) are **set**, and the secret was confirmed to **MATCH Vercel's** end-to-end (a relay-simulating POST to the live `/api/x/approve` with Railway's value returned `draft_not_found`, not `401`). The remaining gap was that `registerSlashCommands` registered **globally** (`DISCORD_GUILD_ID` unset) — ~1h propagation, and the stale set lingers meanwhile. **Fix (code):** `registerSlashCommands` now registers **guild-scoped to every guild the bot is joined to** (`client.guilds.cache`, available at ClientReady) when `DISCORD_GUILD_ID` is unset → instant registration on deploy, no extra config; falls back to global only if no guild is cached. Pinned by a pure `resolveRegistrationGuildIds` + tests. **This must be PUSHED** to redeploy the bot (Railway auto-deploys on push to main); on the next deploy `/approve`+`/skip` appear immediately. No Vercel/Railway secret change (already set + verified). The Blastoise draft `18b2d14e…` is the pre-v2.1 version — let it auto-skip; verify the live `tweet_video` upload on the first polished card.

**Cross-refs.** [ADR-058](#adr-058--daily-x-content-bot-dry-run-first-own-posts-only-satori-image-not-playwright), [ADR-013](#adr-013--foil-hq-discord-ops-bot-as-a-separate-railway-service), [ADR-014](#adr-014--all-outbound-discord-notifications-through-one-module), `docs/runbooks/x-bot.md`, `docs/goals/x-approval-gate.md`, `docs/goals/x-approval-bot-enablement.md`.

## ADR-072 — X deal-angle sources from the fresh movers signal (no phantom deals) + post-metrics capture

**Date:** 2026-06-27
**Status:** Accepted. Extends [ADR-058](#adr-058--daily-x-content-bot-dry-run-first-own-posts-only-satori-image-not-playwright) (the X bot), [ADR-069](#adr-069--insight-led-market-movers--good-buys-signal-aggregate-momentum-over-fragile-single-listings--the-like-for-like-currency-gate) (movers signal), [ADR-071](#adr-071--x-content-bot-approval-mode-auto-draft--owner-approves-in-discord--auto-post) (approval mode). Implements `docs/goals/x-bot-followups.md`.

**Context — the live failure.** The first approval draft (ADR-071) claimed *"Alakazam ex (151) LP is listed 43% below its sold price of $70.29."* The live card page showed the best listing at $69.17 NM, only ~11% below the NM sold avg — **there was no 43%-below deal**. It was a phantom from the **stale `buy_signals` table** (last computed 2026-06-13; PokeTrace cancelled 2026-06-16). The `deal_of_day` angle read `buy_signals` (single-listing "below sold"); the *fresh* signal (`market_movers`, daily 09:00 cron) that powers `/deals` + the newsletter wasn't used. It also mislabeled an NM card as LP (the stale row's `matched_tier`).

**Decision.**
1. **Repoint the deal angle to `market_movers`** (Part 1). `getDealsForPost` now reads the fresh down-movers (cards trading below their OWN 30-day sold average) instead of the stale `buy_signals` leaderboard. The post reframes to the honest aggregate framing — *"Near Mint copies are ~12% below their 30-day sold average across N recent sales"* — not a single-listing "X% below sold" claim. A market aggregate can't break the way one mispriced listing can (the ADR-069 thesis), and movers are NEAR_MINT by construction, so the LP-style condition mislabel is structurally impossible. The deal image labels match ("below 30-day avg").
2. **Freshness guard.** `freshDeals(movers, nowMs, MAX_DEAL_AGE_HOURS=48)` (pure, tested) excludes any source row older than 48h, so a stale board can never produce a deal — it falls through `resolveAngle` → spotlight → educational. The spotlight's `buy_signals` read gets the same guard (a stale price is as misleading as a stale deal). Defense-in-depth over getMarketMovers' own 36h window.
3. **Post-metrics capture** (Part 2, capture-only precursor to the deferred self-learning loop). New `x_post_metrics` table (RLS-isolated, service-role only) holds one row per posted draft. New `/api/cron/x-metrics` (16:00 UTC) finds posts ≥48h old lacking metrics, fetches `public_metrics` once via `fetchTweetPublicMetrics` (the single x-client boundary; `GET /2/tweets?ids=&tweet.fields=public_metrics`, OAuth 1.0a, ~$0.005/call), stores likes/reposts/replies/quotes/impressions, and marks deleted tweets. The tweet id was already persisted (`x_post_drafts.post_id` from approve time) — no new column there. **No generation change.**

**Consequences.**
- **The bot degrades safely while PokeTrace is down/stale** — the deal angle uses the still-fresh movers signal (the movers cron is PokeTrace-fed but runs daily), and the freshness guards stop any stale source from posting. But **fresh deal data still depends on restoring PokeTrace** (the ~July 15 key cliff); if movers also goes stale, the deal angle falls through to educational rather than posting a phantom.
- **No new env var** — reuses the X creds, `CRON_SECRET`, and Supabase service role. A 6th Vercel cron (`x-metrics`) joins the existing five.
- **The metrics dataset accrues from day one**; the actual outperformers→traits→prompt feedback loop stays deferred (out of scope) until there are weeks of posts + real traffic.
- **Tests:** `lib/__tests__/x-bot-deal-freshness.test.ts` (freshness exclusion, fall-through, honesty/no-mislabel) + `lib/__tests__/x-metrics.test.ts` (fetch parse + deleted detection, run records/marks/idempotent/soft-fail).

**Cross-refs.** [ADR-058](#adr-058--daily-x-content-bot-dry-run-first-own-posts-only-satori-image-not-playwright), [ADR-069](#adr-069--insight-led-market-movers--good-buys-signal-aggregate-momentum-over-fragile-single-listings--the-like-for-like-currency-gate), [ADR-071](#adr-071--x-content-bot-approval-mode-auto-draft--owner-approves-in-discord--auto-post), `docs/goals/x-bot-followups.md`, `docs/IDEAS.md`.

## ADR-073 — Card-hero X image: real card art over a sharp-derived "world" (Satori can't blur) + the weekly board

**Date:** 2026-06-27
**Status:** Accepted. Extends [ADR-058](#adr-058--daily-x-content-bot-dry-run-first-own-posts-only-satori-image-not-playwright) (the Satori image path) and [ADR-072](#adr-072--x-deal-angle-sources-from-the-fresh-movers-signal-no-phantom-deals--post-metrics-capture) (the fresh-movers data source). Implements Phase 1 of `docs/goals/x-flywheel-card-hero-and-homepage.md`; design validated over 8 prototype rounds + a virality scoring pass vs @getcollectr (card-hero 8.35 > board 7.75). References committed under `docs/social/ref/`.

**Context.** The X bot's image was a generic deals "board." The validated upgrade is a **card-hero**: the REAL card art, large and lifted, over a background derived from the card's OWN art — so a blue card yields a blue world, a Charizard a warm one, always carrying Foil's navy/gold identity (the answer to "match Collectr's card-themed backgrounds while staying on-brand"). The technical blocker: **Satori (next/og) cannot Gaussian-blur**, and the design needs a heavy-blurred card-derived background.

**Decision.**
1. **Two-step render (the blur constraint).** The card's "world" background is pre-rendered with **sharp** (`lib/social/card-bg.ts`, a direct port of `docs/social/ref/card-hero-prototype.py::derived_bg`): cover-fill the art → heavy blur → darken → blend a 28% navy undertone → a dominant-color glow halo → vignette, all via sharp composite + SVG radial gradients. Satori then composes the **sharp card art + text over** the finished background. The card's drop-shadow + dominant-color glow halo use Satori's native **box-shadow** (supported), and the giant number uses **text-shadow** — only `filter: blur()` is unavailable, and that's exactly what sharp handles.
2. **Real card art, soft-fail.** Art is the `market_movers`/`buy_signals` `image_url` (threaded onto `DealData`/`SpotlightData`), fetched by `lib/social/card-art.ts` (soft-fails to null). A missing/broken URL drops the card-hero to the board, then text-only — **never an artless hero**.
3. **Brand font correction.** The goal named Bricolage Grotesque, but ADR-036 replaced it with Fraunces and the wordmark is **Fredoka** (ADR-055). The card-hero uses **Fredoka** for the lockup + the giant number (matching the existing renderer + the FoilTCG identity), slate sans for support text. The red ▼ is a CSS-border triangle (no font-glyph dependency), **stacked above** the number (the prototype's centering fix). White number default; `goldNumber` toggle. Slogan `FIND. TRACK. SAVE.` is from the ref (John-editable).
4. **Angle wiring.** `deal_of_day` / `price_spotlight` → the **card-hero** (single card). A new **`weekly_board`** angle (a UTC-Monday day-of-week override when ≥3 fresh movers exist) → the **board**, rebuilt to `board-ref.png` (real thumbnails, DARK navy names on light rows, red ▼ + gold %, long-name clamp). Data stays the ADR-072 fresh-`market_movers` + freshness-guard source.

**Consequences.**
- **Verification boundary:** the sharp background is unit-tested + was rendered for a real card (Blastoise → correct teal-blue world). The Satori composition compiles (build) + is structurally pinned (anchors), but Satori can't run under `node --strip-types`, so the **final pixel match to the refs is reviewed at deploy** via the `#content-engine` draft (the established X-bot image-review path) — consistent with how every prior bot image was reviewed.
- **Per-image cost:** one art fetch + a sharp pipeline + Satori, well within the cron's 120s budget for one image.
- **Phase 2 (homepage "Latest from X" flywheel) is deferred** — its own follow-on, kept below the email capture so it never dilutes the email moat.

**Cross-refs.** [ADR-058](#adr-058--daily-x-content-bot-dry-run-first-own-posts-only-satori-image-not-playwright), [ADR-072](#adr-072--x-deal-angle-sources-from-the-fresh-movers-signal-no-phantom-deals--post-metrics-capture), [ADR-036](#adr-036--home-page-warmth-pass-fraunces--floral), [ADR-055](#adr-055--brand-refresh-foiltcg-wordmark--foil-corner-card-mark-pokeball-retired), `docs/goals/x-flywheel-card-hero-and-homepage.md`, `docs/social/ref/`.

## ADR-074 — Card-hero v2: lock the static frame (number outline, slogan removal, no-overlap layout); motion spiked before building

**Date:** 2026-06-27
**Status:** Phase 0 (static finalization) **Accepted**. Phase 0.5 (motion spike) **Accepted** (findings below). Phase 1 (motion as the standard, MP4) **Accepted + Built 2026-06-27** (John signed off the spike's GO-WITH-CHANGES; decision below). Extends [ADR-073](#adr-073--card-hero-x-image-real-card-art-over-a-sharp-derived-world-satori-cant-blur--the-weekly-board) (the card-hero render), [ADR-058](#adr-058--daily-x-content-bot-dry-run-first-own-posts-only-satori-image-not-playwright) (the X image path), [ADR-072](#adr-072--x-deal-angle-sources-from-the-fresh-movers-signal-no-phantom-deals--post-metrics-capture) (the data source). Implements `docs/goals/x-card-hero-v2-motion.md`.

**Context.** ADR-073's card-hero shipped as a strong first pass. John's deploy review surfaced three finalization fixes; the static frame must be locked first because it is both the permanent **fallback** (motion soft-fails to the still) and the **base frame** any motion layer animates.

**Decision (Phase 0 — `lib/social/post-image.tsx::renderCardHeroImage`).**
1. **Number legibility — white fill + bold layered black outline.** The giant number kept only a soft drop-shadow, which washed out on light card-derived worlds. It now carries an 8-direction black `text-shadow` outline (`±3px` offsets) **plus** the existing soft drop-shadow (`NUM_OUTLINE`). A layered `text-shadow` is the **Satori-reliable** way to fake a stroke — `WebkitTextStroke` support in Satori is partial/historically flaky, so it is *not* relied on (the spike re-checks it as a possible future simplification). Default stays **white** (John's pick); the `goldNumber` toggle is retained, unused. The subline got a lighter (`±1.5px`) outline for legibility (`SUBLINE_OUTLINE`); support line + CTA unchanged.
2. **Slogan removed.** `FIND. TRACK. SAVE.` was lifted from a competitor and must not ship — deleted from the template (it lived only as a hardcoded string in `post-image.tsx`, no `hero-fields.ts` field). The lockup was re-centered (`top: 60`) so the top doesn't read orphaned. A drift guard (`assert.doesNotMatch(/FIND\.|TRACK\.|SAVE\./)`) ensures it can't return.
3. **Red ▼ overlap fixed by layout.** Root cause (geometry, reproduced): with `cardW=636 / top=168`, real 734×1024 art gave card-bottom ≈1055, while the bottom-anchored number column pushed the red ▼ to ≈982 — ~73px *inside* the card's flavor-text region. Fix: shrink the card (`CARD_W 636→588`) + raise it (`CARD_TOP 168→146`) → card-bottom ≈966, and **TOP-anchor** the number band (`NUMBER_BAND_TOP=1000`) so it sits in a clear lower band (~34px gap). Pinned by a structural test that computes worst-case card-bottom (734×1024 ratio) and asserts it is above the band.

**Consequences.**
- Same verification boundary as ADR-073: build-validated + structurally pinned; the final pixel match is John's deploy-time `#content-engine` review. The static frame is committed on its own (independently shippable + the motion fallback).
- The motion build (Phase 1) is **not** bundled here — it is gated on the Phase 0.5 spike below + John's sign-off, because in-cron video encode has real infra risk (function time/memory/output-size limits, a new X upload path, Discord clip preview).

**Phase 0.5 motion spike (findings + go/no-go).** Measured 2026-06-27 (throwaway sharp harness, since removed). **Architecture:** motion = 1 static base (the Phase 0 still) + N cheap sharp shimmer composites (~25ms/frame) + 1 encode — NOT N Satori re-renders. **Encode budget is fine** (well under Vercel's 300s cron): in-process GIF via sharp works (24f→9.1MB/14.7s … 36f→13.5MB/18.8s local), but **animated WebP is impossible via sharp** (the stacked-strip busts WebP's 16383px dimension cap). **GIF is the wrong format** on three axes: X caps GIF resolution at 1280×**1080** (our portrait 1080×1350 must downscale; [X best-practices](https://docs.x.com/x-api/media/quickstart/best-practices)); 256-color banding reads "cheap" (off-brand per PRODUCT.md); and a 9–13MB GIF busts Discord's now-10MB free-tier attachment cap so the approval card can't preview it. **MP4** (H.264, portrait 720×1280, `media_category=tweet_video`, chunked async upload) is ~1–3MB → fits X (≤512MB), Discord's inline preview, and `x_post_drafts` base64 cleanly. **Recommendation: GO-WITH-CHANGES — Phase 1 = MP4 (H.264) motion, still as the guaranteed fallback at every layer.** Net cost: +1 encode dep (ffmpeg-wasm / WASM H.264, ~25–30MB — under Vercel's 250MB unzipped function limit; Phase 1 adds a bundle-size gate) + a chunked async upload path inside the single `x-client.ts` boundary. No data/generation change (reuses ADR-072 movers). **Phase 1 is held for John's explicit sign-off.**

**Decision (Phase 1 — motion as the standard, built 2026-06-27).** Motion is now the default media for the `deal_of_day` / `price_spotlight` card-hero posts, with the Phase 0 still as the guaranteed fallback at every layer. Architecture per the spike: **1 static base (the Phase 0 still) + N cheap sharp shimmer composites + 1 MP4 encode**, NOT N Satori re-renders.
- **Motion design (restrained — soft-skill register, not crypto-flash):** one feathered diagonal **holo shimmer** band sweeping across the frame once per ~2.5s loop (`lib/social/card-motion.ts`; 60 frames @ 24fps, additive `screen` blend, peak opacity 0.3). The band travels off-frame→off-frame so the first/last frames are band-free → a **seamless** autoplay loop. The **number and arrow stay STATIC** (the data is the message; animating the % reads gimmicky). 864×1080 (0.8× the Phase 0 1080×1350 → identical 4:5 composition, both even for H.264, max dim ≤ X's 1280 cap, aspect within X's 1:3..3:1).
- **Format = MP4 (H.264).** `lib/social/mp4-encoder.ts` wraps `h264-mp4-encoder` (a self-contained WASM encoder, ~1.7MB, no native build), the single encode boundary. Measured: a real 60-frame clip encodes in ~4.4s (synthetic) end-to-end — far under Vercel's 300s cron / the route's `maxDuration=120`. GIF was rejected in the spike (X 1280×1080 cap forces a portrait downscale; 256-color banding is off-brand; 9–13MB busts Discord's 10MB preview). The dep is **dynamically imported** + listed in `next.config.ts` `serverExternalPackages` (same treatment as `sharp`) so a missing/broken encoder can't break `build`/`tsc` and only loads when motion renders. A **bundle-size gate** (`card-hero-motion.test.ts`) pins the dep + its build size.
- **Upload = chunked async video** (`x-client.ts::uploadVideoMedia`): INIT→APPEND(1MB)→FINALIZE→STATUS-poll on `api.x.com/2/media/upload`, `media_category=tweet_video`, per docs.x.com (fetched 2026-06-27). Stays inside the single X boundary. **VERIFY-ON-ENABLE** like the image path (OAuth 1.0a + the v2 multipart endpoint must be confirmed with one real upload before live).
- **Still-fallback at EVERY layer (the load-bearing safety property, all tested):** encode failure / non-image still / missing art → `renderCardHeroMotion` returns null → the still posts; **video upload reject → `postToX` falls back to uploading the persisted still** (so a post is never empty). The approval draft persists BOTH the still (`image_base64`) and the clip (new nullable `video_base64` column, migration `20260627130000`); the approve path posts the exact reviewed clip with the still as the upload-reject fallback. Discord (`postDiscordMedia`) inline-previews the MP4 in the dry-run/approval card so John sees the real motion before `/approve`.
- **No data/generation change** — reuses the ADR-072 fresh-movers source; this is purely a render+upload change.

**Consequences (Phase 1).** +1 encode dependency (contained behind `mp4-encoder.ts`, external-bundled, bundle-size-gated) + the chunked async upload surface (contained in `x-client.ts`). The motion path can never produce a contentless post (still fallback at render, encode, upload-reject). Final pixel/motion quality is John's deploy-time `#content-engine` review of the first prod clip (the established image-review loop, now a clip). Remaining VERIFY-ON-ENABLE: one real `tweet_video` upload with live creds before flipping to live; the openh264 encoder emits Constrained Baseline/Main (X recommends High but historically accepts baseline) — confirm at that review.

**Decision (v2.1 — polish from John's review of the first live approval card, built 2026-06-27).** The MP4 motion + still both rendered (first real approval card: Blastoise Base Set, `deal_of_day`). Three fixes from the review. Implements `docs/goals/x-card-hero-v2.1-polish.md`.
1. **Red ▼ removed entirely.** It encoded as a small red *rectangle* (not a triangle) in the MP4 frame — the CSS-border-triangle trick does not survive the H.264 encode. Rather than chase the triangle, the arrow was deleted from the still template (`renderCardHeroImage`) and the `showArrow` field dropped from `HeroFields` + both `heroFieldsFor*` builders; the motion path shimmers over the still, so removing it from the still removes it from the clip. The giant "% below" number + the "below its 30-day sold average" subline already carry the down read. Structural tests flipped to assert the ▼'s ABSENCE.
2. **Background simplified — gradient, not a blurred world.** The v2.0 derived "world" (cover-fill → heavy blur → darken → navy tint → glow → vignette) read as a muddy blurred screenshot of the card behind itself. `card-bg.ts::deriveCardBackground` now builds a CLEAN two-stop vertical gradient (brand navy → navy *tinted* by the card's `dominantColor`, `TINT_WEIGHT=0.4`) plus the soft dominant-color glow halo behind the card (the one part that read as premium, kept). The blurred card cover + heavy vignette are gone; `deriveCardBackground` no longer takes the art buffer (it derives from the dominant color only), which is what the dims-unchanged / gradient-not-blur test pins.
3. **Post copy reworked for virality (the generation prompt, not a one-off) + link in the first reply, not the body (Fix 3b).** The `deal_of_day` + `price_spotlight` prompts (`post-text.ts`) were restructured to four beats — hook-first line / the volume read the image can't show (e.g. "51 sales = a real trend, not one lowball seller") / teach one mechanic / a light forward-looking conversation hook — with literal blank lines between beats. A new pure gate (`post-structure.ts::checkPostStructure`, the single post-text quality gate, composing `voiceCheck` + the structural rules) asserts >=3 beat-separated blocks, a link-free body, no em dash, no banned hype, and that the copy adds interpretation rather than restating the image's three numbers; it runs inside `generatePostText` for the card-hero angles and is unit-pinned (`x-post-structure.test.ts`). **Link-in-reply (Fix 3b):** X throttles posts that contain a link, so every post body is now link-free and the card/board link is posted as the FIRST REPLY. `x-client.ts` gained a `createPost(text, { mediaId?, inReplyToTweetId? })` helper (reply via `reply.in_reply_to_tweet_id` per docs.x.com/x-api/posts/creation-of-a-post, fetched 2026-06-27) and a `linkReply` input; `postToX` posts the link-free main tweet then a best-effort threaded reply (a reply failure never fails the post — the main tweet is already live, reported via `replyId`). `linkReply` threads through `bot.ts` (live) + `approval.ts` (the persisted `draft.link`) + the cron/approve route lambdas. Cost note: a link-free main (~$0.015) + a link-bearing reply ($0.20) ~= $0.215/thread vs $0.20 for one post-with-link.
- **Reconciliation flagged at the premise check:** the goal's validated example contained "around $120", which trips the existing vague-number voice gate (`voiceCheck` bans "around"/"about"/"~"). Kept the gate and used exact phrasing in the prompt + example ("$120 in NM"); also softened the rigid per-figure "as of today" rule to a single present-tense anchor so the punchy beats don't get cluttered (the "as of today" rule was a SYSTEM instruction, never a hard gate, so no test moved).
- **Verification boundary (unchanged):** Satori/MP4 can't render under `node --strip-types`, so the template + background + copy structure are build-validated + structurally/unit pinned; final fidelity is John's eyeball of the regenerated `#content-engine` approval card. Gates: tsc clean · `npm test` 1101/1083-pass/0-fail/18-skip (+14) · build exit 0 · design:lint (only the pre-existing `upload-form.tsx:747 bg-black` warning, untouched) · `/security-review` no findings ≥8.

**Decision (v2.2 — the reply is the newsletter lever, built 2026-06-27).** v2.1 shipped the link-in-reply *mechanism* but the reply was a bare URL. v2.2 makes the reply do work for the list (the north-star). Implements `docs/goals/x-card-hero-v2.2-copy-cta.md`.
- **Fix C — value-framed reply + 80/20 newsletter-CTA rotation.** A new pure `post-text.ts::buildReplyText(input, dayIndex)` replaces the bare URL: ~80% of days a calm value-framed line + the card link (`Full sold history and the live listings: <url>` for deals, `Every recent sale and the live listings: <url>` for spotlights, `See this week's good buys: <deals-url>` for educational), and ~20% (`dayIndex % NEWSLETTER_REPLY_EVERY === 0`, N=5) the newsletter CTA instead (`I send the week's biggest movers every Sunday. Free: <newsletter-url>`). The rotation is **deterministic** (UTC day number, `isNewsletterReplyDay`), not random — so it's testable and the persisted reply is reproducible. The 80/20 split honors STRATEGY-AUDIENCE-MOAT's "the X algorithm punishes CTA-heavy accounts"; the reply is the one place a CTA costs no body reach (the link is already out of the body for the throttle reason). `/newsletter` is a confirmed `PUBLIC_ROUTES` entry (the CTA target resolves).
- **Fix D — the weekly board carries the ONLY explicit save ask.** `weekly_board` → `This week's biggest movers, the full board: <deals-url>` + `Bookmark the board, it updates every week.` Bookmarks are earned on the genuinely save-worthy weekly board, not begged daily — daily `deal_of_day`/`price_spotlight`/`educational` replies never carry a bookmark/like ask (pinned by a split test). The board does not rotate the newsletter (it has its own ask).
- **Persistence (so /approve posts the SAME reviewed reply).** New nullable `reply_text` column on `x_post_drafts` (migration `20260627160000`, additive — legacy rows fall back to the bare `link`), persisted by the cron's `requestApproval` and posted by `approval.ts` (`claimed.reply_text || claimed.link`). The live path (`bot.ts`) computes `buildReplyText` once and posts it directly. The Discord review + approval embeds now show a **Reply** field (the exact reply text), so John reviews the value frame / CTA before `/approve`.
- **Voice on the reply (test-pinned, not a runtime gate — the builder is deterministic).** Every reply variant passes `voiceCheck` (no em dash, no hype, no vague) and fits 280 chars; `x-reply-text.test.ts` pins the rotation cadence (3 of 15 days newsletter), the value/CTA wording, the board-only save-ask split, and voice. Before/after measured: bare `https://foiltcg.com/cards/base1-2-blastoise` → `Full sold history and the live listings: <url>` (value day) / `I send the week's biggest movers every Sunday. Free: foiltcg.com/newsletter` (rotation day).
- Gates: tsc clean · `npm test` 1111/1093-pass/0-fail/18-skip (+10) · build exit 0 · design:lint (3 pre-existing warnings, none on changed files) · `/security-review` no findings ≥8.

**Cross-refs.** [ADR-073](#adr-073--card-hero-x-image-real-card-art-over-a-sharp-derived-world-satori-cant-blur--the-weekly-board), [ADR-058](#adr-058--daily-x-content-bot-dry-run-first-own-posts-only-satori-image-not-playwright), [ADR-072](#adr-072--x-deal-angle-sources-from-the-fresh-movers-signal-no-phantom-deals--post-metrics-capture), [ADR-065](#adr-065--homepage-reorient-email-capture-is-the-primary-conversion-goal-inline-capture-on-the-ranking-content-surfaces) (the email-list north-star the reply CTA feeds), `docs/goals/x-card-hero-v2-motion.md`, `docs/goals/x-card-hero-v2.1-polish.md`, `docs/goals/x-card-hero-v2.2-copy-cta.md`.

## ADR-075 — Autonomous goal-runner: headless Claude Code, queue-fed, commit-never-push

**Date:** 2026-06-27
**Status:** Accepted + Built. Extends [ADR-009](#adr-009--local-cli-tooling-for-autonomous-infra-changes) (the local-CLI-autonomy line). Implements `docs/goals/autonomous-goal-runner.md`.

**Context.** Cowork (the co-CEO/COO advisor) can write goal specs from its sandbox but cannot puppet an interactive terminal, and John wants work to continue while he's away ("go to the gym and have work continue"). No agent can drive an interactive Claude Code session. The durable fix is to route around the terminal: a queue Cowork writes to + a long-running watcher John starts once.

**Decision.** A two-layer runner:
- **`lib/goal-runner/core.ts` (pure):** the decision logic with no fs/git/network/clock side effects, so it is fully unit-testable — queue ordering (FIFO by `NN-` prefix), the commit/no-commit + status derivation, conventional-commit-type inference, result-file + Discord shaping, `DECISION NEEDED` extraction, and the **`gitArgsAreSafe` never-push guard** (the single chokepoint).
- **`scripts/goal-runner.ts` (`npm run goals:watch`):** the I/O loop. Polls `docs/goals/_queue/` (all gitignored, like `docs/goals/`), runs each spec via `claude -p` (spec piped on stdin + a preamble forbidding push/deploy/migration and instructing `DECISION NEEDED:` on a fork), then **independently** runs the closure gates (`tsc/test/build/design:lint`), and:
  - all green → `git add -A` + conventional commit, **never `git push`**;
  - any gate fails / agent errored → discard (`git reset --hard` + `git clean -fd`, restoring the clean tree), mark **BLOCKED**;
  - a fork needs John → commit the safe work (never pushed) + flag **DECISION_NEEDED**.
  Then move the spec to `_done/`, write `_results/<name>.md`, and soft-fail a Discord ping.

**Safety model (stated plainly).** The containment is NOT the permission prompt — the agent runs `--dangerously-skip-permissions` because that is the only mode that runs a gate-running goal end-to-end without hanging on a Bash prompt. The containment is: (1) **commits, never pushes** — `gitArgsAreSafe` refuses `push`/`pull`/`fetch`/`remote`/`clone`/`--force` and the script asserts it before every git spawn, so nothing reaches prod unattended (John reviews then pushes); (2) every commit passed the full gate suite; (3) goals are pre-scoped specs, not freeform; (4) **sole committer** — the runner refuses a dirty tree at startup and runs one goal at a time, so it can't race another committer or clobber WIP; (5) kill switch = Ctrl-C. Pushes, deploys, prod migrations, and financial/irreversible actions stay manual — the runner refuses them and writes DECISION NEEDED.

**Consequences.** `/security-review` is a Claude Code skill, not a CLI, so the runner can't run it — the **agent** runs it as part of the goal contract; the runner enforces the 4 mechanical CLI gates. Running `build` per goal is slow but acceptable for an away-from-keyboard tool (configurable via `GOAL_RUNNER_GATES`). The new env are all optional operational config (`GOAL_RUNNER_*`), documented in ENV-VARS; the Discord ping reuses `DISCORD_WEBHOOK_CONTENT_ENGINE`. The runbook (`docs/runbooks/goal-runner.md`) documents the start command, the one operating rule (sole committer), the safety model, and a supervised first-run. The pure core is unit-tested (16 cases incl. the never-push guard); the I/O loop is smoke-verified (loads, creates the gitignored dirs, the dirty-tree guard fires) — John does the first supervised real run before trusting it unattended.

**Cross-refs.** [ADR-009](#adr-009--local-cli-tooling-for-autonomous-infra-changes), [ADR-014](#adr-014--outbound-discord-notifications-per-channel-webhooks-soft-fail-single-import-boundary) (the Discord boundary `notifyChannel` reuses), `docs/runbooks/goal-runner.md`, `docs/goals/autonomous-goal-runner.md`.

## ADR-076 — SEO metadata targets search-volume buyer keywords, not internal positioning jargon

**Date:** 2026-06-28
**Status:** Accepted. Implements `docs/goals/seo-metadata-destale-and-sharpen.md`. Relates to [ADR-020](#adr-020--pivot-to-buyer-side-deal-finder-positioning) (the deal-finder positioning) + `docs/BRAND-VOICE.md`.

**Context.** Foil's brand line is "market-insight + deal-finder / trusted collector concierge." There is a standing temptation to put that *positioning* language ("market insights") into title tags. But title/meta-description tags are SEO surfaces — they should target the SEARCH-VOLUME keywords buyers actually type (value, price, worth, deals, movers, `[card name]`), not internal brand framing that has ~no search volume. Separately, an audit found pre-pivot **scanner** product framing ("Foil's scanner returns…", "Japanese card scanning is supported at launch") still on indexed pages, and a wrong Twitter handle (`@foilcards`).

**Decision.**
1. **Metadata leads with the page's high-search buyer keyword**, not positioning jargon. Titles ≤ ~60 chars, descriptions ≤ ~155, no em dashes (brand voice). Positioning language ("market insights", "concierge") lives in hero/positioning copy, never in `<title>`/meta-description. `/deals` → "deals / good buys / this week"; pillars → "value / price / condition guide"; `/cards/[slug]` → `<Card> (<Set>) price & deals` (the query shape); never "market insights".
2. **De-stale the product framing:** the deal-finder surface describes how Foil *matches cards by printed metadata (set code + collector number + rarity) to surface real price/sold data* — never "scanner"/"scanning"/pre-launch "waitlist/early access" (the product is live). Educational "valuation" (a real keyword) stays; only the scanner *product* claims were removed. Vending track (`/host`, `/faq`, `/machines`, `/service-areas`) is intentionally vending-framed and untouched.
3. **X handle:** `@Johnnycakx` (live account) until the `@FoilTCG` rename clears review — a one-line swap, TODO pinned in `app/layout.tsx`.

**Consequences.** Search snippets target buyer intent + read consistently with the deal-finder positioning; a copy/metadata-only change (no render change). A structural guard for "no scanner framing on the deal-finder surface" or "no em dash in metadata" was considered but not built (low recurrence risk; the grep in the goal's verification + this ADR are the guardrail). Content-marker live verification (ADR-049) confirms the corrected copy renders post-deploy.

## ADR-077 — Newsletter /approve→deliver loop: the no-spend rail (Beehiiv RSS-to-Send is Max/Enterprise, not Scale)

**Status.** Accepted (2026-06-28). Builds on ADR-011/ADR-012 (newsletter drafts, never-auto-send) + ADR-069 (the movers digest) + clones the ADR-071 X-bot approval rail.

**Context.** Generation is automated (the deterministic movers digest, ADR-069); the SEND was a fully-manual paste (issue #1, 2026-06-28) — the audit's #1 autonomy gap and the named exhibit for the automation-first mandate. The goal proposed **Beehiiv RSS-to-Send** to reach true auto-send on our **Scale** plan with no further spend. **P0 premise check refuted that:** Beehiiv's current official docs ("How to enable and use RSS", support article 9363537272215, updated 2026-06-04) state — three times — that **RSS Ingestion (aka "RSS to Send") is available on the Max and Enterprise plans only**, NOT Scale; the fully-hands-off "refresh feed on send + recurring series" form is attributed to Enterprise. The Posts/Send API is separately Enterprise-gated (the `SEND_API_NOT_ENTERPRISE_PLAN` 403). So on Scale there is **no native programmatic or RSS-driven send path** (automations are subscriber-journey-triggered and can't carry dynamic weekly content). The earlier COWORK-CONTEXT assertion "Scale includes RSS-to-Send" was an unverified inference (AGENTS.md: official docs trump memory). Surfaced to John with the evidence; with ~0 real subscribers, paying +$60/mo (Scale→Max) to remove a 30-second weekly paste is premature, so **John chose the no-spend rail** and deferred paid auto-send until the list justifies it.

**Decision.** Build everything that works on Scale and stop exactly at the must-stay-human send. A weekly Vercel cron (`/api/cron/newsletter-digest`, Wed 14:13 UTC; gated by `NEWSLETTER_DIGEST_MODE=approval`, default **off**) reads the fresh `market_movers` cache, renders the digest (the ADR-069 serializer, refactored to share `buildMoversDigestParts`; `marked` converts the body to paste-ready HTML), runs a movers-specific quality gate (figures trace to source rows · sample-size · em-dash/banned-phrase · **affiliate-link integrity** — every eBay link must carry `campid`, the structural guard for the issue-#1 unwrapped-link bug), persists a `newsletter_digest_drafts` row (unique on `issue_week` = one digest/week idempotency), and posts a Discord `#content-engine` approval card. The owner approves with the SAME `/approve <id>` / `/skip <id>` bot commands as the X bot — the bot tries `/api/x/approve` first and **falls through to `/api/newsletter/approve`** when the id is not an X draft (additive; the live X path is untouched on its happy path). On approve, the persisted paste-ready issue is **emailed to the founder** (Resend) for the Beehiiv paste+send; on skip, nothing is delivered. Cloned the ADR-071 rail rather than generalizing it (the live X approval path is load-bearing; isolation > overloading its route/table). New isolated table (service-role only, RLS no-policies), dedicated `NEWSLETTER_APPROVE_SECRET` (blast radius = "email John a digest"). Soft-fail at every layer; idempotent claim-once delivery (a failed email releases back to pending for re-approve).

**Consequences.** True auto-send is **deferred, not built** — the loop automates everything up to a 30-second human paste (which doubles as the must-stay-human send gate the mandate allows). The graduation path is explicit: upgrade Beehiiv to **Max** to unlock RSS Ingestion, then point it at a digest feed (the unbuilt "syndication rail") OR keep the paste. The approval queue is a clean clone, ready to generalize to other channels (Postiz) later. New env: `NEWSLETTER_DIGEST_MODE`, `NEWSLETTER_APPROVE_SECRET`, `FOUNDER_EMAIL` (see ENV-VARS). One-time John setup: set the two env vars (Vercel prod + the secret on the bot's Railway) and flip `NEWSLETTER_DIGEST_MODE=approval`. The "RSS-to-Send needs Max/Enterprise" fact is now pinned here so it isn't re-inferred wrong.

## ADR-078 — Own the newsletter SEND via Resend Broadcasts (fully automated; no Beehiiv upgrade, no manual paste)

**Status.** Accepted (2026-06-28). Reuses the ADR-077 `/approve` rail; supersedes the manual-paste assumption of ADR-011/ADR-012 and the "newsletter sends through Beehiiv, never a Resend bypass" note (that note's rationale — Beehiiv Ad Network eligibility — is something the newsletter playbook itself deprioritizes for Foil, and Beehiiv's send is paywalled on Scale anyway). Beehiiv is KEPT in parallel (signup form + hosted archive).

**Context.** ADR-077 reached an `/approve`→email-the-founder rail because Beehiiv's auto-send (RSS Ingestion) is Max/Enterprise and its Send API is Enterprise. John's hard constraint (2026-06-28): the send must be **fully automated, zero manual paste, with no Beehiiv upgrade.** Resend is already in-stack (transactional + wishlist sends, verified `foiltcg.com` SPF/DKIM/DMARC) and exposes **Broadcasts** — a full programmatic create + send to an audience. **P0 verified against the live API (not just docs):** our Resend tier can create an audience, add contacts, and create + SEND a broadcast — proven by a real test send that landed in the founder's **Primary inbox** (no plan gating). This also strengthens "owned list = the moat" (the list of record becomes our own Supabase + Resend audience, not a rented Beehiiv list).

**Decision.** Swap the ADR-077 rail's final "deliver" step from "email the founder a paste-ready issue" to "**create + send a Resend Broadcast to the audience**" (`app/api/newsletter/approve` → `sendResendBroadcast`, gated on `RESEND_AUDIENCE_ID`; falls back to the ADR-077 founder email if that env is unset, so a misconfig degrades to manual paste, never a silent no-send). `lib/notifications/resend.ts` stays the single Resend boundary — added `upsertResendContact`, `sendResendBroadcast` (two-step create→`/broadcasts/{id}/send`), and `wrapBroadcastFooter` (CAN-SPAM address + Resend's native `{{{RESEND_UNSUBSCRIBE_URL}}}` one-click unsubscribe — the marketing-list unsubscribe source of truth; the HMAC-token path stays transactional). Signups dual-write to an owned Supabase `newsletter_subscribers` table (source of truth) AND upsert into the Resend audience (`recordSubscriber`), keeping the Beehiiv write in parallel; all three legs soft-fail independently. Idempotency is inherited from the ADR-077 rail: per-ISO-week-unique draft + claim-once delivery, so a re-approve/re-run never double-sends. Kill-switch: `NEWSLETTER_DIGEST_MODE` (cron) + `RESEND_AUDIENCE_ID` presence (send). Graduation: `/approve`-gated now; flip to auto-approve once deliverability holds.

**Consequences.** The newsletter now sends fully automatically from our own code at ~$0 (Resend free tier 3k/mo, 100/day), no paywall on the critical path. **Verified by the HARD test gate (2026-06-28):** 6 real broadcasts delivered to the founder's Primary inbox (2 marked IMPORTANT, none in Spam), full multi-card digest renders correctly, affiliate links EPN-tagged (`campid` present — a Gmail-API quoted-printable decode artifact was ruled out by comparing against the known-good wishlist alerts), and the native one-click unsubscribe round-trip marked the contact `unsubscribed=true` (HTTP 204). New env: `RESEND_AUDIENCE_ID`, `NEWSLETTER_FROM` (see ENV-VARS). **Deliverability follow-up (John):** a dedicated marketing subdomain (`news.foiltcg.com`) is the best practice to protect the transactional reputation before real volume — tests used the verified `alerts@foiltcg.com`. **Unsubscribe sync follow-up:** Resend native unsubscribe marks the Resend contact; mirroring that back to the Supabase `newsletter_subscribers.unsubscribed_at` (a Resend webhook) is a follow-up. Beehiiv stays the signup form + archive; the Max/Enterprise upgrade remains available later if its monetization becomes a real lever, but it is no longer a blocker.

## ADR-079 — Branded newsletter email (react-email), text-forward to hold Gmail Primary

**Status.** Accepted (2026-06-28). Extends ADR-078 (the Resend Broadcasts send) + applies the ADR-029 cream/navy/gold register (DESIGN.md / soft-skill) to email.

**Context.** The live newsletter rendered as unstyled raw HTML (marked output) — no header, no palette, plain blue links — off-brand for the "trusted collector concierge" identity. But the plain email's one virtue was that it landed in Gmail **Primary** (text-forward emails do; image/button-heavy "marketing template" layouts get sorted to **Promotions**, where opens crater). So the constraint was: brand it WITHOUT losing Primary. A redesign that drops to Promotions is a regression, not a win.

**Decision.** Build the email as a typed **react-email** template (`emails/movers-digest-email.tsx`, Resend-native, compiles to email-safe table HTML; `render()` → the broadcast HTML in the cron). It renders a new typed `buildDigestModel` (lib/newsletter/movers-digest.ts) — same source of truth as the markdown serializer, so they never drift. The design is **branded but restrained / text-forward** to hold Primary: **zero images** (a text wordmark "Foil"+"TCG", not a banner — also degrades perfectly when images are blocked), **styled text links not big colored buttons**, cream `#f8f5f0` surface + navy `#0f1e3a` ink, Georgia-serif headlines (Fraunces's documented fallback — custom webfonts are unreliable in email, never depended on), all CSS inline. **Brand-rule reconciliations for email:** the goal suggested a coral down-delta, but **Coral-Hover-Only forbids resting coral** (DESIGN.md), so the bulk "cooling off" deltas are a **neutral navy** pill and **scarce gold** is reserved for the few "heating up" deltas + the wordmark + one hairline (Scarce-Gold ≤10% holds). The native `{{{RESEND_UNSUBSCRIBE_URL}}}` + CAN-SPAM footer live in the template (sent as-is, no double-wrap). `isAffiliateWrapped` (epn.ts) now decodes `&amp;` so the affiliate gate validates react-email's entity-encoded hrefs.

**Consequences.** The newsletter now looks like Foil. **HARD test gate PASSED (live, 2026-06-28):** 4 branded broadcasts through the real render+send path → **all 4 landed in Gmail PRIMARY, zero in Promotions** (definitive: `category:primary`=4, `category:promotions`=0), the multi-card digest renders correctly (verified by a localhost browser screenshot + the full Gmail HTML), images degrade gracefully (none used; the plaintext alternative is complete), affiliate links stay EPN-tagged, and the unsubscribe merge tag rendered to a real one-click link. New dep: `@react-email/components` + `@react-email/render`. **The Primary-vs-brand balance is now settled — do not relitigate by adding card-thumbnail images or big CTA buttons without re-running the `category:promotions` check**, since those are the exact signals that would bump it to Promotions. If a future redesign wants images, gate the change on a fresh live Primary-placement test.

## ADR-080 — Editorial newsletter engine: deterministic facts + an LLM "why + call" layer, gated for honesty

**Status.** Accepted (2026-06-28). Extends ADR-050 (creator-content ingestion + the attribution/voice gates) + ADR-069/078/079 (the movers digest, the Resend send, the branded email). Source of truth: `docs/knowledge/newsletter-editorial-blueprint.md`.

**Context.** The digest reported numbers anonymously — the same gainers/droppers table every Pokémon price tracker has. The moat is the layer a data API can't supply: WHY a card moved and what a Level-4 seller would DO about it. The blueprint specifies that (the signature segments, the MOVE→WHY→CALL formula, John's voice, 9 quality gates, a golden sample). The hard tension: the digest was DETERMINISTIC (no LLM, fabrication structurally impossible), and adding an editorial "why" reintroduces fabrication risk — both invented figures AND causal claims stated as fact.

**Decision.** A HYBRID that keeps the honesty: the deterministic `buildDigestModel` supplies the FACTS (figures, sale counts), an LLM pass (`lib/newsletter/editorial-engine.ts`, Sonnet 4.6, the blueprint encoded as the system prompt + the 3 BEFORE→AFTER rewrites as few-shot) adds the EDITORIAL layer, and a gate set (`lib/newsletter/editorial-gates.ts`) enforces both quality AND honesty before anything ships. The engine outputs a structured `EditorialIssue` (subject + the 8 segments; picks as MOVE→WHY→CALL prose); a 3-retry loop re-prompts on gate failure (same shape as `draft-generator.ts`); after 3 strikes it throws and the week is skipped (never ships a failed issue). **Gates (the blueprint's 9 + two honesty gates):** Why (every pick names a cause), Call (every pick ends in a verdict), Signature-segment (Big Move + Seller's Note + the $50 Call present), Volume-honesty (a sub-25-sale move must carry a noise caveat), POV (first-person present), Hype-ban + em-dash, Length/skim (850-1500 words; Big Move ≤200, other picks ≤110), Subject-line (6-10 words, ≤60 chars, names the Big Move card), **Figures-trace (R-001 — every $ figure is one we supplied; integer-rounding of a real figure allowed, fabrication rejected)**, and **Causal-hedge (every cause is framed as a READ — "likely," "feels like," "my read," "no catalyst I can find" — never asserted as confirmed fact)**. The 9th blueprint gate (Affiliate-placement) is a render-layer property (one inline eBay link per pick, no footer banner) pinned by the template test, since the LLM emits no links.

**Consequences.** **Measured before→after (the CLAUDE.md contract; real Claude run to `_pending`, nothing sent):** picks-with-a-why **0 → 11/12**, picks-with-a-verdict **1 → 12/12**, picks-hedged **12/12**, first-person POV **false → true**, Big Move + Seller's Note + $50 Call all present, **all editorial gates PASS**, ~632 → ~1,184 words. The honesty gates demonstrably fired in the retry loop (caught fabricated `$200/$35/$100` and unhedged causal claims, forced the fix). The interpretive "why" is enforced as judgment, not invented fact, so the R-001 fabrication ethos now covers causal claims too. **Deferred follow-up (the blueprint's "Then" + this goal's design pass):** the cron is NOT yet wired to the editorial engine and the react-email template doesn't yet render the new segments (Big Move feature block, Seller's Note callout, $50 Call highlight) — production still sends the deterministic digest until that ship step. Substance first (this ADR), styling/wire next. **Shipped to production by [ADR-081](#adr-081--wire-the-editorial-engine-into-the-live-send-cron--template-deterministic-digest-as-the-soft-fall).**

## ADR-081 — Wire the editorial engine into the live send (cron + template), deterministic digest as the soft-fall

**Status.** Accepted (2026-06-29). Closes the ADR-080 "Deferred follow-up." Extends ADR-079 (the branded, Primary-safe react-email template) + ADR-078 (the Resend Broadcasts send). NL-EDIT-SHIP.

**Context.** ADR-080 built + measured the editorial engine but routed it to `_pending` only: the weekly cron (`/api/cron/newsletter-digest`) still called the deterministic `buildDigestModel` digest and the react-email template still rendered the old cooling/heating table. So a live send was the anonymous data table, not the editorial issue. Two things had to be true to ship: (1) the cron must produce the editorial issue, and (2) an editorial-generation failure (LLM error or a 3-strike on the honesty/quality gates) must NEVER block the weekly send — the deterministic digest, which can't fabricate, is the obvious safety net.

**Decision.** A composer, `lib/newsletter/digest-compose.ts::composeDigestForSend`, owns the editorial-first / deterministic-soft-fall / skip-only-if-both-fail ladder as pure orchestration over injected IO (generate / render / gate), so the soft-fall is unit-tested with fakes (no LLM, no network). The cron calls it; on success it persists + posts the EDITORIAL issue, on any editorial failure it logs the fallback and sends the DETERMINISTIC digest, and it skips the week only if the deterministic safety net also fails its gate. A new react-email template (`emails/editorial-digest-email.tsx`) renders the structured `EditorialIssue` through the SAME ADR-079 Primary-safe primitives (text wordmark, cream/navy/gold, styled text links, zero images, no buttons) with the new segment treatments: The Open intro, **The Big Move** featured panel, Cooling/Heating verdict rows (one inline affiliate eBay link per pick, mapped from the model card — the LLM emits no links), **Seller's Note** navy-edge callout, **The Read** scarce-gold $50-call highlight, the poll, and the sign-off. The render-layer affiliate invariant (every eBay link `campid`-wrapped — the issue-#1 revenue bug) is factored into a shared `affiliateLinkIntegrity(html)` helper and enforced post-render on BOTH templates; an editorial render that fails it soft-falls rather than ship untracked links. The Discord approval card gains a "Format" field so the owner sees `editorial` vs `⚠️ deterministic (fell back)` at a glance.

**Consequences.** Production now sends the editorial issue; the deterministic digest is the fallback only. **HARD test gate PASSED live (real path, multiple sends):** generated 3 fresh editorial issues from the live `market_movers` cache, rendered each through the branded template, and sent 4 Resend broadcasts (3 editorial + 1 forced-fallback) to a disposable John-only audience. Verified in John's Gmail: **4/4 landed in Primary, 0 in Promotions** (the non-negotiable ADR-079 regression check holds with the richer layout), the full editorial issue renders correctly (all 8 segments, John's voice, honesty visibly intact — Alakazam flagged as 37-sale noise, every cause hedged), **affiliate links EPN-tagged** (pre-send `affiliateLinkIntegrity`: 12 links, 0 unwrapped, all `campid=5339154326`; the Gmail-API `=`→QP-decode artifact is the ADR-078/079 known-benign one), native one-click **unsubscribe** rendered, and the **forced-fallback send proved the soft-fall** (simulated editorial failure → the deterministic digest delivered, also in Primary). Soft-fall is additionally unit-tested (5 scenarios) + the template structurally guarded (segments + no images/buttons + unsubscribe + CAN-SPAM). **Guardrail (inherits ADR-079):** the new segment panels add visual weight but stay text-forward; do NOT add card-thumbnail images or big CTA buttons to the editorial template without a fresh live `category:promotions` check. **Go-live is unchanged from ADR-078:** John applies the migration + sets `NEWSLETTER_DIGEST_MODE=approval` / `NEWSLETTER_APPROVE_SECRET` / `RESEND_AUDIENCE_ID` + pushes; the weekly cron then posts an editorial `/approve` card.

## ADR-082 — Newsletter hardening: Resend unsubscribe sync webhook + dedicated sending subdomain

**Status.** Accepted (2026-06-29). Closes the two ADR-078 follow-ups ("Unsubscribe sync follow-up" + "Deliverability follow-up"). Built + committed; the live HARD test gate is the John-attended activation (push + Resend webhook setup + DNS).

**Context.** Two gaps had to close BEFORE real subscribers land on the Resend-Broadcasts send (ADR-078). **(1) Unsubscribe coherence.** Subscribers live in three stores — Supabase `newsletter_subscribers` (source of truth; the send excludes `unsubscribed_at IS NOT NULL`), the Resend audience, and Beehiiv (parallel). A native one-click unsubscribe in a Resend broadcast marks the contact unsubscribed in **Resend only**, so Supabase still shows them subscribed and the next send re-includes an opted-out address — a CAN-SPAM violation + a deliverability killer. **(2) Sending-domain isolation.** Broadcasts send from `alerts@foiltcg.com`, shared with transactional (wishlist alerts); a marketing deliverability dip shouldn't drag down a paid transactional email, and warming a fresh subdomain from zero is cleanest now, before volume.

**Decision.** **Part A — sync webhook.** `app/api/webhooks/resend/route.ts` (public via the existing `/api/webhooks` prefix — same contract as Stripe/Vercel/eBay, the Svix signature IS the auth; pinned in `proxy.test.ts`, no new PUBLIC_ROUTES rule needed since the prefix already covers it). Verification + extraction live in the pure, fully-tested `lib/resend-webhook.ts`: Svix HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${rawBody}` (key = base64-decode of the secret after `whsec_`), base64 signatures, a 5-minute replay window, constant-time compare — **verified against resend.com + docs.svix.com, not training data** (AGENTS.md). It acts only on opt-out signals: `contact.updated`/`contact.created` with `data.unsubscribed === true` (the one-click unsubscribe fires `contact.updated`) and `email.complained` (`data.to` — a spam complaint is the strongest opt-out). `lib/newsletter/unsubscribe-sync.ts` does the coherence write: a **gated** Supabase `UPDATE … WHERE email = $1 AND unsubscribed_at IS NULL` (idempotent — a replay flips 0 rows) + Beehiiv `unsubscribeEmail` (already idempotent). Resend itself needs no write-back (it's the event source → already coherent). Soft-fail per leg; only a genuine Supabase error returns 500 so Svix retries (safe, because idempotent). New secret `RESEND_WEBHOOK_SECRET`. **Part B — sending subdomain.** The send already reads `process.env.NEWSLETTER_FROM` (ADR-078), so the switch is **env-only**: keep the default `alerts@foiltcg.com` (so an unverified subdomain can never break a send), and set `NEWSLETTER_FROM="Foil <news@foiltcg.com>"` once verified. `scripts/setup-news-subdomain.ts` (`npm run setup:news-subdomain`) provisions the domain via the Resend API and prints the EXACT DNS records (SES Easy-DKIM = 3 CNAMEs, SPF = MX+TXT on `send.news.foiltcg.com`, plus a recommended DMARC TXT) — read-only without `--create`, tracking disabled for fewer records + Primary-friendliness. The exact DKIM tokens are domain-instance-specific (SES-minted at create time), so a precise script beats a pre-baked guess.

**Consequences.** All three stores converge on every opt-out, and marketing/transactional reputations split before volume. **The live HARD test gate is deferred to John's attended activation** (per the goal's "commit, don't push"): trigger a real unsubscribe → confirm Supabase + Resend + Beehiiv all show unsubscribed and a subsequent send excludes them, replay the webhook → confirm no-op; send a test broadcast from the subdomain → confirm Primary + DKIM/SPF/DMARC pass. Runbook: `docs/runbooks/newsletter-unsubscribe-and-subdomain.md`. Kill-switches: unset `RESEND_WEBHOOK_SECRET` (route 503s, sync pauses) / unset `NEWSLETTER_FROM` (sender reverts to `alerts@`). **Scope note:** the webhook deliberately does NOT auto-resubscribe on `unsubscribed: false` — re-subscription is owned by the signup path, not an inbound webhook. If the complaint path is ever observed to leave a Resend contact still subscribed, add a Resend PATCH leg through the single `lib/notifications/resend.ts` boundary.

## ADR-083 — Resend is the sole send + unsubscribe surface; Beehiiv is passive (fixes the silent Beehiiv unsubscribe no-op)

**Status.** Accepted (2026-06-29). Amends [ADR-082](#adr-082--newsletter-hardening-resend-unsubscribe-sync-webhook--dedicated-sending-subdomain) (the Resend→Supabase/Beehiiv sync) + [ADR-078](#adr-078--own-the-newsletter-send-via-resend-broadcasts-fully-automated-no-beehiiv-upgrade-no-manual-paste) (own-the-send-via-Resend; Beehiiv = signup/archive).

**Context.** The ADR-082 Part A live test (2026-06-29, the first real unsubscribe through the deployed webhook) proved Resend→Supabase works but surfaced two Beehiiv defects. **(1) `unsubscribeEmail` silently no-op'd.** It called `client.subscriptions.list(...)` then `.update(...)` through `as unknown as {...}` casts — but **neither method exists** on `@beehiiv/sdk` (the real surface is `index` + `updateByEmail`/`put`/`patch`/`delete`). The cast hid that from `tsc`, so at runtime the first call threw on the missing method, the leg returned `ok:false`, and a Resend-unsubscribed contact was left **`active` in Beehiiv** (Supabase + Resend coherent; Beehiiv drifted). **(2) Reverse-direction gap.** A Beehiiv-initiated unsubscribe (e.g. from the "Foil welcome" automation Beehiiv auto-sends despite our `send_welcome_email: false`) does not propagate back to Supabase/Resend — and since the newsletter sends via Resend, such a person would keep receiving it (a CAN-SPAM exposure, [R-059](RISKS.md)). Both trace to Beehiiv being treated as a second send/unsubscribe surface when ADR-078 intended it to be passive.

**Decision.** Make the ADR-078 intent real: **Resend is the sole send + unsubscribe surface; Beehiiv is a passive signup-capture + archive.** Concretely: (1) **Fix the leg with the typed SDK method** — `unsubscribeEmail` now calls `client.subscriptions.updateByEmail(pub, email, { unsubscribe: true })` (the `PUT /publications/{pub}/subscriptions/by_email/{email}` endpoint), a single email-targeted call that lands the subscription at `inactive`; a `NotFoundError` (404) is success (effectively unsubscribed), any other error is `ok:false` (never a false-success). Verified **live** (alias `active`→`inactive`) and unit-tested with a fake that implements ONLY `updateByEmail` — so reverting to a phantom method fails the build/test. (2) **Reverse direction — resolution (b):** subscribers only ever see Resend's unsubscribe link (we don't send via Beehiiv), so Resend is the only unsubscribe surface they touch. The one Beehiiv outbound — the **"Foil welcome" automation** (`aut_ffd18eec-…`, status `live`) — must be paused in the Beehiiv dashboard; the automations API is **read-only** (`index`/`show` only — no status toggle), so this is a one-time dashboard action, deferred (≈0 real subscribers makes the exposure theoretical until acquisition). The (a) upgrade — a Beehiiv→Supabase/Resend webhook for true bidirectional sync — is noted as the move IF Beehiiv ever sends real content again.

**Consequences.** All three stores are now coherent on a Resend unsubscribe (Supabase source-of-truth set, Resend native, Beehiiv now actually deactivated). **Exclusion hard-proven live:** after the alias unsubscribed, a fresh Resend broadcast was delivered to the still-subscribed address but **not** to the unsubscribed alias (Gmail `to:`-filter: 1 vs 0). **Residual (accepted, tracked R-059):** until John pauses the "Foil welcome" automation, a brand-new subscriber gets one Beehiiv welcome email whose unsubscribe wouldn't propagate — theoretical at current volume, a trivial dashboard toggle before the first real subscriber. **Standing question (IDEAS):** Beehiiv has now cost two cycles (the welcome-email surprise + this no-op) at ≈0 subscribers; whether it earns its keep vs a single-source Supabase+Resend architecture is a Sunday-review decision. **Lesson:** `as unknown as {...}` casts over a third-party SDK defeat the typechecker and let a non-existent method ship — prefer the typed surface; if a cast is unavoidable, a test that exercises the real call path is the only guard.

## ADR-084 — Acquisition Phase 0: UTM channel attribution on the owned newsletter row + a founder-only readout

**Status.** Accepted (2026-06-29). Extends [ADR-078](#adr-078--own-the-newsletter-send-via-resend-broadcasts-fully-automated-no-beehiiv-upgrade-no-manual-paste) (Supabase `newsletter_subscribers` = the owned source of truth) + honors [ADR-066](#adr-066) (one email ask per page). Strategy: `STRATEGY-AUDIENCE-MOAT.md`.

**Context.** The newsletter send is live but reaches ≈0 real subscribers; the next phase is a founder-led community push (Reddit/Discord/X). "Get people into the funnel to see if it works" is only answerable with per-channel attribution. The P0 measurement found: `/deals` already has exactly one strong, board-tied `EmailCapture` (`source=deals_board`) — not a leak; but the signup path captured only the per-surface `source` tag, **dropping inbound `utm_*`** (the `EmailCapture` form submitted just `source`+`email`), and there was **no readout** of signups-by-source. So a `/deals?utm_source=reddit` signup lost the channel. The goal correctly collapsed to the attribution + readout half.

**Decision.** Capture the inbound channel at signup and persist it on the owned row; read it from a terminal, not a tracker. (1) **Migration** adds nullable `utm_source`/`utm_medium`/`utm_campaign` to `newsletter_subscribers` (service-role, RLS-no-policies, consistent with the table). (2) The **shared `EmailCapture`** (used on every surface) reads the landing URL's `utm_*` — plus `?src=` as a short alias for `utm_source` — from `window.location` after hydration (NOT `useSearchParams`, to avoid forcing host pages into a Suspense/client-render boundary) and mirrors them into hidden fields; instrumenting the shared component attributes all capture surfaces at once. (3) `subscribeAction` → `recordSubscriber` thread the UTM through; a pure `buildSubscriberRow` sanitizes each value to `[a-z0-9-]`/≤64 (reusing the `?src=` sanitizer charset — defense-in-depth + group-by hygiene) at the persistence boundary, and **omits a null UTM from the upsert** so a later no-UTM re-subscribe can't wipe the first-touch channel (sticky first-touch). Soft-fail throughout: missing params → null, never an error; `source` is unchanged and always kept. (4) **Readout** is a founder-only `scripts/subscriber-sources.ts` (`npm run subscriber-sources [-- --days N | --all]`) that groups active subscribers by `source` / `utm_source` / `utm_campaign` — no public surface, no analytics SaaS, owned data only. (5) A **canonical UTM cheat-sheet** (`docs/runbooks/acquisition-utm.md`) gives the exact copy-paste link per channel so Phase 1 is measurable from the first link.

**Consequences.** A visitor at `/deals?utm_source=reddit…` who subscribes is stored with that channel attributed; `npm run subscriber-sources` answers "which channel converted" in one command; `/deals` keeps its single board-tied capture (ADR-066 intact). `source` (surface) and `utm_source` (channel) are orthogonal and both queryable. Tests pin the URL→stored-row flow, the sanitization (incl. injection-ish input collapsing to safe tokens), the sticky-first-touch omit, the `EmailCapture` hidden-field mirroring, and the one-capture-on-`/deals` guard. **Deferred to John's deploy:** apply the migration (`supabase db push`) then the readout works. **Not in scope (later):** referral program, onboarding survey, any third-party tracker. **Open follow-up:** if a re-subscribe should ever record last-touch instead of first-touch, revisit the omit-null rule deliberately.

## ADR-085 — Content syndication: safe-vs-human channel split; Postiz as the headless layer; build gated on setup

**Status.** Accepted as policy (2026-06-29); the Postiz integration is **deferred** (parked) pending setup. Captures the P0 outcome of `docs/goals/postiz-multichannel-autosyndication.md`. Runbook: `docs/runbooks/postiz-syndication-setup.md`. Related: the X bot (ADR-058/071), the IDEAS "content-syndication engine" entry.

**Context.** North star is the owned list; distribution reach is the bottleneck; John's directive is zero routine human input. The content engine produces good assets (daily card-hero/board, weekly digest, blog) but they go only to X. The goal was to fan them out via Postiz. The P0 premise check found the goal's foundation absent: the `postiz:postiz` skill is **not installed**, no Postiz account/API key/connected channels exist (Postiz was an idea, never built), and — verified against the official Postiz docs — **connecting a channel is OAuth-via-dashboard only, not API**, i.e. account creation + OAuth = John's hands (a category I'm barred from). Per AGENTS.md we don't ship code against an external API we can't verify end-to-end, and the goal's own "dry-run to a test channel" discipline is impossible with zero connected channels. So building now would be speculative.

**Decision.** Two parts. **(1) The channel-safety split is policy now (the load-bearing rule, independent of any tool):** auto-post ONLY to surfaces Foil OWNS or broadcasts to its OWN feed; NEVER auto-post into communities Foil doesn't own. **Auto-safe:** X (already live, direct via `x-client.ts`), Bluesky / Threads / Mastodon (own feeds, the net-new Postiz value), a Foil-owned Telegram channel, a Foil-owned Discord announce channel (already possible via `lib/notifications/discord.ts` — no Postiz needed). **Auto-safe but needs a new account first (deferred):** Instagram, TikTok. **Human-only (ban risk):** subreddits, third-party Discords — they stay on the weekly human distribution kit. **Default-deny:** unclear ownership → human track. **(2) Postiz is the chosen headless layer, but the build is gated on John's one-time setup** (sign up cloud or self-host → API key → OAuth-connect the auto-safe channels → hand over the key + integration IDs). Then the syndication tap reuses the existing asset-finalization point, adapts per platform, attaches one UTM-tagged link per channel, is idempotent + soft-fail-per-channel + kill-switched (`POSTIZ_SYNDICATION_ENABLED`, default off) + dry-run-first (mirrors the X-bot proven-in-prod pattern).

**Consequences.** The "never auto-post into others' communities" boundary is now a recorded, durable policy **encoded as a tested constant** — `lib/social/syndication-channels.ts` (`SYNDICATION_CHANNELS` + `autoSafeChannels()` + the default-deny `isAutoSafe()`, pinned by `syndication-channels.test.ts`) — so the ban-risk guardrail can't drift and survives independent of whether Postiz ever ships; the future tap reads `autoSafeChannels()` to decide where it may post. (This policy layer is the ONLY code built now — the Postiz API integration stays parked.) The build is parked (no unverified code), captured in the runbook + ROADMAP (SYND-POSTIZ) + IDEAS so it resumes fast once Postiz is connected. **Env vars (`POSTIZ_*`) are intentionally NOT added to ENV-VARS.md yet** — nothing reads them until the build; they're spec'd in the runbook. **Scope sharpener recorded:** X is already syndicated (not via Postiz) and a Foil-owned Discord is already auto-postable via our webhook lib, so Postiz's real net-new today is Bluesky/Threads/Mastodon. If John never sets up Postiz, the owned-Discord/Telegram path is a no-vendor fallback that still satisfies "syndicate to owned surfaces."

## ADR-086 — X engagement-brief engine: automate the research + drafting, a human posts every reply (zero-X-write firewall)

**Status.** Accepted (2026-06-29). Promotes the IDEAS "engagement-brief engine" entry (2026-06-28). Related: the X bot (ADR-058/071, the posting boundary), market-movers (ADR-069), the editorial honesty pattern (ADR-080).

**Context.** John's autonomy mandate wants the X founder-engagement grind automated toward zero input. But the HARD constraint (brand + account survival) is that automated replying/following/liking/DMing on others' content is X "platform manipulation" → suspension, and a detected auto-reply bot destroys Foil's trust moat. So the only safe automation is the RESEARCH + DRAFTING; the ACTION (posting the reply) must stay a deliberate human act. **P0 feasibility (the load-bearing unknown): does our X API tier permit recent-search (reading others' posts)?** Our creds are OAuth 1.0a user tokens configured for posting; the docs only covered write cost. Verified empirically (AGENTS.md — an actual signed call, not an assumption): a real `GET /2/tweets/search/recent` returned **HTTP 200** with high-intent results ("is this worth ripping…", "so I could know what they're worth"), rate-limit 300/15min user-auth. Search is **available** and **pay-per-usage** (billed on data retrieved) — low cost for a daily brief, bounded by the existing console spending cap (R-019). So the feasible scope is the full read+draft+deliver engine.

**Decision.** A daily cron (`/api/cron/engagement-brief`, gated by `ENGAGEMENT_BRIEF_ENABLED`, default off; Bearer `CRON_SECRET`) that **reads + drafts + delivers only — never acts on X.** Flow: (1) read-only recent-search over intent queries (`searchRecent` added to the single X boundary `x-client.ts`; the engine imports ONLY that read fn); (2) a pure heuristic filter to buy/value-intent pokemon posts + opportunity ranking (`candidate-filter.ts`); (3) for the top candidates, draft ONE calm, numbers-first reply citing REAL `market_movers` figures via Claude, behind a pure honesty/voice gate (`draft.ts`: no link, no em dash, no hype, and **every $ figure must trace to the supplied data** — the editorial figures-trace pattern, so a reply can't fabricate a price); (4) deliver a ranked, deep-linked brief to Discord `#content-engine` (each item: the post, a deep link John clicks, the drafted reply to post BY HAND, the data cited); (5) idempotent (the isolated `engagement_briefed_posts` table — a post is briefed at most once), soft-fail per query/candidate, draft-budget-bounded (LLM cost). **The firewall is enforced in code AND pinned by a test:** `engagement-invariant.test.ts` reads every engagement file as text and fails the build if any references a write/engagement call (`postToX`, media upload, `in_reply_to`, `api.x.com`, like/follow/retweet/DM), and asserts the only X-boundary import anywhere in the path is the read-only `searchRecent`.

**Consequences.** ~30 min/day of finding-the-right-post + writing-the-perfect-data-reply collapses to a ~10-min review-and-post, with **zero automation of the X action** — drafted ≠ sent; John posts every reply. The structural invariant test means the "human send is the firewall" can't silently erode in a refactor. New env `ENGAGEMENT_BRIEF_ENABLED` (default off) — the code deploys without ever scanning or spending until John flips it (mirrors the X-bot dry-run discipline). **Cost:** pay-per-usage search (a few queries/day at maxResults 30) + a bounded LLM draft budget; the X console spending cap is the backstop. **Out of scope, permanently (the banned means):** any automated X action (auto-reply/follow/like/DM/retweet, batch-approve-then-autopost), buying engagement, posting into non-owned communities (ADR-085). **Graduation:** John flips `ENGAGEMENT_BRIEF_ENABLED=true` after a dry review of the first brief; the action stays manual forever by design.

**Amendment (2026-06-30, later) — advisory reply mode + Discord Skip/Post buttons (the firewall still holds).** The accuracy fix above made the engine correctly conservative: a daily brief can legitimately be EMPTY because the highest-reach posts are generic buying questions ("I'm 50, what should I buy myself?" at 50k reach; "is grading worth it?") that name no resolvable specific card, so the data-cite-only engine threw them all away. Those are the BEST engagement opportunities. Two additions, the zero-X-write firewall unchanged.

**(1) Advisory reply mode.** Candidates now classify into **data-cite** (names a resolvable `KNOWN_CARDS` mover with data → v1 behavior, cites the exact card's real figures) and **advisory** (a high-reach, relevant buying-intent / market-curiosity post with no resolvable specific card → a value-FIRST reply). The orchestrator tries data-cite first; if no card resolves (or the resolved card has no data) AND the candidate has real reach (`advisoryEligible`: followers ≥ 500 OR views ≥ 1000 — stricter than the base candidate floor), it falls through to `draftAdvisoryReply`. **Accuracy stays:** advisory replies cite **NO dollar figures at all** by design — `validateAdvisoryDraft` rejects any `$` figure, so there is **zero wrong-card / fabrication risk by construction** (the data-cite path keeps its exact-card guarantee via `card-resolver`). **Link discipline (the one real risk):** a new low-rep account dropping site links to strangers is a spam-flag, so advisory replies mention Foil by **name/text only, never a bare link** (the gate rejects all URLs) and the gate rejects cold-outreach-spam patterns ("check out", "DM me", "link in bio", "follow me", "sign up", "my site/page", "click here"). Raw-link inclusion is conservative by default (off); the seam to allow a rare link as reputation builds is documented but not enabled. Each brief item carries a `mode` so the Discord card is labelled `data-cite` vs `advisory`.

**(2) Discord Skip/Post buttons — and the delivery-architecture change they forced.** Goal P0 surfaced a load-bearing platform fact (verified against Discord's official webhook docs, AGENTS.md): **a standard channel webhook cannot send interactive components**, and a button click only routes to the **application that owns the message**. So the existing webhook (`DISCORD_WEBHOOK_CONTENT_ENGINE`) physically cannot deliver working buttons — the **foil-bot** (an application), not the webhook, must post the brief and own the clicks. Since the bot is a separate package with its own service-role Supabase client and no HTTP server, delivery is **Supabase-mediated**: the Vercel cron computes the brief and ENQUEUES items into a new isolated `engagement_brief_items` table (`lib/engagement/brief-queue.ts`); the bot drains undelivered rows on a 60s poll and posts each to `#content-engine` as an embed with **Skip / Post** buttons (`bot/src/engagement/`), then handles the clicks. **Skip** records an idempotent decision (a learning signal; the cron already marked the post in `engagement_briefed_posts` so it never resurfaces regardless). **Post NEVER posts to X** — it surfaces the copy-ready reply (a fenced block) + a deep link to the source post, and John posts it by hand in ~2 taps. The button handler is **owner-gated** (`X_BOT_OWNER_DISCORD_ID`, fail-closed) and validates the `custom_id` (numeric X id only). If the queue write fails, the cron **degrades** to the full rendered webhook brief (no buttons), so a brief is never silently lost. **The firewall is unchanged and extended:** the zero-X-write invariant test now also reads the bot's `queue.ts` / `buttons.ts` / `render.ts` / `handler.ts` as text and fails the build on any X write/engagement reference (including the X-posting approval relay — `callApprovalEndpoint` / the approval endpoint — so the Post button can never route to the path that DOES post). **Unlike the newsletter/X-bot OWN-content auto-send, a reply to someone else's post can NEVER graduate to auto — John posts every one, by design.** New env `ENGAGEMENT_BRIEF_CHANNEL_ID` (the bot's target channel; unset = poller disabled, safe default). New migration `engagement_brief_items` (RLS on, no policies, service-role only). **Consequence:** the daily brief now captures BOTH the exact-card data replies AND the high-reach generic posts it used to discard, John triages in two taps, and the engine still provably never acts on X.

**Amendment (2026-07-04) — widen the scan (surface area, not lower quality).** The live brief felt thin (1 surfaced from 64 scanned). Root cause: not the `draftBudget` (40, not throttling) but a narrow scan — only **3 queries** and a **500-follower advisory floor** dropping most candidates. **P0 (the load-bearing quota check): X's own `GET /2/usage/tweets` meter reported `project_cap` 2,000,000/mo with `project_usage` 480 (~0.02% used)** — the search quota is a non-issue, so the widen is safe (9 queries × 50 × 3 runs/day ≈ 40k/mo ≈ 2% of cap; rate limit 300/15min untouched at 9 calls/run). **Changes:** (1) `ENGAGEMENT_QUERIES` 3 → **9** (grading intent, pulls/mail-days, hot sets by name, price-movement/investment, authenticity, vintage/WOTC — all Pokemon-scoped, `-is:retweet -is:reply lang:en`, pinned in tests); (2) engagement `maxResults` **30 → 50** (kept below X's 100 ceiling to add reach not noise); (3) `ADVISORY_REACH_FLOOR_FOLLOWERS` **500 → 250** (500 was over-tight for a young account; 250 still guarantees a real mid-tier audience, and `opportunityScore` still sorts best-first so quality ordering is preserved). **Two hardenings the measurement forced, both in-scope per the rubric:** (a) a `-giveaway -"giving away"` exclusion on every query — the wider scan surfaced high-reach giveaway/crypto-airdrop posts (the `\bpsa\b` signal matched a P2E giveaway); (b) a **~2s inter-query delay** in the cron's search closure — recent-search enforces a burst cap well below 9 rapid calls (measured: back-to-back throttles after ~8; 2s spacing runs all 9 clean), so without spacing the later widened queries would **silently soft-fail to []** and the widen would only partly apply (the silent-truncation anti-pattern). **Measured before/after (live search, pre-dedup surfacing power):** candidates **40 → ~97**, advisory-eligible **30 → ~79** (the floor drop contributes ~+17); the top of the ranked list stays high-reach real collectors (Moonbreon value chatter, PSA-pop price-claims, grading takes) with giveaways excluded — quality held. The zero-X-write firewall is untouched (read-only config + a sleep; no new data path, so `/security-review` N/A). Recall lever remains the query set + `KNOWN_CARDS`; if a run ever floods low-signal noise, tighten queries before dropping the floor further.

**Amendment (2026-06-30) — exact-card accuracy + target-reach gates.** The first live brief exposed two bugs. (1) **Wrong-card citation (brand-critical):** a reply about the "Moonbreon" (Umbreon VMAX Alt Art, `swsh7-215`) cited `sv8pt5-161-umbreon-ex`'s $1,347 figure — the LLM name-fuzzed "Umbreon" to a different printing (`market_movers` had THREE Umbreon rows). The honesty gate ensured the number was *real* but not that it was for the *right card*. (2) **Worthless targets:** the brief surfaced a 0-follower/3-view account. **Fix (the card-ID framework's "null over guess / the primary key is set+collector#, not the name / never a name-only fuzzy match" applied):** a new deterministic `lib/engagement/card-resolver.ts` resolves a post to ONE exact card via a curated chase-card alias map (the slug IS the identity) — a bare/ambiguous Pokemon name resolves to **null**. `draft.ts` then matches the data row **BY SLUG** (never name), gives the LLM ONLY the resolved card's figures (so it cannot pick another printing), and the gate's allowed-figure set is just that card's — `null over guess` when the card is unresolvable or its data isn't present (skip, never substitute). A **target-reach floor** (drop when author followers AND post views are both negligible) + reach-weighted ranking surfaces only posts worth John's limited daily replies (`searchRecent` now expands `user.fields=public_metrics`). The `@thelou7789` Moonbreon case is a pinned fixture + regression test (wrong-card rejected, 0-reach filtered); the zero-X-write invariant still holds. **Consequence: accuracy is prioritized over recall by design** — the curated resolver is conservative, so a live re-run can legitimately deliver 0 on a day with no resolvable chase-card-in-a-reachy-post (verified: scanned 57 → 0 wrong-card citations shipped). The `KNOWN_CARDS` map is the recall lever (add chase cards with *unambiguous* aliases; never a bare name). Every cited figure is now provably for the exact card the post is about.

## ADR-087 — Content intelligence: mine winning FORMATS from the niche, generate Foil posts ("steal the container, keep the soul")

**Status.** Accepted (2026-06-30). Promotes the IDEAS "close the content→metrics loop" entry (2026-06-27). Related: the X bot posting boundary (ADR-058/071), the engagement-brief read path + card-resolver + figures-trace honesty gate (ADR-086), market-movers (ADR-069), the brand-voice gate (ADR-048).

**Context.** Foil's X-post generation (`lib/social/post-text.ts`) picks hooks + formats by informed guessing, and we have ≈0 own-post history to learn from. But the niche's outlier posts already reveal proven content MECHANICS (hook, format, angle, structure) that earn reach regardless of who posts them. Mining those and feeding them into our OWN generation bootstraps "what works" from the whole niche. **The risk to avoid:** copying winning posts naively means copying the loud hype voice (and sometimes another account's substance) — which would torch the calm, data-honest trust that converts reach → email signups → affiliate clicks. **P0 (the read tier):** confirmed `searchRecent` returns per-post `public_metrics` (likes/reposts/replies) on OTHER accounts' posts + the author `followers_count` (ADR-086 already wired `user.fields=public_metrics`); impressions are author-only (null on others') so ranking uses public engagement ÷ followers. Pay-per-use (~$0.005/read), bounded by the R-019 console cap. So the feasible scope is read → rank → extract → generate → dry-run preview. **Unlike the engagement-brief engine this is SAFE to fully automate** — it only informs OUR OWN posts (already an allowed surface), with no engagement-action ToS surface on others' posts.

**Decision — the principle: steal the container, keep the soul.** Copy the FORMAT/hook/structure (the loud mechanics that earn reach); NEVER the hype voice or another account's substance. Implementation in three layers:
1. **Outlier mining (the container, `lib/engagement/format-mining.ts`, read-only, in the zero-X-write firewall).** Sweep recent Pokémon-TCG posts via `searchRecent`; rank by **engagement RATE** = `(likes+reposts+replies) / max(followers, FOLLOWER_FLOOR)` — normalized by follower count so we surface posts punching *above* their weight, NOT just big accounts (absolute likes would only rediscover "big accounts win"). A `MIN_ABSOLUTE_ENGAGEMENT` floor + the follower-floor denominator stop a tiny-account post from manufacturing an infinite rate. Then Claude extracts the reusable MECHANICS (hook, format, angle, length, media, CTA) as a structured `MinedPattern[]` — explicitly NOT verbatim posts; model-supplied provenance (`sourcePostId`) is validated against the real outliers so it can't be fabricated.
2. **Generation (the soul, `lib/social/format-generation.ts`).** Feed a mined pattern + ONE real `market_movers` card into Claude: "use this proven hook/structure, in Foil's calm voice, citing ONLY these real figures." 
3. **The keep-the-soul gate (`validateFormatPost`) — the guarantee, reusing the engagement primitives.** Every generated post must pass: anti-hype (the reused `matchesHype` from `draft.ts` — catches "insane"/"must buy"/"guaranteed" that the SEO `voiceCheck` banned-list misses) + `voiceCheck` (em dash, AI-tells, vague numbers) + **figures-trace** (every `$` figure ∈ this card's real averages, reusing `suppliedFigures`) + **correct-card** (`resolveCardSlug(text)` must be null OR equal this card's slug — reusing the card-resolver so a mined hook can never pull in a DIFFERENT chase card) + link-free body + char limit. A draft that fails is rejected/regenerated, never returned. So "copy the format" can NEVER degrade into "copy the hype" or "cite wrong/fake data."

**Delivery — ship dry-run first, then safe-autonomous.** A weekly cron (`/api/cron/format-mining`, Sun 16:20 UTC, gated by `FORMAT_MINING_ENABLED` default off + Bearer `CRON_SECRET`) runs the sweep and posts a brief to Discord `#content-engine`: section A "what's working in the niche" (the mined formats + their outlier engagement rates, for John's awareness) + section B the gate-valid Foil-post previews — **DRY-RUN, nothing posted to X.** John eyeballs the format-mined posts before any could enter the live X-post path. A local `scripts/format-mining-dryrun.ts` mirrors it to `docs/content-intelligence/{date}.md`. **No new DB table** — the mined patterns are ephemeral per-sweep (we WANT evergreen winning formats to resurface), so no idempotency store is needed.

**Consequences.** The X bot stops guessing at hooks and learns proven formats from the whole niche while expressing them in Foil's differentiated voice + data — **loud container, our soul.** Because the gate reuses the engagement honesty/voice primitives, the wrong-card + fabricated-figure guarantees that protect the reply engine now also protect generated posts. The firewall test is extended to the mining/brief/cron files (read-only); the own-post GENERATOR is intentionally outside the firewall (it's an own-post generator like `post-text.ts`, gate-validated, and is meant to feed the live path once proven). **The seam to full autonomy:** the gate-valid `generateFormatPost` output can be wired into `runXBot`'s approval/live mode (own content, already allowed) — NOT activated in this ship; dry-run preview is the proving ground. **The honest caveat (engagement ≠ conversion):** engagement RATE measures REACH, not signups. Loud-and-different beats loud-and-same, but whether a louder format actually converts is answered by the UTM attribution (ADR-084) + the Sunday review, not by the engagement rate. New env `FORMAT_MINING_ENABLED` (default off). **Out of scope (forbidden by the gates):** verbatim post copying, hype voice, fabricated figures, any engagement action on others' posts (that stays the manual brief engine, ADR-086).

## ADR-088 — Catalog breadth expansion: every English set's top-5-by-value (chase-card coverage)

**Date:** 2026-07-01
**Status:** Accepted. Extends [ADR-046](#adr-046--tiered-per-card-rendering--catalog-expansion-to-1000-cards) (rank/expand pipeline + tiers) and [ADR-070](#adr-070--modern-set-catalog-expansion-unblocked-by-the-poketrace-only-movers-signal--the-volumemateriality-filter) (append-only, no-URL-drop expansion). Unblocks the market-card content engine (needs representative subjects to surface).

**Context.** The catalog tracked ~1,190 cards across **29 sets** — a thin slice of the SDK's **173 English sets**. The wave-1 long-tail (ADR-046/070) added DEPTH within those 29 sets but left ~144 sets **absent entirely**. That absence is the ROOT cause of the content engine surfacing obscure movers (e.g. "Lt. Surge's Bargain") instead of chase cards: the mover pool was drawn from a non-representative catalog. John's read (2026-06-30) — correct — was that this is a coverage gap, not a selection bug (Cowork's "it's just a selection problem" hypothesis was wrong). pokemontcg.io is English-only, so "every set" = every English set; Japanese is a tracked follow-up (IDEAS).

**Decision.**
1. **Add every English set's top-5 cards by SDK TCGplayer market value.** The most-valuable cards in a set ARE its chase cards (alt arts, special-illustration rares, gold/rainbow secrets, chase Charizards/eeveelutions), so ranking by value is a clean, automatable proxy for "desirable" — same rank source as ADR-046 (cheap: one SDK query per set; no PokeTrace hammering). Every ranked card has a TCGplayer price by construction, so its `/cards/[slug]` page renders real pricing (AggregateOffer + variants) even before any PokeTrace sold-history is baked. New script `scripts/expand-top5-per-set.ts` fetches all 173 sets, takes each set's top-5-by-price, dedupes against the ENTIRE existing catalog (curated + wave-1 long-tail), and writes a dedicated generated file `lib/cards/catalog-top5-per-set.generated.ts` (`TOP5_PER_SET_CATALOG`, tier "longtail"), spread into `CARD_CATALOG`.
2. **Dedicated generated file (not merged into the wave-1 long-tail).** Keeps the ≤5-per-set invariant testable in isolation (a set may still show >5 in `CARD_CATALOG` overall — the curated block + wave-1 add DEPTH to the original 29 sets) and makes regeneration a clean overwrite. Purely additive: no live `/cards/[slug]` URL is dropped (the SEO-regression guard from ADR-070).
3. **PokeTrace stays LAZY.** New cards enter with SDK price only (tier "longtail" → `SoldHistoryPanel` shows "not yet available" with ZERO network calls at render; `CardVariantsSection` + AggregateOffer render from the live SDK price). No bulk PokeTrace bake for the ~650 new cards (rate limits + renewal clock ~Jul 15). PokeTrace sold-comp resolves on-demand when a card is actually surfaced by the market-card engine.
4. **Coverage integrity (built under real API degradation).** pokemontcg.io was flapping healthy↔timing-out during the build; the script grew (a) per-request AbortController timeout + retry, (b) concurrent fetch (8 workers) so timeouts overlap, (c) a sequential retry-failed-sets pass (4 rounds) that self-heals transient set failures, and (d) an abort-guard that refuses to WRITE if any set is still unreadable after all retries — so a partial file can never overwrite a good one and "every set gets its top-5" stays honest. Sets with genuinely <5 priced cards contribute what's priced; **13 sets with 0 priced cards** (brand-new / promo sets without TCGplayer data) contribute nothing — null-over-guess, never fabricated.
5. **`bake:cards` variant-preservation fix + `--only-missing`.** `bake-card-metadata.ts` overwrote each card record with SDK metadata that lacks the baked-only PokeTrace `variants` field — a naive re-bake would have silently wiped every existing card's sold-history and forced a full (rate-limited) PokeTrace re-bake to restore. Fixed to overlay fresh metadata onto the prior entry (preserving `variants`); added `--only-missing` to bake ONLY net-new entries (the fast path for incremental expansion; the ~1.2k already-baked cards keep their full records + variants untouched). Also added an AbortController timeout to the bake fetch (same flaky-API defense).

**Consequences.**
- **Catalog: 1,190 → 1,840 cards; 29 → 159 sets** (650 net-new across 130 previously-missing sets, 5 each; score range $0.74–$7,000). Verified: chase cards from every previously-absent era now resolve (Shiny Vault Umbreon-GX, EX Dragon Charizard $772, XY Evolutions M Charizard-EX, Cosmic Eclipse Arceus & Dialga & Palkia-GX $489, Mega Evolution 2 Mega Charizard X ex). The market-card engine's mover pool is now representative.
- **~650 new indexable `/cards/[slug]` + ~130 new `/cards/sets/[id]` pages** enter the sitemap (both routes enumerate `CARD_CATALOG` with no cap). Net-positive for the programmatic-SEO long tail — but a conscious crawl-budget decision, so this ships committed-not-pushed pending John's call on the deploy.
- **Build cost rises**: `/cards/sets/[id]` prerenders one page per set (29 → 159) at build, each fetching card metadata (the now-complete 1,840-card baked snapshot is the fallback for SDK flake). Watch build time.
- **Baked snapshot: 1,840/1,840 cards, 173 sets.** The 14 sets in the SDK not in the catalog are the 13 zero-priced sets + `me1` (already covered by ADR-070, so it added 0 net-new).
- **Japanese-set expansion** is the tracked follow-up (IDEAS) — pokemontcg.io is English-only, so it needs a different data source.

**Cross-refs.** `scripts/expand-top5-per-set.ts`, `lib/cards/catalog-top5-per-set.generated.ts`, `lib/cards/catalog.ts`, `scripts/bake-card-metadata.ts`, `lib/__tests__/catalog.test.ts`, `docs/top5-per-set-ranked-2026-07-01.json`, [ADR-046](#adr-046--tiered-per-card-rendering--catalog-expansion-to-1000-cards), [ADR-047](#adr-047--ssgisr-hybrid-rendering--metadata-only-tier-for-the-18k-long-tail), [ADR-070](#adr-070--modern-set-catalog-expansion-unblocked-by-the-poketrace-only-movers-signal--the-volumemateriality-filter).

## ADR-089 — Baked-first card rendering + the one-parser bake fix (perf-and-data foundation)

**Date:** 2026-07-01
**Status:** Accepted. Phase 1 of the Fable overhaul plan ([AUDIT-2026-07-01-FABLE.md](AUDIT-2026-07-01-FABLE.md)); amends the render posture of [ADR-047](#adr-047--ssgisr-hybrid-rendering--metadata-only-tier-for-the-18k-long-tail) v2 and closes the parser defect ADR-088's bake exposed.

**Context.** Two coupled defects, both found by the 2026-07-01 audit. (1) **Render blocked on upstream health:** `getCardMetadata` was live-FIRST — every `/cards/[slug]` render (force-dynamic, so every crawl) fetched pokemontcg.io with retry-on-flake and NO per-attempt timeout, riding undici's ~300s default when the upstream hung. Measured 32–52s TTFB during a flap; 0.25–0.35s when healthy (the P0 re-measure confirmed the degradation is upstream-health-dependent, not constant). Googlebot doesn't pick a healthy moment, and the Jul-1 GSC sitemap resubmit was about to invite it into ~650 new pages. (2) **The snapshot the fallback relied on was price-empty:** `scripts/bake-card-metadata.ts` carried a stale 8-field duplicate of `parseCard` that silently dropped `tcgplayerPrices` + every reference-data field — so **0/1,840 cards in every snapshot ever committed had prices**, the JSON-LD AggregateOffer was null on every card, and nothing failed because `tsconfig.json` excluded `scripts/` from typecheck. The defect survived ~5 weeks and multiple bake runs.

**Decision.**
1. **Baked-first rendering (the inversion).** `getCardMetadata` returns the committed snapshot entry immediately — zero network — for any baked id; the live fetch runs only for ids absent from the snapshot. The snapshot is committed data we already trust for builds; there is no reason a page render should re-earn it from a flaky upstream on every request. Test callers (injected `fetchImpl`) keep the live-first path so failure-mode tests stay valid.
2. **Timeout-bounded live path (Phase A).** `fetchWithRetry` gains a per-attempt `AbortController` (default cap 15s, matching the bake script) and an options param for schedule overrides. The render path (`getCardMetadata`/`getSetMetadata` live fallback) runs 2 attempts × 2.4s + 200ms backoff — ≤5s worst case. `searchCards`/`getAllSets` keep the 4-attempt schedule (typeahead/API surfaces, now hang-proof via the 15s cap).
3. **One parser (Phase B).** The bake script imports `parseCard` from `lib/cards/sdk.ts`; the stale duplicate is deleted and a structural test forbids its return. `scripts/` is now INSIDE the root tsconfig (the `exclude` entry removed; target bumped ES2017→ES2018), which surfaced + fixed 8 latent type errors in 4 scripts.
4. **Variant-wipe guard.** The fresh SDK record always has `variants: []`, so the overlay `{...prior, ...fresh}` would have clobbered all 1,189 cards' baked PokeTrace variants. `lib/cards/bake-merge.ts::overlayFreshMetadata` strips baked-only fields from the fresh record before merging; invariant tests pin (a) snapshot-wide variant count ≥ the 1,752 pre-bake floor, (b) base1-4 carries real `tcgplayerPrices`, (c) ≥1,500 cards priced.
5. **Full re-bake + retry-failed + abort-guard.** All 1,840 cards re-baked fresh through the fixed parser; the script grew a sequential retry-failed pass and exits non-zero if a full bake leaves any card un-refreshed (never commit a partial refresh as complete).
6. **Sitemap + metadata hygiene (Phase D).** `/cards` + all `/cards/sets/[set-id]` hub URLs added to the sitemap (the crawl path INTO the long tail was omitted entirely); fabricated `lastModified: new Date()` replaced with the snapshot's real `bakedAt` (cards/sets) and post dates (blog), landings carry none; uniform `daily`/0.8 dropped (weekly; curated 0.8, long tail 0.5). One canonical-origin constant `lib/seo/site-url.ts` (non-www) replaces the drifted www/non-www fallbacks in the card page vs layout. The `"%s · Foil"` layout template + hand-suffixed `"| Foil"` page titles double-branded every major page (`… | Foil · Foil` live-verified) — suffixes stripped; card-page og:title/twitter:title now inherit the resolved title instead of hand-drifting.

**Consequences.**
- Card-page TTFB is decoupled from pokemontcg.io health: baked ids render with zero network; the worst case for a snapshot-missing id is ~5s, not ~50s. The R-013 ISR deferral stands — this makes force-dynamic cheap rather than reopening ISR.
- The committed snapshot is now load-bearing for prices (AggregateOffer, variants panel) — a bad bake fails the suite instead of silently shipping empty structured data.
- Bake-freshness matters more: a stale snapshot means stale (not missing) metadata. Periodic re-bake remains the ADR-030 follow-up.
- Sitemap tells Google the truth about change frequency; expect lastmod-driven recrawl behavior to settle.
- Risks logged: R-060 (render-blocks-on-upstream class), R-061 (the price-empty incident record), R-062 (PokeTrace ~Jul-15 renewal SPOF).

**Cross-refs.** `lib/cards/sdk.ts`, `lib/cards/bake-merge.ts`, `lib/cards/aggregate-offer.ts`, `lib/seo/site-url.ts`, `scripts/bake-card-metadata.ts`, `app/sitemap.ts`, `lib/__tests__/bake-snapshot-invariants.test.ts`, `lib/__tests__/baked-first-render.test.ts`, [AUDIT-2026-07-01-FABLE.md](AUDIT-2026-07-01-FABLE.md), [ADR-047](#adr-047--ssgisr-hybrid-rendering--metadata-only-tier-for-the-18k-long-tail), [ADR-088](#adr-088--catalog-breadth-expansion-every-english-sets-top-5-by-value-chase-card-coverage), [R-013](RISKS.md).

## ADR-090 — Start-funnel integrity: tri-store opt-in, idempotent watches, attribution, and an unsubscribe that stops alerts

**Date:** 2026-07-01
**Status:** Accepted. Phase 2a of the Fable overhaul ([AUDIT-2026-07-01-FABLE.md](AUDIT-2026-07-01-FABLE.md)); precondition for ANY traffic push (eve, X replies, paid). Extends ADR-078 (owned list), ADR-082/083 (unsubscribe coherence), ADR-084 (UTM attribution).

**Context.** The audit graded the /start funnel D on four defects: (1) the newsletter opt-in wrote to **Beehiiv only** — never `newsletter_subscribers` (Supabase) or the Resend audience, which is the store the weekly digest actually sends from, so /start opt-ins never received an issue; (2) the watch write was a bulk `.insert()` against UNIQUE(email, card_slug, variant, condition) — ONE duplicate rejected the whole batch and the user saw "Something broke" (the route's comment claimed duplicates were "silently absorbed" — false); (3) the form posted no `utm_*`/`src`, so the funnel's own top-of-funnel was unattributable despite the `watchlists.src` column existing; (4) `/api/unsubscribe` (the link in EVERY alert email, including Gmail's RFC 8058 one-click) called only Beehiiv — the alert cron kept sending forever, and the confirmation page told recipients to "email john…" to stop alerts (a CAN-SPAM hole on the funnel's highest-volume email type). Plus: no abuse guard beyond the per-request 50-card zod cap.

**Decision.**
1. **Tri-store opt-in on /start** — `recordSubscriber({ email, source: "start-page", utm })` (Supabase + Resend) + Beehiiv, mirroring `app/actions/subscribe.ts` with one deliberate deviation: the owned-list write is NOT gated on Beehiiv success, because /start's user-facing success is the watchlist, so gating would silently drop the subscriber. Soft-fail legs now ping `DISCORD_WEBHOOK_ERRORS` (`postError`) instead of a console.warn nobody reads.
2. **Idempotent watches** — every row goes through the shared `upsertWatchlist` (same conflict target as the per-card form). Re-submitting the same cards updates targets and returns 200.
3. **Attribution end-to-end** — StartPageForm captures `utm_*`/`?src=` on mount (the EmailCapture pattern), posts them; the route sanitizes (`sanitizeUtmValue`) and persists `src` on every watchlists row + utm on the subscriber record. A `/start?utm_source=x&utm_medium=bio` signup is queryable via `npm run subscriber-sources`.
4. **Unsubscribe stops EVERYTHING, and suppression is STICKY** — new `watchlists.alerts_paused_at` (migration `20260701230000`, applied) + `lib/wishlist/pause.ts::pauseWatchlistAlerts` (idempotent, gated on `IS NULL`, never throws). `/api/unsubscribe` now runs `syncUnsubscribe` (Supabase + Beehiiv newsletter legs) AND `pauseWatchlistAlerts`; the alert cron's scan excludes paused rows; the Resend webhook pauses alerts on `email.complained` (spam complaint = strongest opt-out; a plain contact.updated unsubscribe touches only the newsletter). The one-click link has no way to express "just this email type," so honoring it means stopping all email — the conservative CAN-SPAM-safe read. **Suppression hardening (the goal's /security-review caught a real bypass in the first cut):** the initial design cleared the pause on any explicit re-submission ("renewed consent") — but every watch write path is unauthenticated, so *anyone who knew a victim's email* could resume alerts to a complained address, and new rows were born unpaused. Fixed: `upsertWatchlist` never writes `alerts_paused_at: null`; it checks per-email suppression (`getAlertSuppression`) and writes suppressed emails' rows PAUSED (inheriting the original pause timestamp), with `/api/start` precomputing once per batch and the response indistinguishable from success (suppression state doesn't leak). Un-pausing requires a future verified-email action — bundled with the deferred double-opt-in (IDEAS). Knowing an email address is not consent. **Hardening #2 (verify pass residual):** the legacy `/api/watchlist` endpoint wrote emails verbatim while every pause/suppression query lowercases and matches case-sensitively — a row born `Victim@Example.com` could never be paused. `upsertWatchlist` now lowercases at the choke point (fixes all three callers at once) + backfill migration `20260701235000` (duplicate-safe lower(), applied; 0 mixed-case rows remain). Two accepted risks, documented not fixed: `getAlertSuppression` fails open on DB error (the subsequent upsert shares the same DB health), and an address with ZERO watch rows at complaint time carries no durable suppression marker — first-time-subscription harassment is inherent to the no-verification design until double-opt-in.
5. **Abuse guards, minimum viable** (`lib/start/guards.ts`) — off-screen honeypot (`website`; non-empty → FAKE success so the bot learns nothing), per-IP in-memory limiter (10 req / 10 min per instance; cold start resets — deliberate, no Redis before traffic justifies it), per-email TOTAL watch cap (100). Double-opt-in explicitly deferred (IDEAS; trigger: first deliverability complaint or >100 real subs).

**Consequences.**
- /start opt-ins now actually receive the digest, and every signup is channel-attributable from the first pushed link.
- Alert volume can only be stopped by the recipient themselves now — no manual john-inbox dependency; CAN-SPAM/deliverability posture materially better BEFORE list growth (R-059 amended).
- **A legitimately-returning unsubscribed user cannot self-resume alerts** (their new watches are written paused). Deliberate: the CAN-SPAM-safe failure mode. The unsubscribe page no longer suggests /start for alerts; the verified resume path ships with double-opt-in.
- The IP limiter is per-instance memory: multi-instance bursts multiply the budget. Accepted at pre-traffic scale; revisit with real infra when traffic arrives.
- The watch cap counts conservatively (upserts of existing watches count as new against the cap headroom).
- Every single-row watch write now carries one extra suppression SELECT (the /api/start batch precomputes it once). Negligible at current volume; the new `watchlists_email_idx` covers it.

**Cross-refs.** `app/api/start/route.ts`, `components/start-page-form.tsx`, `lib/start/guards.ts`, `lib/wishlist/pause.ts`, `lib/wishlist/upsert.ts`, `app/api/unsubscribe/route.ts`, `app/api/webhooks/resend/route.ts`, `app/api/cron/wishlist-alerts/route.ts`, `supabase/migrations/20260701230000_watchlists_alerts_paused.sql`, tests `lib/__tests__/{start-guards,unsubscribe-stops-alerts,start-page}.test.ts`, [ADR-078](#adr-078), [ADR-082](#adr-082--newsletter-hardening-resend-unsubscribe-sync-webhook--dedicated-sending-subdomain), [ADR-084](#adr-084--acquisition-phase-0-utm-channel-attribution-on-the-owned-newsletter-row--a-founder-only-readout), [R-059](RISKS.md).

## ADR-091 — Alert engine rebuilt as an honest event model (armed/fired state, market floor, evidence-line emails)

**Date:** 2026-07-01
**Status:** Accepted. Phase 2b of the Fable overhaul ([AUDIT-2026-07-01-FABLE.md](AUDIT-2026-07-01-FABLE.md)). Supersedes the `watchlist-alert-quality-overhaul` goal; absorbs Bug 1 (currency) from `trust-hardening-currency-and-affiliate.md` (that goal is trimmed to its affiliate-claim half — one owner per fix). Extends ADR-024 (the cron), ADR-043 (variant/condition watches), the Tranche-A verified-resolver migration (kept untouched — it's good), and ADR-069 (market_movers, now the alert comp source).

**Context.** The core pull-model promise — "we email you when something happens" — was structurally dishonest. (1) The sole trigger was `price ≤ target` with no baseline state: a below-target card re-alerted every ~24h forever, each email claiming it "just dropped." (2) A blank target became a 10,000,000¢ sentinel, so those watches fired on ANY verified listing and the email rendered "you wanted ≤ $100000.00." (3) The Browse search had NO `filter=`: auction bids and non-US/non-USD listings were "verified" prices (the $6-Charizard and £1,000-Moonbreon classes), and the scan converted `listing.price` to cents with no currency check — a £30 listing cleared a $40 target. All four premises verified at 24e65f0 before the rebuild.

**Decision — the event model (designed fresh from the goal spec, not patched):**
1. **State per watch row** (migration `20260702000000`, applied): `last_seen_price_cents` (written on EVERY evaluation — baseline freshness), `last_alerted_price_cents`, `alert_state` ('armed' | 'fired'). `target_price_cents` is now NULLABLE; the sentinel is backfilled to NULL and structurally test-forbidden.
2. **Fire condition (ALL must hold):** a VERIFIED listing (the existing resolver identity gates remain the only path to an email) that is fixed-price/US/USD, price ≤ effective target, state 'armed'.
3. **Reference floor:** `effective_target = max(user_target, 15% under the 30-day sold avg)` from the `market_movers` cache (real PokeTrace aggregates, ≤36h fresh). Blank target = the floor alone. **Comp-axis honesty (I-009):** the NM-tier comp sets the floor only for NM-comparable watches ("any-raw"/"nm"); it never lifts a cross-axis (LP/graded) watch's trigger, and a blank-target cross-axis watch has no basis → holds with a counter.
4. **Hysteresis re-arm:** after firing, state 'fired'; re-arm only when price rises above `effective × 1.05`. Oscillation around target fires once. The 24h cooldown stays as a volume backstop, not the mechanism.
5. **Honest kinds:** "dropped" ONLY when a cross was observed (prior seen above, now at/below). First observation already-below → ONE "already below" email. A failed send records the observation but does NOT transition to 'fired' (the retry says "already below" — the cross is spent).
6. **Marketplace hygiene at the API:** `searchItems` now always applies `filter=buyingOptions:{FIXED_PRICE},itemLocationCountry:US,priceCurrency:USD` (syntax verified against the official Buy API Field Filters reference) — every surface (pages, deals, wishlist) stops ingesting auctions and non-US/non-USD listings at the source. The scan ALSO re-checks currency explicitly (belt and braces; skip + `skippedNonUsd` counter; a non-USD price writes no baseline — it's not an observation on the USD axis).
7. **Delivery doctrine — "the page is the house, email is the doorbell" (John, 2026-07-01):** the alert email is a thin ping — honest subject, the evidence line ("30-day avg sold (Near Mint): $92.00 · this listing: $75.00 (18% under)" or the explicit no-comp disclosure), ONE link to the card page. No images, no buttons (ADR-079 Primary-safe), no affiliate link in the email (revenue flows through the page), no "newsletter" framing.
8. **Blank-target plumbing:** NULL end-to-end (/api/start, /api/watchlist validate, the card-page action maps blank → null; the shared upsert type is nullable).

**Consequences.**
- Alert volume drops to genuine events; each email cites market evidence. The re-arm rule means a user hears about a card again only after its price actually recovers and drops again — stated verbatim in the email footer.
- Blank-target watches on cards without a fresh movers comp (long-tail slugs outside the daily cron's curated sweep) hold silently (`heldNoBasis` counter surfaces the volume). Widening comp coverage = widening the movers sweep — a deliberate future knob, not a bug.
- The market floor can fire ABOVE a user's explicit low target (max()) — spec'd product behavior; the copy carries the market basis, never claims the user's target was met.
- Removing the affiliate link from alert emails trades a direct email→eBay click for page-mediated attribution — accepted under the delivery doctrine.
- The Browse filter changes ALL surfaces' listing pools (deals refresh, card pages): non-US/auction listings disappear from candidate sets. That's the desired end of the $6-Charizard/Moonbreon class at the source.

**Cross-refs.** `lib/wishlist/alert-decision.ts` (pure core), `lib/wishlist/scan-batch.ts`, `lib/wishlist/alert-email.ts`, `lib/affiliate/ebay-browse.ts` (`BROWSE_MARKETPLACE_FILTER`), `app/api/cron/wishlist-alerts/route.ts` (state writes + movers comp), `supabase/migrations/20260702000000_watchlists_alert_state.sql`, tests `lib/__tests__/{alert-decision,wishlist-scan-batch,wishlist-alert-email,ebay-browse}.test.ts` (fixture 12 acceptance), [ADR-069](#adr-069--insight-led-market-movers--good-buys-signal-aggregate-momentum-over-fragile-single-listings--the-like-for-like-currency-gate), [ADR-079](#adr-079--branded-newsletter-email-react-email-text-forward-to-hold-gmail-primary), [ADR-090](#adr-090--start-funnel-integrity-tri-store-opt-in-idempotent-watches-attribution-and-an-unsubscribe-that-stops-alerts), [R-010](RISKS.md).

## ADR-092 — Demand-driven PokeTrace hydration: watches allocate the data budget

**Date:** 2026-07-01
**Status:** Accepted. Phase 2.5 of the Fable overhaul; the data-budget doctrine behind ADR-091's evidence lines. Extends ADR-042/049.2 (variant bake + market ladder), ADR-088 (the lazy-PokeTrace boundary on the top5-per-set expansion), ADR-069 (market_movers as the comp cache).

**Context.** Foil cannot afford deep sold data on every card — an industry-hard problem (per Collectrics). But a watch SERVICE doesn't need breadth; it needs depth on the cards people actually track. The ~650 ADR-088 long-tail cards shipped with zero PokeTrace variants by design; their sold-history panels say "not yet available," their blank-target alerts have no basis, and their alert emails would carry the no-comp disclosure forever. PokeTrace is renewed (paid 2026-07-01); 10K req/day is ample for demand-driven depth — and nowhere near enough for bulk breadth.

**Decision — demand allocates the data budget.**
1. **Prioritization doctrine (recorded): watched > high-value > everything else. NEVER bulk-hydrate the full catalog.**
2. **One resolution path.** The bake script's PokeTrace search + market-fallback ladder + override handling is extracted to `lib/poketrace/hydrate-core.ts::resolveVariantsForCard`; the bake script, the runtime worker, and the seed script all import it (test-pinned — a second ingestion path is structurally forbidden).
3. **Trigger:** the shared watchlist upsert (every watch write path) enqueues any card whose catalog entry has no baked variants into `card_hydration` (migration `20260702010000`, applied) — one table is both queue and store; the PK makes enqueueing idempotent; soft-fail never blocks the watch write.
4. **Worker:** hourly cron `/api/cron/hydrate-cards` (:10, off the :00 stampede) drains oldest-first, capped at 50 cards/run with 200ms pacing (≤~250 PokeTrace calls/run — under the 30 req/10s burst and far under 10K/day). `no_match` is terminal (vendor gap, never retried); transient errors retry to 3 attempts, then ping `#errors`.
5. **Surfaces merge, baked wins:** the card page and the movers cron fall back to DB-hydrated variants only when the baked snapshot has none; a later local bake run folds hydrated cards into the committed snapshot for good. The sold-history panel discloses "Sold data tracked since <date>" on hydrated cards, and its empty state now tells visitors that watching a card is what queues it for tracking.
6. **The alert coordination:** hydrated cards join the movers cron's momentum universe, so their NM 30-day averages land in `market_movers` — which is exactly what makes blank-target ("15% under 30d avg") alerts and evidence lines possible on long-tail cards (ADR-091 reads the same cache).
7. **Proactive seed (one-time, the high-value leg):** the top-100 unhydrated cards by baked TCGplayer value were seeded through the same shared path directly into the committed snapshot — **81 hydrated · 19 no-match · 0 errors** (misses: alpha-numbered promos the matcher can't parse [H28/SWSH296-class] + genuine PokeTrace catalog gaps like the Van Gogh Pikachu — graceful degradation, logged). Snapshot: 1,189 → 1,270 cards with variants; 1,752 → 1,839 total variants.

**Consequences.**
- Sold-history depth accrues where demand exists, at ~zero standing cost; the PokeTrace budget is spent by watches, not by breadth ambitions.
- Two variant sources exist until a bake run folds the DB layer in — the merge rule (baked wins; DB fills gaps) keeps them coherent, and the periodic-bake follow-up (ADR-030) now also syncs hydration.
- Alpha-numbered promos (SWSH296, H28, SV49…) can't hydrate until `matchCatalogCard` learns letter-prefixed collector numbers — a known matcher limitation, now visible in the seed log and the `no_match` rows (future fix, not silent).
- Blank-target alerts on hydrated long-tail cards start working the day after hydration (next movers run populates their comp).

**Cross-refs.** `lib/poketrace/hydrate-core.ts`, `lib/poketrace/hydration.ts`, `app/api/cron/hydrate-cards/route.ts`, `supabase/migrations/20260702010000_card_hydration.sql`, `scripts/seed-hydration.ts`, `scripts/bake-poketrace-uuids.ts` (refactored), `lib/__tests__/hydration.test.ts`, [ADR-088](#adr-088--catalog-breadth-expansion-every-english-sets-top-5-by-value-chase-card-coverage), [ADR-091](#adr-091--alert-engine-rebuilt-as-an-honest-event-model-armedfired-state-market-floor-evidence-line-emails), [ADR-069](#adr-069--insight-led-market-movers--good-buys-signal-aggregate-momentum-over-fragile-single-listings--the-like-for-like-currency-gate).

## ADR-093 — The vault: token-access watchlist page (no login wall, binder-structural, the "house" half of the SaaS synthesis)

**Date:** 2026-07-01
**Status:** Accepted. John's directive 2026-07-01 — a non-negotiable product surface; the "page is the house" half of ADR-091's delivery doctrine (alert emails = the doorbell). Sequenced after alert-engine-rebuild + demand-driven-data, before the eve delivery. Extends ADR-090 (pause machinery), ADR-091 (state rules), ADR-092 (add-card rides the hydration trigger).

**Context.** Users must be able to build and manage their watchlist in the web app — but the funnel promises "no account required," and Supabase-auth accounts don't arrive until the Pro tier. The alert emails' one link needs somewhere rich to land.

**Decision.**
1. **Access = a private signed-token URL (`/w/<token>`).** Token = HMAC-SHA256 over the email payload, **context-separated** from the unsubscribe token (`"foil-vault.v1|" + payload` in the HMAC input) — SAME `UNSUBSCRIBE_TOKEN_SECRET` (no new env var), but the audiences are cryptographically disjoint: an unsubscribe token can never open a vault and vice versa (test-pinned both directions). Constant-time verification; every failure renders 404 (the URL space is indistinguishable from not-found); the email never appears in the URL. `/w` prefix added to PUBLIC_ROUTES (segment-scoped; proxy test).
2. **Link-sharing risk accepted for v1** (RISKS R-064): anyone with the link can view/edit that watchlist — the private-calendar-link class. Every distribution point says so plainly.
3. **Distribution:** the /start success screen + `/api/start` response (`vault_url`), the card-page form success, a first-watch welcome email, the alert-email footer ("Manage your watchlist"), and a `/w` recovery form that re-sends the link with a UNIFORM response (never discloses whether an email exists).
4. **The binder is structural, not theatrical:** 3×3 desktop / 2-col mobile pocket grid (9 = the platonic binder page), faint plastic-pocket inset depth, pagination as a page-turn link, ONE first-open ~300ms settle (localStorage-gated, `motion-safe:` only). NO loading gate — daily-visit surface; the sub-second load IS the feature. Art-forward tiles, market data set quietly beneath; "vault" is the product noun; warm possessive copy.
5. **Pause provenance (`paused_source`, migration `20260702030000`, applied):** 'vault' | 'unsubscribe' | 'complaint'. Vault pause/resume is the user's own toggle; unsubscribe-sourced pauses ARE resumable from the vault (the token holder received it by email — verified email control, stronger re-consent than ADR-090's knowing-an-address concern); **complaint-sourced pauses are NOT resumable** from the vault. Per-email suppression (the ADR-090 sticky rule) now counts ONLY unsubscribe/complaint — a vault pause is a per-card preference and never makes new watches born dead. Suppression inheritance carries the SOURCE, so a complaint-inherited row keeps its lock. Pre-existing pauses backfilled to 'unsubscribe'. `alert_state` is never touched by vault edits — ADR-091's armed/fired rules alone govern firing.
6. **Quota + speed discipline (a deliberate deviation from the goal sketch, documented):** the vault does NO live eBay resolve. Nine curated tiles doing nine resolves per view would dwarf the card page's Browse budget (R-012) and break the sub-second requirement. Each pocket shows the alert engine's **last verified observation** (`last_seen_price_cents`, at most one scan old, labeled "Last verified listing") + the movers-cache sold average ("sold for ~$92 recently") and links to the card page for the live block. Sort = closest-to-target using the same observation.
7. **Add-in-place uses the SHARED type-ahead** — extracted from /start into `components/cards/card-typeahead.tsx`; both surfaces import it (fork structurally forbidden by test). The vault's add rides `upsertWatchlist`, so suppression-inherit + demand-driven hydration come along free.

**Consequences.**
- The alert email finally has a house to point at; every capture surface hands users their vault immediately.
- Anyone with the URL can edit — revisit at the first support incident or with Pro accounts (R-064's trigger).
- Secret rotation invalidates vault links in old emails (same trade as unsubscribe links; recovery form is the path back).
- The last-verified price can be up to a scan old and absent before a card's first scan — labeled honestly rather than fetched live.

**Cross-refs.** `lib/vault-token.ts`, `app/(site)/w/[token]/page.tsx`, `app/(site)/w/page.tsx`, `app/actions/vault.ts`, `lib/wishlist/{pause,upsert,vault-email,alert-email,scan-batch}.ts`, `components/cards/card-typeahead.tsx`, `components/vault/*`, `supabase/migrations/20260702030000_watchlists_paused_source.sql`, `lib/__tests__/vault.test.ts`, [ADR-090](#adr-090--start-funnel-integrity-tri-store-opt-in-idempotent-watches-attribution-and-an-unsubscribe-that-stops-alerts), [ADR-091](#adr-091--alert-engine-rebuilt-as-an-honest-event-model-armedfired-state-market-floor-evidence-line-emails), [ADR-092](#adr-092--demand-driven-poketrace-hydration-watches-allocate-the-data-budget), [R-064](RISKS.md).

## ADR-094 — Brand mark refresh: the hanko seal + "Foil" wordmark (supersedes ADR-055; gold retired)

**Date:** 2026-07-01
**Status:** Accepted. Stage 2 of the `brand-mark-refresh` goal (Stage 1 = John's direction pick). Supersedes [ADR-055](#adr-055--fredoka-foiltcg-wordmark--foil-corner-card-mark-pokeball-retired) (the foil-corner card + gold "FoilTCG" wordmark). Coordinates with the fable-design-overhaul palette revision.

**Context.** Two forcing functions (John, 2026-07-01). (1) The gold accent is being retired, which kills the gold-sheen "TCG" wordmark treatment — the mark and the palette succession had to land coherently. (2) The brand needed a single owned mark that IS *also* the accent-color decision. **P0 premise reconciliation:** the goal's framing ("the live mark is a literal Pokéball") was already STALE — ADR-055 retired the Pokéball on 2026-06-05 (the live mark was the foil-corner card, IDEAS #295 marked SHIPPED). So this refresh is driven by forcing-function #2 (gold retirement), not a live IP exposure; the deliverable — implement John's Stage-1 pick everywhere — is unaffected. Recorded honestly rather than restating a resolved risk as open.

**Decision — implement "C1, the hanko, carved straight" (John's Stage-1 pick).**
1. **The mark (`SealMark`, `components/brand/logo.tsx`):** a vermillion (`#D85A30`) carved seal square with a card slotting into a pocket, knocked out in cream (`#f8f5f0`) in negative space. The **seal square IS the mark** — favicons/avatars render it full-bleed (rounded square, not circle-cropped). A single-ink navy monochrome variant exists for one-color contexts; at ≤16px the card stroke thickens (~1.8) for legibility. Master geometry is John's canonical 24×24 SVG, refined optically.
2. **The wordmark:** "Foil" in **Bricolage Grotesque 600** (replaces Fredoka, whose rounded playfulness clashed with the carved seal), navy on cream / cream on navy. **"TCG" is dropped from the display wordmark** (the domain keeps the longer form); the gold-sheen treatment is gone.
3. **The hanko vermillion `#D85A30` is the accent color that succeeds gold.** But this mark ships **palette-agnostic** (the goal's explicit constraint): the seal carries its own vermillion everywhere; the broader gold→vermillion *UI accent* migration (buttons, links, badges) is the separate fable-design-overhaul goal's work. A brief transitional state (vermillion mark next to still-gold UI accents) is sanctioned by the goal's "mark-first is fine" note.
4. **Rolled across every surface in ONE commit** so no surface lags: favicon.svg (full-bleed seal), icon.svg (seal + "Foil"), apple-touch + `icon-192/512.png` (sharp-rasterized from the seal), the new `app/manifest.ts` metadata route, the OG/Twitter share card (seal mark + "Foil" + vermillion accent + Bricolage font load), the site header/footer `<Logo>`, and the two email mastheads (text-forward "Foil", no image — ADR-079 Primary rule). The "How it works" homepage watermark tiles the seal glyph.

**Consequences.**
- Every brand touchpoint reads as the seal; the gold-"TCG" treatment is fully retired. The `FoilCornerMark` export is kept as a deprecated alias → `SealMark` so no call site breaks.
- A transitional palette state exists until fable-design-overhaul migrates the UI gold accents to vermillion — accepted, documented.
- Off-repo surfaces (X avatar/banner, Discord icon, Beehiiv logo) can't be bot-swapped — a 3-line checklist for John lives at `docs/brand-mark-offrepo-checklist.md` (use `public/icon-512.png`).
- The IP-exposure risk (R-... / IDEAS #295) was already resolved by ADR-055; ADR-094 does not re-open it — it changes the *owned* mark, not the trade-dress posture.

**Cross-refs.** `components/brand/logo.tsx`, `app/layout.tsx`, `app/globals.css`, `public/favicon.svg`, `public/icon.svg`, `public/apple-touch-icon.png`, `public/icon-{192,512}.png`, `app/manifest.ts`, `app/opengraph-image.tsx`, `app/(site)/layout.tsx`, `app/(site)/page.tsx`, `emails/{editorial,movers}-digest-email.tsx`, `DESIGN.md` §5, `lib/__tests__/visual-regression.test.ts`, `docs/brand-mark-offrepo-checklist.md`, [ADR-055](#adr-055--fredoka-foiltcg-wordmark--foil-corner-card-mark-pokeball-retired), [ADR-079](#adr-079--branded-newsletter-email-react-email-text-forward-to-hold-gmail-primary).

## ADR-095 — The line tracker: /lines/[pokemon] shareable pages, sakura register accent, null-over-guess sold data (the gift-economy acquisition play)

**Date:** 2026-07-02
**Status:** Accepted. Delivers the `eve-line-tracker` goal (John + Cowork, 2026-07-01). Launch lines: `umbreon`, `espeon`, dedicated to @possiblyeve (~50K followers). Builds on [ADR-091](#adr-091) (alert-engine-rebuild — a hard prereq: sending a creator's audience into the old $100k-sentinel spam alert would have been anti-viral), [ADR-092](#adr-092) (demand-driven hydration — seeded the Eeveelution cards), [ADR-094](#adr-094--brand-mark-refresh-the-hanko-seal--foil-wordmark-supersedes-adr-055-gold-retired) (the seal mark — do not put a trademark liability in front of 50K people).

**Context.** The buyer-side deal-finder needs an acquisition channel with a viral surface. The play (John): build a *bespoke, beautiful* page tracking every printing of a Pokémon a high-reach collector cares about, dedicate it to them, and let the "made-for-me" feeling drive a share to their audience. Realistic math: 5–20K impressions → 150–600 visits → 30–100 tracked-card signups. The critical constraint is trust: this is Foil's most public surface yet, and **wrong prices in front of collectors is anti-viral** — a sharp Eeveelution collector will screenshot a $499k Damaged-copy "sold" figure and mock it. So it had to be built as a REUSABLE product surface (config-driven, line #3 is a data entry), not a one-off microsite — the flop case leaves permanent SEO pages ("every umbreon card" is a real query); the win case is a repeatable playbook.

**Decision.**
1. **Config-driven route (`app/(site)/lines/[pokemon]/page.tsx`, `force-static`).** Lines are entries in `lib/lines/config.ts` (`LINE_CONFIGS` + `LAUNCH_LINES` allowlist); `getLineConfig` returns null for anything not in the allowlist so unshipped lines 404. `/lines` is a PUBLIC_ROUTES prefix (pinned in `proxy.test.ts`). The page reads ONLY baked sources (baked snapshot + a committed sold snapshot) — zero network at render, so it prerenders and feels instant. The live "cheapest right now" listing stays on each card's `/cards/[slug]` page (R-008 no-cache), linked per row — 44 live eBay fetches on the line page would break the speed and the quota (R-012).
2. **Null-over-guess sold data (the trust moat).** Sold figures come from a committed snapshot (`lib/lines/sold-snapshot.generated.json`) seeded once by `scripts/seed-line-sold.ts` from real PokeTrace NM/LP sold history — NOT SDK-guessed. A card with no quality sold data renders **"Sold data pending — we're tracking it,"** never a fabricated figure. The seed applies an **outlier-suppression moat**: headline only NM/LP tiers (MP/HP/DMG junk-copy prices are where a 2-sale $499k Damaged outlier lives), require ≥3 sales, and cross-check against the baked TCGplayer market (reject > 4× the market high or < 0.15× the market low). Two cards were correctly suppressed to pending on seed (POP 5 Espeon ★: a $499k Damaged outlier; a $320k Umbreon on a ~$50 card) — the exact 12×-contradiction failure the audit warned about.
3. **Price high → low, sold-aware + outlier-resistant ranking.** Default sort is "most valuable first" (Moonbreon on top — the immediate wow). The rank value is `max(recent sold, current market)` so a card that recently SOLD high (e.g. a vintage EX that trades above TCGplayer market) isn't buried below cheaper cards. It **never sorts on the TCGplayer `high` field** — that's polluted by single $9,999 placeholder listings (sorting by `high` put a $499-market card above Moonbreon). For the same reason the displayed market line anchors on the representative `market` value (`marketPhrase` → "Around $X"), not the low/high range whose ceiling is the same $9,999 junk — keeping the shown number consistent with the sort so a card can't read "Around $5,000" while sitting below "$2,000" cards.
4. **Sakura register accent — an INTENTIONAL accent, not a brand fork.** New page-scoped tokens `--color-foil-sakura` / `--color-foil-sakura-wash` + a `sakura-fall` keyframe layer a cherry-blossom accent over the cream/navy base. Sakura behaves like coral does elsewhere: hover/accent + a soft resting wash only, never a loud resting fill (pinned by an extension of the coral-hover-only invariant). The surface stays unmistakably Foil (seal wordmark, navy ink, Fraunces/Geist type). Motion lives ENTIRELY in `motion-safe:` — `prefers-reduced-motion` users get static scattered petals and the rail degrades to instant jumps; there is no auto-scroll ever.
5. **One signature interaction (the flourish budget).** A horizontal card-art scroll rail (`LineCardRail`) — the collector's-eye view; clicking a tile smooth-scrolls to its row. That plus the sakura accent is the *entire* flourish budget; everything else stays Flat-At-Rest.
6. **Plain-language labels.** Collector words only — "Sold for ~$2,214 recently," "Around $2,276 to buy right now" — never "30d avg" / "momentum" / "Δ7d." A label that needs finance vocabulary to parse is a bug.
7. **Dedication + funnels.** A config-driven "Made for @possiblyeve" line (absent → no dedication — people share what's made for them). Every path funnels to `/start`: per-card **Track this card** forms (post one card into the existing `/api/start` tri-store with `src=line-umbreon`) + a persistent "watch your own cards" CTA, all UTM-tagged (`utm_source=x&utm_medium=line_page&utm_campaign=eve`). Mobile-first — the audience opens this from a tweet on a phone.
8. **SEO.** Full metadata + a gorgeous shared OG card (`opengraph-image.tsx`, nodejs runtime: seal + "Foil" + "Every {Pokémon} card, tracked." + a fan of the top-3 art, soft-falling to text-only sakura if art/font fetch fails) + JSON-LD `ItemList` of every printing in price order.

**Consequences.**
- Universe enumeration added **45 net-new Umbreon/Espeon printings** (additive per ADR-070) via `scripts/expand-eeveelutions.ts` → `catalog-eeveelutions.generated.ts`; the catalog is 82 across the two lines (44 Umbreon, 38 Espeon). Sold-data coverage is honest: **27/44 Umbreon + 25/38 Espeon** carry real figures; the rest render "pending."
- **Seed-artifact discipline caveat (found in verification):** the committed snapshot had been generated by a pre-fix seed script that wrote a `cents` field, while the data layer reads `soldCents` — so every card silently rendered "pending" (the Moonbreon wow was dead) even though the JSON looked full. A generated artifact whose field shape drifts from its reader is the R-015 write/read trap in miniature; the end-to-end data spot-check (not the passing build) is what caught it. Fixed by aligning the field name; the accuracy pass is now a required closure step for this surface.
- The sold-vs-market divergence on thinly-traded vintage EX cards (e.g. Unseen Forces Umbreon ex: ~$1,196 sold / ~$501 market) is REAL market reality (TCGplayer aggregate lags eBay NM sold for 20-year-old cards), not a bug — both figures are individually sourced and the "Every figure is real market data" line covers it.
- The snapshot is point-in-time; the page labels it "as of <date>" so a stale snapshot never overclaims currency. Refresh = re-run `scripts/seed-line-sold.ts` (needs `POKETRACE_API_KEY` + baked variants).
- New public-accuracy exposure risk logged in RISKS (a wrong figure now reaches a creator's whole audience, not just a crawler). The suppression moat + null-over-guess + the accuracy-pass closure gate are the mitigation.
- Delivery + the pinned @FoilTCG reveal are John's to send (out of goal scope); the goal ships the pages + the UTM funnels behind them.

**Cross-refs.** `app/(site)/lines/[pokemon]/page.tsx`, `app/(site)/lines/[pokemon]/opengraph-image.tsx`, `lib/lines/{config,data}.ts`, `lib/lines/sold-snapshot.generated.json`, `scripts/{expand-eeveelutions,seed-line-sold}.ts`, `lib/cards/catalog-eeveelutions.generated.ts`, `components/lines/{sakura-petals,line-card-rail,line-track-form}.tsx`, `app/globals.css` (sakura tokens + keyframe), `lib/supabase/public-routes.ts`, `lib/__tests__/{proxy,visual-regression,catalog}.test.ts`, [ADR-070](#adr-070), [ADR-091](#adr-091), [ADR-092](#adr-092), [ADR-094](#adr-094--brand-mark-refresh-the-hanko-seal--foil-wordmark-supersedes-adr-055-gold-retired), [R-015](RISKS.md).

## How to add an ADR

1. Pick the next number (don't reuse).
2. Title: short, specific. The choice + the rationale, not the topic.
3. Sections: Status (Accepted / Superseded / Deprecated), Context (what was true that forced the choice), Decision (what we chose, concretely), Consequences (what now follows — costs, constraints, follow-ups).
4. If superseding an old ADR, edit the old one to add "Superseded by ADR-N" to its Status — don't delete it.


## ADR-096 — The night register: homepage as "the lit room" (dark direction wins the DIVERGE face-off; chrome tone variables; vermillion succession begins)

**Date:** 2026-07-02 · **Status:** Accepted (pending John's morning merge of `design/overnight-loop-2026-07-02`)

**Context.** John's 2026-07-02 evaluator pass named four enemies on the live homepage — flat/no depth, empty/sparse, generic-AI-template smell, weak hero moment — and unlocked the brand system ("anything for the ICP"), with a taste direction of basement.studio energy tuned to collectors and a functional thesis: holographic card art is a light source, and light sources need dark walls. The overnight evaluator-optimizer loop (goal: overnight-design-loop) ran a DIVERGE phase — a dark rebuild vs an honest evolved-warm control scored against one rubric — then converged on the winner.

**Decision.**
1. **The homepage runs a night register** ("the lit room"): warm near-black surface tokens (`--color-foil-night` #0a1322, `--color-foil-night-2` #101d31 — navy-derived, never #000), where the grail card fan is the light source (glow spills, a floor pool, Moonbreon focal). Scoped to the homepage via `data-tone="night"`.
2. **Chrome tone variables, not a layout fork:** the shared (site) header/footer read `--chrome-*` CSS variables; `body:has([data-tone="night"])` flips them dark. Any future page is one attribute from the night register; no client JS, no route-group split.
3. **Vermillion (#d85a30) is now a first-class token** (`--color-foil-vermillion`) and REPLACES gold on every surface the loop touched (homepage, /start, /deals, email-capture, typeahead). This begins the ADR-094-coordinated gold retirement in the UI; untouched surfaces keep gold until their own pass — do not add new gold.
4. **The signature effect is holo-tilt** (`components/cards/holo-card.tsx`): pointer-tracked 3D tilt + foil sheen (pokemon-cards-css technique in-house), transform/opacity only, touch never tilts, reduced-motion fully static (verified live). Tier-1 ambience is CSS scroll-driven reveals (`animation-timeline: view()`) behind `@supports` + reduced-motion exclusion; the hero never reveals (LCP guard).
5. **The tiled seal-watermark wallpaper is dead** and guard-forbidden (no SVG `<pattern>` tiles on the homepage). Depth is structural (light, planes, interaction), never applied texture.
6. **Wordmark soft cut:** "Foil" in Baloo 2 600 (`--font-wordmark-soft`, `Logo face="soft"`) in the site chrome; Bricolage stays the carved cut on OG/favicon surfaces pending the brand-asset follow-up goal.

**Evidence.** DIVERGE scores: dark 8.06 vs warm 7.81 at first-draft fidelity; the gap sat exactly on the ICP-resonance and card-art-spotlight dimensions (holo art visibly dims on cream in the side-by-side galleries: design-loop/gallery/iter-01 vs iter-02). The converged dark homepage sustained avg >= 8.5 / min >= 7.5 across two consecutive iterations (iter-05 8.56, iter-06 8.59) and terminated on quality. Full trail: design-loop/{RUBRIC,RESEARCH,ITERATION-LOG,SUMMARY}.md.

**Consequences.**
- The homepage guard block in `lib/__tests__/visual-regression.test.ts` pins the new contract (pull-model H1 + "Start your vault" -> /start, no wallpaper patterns, night mechanism, HoloCard eager loading, reveal/reduced-motion discipline). The warm direction remains recoverable at commit `efc26ac`.
- The marketing-dark / task-light split (dark homepage -> cream /start, vault, card pages) is deliberate tonight; extending night to other surfaces is John's decision, one `data-tone` attribute per page when made.
- DESIGN.md gains §7a (night register) + night/vermillion tokens; `.impeccable/design.json` carries their tonal ramps. The "Dealer's Quiet Backroom" §§1-6 canon still governs untouched cream surfaces.
- Follow-ups (tracked in ROADMAP/IDEAS): brand-asset re-roll in the new register, night-register decision for /cards + /start, /lines + card-page polish under the won direction, blog-index split.


## ADR-097 — Charcoal ground + sakura succeeds teal (pre-send-coherence: one visual family before the eve send)

**Date:** 2026-07-02 · **Status:** Accepted

**Context.** Eve's audience enters on /lines (cream + sakura) and clicks into the night surfaces (previously navy-derived ground + moon-glow teal accent, ADR-096 + round-2 bake-off). John's in-prod verdict: the /lines pages set the standard — "design choices should follow the espeon and umbreon pages across the board." The teal ratification is explicitly superseded by this call; recording the succession rather than silently flipping.

**Decision.**
1. **Charcoal ground:** `--color-foil-night` #0d0d0e / `--color-foil-night-2` #17171a — neutral matte charcoal, zero blue cast (supersedes the navy-derived #0a1322/#101d31). The cards and data are the only luminous objects. Navy survives solely as semantic ink/shadow on cream surfaces.
2. **Sakura succeeds teal as THE accent, site-wide, both tones:** `--color-foil-accent` = #d98aa0 (the /lines petal ink itself; ~7:1 on charcoal) · `--color-foil-accent-deep` = #a5546e (4.8:1 on cream). One hue family across /lines → home → /deals → cards → vault. **Teal (#6fd8c5/#0e7c6b) is RETIRED** (guard-enforced: the hexes are forbidden in globals). Raw teal rgba values in the hero rim glow/reflection swept to sakura; the holo-sheen's vermillion stop retinted sakura (pale-blue stop kept — iridescence, not accent).
3. **Hero fan links (navigation promise verified):** every fan card + vault pocket links to its `/cards/[slug]` page via a catalog lookup (null over guess — uncatalogued renders unlinked); all 8 targets verified rendering WITH price data before shipping. Fan is no longer aria-hidden; links carry `aria-label "<name> — sold prices and live listings"` + accent focus-visible ring.
4. **Fan composition:** symmetric wing cadence (mirrored tilt/arc), per-card `gap` clearance kills the sliver-behind-focal bug, per-card `fx` equalizes edge luminance (artwork brightness differs; treatment compensates), firmer floor (contact shadow + sakura reflection pool).

**Consequences.** Gold remains wordmark-scope (the wordmark itself is the post-send blackout goal); vermillion stays hanko ink. Emerald/amber semantic tints stay for meaning. Guards pin the charcoal hexes, the sakura pair, the teal ban, and the hero-link contract. The round-2 bake-off galleries remain the record of why teal was tried; this ADR is the record of why it retired: coherence with the surface eve actually lands on beats a palette argued from the focal card's art.


## ADR-098 — Alert digest batching: one email per subscriber per cron run (send-boundary aggregation)

**Date:** 2026-07-02 · **Status:** Accepted (live proof pending John's push + next cron)

**Context.** The hourly alert cron sent one email PER WATCHLIST ROW — John received 7 separate Foil emails at 12:01 PM, including TWO for the same Blastoise (two rows for one card in different variant/condition combos, each firing independently with different framings). Per-card emails trash inboxes, invite spam-marks (domain-wide Gmail punishment), and bury the signal.

**Decision — aggregation strictly at the send boundary (engine untouched):**
1. **Two-write pattern per firing row:** the OBSERVATION (`last_seen_price_cents`) is written at evaluation time exactly like hold paths; the `fired` stamp (`alert_state`/`last_alerted_price_cents`/`last_notified_at`) moves to AFTER the batched send succeeds. A failed send therefore leaves the row armed with a fresh baseline — identical retry semantics to before (honest "already below" next run).
2. **Collector keyed subscriber → card:** fired alerts buffer per email; ONE send per subscriber per run. n=1 renders the existing single-card email verbatim; n>1 renders the batched digest (subject "N of your cards hit good buys today", most significant first: explicit-target hits, then deepest %-under; one footer, one one-click unsubscribe).
3. **Dedupe per (subscriber, card):** same-card rows from different combos merge to ONE digest entry. The explicit-target framing wins the copy (its evidence line already carries the market comparison, so the merged email still conveys both reasons); "dropped" outranks "already_below" within a basis. EVERY merged row still gets its own fired stamp at its own observed price.
4. **Contract tests** (lib/__tests__/wishlist-scan-batch.test.ts): GROUPING (10 cards/1 user → 1 email), ISOLATION (2 users → 2 emails, zero cross-user leakage — a leak is a privacy incident), DEDUPE, IDEMPOTENCY (re-run resends nothing), SOFT-FAIL (one subscriber's failure never blocks the rest). Discord run embed gains "Subscribers emailed / Cards fired / Dupes merged".

**P0 findings recorded:** the "already at $X" emails are ADR-091's deliberate one-time first-observation confirmation (not a signup send) — semantics unchanged, they simply batch now. The 12:01 run is NOT replayable (no per-run event log exists; per-row state overwrites each run) — the dry-run artifact (docs/goals/_results/batched-email-preview.html) renders from an honest reconstruction of John's reported inbox instead; a persisted alert-event log is noted as a future observability candidate, not built here.


## ADR-099 — Shared OG brand block + retired-asset tripwire (brand-og-unification; supersedes ADR-094's OG/favicon/manifest treatment)

**Date:** 2026-07-02 · **Status:** Accepted

**Context.** The live site runs the Shrikhand wordmark on charcoal (ADR-096/097), but every share surface still carried the retired ADR-094 vermillion hanko seal — the /lines OG card cached into the flagship eve tweet with round-1 branding. Root cause: the round-2/3 design loops deliberately deferred "brand-asset re-rolls" and nothing ever closed the deferral; each OG template also hand-rolled its own identity block, so a brand succession had to find and edit N files. Worse, Phase-1 diagnosis found the OG wordmark font NEVER actually loaded in production: the templates fetched Google's css2 API with a modern UA, which returns **woff2 — a format Satori cannot parse** — so every card silently rendered in the fallback face.

**Decision.**
1. **One identity block, `lib/og/brand.tsx`:** `OG_COLORS`, `OgWordmark` ("Foil" in Shrikhand as pure lettering, cream-on-charcoal / navy-on-cream), and `loadOgFonts()`. Every ImageResponse surface imports it; composition stays per-surface.
2. **Self-hosted TTFs under `assets/og/`** (Shrikhand OFL; Geist OFL — byte-identical to the fallback next/og itself bundles), never a remote css2/woff2 fetch. **Runtime-split loader:** edge fetches the bundler-emitted asset via `new URL(..., import.meta.url)`; nodejs reads `join(process.cwd(), "assets/og", ...)` via fs — undici's fetch REJECTS file: URLs, which is exactly the bug that broke the lines OG prerender when the fetch pattern was used on the nodejs runtime.
3. **Never `fonts: []`:** ImageResponse does `options.fonts || defaultFonts`, so an empty array (unlike undefined) DISABLES its bundled-Geist fallback and Satori throws "No fonts are loaded" — a build failure on prerendered OG routes. The loader collapses an empty set to `undefined`. Font-failure fallback is styled text in the body face — NEVER the retired mark.
4. **Explicit font roles:** wordmark = Shrikhand; all other text = self-hosted Geist (`OG_BODY_FONT`), passed alongside — supplying any `fonts` array replaces next/og's default entirely, and Satori maps unmatched families to a loaded font, so without an explicit body font the whole card would render in the display face.
5. **The pin (recurrence prevention):** `og-image.test.ts` asserts every ImageResponse surface imports the shared block, and a **retired-asset tripwire** fails the build on any seal reference (`#D85A30` ink, seal data-URL, seal geometry) across all OG/meta surfaces (both OG templates, twitter-image, brand block, favicon.svg, icon.svg, manifest.ts). Favicon/app icons succeed to the sakura petal on charcoal (`scripts/generate-brand-icons.mjs` rasterizes the PNGs); manifest `theme_color` → charcoal. The page-visible `SealMark` (components/brand/logo.tsx hero pill) is intentionally out of scope — its succession is UI-scope work.

**Consequences.** A future brand change edits `lib/og/brand.tsx` once and the tripwire forces the asset sweep. OG cards now genuinely render the brand fonts for the first time (verified by local render: home/twitter/umbreon/espeon all 200 image/png, shots in `design-loop/gallery/og-refresh/`). Headline weight renders at Geist 400 (the only self-hosted body cut) — visually equivalent to what prod actually rendered before (the font never loaded); a heavier self-hosted headline cut is a candidate follow-up, deliberately not fetched at request time. A Shrikhand letterform favicon needs glyph-path tooling — flagged, not half-shipped; the petal is the owned vector.


## ADR-100 — Seeded gift vaults: pre-made claimable vaults on a second token context (eve-vault)

**Date:** 2026-07-02 · **Status:** Accepted

**Context.** Eve (@possiblyeve) asked "can u do it for me." The line pages answered the research half; this answers it literally — a vault pre-seeded with her duo's six grails, smart targets already set, delivered working ("done" beats "coming soon"). But the existing vault (ADR-093) is EMAIL-anchored: the /w token's payload IS an email, and every row read/write is scoped to it. A gift vault must exist BEFORE any email, be claimable by exactly one, and stay useful to everyone else watching the thread (the fork mechanic).

**Decision.**
1. **Second token context, same machinery:** `foil-seeded-vault.v1|` in lib/vault-token.ts — payload `{v: vaultId}`, same secret, same constant-time verify, same uniform-404 posture. The context string inside the MAC makes cross-audience verification impossible (seeded ↛ email-vault ↛ unsubscribe, all pinned). /w/[token] tries the email context first, then the seeded context; both failing 404s exactly as before.
2. **Definitions in code, claim state in the DB:** the vault's curation (lib/vault-seeds.ts — pockets, dedication, copy, src/UTM) is reviewed config guarded by the navigation-promise test (every pocket must be in CARD_CATALOG with committed sold data ≥10 sales — no stub pockets on a gift). The DB holds ONE row per claimed vault (`seeded_vault_claims`, vault_slug PK, service-role only): the PK insert IS the claim, so a concurrent second claimant loses atomically — no read-then-write race.
3. **Claim = the /start funnel, not a parallel one:** the claim core (lib/wishlist/seeded-claim.ts, DI-tested) runs the existing helpers — upsertWatchlist (NULL targets = ADR-091 blank-target market basis, the "smart targets" the page shows; suppression inherited, so claiming never resumes an opted-out address; demand-hydration rides along), watch-cap BEFORE consuming the claim, tri-store opt-in with the seed's UTM (`utm_source=x&utm_medium=eve`, src `eve-vault`), and the welcome email carrying the claimant's PERSONAL vault link — inbox-only, mirroring /api/start's first-watch bearer-credential rule. The public seeded page never renders any email-vault token and shows only the maskEmail'd claimant.
4. **Idempotent + recoverable:** the claimant re-submitting re-runs the row upserts (heals partial failures) and reports success; total row-write failure on a fresh claim RELEASES the claim row. A wrong-party claim (the link is in a public thread — first-come by John's design) is founder-recoverable: delete the seeded_vault_claims row (+ the squatter's src-tagged watchlist rows) and the vault re-arms.
5. **/eve vanity (eve-clean-links pattern):** mints the seeded token at REQUEST time (no hardcoded token; works across environments) and 302s with the eve UTMs; secret-missing soft-falls to /start — a tweeted link never 404s. Guard-pinned in proxy.test.ts. A `demo` seed ships alongside so the claim flow is live-verified on a throwaway before eve's link ever goes out.

**Consequences.** The gift is also the product demo: one page-load shows curated pockets, real sold data, smart targets, and a one-field activation; the fork CTA (`/start?src=eve-vault-fork`) converts the audience. Seeded vaults generalize into a repeatable creator-gift play (IDEAS). ~~The public-claimable window between tweet and claim is accepted (recoverable, above); the calendar-private-link risk class from ADR-093 is unchanged.~~ (Superseded by the amendment below — no claim window exists in the template model.) New table is service-role-only with RLS on/no policies.

**Amendment (2026-07-02, eve-vault-template-claims — SUPERSEDES the single-claim semantics in points 2 and 4).** John's correction, pre-push, emphatic: the vault link goes in a PUBLIC reply — *"anyone should be able to click those links and have the same experience."* One-winner claiming was the wrong object model for that distribution channel: it turns the gift moment into a race and locks out the entire audience the reply is meant to convert. **A seeded vault is a TEMPLATE, not a single-claim object.** Claim = instantiate, unlimited: every submitted email gets its OWN watch-set (the seeded pockets + smart targets applied through the same funnel machinery — tri-store opt-in, UTM/src, suppression inheritance, watch-cap, welcome email carrying THEIR private /w link, inbox-only as before). `seeded_vault_claims` becomes an instantiation LOG — composite PK `(vault_slug, claimed_email)`, one row per claimer (migration `20260702230000`, applied) — so the only possible insert conflict is the same email re-claiming, which stays the idempotent heal-the-rows path. The public page NEVER locks: post-submit state is per-visitor (`?c=ok` confirmation / `?c=again` already-watching), a fresh visitor always sees the claimable state, and no email (masked or raw) ever renders — the ADR's "shows only the maskEmail'd claimant" line and the /security-review L-1 mask are both moot because there is no claimant to display. The wrong-party-claim recovery runbook in point 4 is retired (a stranger claiming is now just... a user converting); R-067 is resolved by design. Abuse posture is unchanged and now load-bearing: per-IP rate limit + honeypot on the action, per-email watch-cap before any write. Two /security-review Lows triaged at ship: (1) the `?c=again` friendly already-watching response is an email-membership oracle for this vault's claim set — ACCEPTED, because the goal explicitly specifies the friendly response and it's the same enumeration class as the accepted /api/start `isFirstWatch` posture (collapse `again`→`ok` is the one-line fix if that posture ever tightens); (2) the claim's unconditional tri-store newsletter opt-in now carries a disclosure line in the page footer (the /api/start flag equivalent was client-controlled anyway; double-opt-in remains the deferred fix per ADR-090).

## ADR-101 — Welcome-email overhaul: one welcome per signup path, vault-claim suppression via Beehiiv-side medium flag (welcome-email-overhaul)

**Date:** 2026-07-03 · **Status:** Accepted (Beehiiv changes staged; live on John's publish)

**Context.** The first email every subscriber receives — including eve, tonight — was the Beehiiv Welcome Automation (`aut_ffd18eec…`, subject "You're in. Here's what to expect"): retired navy/gold `foil-logo.png` masthead (theme-level), a cheat-sheet paragraph + big navy CTA button (the exact ADR-079 Promotions-tab pattern), long body, and "the one card you are hunting" (the voice sweep never covered emails). Worse, a vault claimer got TWO welcomes ~2 minutes apart: the excellent text-forward vault email ("Your Foil vault is open", `lib/wishlist/vault-email.ts`) AND the generic automation welcome — John's live finding, 2026-07-02 10:21+10:23 PM. The generic welcome lives in Beehiiv, not the repo, so the overhaul is a staging edit + publish, not a code deploy; but the DEDUPE needs a durable, code-owned flag the automation can key on.

**Decision.**
1. **One welcome per path.** Vault claimers get ONLY the vault email; it now carries the what-to-expect line ("about one email a week… plus an alert when a card you're watching genuinely dips") and the reply-ask. Non-vault signups get ONLY the (rewritten) generic welcome.
2. **The suppression flag is Beehiiv-side `utm_medium`.** `subscribeEmail` gains `utmMedium?: "email-capture" | "vault-claim"` (default unchanged: `email-capture`); the seeded-vault claim action passes `"vault-claim"`. The welcome automation's signup trigger gains the condition `medium not_equal "vault-claim"`. Chosen over a `utm_campaign not_contain "vault"` substring rule because the medium flag is EXACT (one constant, all future seeded vaults inherit it via the claim path — no naming-convention fragility). The enum + the claim-path call are pinned in `lib/__tests__/beehiiv.test.ts`; changing either string silently breaks the live trigger condition, so the pin is load-bearing. Note: our OWN `newsletter_subscribers` attribution (ADR-084, `vault.utm`) is untouched — this medium is the Beehiiv-side attribution only.
3. **Generic welcome rewritten** (staged): 5 blocks — plain-text "Foil" wordmark heading, greeting + one-line who-I-am, what-to-expect, the reply-ask ("the one card you're **chasing** right now — I read every reply."), sign-off. Cheat-sheet block deleted entirely (verdict 2; the magnet still lives at `/free/…` for SEO/gate traffic). The masthead image logo is theme-level — John removes it in the editor at publish (no MCP surface for automation email themes).
4. **Guard extended (ADR-099 tripwire → emails).** New `lib/__tests__/email-templates-guard.test.ts` auto-discovers `emails/*` + the transactional composers: zero `<img>`, zero `<button>`/background-styled links, zero "hunt" in email copy, and the retired-asset bans (seal ink/data-url/geometry, `foil-logo.png`, the `>TCG<` lockup node, one-word `FoilTCG`).

**Consequences.** A claimer's inbox tells one coherent story (vault link + expectations + reply-ask in one email); the generic welcome is Primary-shaped (text-forward, no images once the masthead drops, no buttons). The Beehiiv body itself remains un-guardable from the repo — the tripwire covers every repo template, and the publish checklist (docs/goals/_results/welcome-overhaul-beehiiv-staged.md) covers the dashboard side. Suppression correctness rests on Beehiiv's `medium` condition evaluating the API-set `utm_medium` — verified live by the post-publish two-path test (fresh plain signup sees the new welcome; fresh vault claim sees ONLY the vault email). If that test fails, the fallback is `campaign not_contain "vault"` (subscriberSource naming is already vault-suffixed).

## ADR-102 — The hero chase belt: a virtualized wheel of the top 200 chase cards succeeds the composed fan (hero-chase-belt)

**Date:** 2026-07-03 · **Status:** Accepted

**Context.** John's final direction: no permanent Moonbreon mascot — the hero should say "everything you'd chase, we're already watching." Cowork's research locked the approach: GSAP loop engine (standard license, free incl. commercial), a ~26-node DOM with recycling faces for the 200-card pool, and a hard license wall — simeydotme/pokemon-cards-css is GPL-3.0, so the holo effect must be an independent implementation.

**Decision.**
1. **Virtualization = windowed recycling.** `NODE_COUNT` (26) fixed slots; a single virtual offset drives the track's fractional transform (GSAP ticker writes `x` directly — compositor-safe, no per-frame CSS vars per I-011); each whole-slot wrap shifts the face mapping `pool[(k+i) % 200]`. The rendered scene is IDENTICAL across the wrap instant, so a face never visibly morphs — only the node re-entering off-screen takes a new image (React reconciliation touches exactly that node; entering faces are already mounted, i.e. preloaded one slot ahead). The loop arithmetic was informed by GSAP's official `horizontalLoop` helper but written independently against this windowed design.
2. **Motion doctrine (emil-design-eng):** constant drift = LINEAR at 48px/s (gallery walk); pause is a DECELERATION — hover/focus/offscreen/hidden-tab tween a speed factor to 0 over ~0.45s power2.out, resume tweens back; hover shine gated to `(hover:hover) and (pointer:fine)`; the shine is an original two-stop diagonal light band, opacity-only reveal (GPL wall respected, provenance here).
3. **Pool = committed artifact** (`lib/hero-belt/pool.generated.json` + faces self-hosted under `public/belt/`, ~14MB, ADR-056 posture: the hero never fetches the flaky CDN at runtime). `scripts/generate-hero-belt.ts` re-derives it from each bake: value-ranked (max variant tcgplayer market, $15 floor), catalog-slug-joined (every face links a real data-bearing page), adjacency-arranged (no same-Pokemon/same-set neighbors incl. the wrap seam). **Premise adjustment:** the goal's first-choice rank signal (watch count) is NOT bake-available — watchlists live in the DB — so the selector ranks by market value and accepts a watch-count map the day a committed watch-count artifact exists.
4. **The composed fan survives as the `prefers-reduced-motion` fallback** (and the honest no-pool degradation). Both hero variants are server-rendered and CSS-gated (`motion-safe:`) — no hydration swap, both crawlable.
5. **The request widget** (site-to-X intake): a quiet card after the alert section — "Chasing a card we don't have data on yet?" → one-tap `x.com/intent/post` prefilled composer + the plain @FoilTCG link. **The "front of the queue" line binds a human contract:** front-of-queue requests get same-day-ish hydration via the ADR-092 demand pipeline; the x-reply-desk goal triages the mentions.

**Consequences.** The hero self-updates with every bake (the data-driven focal, fully realized); DOM stays ≤30 nodes regardless of pool size; measured on the prod build with petals running: 177fps @1440/2x-cpu, 197fps @1920/2x, 115fps @mobile-layout/4x, LCP 0.44–1.17s (budget ≤2.5s), zero CLS by construction (explicit dims). New dependency: `gsap` (^3.15). Guards: pool data-level invariants, motion/a11y/perf contract pins, widget copy + voice pins (lib/__tests__/hero-belt.test.ts). Honest gaps: Lighthouse before/after was NOT run (LCP/fps measured via CDP probe instead); the belt renders flat (no depth-of-field ladder) — "card of the day" centerpiece + depth are IDEAS candidates.

**Amendment (2026-07-04, mobile-static-hero) — device-gated motion (desktop animates, mobile is static).** Real prod mobile PageSpeed later proved the animated hero is FREE on desktop (LCP ~0.7s / Perf ~99) but the dominant cost on mobile (the belt+petals style/layout ~2.4s under 4× CPU + the ~1s GSAP boot). So motion is now **device-gated**: the belt container is `lg:motion-safe:block` and the petal field is `desktopOnly` (`hidden lg:block`), while the composed fan (already the reduced-motion fallback, #4 above) also serves as the MOBILE hero (`lg:motion-safe:hidden`). GSAP **execution** is gated behind a `min-width:1024px` matchMedia check in the effect (before `gsap.ticker.add`), so the boot never runs on phones; belt faces are `loading="lazy"` so the now-`display:none`-on-mobile belt doesn't waste bytes (eager loads even under display:none). Both variants stay SSR'd + crawlable, no hydration swap, reduced-motion still static everywhere. Desktop is byte-identical animation (only a viewport gate added) — verified Perf 98 / LCP 1.1s. (A dynamic `import("gsap")` to also drop the ~70KB module from the mobile bundle was tried but reverted: its desktop verification was confounded by the automation tab's `document.hidden` belt-pause, and the desktop hero is not worth risking on an unverifiable change — GSAP is downloaded-but-idle on mobile.) Guard: `hero-belt.test.ts` pins the `lg:motion-safe` gates + the desktop-precedes-ticker execution gate. Residual: the static fan is still image-heavy (5 next/image cards), so sub-2.5s mobile LCP needs a *minimal* mobile hero — a further decision.

## ADR-103 — Alert plausibility guard: too-good-to-be-true is a red flag, not a deal (send-boundary filter)

**Date:** 2026-07-03 · **Status:** Accepted

**Context.** Live incident, 2026-07-03 03:08 AM: the wishlist cron mailed "Umbreon ex (Prismatic Evolutions) dropped to $57.24, 95% under its 30-day sold average ($1,244.86)" — even damaged copies of the SIR average ~$1,006; $57 was junk (same-name cheap printing / scam-BIN class). Cowork's pre-diagnosis verified in code: `lib/listing/identity.ts` treats the Card Number aspect as CORROBORATING (absence passes), so a listing aspected only name+set clears identity and prices like the cheap non-SIR printing from the same set. The picker's existing outlier gate judges against the median of the search hits' ASKS (self-referential) — never against the sold basis. The homepage promise is "judged against what cards really sell for, not asking prices"; the junk filter judged against asking prices. Eve's seeded vault watches this exact card.

**Decision.** A FILTER at the send boundary (the ADR-098 pattern: boundary layers, not engine rewrites — armed/fired hysteresis untouched, observations still record, suppressed rows stay armed):
1. **The plausibility band** (`lib/wishlist/alert-plausibility.ts`): a fire whose price is below `PLAUSIBLE_FLOOR_FRACTION = 0.35` of the condition-matched 30-day sold basis (i.e. more than 65% under) is suppressed + logged, never mailed. Threshold judgment, documented: the fixture is 4.6% of basis (suppressed with 20x margin); real fire-sales in the movers data run 10–40% under (a genuine 35%-under deal mails with margin); on the fixture card the LOWEST raw tier (damaged) averages ~80% of the NM basis, so the 35% floor sits far beneath every real raw condition — the goal's condition-coherence rule is subsumed by the band with margin, using only data the cron already has (no per-tier API spend at the boundary).
2. **Null-over-guess for deals:** with NO sold basis, a fire deeper than 65% under the user's own target is suppressed (a dramatic delta with nothing plausible to stand on); modest under-target fires keep ADR-091 semantics.
3. **Observability:** `suppressedImplausible` counter in the cron's Discord run summary ("Suspicious suppressed") + one #errors ping per suppression ("suspicious listing suppressed: <slug> at $X vs $basis").
4. **PokeTrace anomaly flags (premise adjustment):** no per-listing anomaly field exists in our PokeTrace client shapes, and PokeTrace flags cannot mark eBay Browse items; the anomaly signal is already consumed where it lives — the BASIS (movers aggregates are upstream anomaly-filtered `avg7d/avg30d`). Recorded honestly instead of inventing plumbing.
5. **Voice:** the alert composer's rendered em dashes swept (commas/periods/colons; subject shape now "dropped to $38.00, at your $40.00 target") and the email-templates guard now bans em dashes across every template's rendered copy.

**Consequences.** The $57-class can never mail again (fixture 13 pinned end-to-end: would-have-mailed → suppressed with reason). A suppressed row stays armed and re-suppresses on subsequent scans while the junk listing persists — churn in counters, zero churn in inboxes; a sustained suppression stream on one slug is itself a signal (R-063 escalation trigger). Blast-radius follow-up (SESSION-LOG): the same admission path serves the card-page "best current listing" module, /go, and the deals cron — extending sold-basis coherence to those surfaces rides the sold-data-integrity coherence-gate work. The bgs-10-bl scan test's "alert on anything" 9,999,999-cent fixture target was itself the suppressed class; re-fixtured to a realistic target (deliberate semantic change, not history rewriting). One test-behavior note: identity hardening (number-absence flips to hard on high-value watches) was OPTIONAL in the goal and NOT shipped — the band alone kills the class; revisit only if suppression streams show identity gaps worth closing upstream.

## ADR-104 — Sold-data honesty: freshness-gated windowed figures + a render-time coherence gate (sold-data-integrity)

**Date:** 2026-07-03 · **Status:** Accepted

**Context.** Live incident (John, L4 TCGplayer seller, on localhost): xy4-122 Dialga-EX (Phantom Forces secret rare) rendered "30-DAY SOLD AVG $391 · n=63 sales" with a non-monotonic condition ladder (Damaged $261 > Heavily Played $128), a $24,500 PSA 10 row, and a 7-day-median chart oscillating $275↔$975 — next to a TCGplayer market anchor of $975. The goal ran the three-branch diagnostic against PokeTrace live (`/cards/{uuid}` + all 327 per-sale records via `/cards/{uuid}/listings`):
- **H1 (wrong match): ruled out.** The baked UUID resolves to exactly the right card/set/number/variant.
- **H3 (our rollup): PRIMARY.** Three verified field-semantics facts we were misusing: (1) PokeTrace's per-tier `saleCount` is an ALL-TIME approximate count (records span 2021→2026) — we summed it across tiers and labeled it a 30-day n (reality: ~3 raw sales in the actual last 30 days); (2) `avg30d` is anchored to the tier's `lastUpdated` (its most recent sale), NOT to today — LP's "30-day avg" described a window ending May 27, HP's lone sale was January 30; (3) the pooled "any-raw" headline weighted `avg30d ?? avg` across mixed condition tiers and mixed sources (MP came from tcgplayer, the rest from ebay), excluding NM from the average while counting its sales in n. `parseSnap` dropped `lastUpdated`/`approxSaleCount`, so none of this was visible to any consumer.
- **H2 (upstream pollution): REAL, SECONDARY.** PokeTrace pools other-language printings into the English card (9/327 sales are Brazilian-Portuguese — ~22% of the 41 raw records; the $275↔$975 chart oscillation IS Brazilian NM sales pooled with English ones; PSA_8's $1,550 headline is a Portuguese slab). Filed upstream: `docs/goals/_results/poketrace-h2-filing.md` (John sends; we are not blocked on it).

**Coherence scan (rate, not anecdote)** across belt pool ∪ curated set (348 cards with sold data, `scripts/sold-coherence-scan.ts`, artifact `docs/goals/_results/sold-coherence-scan.md`): pre-fix, 71.6% of pages had a ladder inversion, 24.4% pooled-avg diverged >2x from the TCGplayer anchor, 19.3% had a fabricated-window n (≥50% of the claimed n from tiers with no fresh window), 30.5% had >2x cross-source same-tier divergence.

**Decision — two layers, calibrated by John's rule ("flag incoherence, never magnitude" — top-5-per-set chase cards make extreme prices and 100x+ graded multipliers legitimate):**
1. **Honest display resolution** (`lib/cards/sold-coherence.ts`, the ONE module that turns a `SoldHistory` into renderable figures; `SoldStat` now carries `lastUpdated`/`approxSaleCount`/`median7d`/`median30d`): a "30-day" figure renders only from a FRESH windowed value (`avg30d ?? median30d`, lastUpdated within 35 days); stale tiers render as dated last sales ("last $362 · May 27"); counts are labeled "sales on record" (approx-marked `~`), never a windowed n; the "Any (Raw)" headline names the single best fresh tier it shows (e.g. "· Near Mint") — a pooled mixed-condition average never renders; the graded row is the freshest preferred grade (xy4's becomes PSA 9 $2,530 — accurate — instead of April's lone $24,500 PSA 10); the chart plots the tier the headline names.
2. **Render-time coherence gate** (null-over-guess extended to the data surface, same doctrine as vision and alerts): (a) a cross-source dispute — two sources both fresh on the SAME tier disagreeing >2.5x (the Umbreon-ex class: ebay NM $1,196 vs tcgplayer $1) — drops THAT tier entirely (we can't arbitrate which source is wrong); (b) a ladder inversion among surviving fresh tiers beyond 1.5x tolerance (the mixed-population signature) suppresses ALL the panel's figures → the honest empty state ("Sold data pending…"); every violation pings #errors (`sold-data-suppressed: <slug>, reason`, deduped 6h in-process, soft-fail). Thresholds picked from the scan's own distribution: post-fix, 2.9% of pages fully suppress (all genuine incoherence, no grails), 4.6% drop one disputed tier, 93.1% keep a fresh windowed headline.

**Basis parity (the ADR-103 interplay):** the same freshness gate now guards every computation basis — `rawReferenceFromHistory` / `conditionMatchedReferenceFromHistory` / `lowestRawReferenceFromHistory` (buy signals, the alert plausibility band's condition-matched basis, the ADR-091 market floor) return UNKNOWN instead of a stale window, and `classifyMomentum` (movers/deals/newsletter) returns null on a stale NM stat — stale-anchored momentum can no longer surface as a current "good buy."

**Consequences.** The xy4-122 incident render is pinned end-to-end against the REAL captured payload (`lib/__fixtures__/poketrace/xy4-122-dialga-ex.json`): the $391 pooled blend, the n=63 windowed claim, the January HP rung, and the April PSA 10 headline are each structurally unreproducible. Honest cost: fewer numbers render (some pages show "last recorded $X (date)" instead of an avg; ~3% show the pending state) — that is the product promise working, not a regression. `ambiguous` hydration persistence audited and NOT implicated (H1 ruled out; the render gate is now the safety net for whatever an ambiguous match would show); left as designed. The scan script is re-runnable (`--from-cache`) as a standing data-quality probe. Out-of-scope parity gaps noted, not crept: the deals-page single-listing board and /go compare against these same bases (they inherit the basis fix; their own render surfaces were untouched).

## ADR-105 — Vault-first card-page hierarchy: the eve-pattern is the default audience (card-page-vault-first)

**Date:** 2026-07-03 · **Status:** Accepted

**Context.** John's strategy read (2026-07-03): eve's "can u do it for me" is the mainstream flow, not the exception — most card-page visitors want Foil to watch the card FOR them, not to study a dashboard. The page was a data tower with the conversion in the basement: `WatchlistForm` rendered at the very bottom of `/cards/[slug]`, below variants, sold history, chart, condition table, and the listing module. The belt (200 cards) and the reveal post land traffic directly on these pages — this surface is now the funnel's mouth. Sequenced deliberately AFTER sold-data-integrity (ADR-104): the headline number this page now leads with is the exact number that goal repaired.

**Decision — one page, three tiers, top to bottom:**
1. **The action (above the fold, mobile-first).** Card identity + ONE coherence-gated trust number (30-day sold avg + all-time sales count) + the **"Add to vault"** button, thumb-reachable inside 390×844. The mobile hero rides the card art compact (6.5rem) beside the identity instead of a full-width centerpiece; desktop keeps the full-art column. The hero stat comes from the NEW `lib/cards/sold-headline.ts`, which owns variant selection (traded-score ranking + ?v= override) and is consumed by BOTH the hero and the SoldHistoryPanel — the two surfaces cannot disagree by construction. Tap → the EXISTING watch flow inline (`components/cards/add-to-vault.tsx` reveals `WatchlistForm`, autofocuses email, swaps the button for the form). One write path: the component is an entry point only; the Server Action + upsert + ADR-092 hydration enqueue are untouched (test-pinned). Vocabulary: "Add to vault" verbatim at every step (button, submit, success "Added to your vault.") — one noun sitewide.
2. **The proof (visible, never collapsed).** The listing module (live best-listing / longtail search fallback / metadata-only CTAs) moved ABOVE the data: it is the revenue path and the "we found this for you" evidence. Never behind a dropdown (test-pinned).
3. **The depth (collapsible, smart defaults, SEO-safe).** Sold panel, variants/market range, and card details demoted into a shared `DetailSection` — native `<details>/<summary>`, zero client JS, so collapsed content still ships in the server-rendered DOM (no client-fetch-on-expand; the SEO price-checker persona and crawlers lose nothing — test-pinned). Defaults: sold panel OPEN (the chart is the strongest evidence), per-condition table nested + collapsed, variants + card details collapsed.

**Honest fallback (null-over-guess extends to the CTA).** On thin-data cards (metadata-only tier, hydration pending, or ADR-104-suppressed) the hero renders "Sold data pending for this card. We only show figures we can stand behind." and the reveal says "Sold data is still pending for this card. Add it and we start watching right away..." — plain words, no invented figures; the existing demand-hydration enqueue makes the promise real. Ride-along fix (Cowork live audit): the About section's "Best Current Listing block above" promise was asserted on tiers that render the Browse-on-eBay fallback — copy is now tier-conditional via `lib/cards/about-copy.ts` (test-pinned: fallback tiers never render the promise).

**Consequences.** Four structural guards in `visual-regression.test.ts` (button-above-fold order, collapsed-content-in-DOM, one-write-path, fallback-copy state) + `about-copy.test.ts`; the old "panel between variants and buy CTA" order pin deliberately inverted. Target-picker internals stay out of scope: the reveal ships the current default-target form and IS the slot the target-picker-redesign goal fills. Empirical catch worth remembering: the JSX compiler dropped the space after `{cardName}` in metadata-only-listing ("Chikoritayet", verified in SSR HTML) — fixed with a single template expression; watch for the pattern elsewhere (PATTERNS.md I-013).

## ADR-106 — Blackout brand: FoilTCG wordmark returns with metallic real-gold TCG; gold becomes wordmark-only on night; /deals reaches row parity (blackout-brand-and-deals-rework)

**Date:** 2026-07-03 · **Status:** Accepted

**Context.** John's verdicts (2026-07-03, decisions not suggestions): (1) the site ground is matte charcoal, not navy — this had already landed token-level (ADR-097 lineage; `--color-foil-night` #0d0d0e / `#17171a`, sakura `--color-foil-accent` ratified as THE functional accent, succeeding the round-2 teal); (2) the wordmark is bold white "Foil" + "TCG" in REAL gold #856A00 rendered metallic, and TCG is the only gold accent anywhere; (3) /deals needed an aesthetic/functionality/readability rework — its Heating-up section shipped without card images. P0 finding on that defect: a COMPONENT gap, not a data gap (`MoverRow.imageUrl` was always populated for both directions; the up-list simply never rendered an `<Image>`).

**Wordmark succession (deliberately reverses ADR-094's TCG drop).** ADR-094 dropped "TCG" when gold was retired; John's verdict brings it back as the gold's ONE sanctioned home. `components/brand/logo.tsx` now renders `Foil` (chrome ink: cream on night, navy on cream) + `TCG` through the new `.wordmark-tcg` class: a metallic gradient ramp ANCHORED on `--color-foil-gold-anchor` #856a00 with specular stops (→ #f4e3a1 highlight), `background-clip: text`, solid #856a00 fallback outside `@supports`, and a slow hover sheen (background-position sweep, ~12px of text, gated behind `prefers-reduced-motion`). Face pick (corrected 2026-07-04 on John's live review): "TCG" is the **SAME font cut as "Foil"** — it inherits the lockup's face and weight and only shrinks to a suffix cap height (`text-[0.5em]`, a hair of `tracking-[0.04em]` for small-caps legibility). The first cut forced `font-wordmark` (Bricolage) on "TCG", which read as a different, thinner typeface next to the Shrikhand bubble "Foil" in the chrome; inheriting keeps them one face in every context (bubble → both Shrikhand, carved → both Bricolage), and the `.wordmark-tcg` shimmer clips over whatever face renders. The `tcgFace` prop from the abandoned face-trial was removed. Accessible name updated to "FoilTCG home" (label-in-name). Known mismatch, deferred to the brand-asset goal: favicon/OG/manifest still carry the petal/Shrikhand system with no TCG. Note: this treatment is a sanctioned exception to the "no gradient text" design law — the gradient IS the meaning here (metal, not decoration), specified verbatim by John + Cowork's standing call. Email/OG stay solid-gold-only territory (bg-clip does not survive email, ADR-079); no email template touched.

**Scarce-gold, absolute form.** On night surfaces gold now appears in the wordmark ONLY. All night-surface `foil-gold` usages are retinted to the sakura accent in the Workstream D migration (`Card3D` keeps its gold ring pin but greps to ZERO render sites anywhere, so no gold paints; it retints when a surface actually adopts it); cream-register pages (legal/pillars/vending, out of scope) keep their ADR-029 gold until their own migration.

**/deals rework (Workstream C).** One shared `MoverRowItem` renders BOTH directions at full parity: thumbnail (with a DESIGNED card-glyph null state, never a blank box), name + set linking to `/cards/[slug]` (the vault loop), a 13px plain-words stats sentence (up from 12px/60% — readability), the two-point delta dumbbell (down: sakura dot left of the cream baseline; up: cream dot right — vermillion is hanko-only, coral hover-only, gold wordmark-only, so "warm" is carried by direction + label inside the token rules), and the untouched affiliate Browse CTA. Sections gained headers + ids ("Cooling off" / "Heating up"), the page gained jump chips (Cooling / Heating / Below sold) and the explainer became a labeled "How to read this board" footnote block. Sample size stays on every row; freshness stays in the footnote. Zero changes to affiliate URL construction (compliance suite pins it).

**Cream-surface migration (Workstream D, John's 2026-07-03 amendment).** /start, /cards index, and /cards/sets/[set-id] were the last funnel surfaces on the retired cream register (the belt CTA landed on a white flash). All three move to the night register token-level (data-tone="night" chrome flip; watchlist-form input idiom for the /start form fields; tiles stay the luminous objects), with a visual-regression guard pinning the register so a future goal can't ship a cream regression.

**Consequences.** The wordmark contract + gold ramp + register pins are test-enforced in `visual-regression.test.ts` (the old "no TCG" ADR-094 assertion deliberately inverted). The vault-first card page, /deals, home, /w, /start, and /cards now present one coherent charcoal register end-to-end; /lines (eve's live links) is untouched. /deals filters/sorting remain a later goal (IDEAS).

## ADR-107 — The two-lane X reply workflow: API-post on user-initiated contact, intent-link on cold replies + the in-flow receipts tool

**Date:** 2026-07-03 · **Status:** Accepted

**Context.** John's directive (2026-07-01): posting/replying on X must be as easy as possible on every surface — one click wherever the ToS allows, prefilled composer where it doesn't. Being in the replies ON X is his growth job (2026-07-02: "make it easier for me to post directly from X — that is your job"). But X's automation rules draw a hard, account-fatal line, so the ease has to bend around it, not through it.

**Decision — the two-lane ToS firewall (non-negotiable; this ADR exists so a future goal doesn't "helpfully" unify the lanes).**
- **USER-INITIATED contact** (mentions of @FoilTCG, replies in our own threads — the "eve case"): X's automation rules PERMIT an API response to someone who contacted us. So the **reply desk's "Reply" button API-posts** the drafted reply in-thread. True one click.
- **COLD replies** (replying on a stranger's post, quote-tweets, the engagement brief): API-posting is platform-manipulation and **account-fatal**. It stays **human-send FOREVER** — the tooling builds an `x.com/intent/post` URL (prefilled composer) and John presses X's own Post button. One tap to the composer, firewall intact.
- Own-content posts (the x-post bot) are unchanged (own account, already API).

**Structural enforcement.** `lib/__tests__/reply-desk-invariant.test.ts` reads source as text and fails the build if (a) any cold-lane or read/draft/enqueue file references an X write (`postToX`, media upload, `api.x.com`), or (b) more than one file binds the X write API. The single sanctioned write binding is `app/api/reply-desk/approve/route.ts` (gated by the dedicated `X_REPLY_DESK_SECRET`, reachable only for a queued inbound). The pre-existing engagement zero-X-write invariant is preserved by keeping the `in_reply_to`/quote intent-URL construction in `lib/receipts/intent.ts` (NOT in the firewalled `lib/engagement/` tree) — the cron imports the builder, so no forbidden literal appears in a scanned file.

**§3d — the in-flow receipts tool (built FIRST, serves the manual duty tonight).** `POST /api/receipts` (Bearer `X_RECEIPTS_SECRET`, per-IP rate-limited, CORS-open so a bookmarklet can call it from x.com) takes a tweet URL (or raw text) → resolves the card (`resolveCardSlug`, null-over-guess, the 3a alias hardening applies) → **sold avg + spread** from a layered source (`market_movers` live → the committed `/lines` snapshot; null when neither stands) → a drafted reply in John's L4 voice through the SAME figure/hedge gates as the engagement engine (`validateDraft` figure-trace + `voiceCheck` hedge/banned) → a ready `x.com/intent/post?in_reply_to=<id>&text=<urlencoded>` URL. Three honest modes: **receipts** (figures + card link), **figure_free** (resolved but no data → the card link, no numbers), **clarify** (unresolvable → asks for set/number). Delivery: a desktop **bookmarklet** (one click → overlay → Reply on X) + an **iOS Shortcut** (share sheet → clipboard + composer), both in `docs/runbooks/x-reply-desk.md`. The draft NEVER auto-posts — John's Post press is the firewall.

**§1 — the reply desk (the eve-detector).** A Vercel cron (3x/day, ~13/17/22 UTC) polls X for mentions + replies (read-only `searchRecent`), dedupes against `reply_desk_items`, drafts a reply per inbound reusing the receipts engine, and enqueues it. The foil-bot delivers each with **Reply / Edit / Skip**. Reply relays to the approve endpoint (claim-once idempotent; a failed post releases the claim for retry; confirmation carries the reply permalink). **§3b intake:** a resolved card with no data → a "tracking it now: <link>" reply AND a demand-driven hydration enqueue. **§3e image mentions:** an image-bearing mention we can't resolve becomes a **human-look** card (never an auto "couldn't find it"), honoring the ADR-102 request-widget "front of the queue" contract.

**§2/§3c — cold-lane fixes.** The engagement brief's copy/paste "Post" flow is replaced by the one-tap intent link (a `intent_url` column the cron computes; a price-claim data-cite becomes a QT-with-receipts via `buildQuoteIntentUrl`). The engagement cron bumps 1x→3x/day. The dead "views" ranking leg is replaced by **public engagement** (likes+replies+reposts — impressions are author-only, ADR-087), and both cold lanes gain a **velocity term** (public-engagement-per-hour: an accelerating post wins the early top-reply/QT slot). §3a: the bare `"<eeveelution> ex"` aliases are stripped (the 1,840-card catalog has same-name regular arts; a $5-pull question would get the four-figure SIR) — the pinned test is flipped to assert null.

**Consequences.** New env: `X_RECEIPTS_SECRET`, `X_REPLY_DESK_SECRET`, `REPLY_DESK_ENABLED`, `REPLY_DESK_CHANNEL_ID`. New migrations: `reply_desk_items` + `engagement_brief_items.intent_url`. The reply desk stays inert until John applies the migrations + sets the secrets/flag (safe-by-default). The one account-ban risk is the reply desk's API write; it is bounded by (1) user-initiated-contact-only by design, (2) the single-write-binding firewall test, (3) human Approve before every post, (4) `REPLY_DESK_ENABLED` off by default (R-069). Honest coverage limit: receipts figures need a live mover or the baked snapshot; a live-PokeTrace sold-history layer (fuller coverage + per-condition spread) is a tracked follow-up, deliberately not a hard dependency because the PokeTrace key lapses ~2026-07-15.

## ADR-108 — Self-hosted Fraunces subset (SOFT baked, opsz/wght range-trimmed) + GSAP dynamic-import: cutting the mobile-LCP font/JS floor

**Date:** 2026-07-04 · **Status:** Accepted

**Context.** The LCP campaign drove the mobile hero to a server-only static strip with the H1 as the LCP element, but prod mobile LCP held at ~4.4s (prior 3-run Lighthouse median). That session named the residual precisely: a FONT/JS floor — the 118KB Fraunces variable display font + a ~74KB GSAP chunk that downloads on mobile — independent of the hero. This goal (`mobile-lcp-font-js-floor`) cuts that floor WITHOUT dropping Fraunces (ADR-036 brand) or touching the desktop hero.

**Premise re-verified before building (P0).** The prod trace confirms the mobile LCP element is **TEXT** (the Fraunces H1, size 39,820), and with `display:swap` the font swap re-paints the H1 and updates LCP — so the 120KB font IS on the LCP critical path. The "~70KB JS" is **GSAP** (74KB raw / 29KB gzip), statically imported by `HeroBelt` and hydrated (its module init runs) on mobile even though the belt is `display:none` there; the code comment had long *claimed* this import was already dynamic — it wasn't.

**Decision.**
1. **Fraunces → self-hosted subset via `next/font/local`.** `scripts/subset-fraunces.py` (fonttools) instances the Google "latin" file to `app/fonts/fraunces-display.woff2`: **SOFT baked at 30** (the only value the site renders per globals.css — the warm terminals are preserved pixel-identical; only the unused runtime axis is removed), **opsz kept variable [9,72]** (`font-optical-sizing:auto` still adapts; nothing renders `font-display` above text-7xl/72px), **wght kept variable [400,700]** (`font-semibold`/`font-bold` still compose), all 245 latin glyphs + all layout features (kern/liga/rvrn) retained. Result: **120,724 → 56,816 bytes (−53%)**, brand-pixel-identical (proven by a difference-overlay CONTROL: subset-vs-subset reproduces the same sub-pixel ghost as full-vs-subset, so the ghost is DOM positioning, not the font). `next/font/local`'s `adjustFontFallback: "Times New Roman"` keeps the metric-matched fallback → **CLS-0 preserved** (verified: the `"fraunces Fallback"` @font-face is emitted).
   - **Why not smaller** (the goal floated 15–30KB): reaching that requires PINNING opsz+wght, which de-bolds every `font-bold` heading site-wide and kills optical sizing — brand-lossy (measured: full-pin = 17KB). 56.8KB is the smallest BRAND-IDENTICAL subset. Per the goal's honest-exit clause, brand is not traded for a throttled-emulator metric.
   - **Coverage note:** the single latin file drops the (non-preloaded) latin-ext/vietnamese Fraunces ranges next/font/google used to lazy-load; a `font-display` heading with a Latin-Extended glyph (U+0100+, e.g. ā/ł) now falls back to the serif fallback for that glyph. English + Pokémon headings (é / × / curly-quotes / em-dash all covered) are unaffected. Widen the subset source if that ever matters.
2. **GSAP → dynamic import.** `components/hero-belt.tsx` replaces the module-scope `import gsap from "gsap"` with `import("gsap")` INSIDE the effect, AFTER the `min-width:1024px` + reduced-motion gate. GSAP now enters only a desktop async chunk. Verified: the after-mobile bundle has NO gsap chunk (total mobile JS 200,133 → 172,526 B, **−27.6KB**); desktop still loads it (belt unchanged).

**Consequences.** New committed asset `app/fonts/fraunces-display.woff2` + reproducible `scripts/subset-fraunces.py`. `layout.tsx` swaps next/font/google Fraunces for next/font/local; `globals.css` drops the now-baked `font-variation-settings:"SOFT" 30`; the visual-regression font test is updated to pin the new wiring (subset asset + SOFT=30 baked in the script). Desktop hero untouched (belt gsap still loads on desktop-motion); CLS-0 + reduced-motion intact.
- **Measurement (PUSHED + MEASURED 2026-07-04).** The deterministic payload wins are **−64KB on the LCP-critical preloaded font + −27.6KB mobile JS** (~91KB off the mobile critical path), directly targeting the verified text-LCP. After John pushed (`d6b7f46`), the authoritative real-prod mobile Lighthouse (6 runs, warmed) = **LCP ~3.9s, CLS 0, Perf 85 — the <2.5s target was NOT crossed.** Honest finding: prod mobile LCP is **dominated by render-delay + TTFB + the `display:swap` font-swap-paint timing, not raw font/JS bytes** — so a 53% byte cut kept the LCP inside the pre-existing noisy 3.1–4.4s band. The change was still worth shipping (lighter, brand-pixel-identical, CLS-0, no regression), and it **closes the perf campaign**: corroborated by the same-day GSC data (ADR-109 — 0 clicks / 17 of 2,079 pages surfaced), the conversion bottleneck is **audience/authority, not LCP**. Stop optimizing the hero's LCP; the next lever is distribution.
- **Correction to a prior note.** The Lighthouse "26KB unused JS" is a *framework* chunk present before AND after — NOT GSAP (whose top-level init ran on static import, so coverage never flagged it "unused"). The GSAP lever is a −27.6KB transfer + init-CPU win, not a reduction of that specific audit number.
- **Follow-up** (same technique, ~13KB more off the mobile preload, brand-safe): glyph-subset the preloaded Shrikhand bubble-wordmark font (used only for the "Foil" header lockup) to its ~8 glyphs.

## ADR-109 — Google Search Console API client: live index-coverage over inference

**Date:** 2026-07-04 · **Status:** Accepted

**Context.** The seo-crawl-hygiene goal reconciled the "56 vs 2,079" indexed-count question by INFERENCE (sitemap count) because there were no GSC credentials — an assumption on a load-bearing SEO question. GSC has a free API; this wires it so every future indexing question is pulled live, not guessed.

**Decision.** `lib/seo/gsc.ts` — a typed, **server/script-only** client over the Search Console API, authed as a service account via `google-auth-library` (JWT, scope `webmasters.readonly`). Methods: `listSites`/`hasAccess` (verify), `listSitemaps`, `searchAnalytics`, `inspectUrl` + `inspectUrls` (batched, paced ~150ms + capped ≤1,500 to respect the 2,000/day + 600/min URL-Inspection quota). `scripts/gsc-index-report.ts` verifies access (else prints the exact GSC add-user step and exits — Phase 1 step 3 is John-manual), fetches the live 2,079-URL sitemap, runs Search Analytics (page + query, 28d), inspects a representative quota-safe sample (core routes + pillars + all blog + a slice of cards/sets), and writes `docs/goals/_results/gsc-index-report.md` — the coverageState distribution + per-URL "why" from the API.

**Key handling (the security surface).** The SA key is stored **base64 as `GSC_SA_KEY_JSON` in `.env.local`** (gitignored) and read **FROM ENV ONLY** — never logged, never written to disk by the client, never committed. The encoder printed only non-secret identifiers (client_email/project_id); the raw download is deleted after encoding; `.gitignore` guards SA-key filename patterns as defense-in-depth. `/security-review` on the key path: no findings.

**The headline finding (56-vs-2,079, now answered with data, not inference).** Of **2,079** sitemap URLs (GSC last downloaded 2,034 on 2026-07-01), only **17 pages surfaced in Google search in the last 28 days** (609 impressions, **0 clicks**). A representative URL-inspection sample of 45 returned **1 "Submitted and indexed," 12 "Crawled – currently not indexed," 32 "URL is unknown to Google."** Every pillar + every blog post inspected is *Crawled – currently not indexed* with robots **ALLOWED** and a self-canonical — so there is **no technical block**; Google is choosing not to index, and ~71% of the sampled catalog (cards/sets) is **undiscovered ("unknown to Google")**. The real problem is **discovery + authority, not sitemap size or a crawl-hygiene bug** — the opposite of what a sitemap-count inference would suggest. This reframes the SEO backlog toward internal linking / crawl-budget / authority, not more pages.

**Consequences.** New dep `google-auth-library`. New env `GSC_SA_KEY_JSON` (docs/ENV-VARS.md). Phase 1 (GCP project + SA + GSC add-user) was John-manual and is **DONE** — the SA (`gsc-reader@n8n-content-project.iam.gserviceaccount.com`) authenticates with `siteFullUser` access. Optional follow-up (automation-first): a weekly cron posting the indexed-count / "unknown-to-Google" delta to `#content-engine`.

## ADR-110 — Extending the ADR-104 freshness doctrine to the baked /lines snapshot + "TCGplayer listed" labeling

**Date:** 2026-07-08 · **Status:** Accepted

**Context.** ADR-104 made the `/cards/[slug]` sold surface honest (fresh-windowed figures, dated last-sale degradation, a render-time coherence gate) — but the doctrine covered only PokeTrace sold figures on the card page. Three adjacent surfaces still bypassed it, surfaced by the content-trust-hotfix (Phase 1 of the validation-sprint runner):
1. **The `/lines` baked sold snapshot.** `scripts/seed-line-sold.ts` selected `avg30d ?? avg` — the `?? avg` is PokeTrace's ALL-TIME last sale, the exact anti-pattern ADR-104 forbids — and `lib/lines/data.ts` rendered it with no freshness claim-check. A months-old outlier (or a slowly-drifting stale window) got frozen into the committed snapshot and rendered as "sold recently."
2. **The TCGplayer `market` figure** on the variants panel + `/lines`, presented as a bare "market" / "to buy right now" price. The ADR-104 coherence gate is PokeTrace-**sold**-only; it never reached the baked TCGplayer market, which runs ~2× real sold on low-liquidity vintage (Base Blastoise $229 listed vs ~$95 sold, per the 2026-07-05 deals-freshness diagnosis).
3. **Cross-post figure contradictions** for Moonbreon (Umbreon VMAX Alt Art, EVS 215): three live blog posts disagreed ~12× (raw NM $2,100 vs $180; PSA 9 $2,300 vs $175-220; PSA 10 $4,400 vs $310-380).

**Decision.**
1. **Fresh-windowed selection, extracted + shared.** `lib/lines/sold-select.ts::resolveLineSoldEntry` is the one place that picks a `/lines` headline figure. It reuses `freshWindowedValue`/`isFreshStat` from `lib/cards/sold-coherence.ts` (windowed `avg30d ?? median30d`, gated on the tier's last sale being within `SOLD_FRESHNESS_MAX_DAYS`), drops the all-time `avg` fallback entirely, keeps the ≥3-sales + TCGplayer sanity band, and records the tier's `lastUpdated` as `soldAsOf`. Null-over-guess: no fresh windowed value → no baked figure. The generator + the render + the unit tests all consume this one function.
2. **Render-time degradation.** `lib/lines/data.ts` carries `soldAsOf` per entry; `soldPhrase` renders "Sold for ~$X recently" only when fresh, else dated "Last sold ~$X (as of <Mon D>)". `isSoldFresh` keys off the entry's own last-sale date (fallback: the snapshot-wide `asOf` for legacy entries).
3. **Honest TCGplayer labeling (not suppression).** The variants panel + `marketPhrase` label the figure "TCGplayer listed ~$X" with a may-lag caveat, instead of "market" / "to buy right now." Deliberately a LABEL, not a coherence gate: for high-liquidity moderns the listed price ≈ sold (Moonbreon listed $2,276 ≈ sold $2,285), so blanket suppression would wrongly hide an accurate figure; the honest framing is that it's a listed reference that can lag.
4. **Figure reconciliation to a SOURCED number.** A live PokeTrace probe (2026-07-08) resolved Moonbreon to eBay NM $2,285 (n=64) / PSA 9 $2,277 (n=202) / PSA 10 $4,574 (n=548), cross-checked by TCGplayer NM $2,240 (n=368). The checklist post ($2,100/$2,300/$4,400) was already correct; the two undervaluing posts were reconciled up to the sourced numbers and pinned with content markers.

**Consequences.**
- The `/lines` snapshot was regenerated with the fresh-windowed rule: 8 figures the old all-time fallback had skewed were corrected (e.g. `neo2-32-umbreon $175→$72`, `neo2-20-espeon $93→$28`), 1 stale entry honestly suppressed, all 52 entries now carry `soldAsOf`.
- **Premise correction (P0 check paid off):** the brief's "neo2-13 Umbreon $840 is ~2× inflated vs ~$450 live" was CONTRADICTED by the probe — $840 is the current fresh 30-day windowed NM average (med $750, n=20, updated 2026-06-07); "$450" was a different basis (lowest active ask). $840 was left intact (sourced-correct); the value delivered was the architectural gate + the 8 *other* corrected figures, not the named card.
- **Affiliate silent-drop → loud (Defect 4, tangential):** `lib/affiliate/epn.ts::buildAffiliateUrl` still soft-fails to an unwrapped URL when `EBAY_CAMPAIGN_ID` is unset (navigation must never break), but now fires a once-per-process `#errors` ping in production so a config miss surfaces immediately instead of leaking 100% of affiliate attribution silently (it bit the 2026-06-28 digest). The decision + latch are unit-tested via the injectable `alertMissingCampaignId`.
- Extends ADR-104; updates R-066 (residual closed) + R-068 (2026-07-08 amendment). `/security-review`: no findings.

## ADR-111 — Foil Pro repurposed to a $6/mo + 30-day card-required trial (test-mode rail)

**Date:** 2026-07-08 · **Status:** Accepted (test mode; live activation is John's gate)

**Context.** Validation-sprint Phase 2. The in-tree Stripe surface was built for the parked $14.99/mo scanner paywall (ADR-020 deferred it). The strategic reframe (foil-gated-drop-paid-test) needs a **$6/mo subscription with a 30-day card-required trial** to run the willingness-to-pay ads test — a card entered is the conviction signal free email never gave. This phase builds the RAIL (checkout + webhook + entitlement + a `/pro` page), not the pitch — the offer wording is the upcoming Fable offer-lock session's call.

**Decision.**
- **Price → $6/mo.** `PRO_PRICE_USD_CENTS` 1499 → 600. A NEW lookup key `foil_pro_monthly_v2` (the old `foil_pro_monthly` is bound to the immutable $14.99 price object) so `ensureProProductAndPrice` creates a fresh $6 price instead of silently reusing the old one.
- **30-day trial, card required.** `createCheckoutSession` adds `payment_method_collection:"always"` + `subscription_data.trial_period_days:30`. Confirmed against docs.stripe.com/payments/checkout/free-trials: `payment_method_collection` defaults to collecting a card, `"if_required"` is the opt-out; `"always"` is set explicitly so a $0-due trial still collects the card. `trial_period_days` is the trial length.
- **Webhook covers the trial lifecycle.** Added `customer.subscription.created` + `customer.subscription.trial_will_end` alongside the existing `checkout.session.completed` / `.updated` / `.deleted`. The status→tier mapping is extracted to a pure `lib/stripe-entitlement.ts::subscriptionTier` (trialing + active → pro; everything else → free) — unit-testable without the route's `@/` imports (the node test runner doesn't resolve the alias). No schema change: `subscriptions.current_period_end` doubles as the trial-end date during `trialing`.
- **`/pro` page** (new, PUBLIC per `lib/supabase/public-routes.ts`): the offer + a checkout CTA in the night brand register. Function-first copy, FLAGGED for John's voice veto — not locked. The CTA posts to the auth-gated `createCheckoutSession`, so the page is anonymous-reachable but the purchase self-gates to `/login`.

**Verification (the closure bar).**
- **Mockable unit tests** (`lib/__tests__/stripe-pro.test.ts`): the `subscriptionTier` status matrix + `periodEndIso` + the $6/30-day config.
- **Live test-mode E2E** (`scripts/verify-stripe-pro.ts`, guarded to `sk_test`): 5/5 — the $6 price is created idempotently; a real subscription reaches `trialing` (trial_end +30d); the webhook's exact upsert logic creates the entitlement row as `pro`; canceling revokes it to `free`; full cleanup (subscription, customer, row, temp auth user). This exercises everything the webhook drives except the browser-hosted-checkout + HMAC-signature HTTP layer (Stripe's own SDK) — documented in the go-live checklist as John's optional manual confirm.

**Consequences.** Live-mode activation (Stripe live keys + live product + prod webhook secret) is billing/credentials = John's gate; `docs/goals/_results/stripe-golive-checklist.md` has his exact ~20-min steps. New optional env `STRIPE_PRO_PRICE_ID` (docs/ENV-VARS.md). The parked $14.99 price object stays in Stripe (harmless). Nothing gates on `/pro` yet (RAIL, not pitch). Extends ADR-020.

## ADR-112 — /deals gated teaser + funnel instrumentation (the WTP-test rail)

**Date:** 2026-07-08 · **Status:** Accepted

**Context.** Validation-sprint Phase 3. The reframe (foil-gated-drop-paid-test) turns the supply-constrained `/deals` board (0–6 real good-buys/day — fatal for an always-on page, ideal for an inbox) into a **gated daily drop you subscribe to**. This phase gates the BOARD only (the settled shape: top 2 shown, rest visibly locked) and stands up the funnel instrumentation — it does NOT touch the email product or pre-empt the free-vs-paid-drop fork (that's the ads A/B + the Fable offer-lock session).

**Decision.**
- **Gated teaser** (`components/deals/deals-board.tsx` + `lib/deals/gate.ts`): the top 2 deals render fully (the public proof-it's-real teaser); the rest render as visibly-locked rows (card dimmed + blurred, no sold price / below% / CTA leaked) above an email drop-subscribe. **Thin-day honesty is the load-bearing property** — `dealsGateState(totalToday)` NEVER fabricates a locked count: with 0 deals it degrades to "Nothing worth locking today" (the trust flex), with 1–2 it shows them all with no fake lock, and only with ≥3 does it lock the real remainder ("N more good buys today"). Pure + unit-tested across the full 0–12 range.
- **The gate** (`components/deals/deals-drop-gate.tsx`, client) reuses the ADR-090 tri-store path (`subscribeAction` → Beehiiv + owned Supabase list + Resend) and the ADR-084 UTM forwarding (mirror the landing URL's `utm_*`/`?src=` into hidden fields) with `source="deals_gate"` — so a `/deals?utm_source=reddit` signup is attributed. No new capture path; the existing, already-reviewed one.
- **Funnel report** (`scripts/funnel-report.ts` + `lib/funnel/aggregate.ts`, `npm run funnel-report`): the three signals from the owned source of truth (Supabase) — (1) signups by `utm_source`, (2) trial starts (subscriptions rows WITH a `stripe_subscription_id` — the free placeholder rows are excluded), (3) trial→paid among RESOLVED trials. **Honesty:** signup% and trial-start% as TRUE conversion rates need the ad platform's clicks (the denominator we don't have server-side), so it prints raw COUNTS + the one rate we can compute, and says so — no invented percentages.
- **Content marker:** the gate renders "get the drop" in every supply state (SSR HTML), pinned by `content-marker-verification.test.ts` so the live board is verified in prod.

**Consequences.** `/deals` now has the gate inside `DealsBoard` (the page didn't change — it already passed `deals`). The existing footer `EmailCapture` stays (secondary). UTM persistence is covered by the shared `subscriber-attribution.test.ts` (the gate reuses that path) + verified live (the funnel-report groups by `utm_source`). Nothing gates on the email product yet (board only). The free-vs-paid-drop fork stays OPEN for the ads A/B. `npm run funnel-report` verified live (reads real Supabase). Extends ADR-054/090.

## ADR-113 — The locked offer wired in: tier mechanics, payment-first guest checkout, the Pro daily drop, two-voice copy + the register rule

**Date:** 2026-07-11 · **Status:** Accepted

**Context.** The 2026-07-11 offer-lock session (John + Fable, every decision ratified; spec `docs/goals/offer-implementation.md`) fixed the offer: free = top-2 /deals teaser + weekly digest + 3 active watches checked once daily (seeded gift vaults exempt); Pro $6/mo with a 30-day card-required trial = unlimited watches checked hourly + the full daily deal drop + an honest founding rate-lock. The funnel-stress-test (ADR-112 follow-on, 4e90611) had confirmed the promised daily drop had NO send path and even the weekly digest was off in prod. Two voice rules were ratified: product surfaces speak as Foil-the-agent in third person (supersedes the 2026-07-03 first-person-singular rule ON PRODUCT SURFACES ONLY — John's "I" stays on X + editorial), and the REGISTER RULE (card-shop language; finance/tech words banned in public copy).

**Decision.**
- **Email→tier bridge:** `subscriptions.email` (lowercased, webhook-written, migration-backfilled from auth.users) bridges the email-anchored watch subsystem to the user_id-keyed entitlements. `getTierByEmail` / `proTierEmails` in `lib/entitlements.ts`.
- **Free watch cap (3, product cap, distinct from the 100 abuse cap):** shared `lib/wishlist/free-cap.ts` guard on all three write paths (/api/start bulk, card-page action, vault add); seeded-vault rows (src ∈ SEEDED_VAULTS) exempt; re-add of a watched card is an update and always passes; fails OPEN on read errors (availability > enforcement; the abuse cap still bounds damage). Cap hit returns `watch_limit_free` + an upgrade prompt on every surface.
- **Cadence split:** one filter in the existing hourly wishlist-alerts cron (`watchDueThisRun` in `lib/offer.ts`): pro rows every run, free rows only on the 17:00 UTC run. No new engine.
- **Payment-first guest checkout (1d, supersedes the ratified "return-to-checkout" wording per the 2026-07-12 Fable amendment):** `createCheckoutSession` no longer bounces signed-out buyers to /login — a guest session is created with NO `customer` (Stripe creates one; verified docs.stripe.com/api/checkout/sessions/create), success lands on `/pro?checkout=success` (public) with the "check your email for your sign-in link" state. The webhook resolves the account: email from `customer_details.email` → lookup-FIRST via a SECURITY DEFINER `get_user_id_by_email` (service-role-only; PostgREST can't read auth.users) → `admin.createUser(email_confirm:true)` if missing → entitlement upsert → magic link via `signInWithOtp(shouldCreateUser:false)`. Known noise: `customer.subscription.created` can arrive before `checkout.session.completed`; the pre-existing "no subscription row" fallback logs and the completed event resolves it.
- **One-trial-per-customer (1c), keyed on email:** no native Stripe gate exists (docs-verified) — `lib/stripe-trial.ts::trialAlreadyUsed` walks customers-by-email (case-sensitive list endpoint; both spellings probed) for any prior `trial_start`. Signed-in: checked at session create → a used trial gets a NO-TRIAL checkout ("$6 due today" displayed honestly). Guest (email unknown pre-checkout): enforced in the webhook — a repeat-trial trialing sub is CANCELED before any charge (trial = $0 due) and the buyer gets an honest email pointing at the signed-in no-trial path; never a surprise charge (card-network trial-disclosure compliance). A duplicate live sub for the same account is likewise canceled (double-billing guard). Fails open on Stripe errors.
- **The Pro daily drop (2a):** deterministic composer `lib/newsletter/daily-drop.ts` + daily cron `/api/cron/daily-drop` (09:47 UTC, after deals-refresh + movers) sending the day's full BELOW board to live Pro entitlements only, skipping unsubscribed addresses; text-forward/Primary-safe per ADR-079. THIN-DAY DECISION: a 0-deal day SENDS the quiet-day email (the offer copy literally promises "On a quiet day it says so"). DEVIATION flagged: drop links go to card pages (the house), not EPN-tagged eBay URLs — buy_signals stores no eBay fields (R-008) and ADR-091 set the "email is the doorbell" doctrine; affiliate revenue happens on the page click-through.
- **Market-temperature stat (item 6):** `market_temperature` table + `computeMarketTemperature` over the movers run's full priceable snapshot universe; rendered in card-shop words on /deals + the drop email, freshness-gated to 7 days. Market-level claims in copy stay banned without it. The goal's "pull watched cards into the daily sweep" was already de facto done by ADR-092 hydration (P0 premise check).
- **Copy stack + register:** locked lines applied verbatim on /pro (H1/sub/cards/trust/founding/free-catcher), the /deals gate re-pitched to Pro ("N more good buys today." / "Pro sees everything Foil finds, first.") with the real locked count and the free catcher above the digest form; homepage watch promise retuned per-tier (no "the moment" claim for free-daily); cadence promises reconciled (gate: "one email a week"; /account and start-success state the daily/hourly split). Agent dress: prompt-style watch box ("Tell Foil what you're chasing…", null-over-guess empty state asks), agent receipts ("Foil is now watching N cards for you", alert emails open "Foil checked your watches. N hit(s)."). Jargon sweep executed ("sample-size gated" → "we only show a price when enough copies actually sold") and pinned by `lib/__tests__/register-rule.test.ts` (banned-words scan over the public copy surfaces + locked-copy verbatim pins + the no-em-dash rule).
- **?hook=drop (item 7):** /pro reads the searchParam server-side and leads with the drop framing; UTM + hook ride checkout subscription metadata for funnel attribution (ADR-084/112 passthrough).

**Consequences.** Two migrations (`subscriptions_email_bridge`, `market_temperature`) need `supabase db push` before the cadence/cap/drop paths are live in prod. John's activation steps: set `NEWSLETTER_DIGEST_MODE=approval` (the free tier's weekly digest is otherwise OFF — ENV-VARS row flagged), edit the Beehiiv welcome automation copy ("about one email a week" stays true for free; dashboard-only), and optionally retitle the Supabase magic-link template ("Foil is set up — your sign-in link" is a dashboard template, not code). The /account scan-era copy is gone; FREE_DAILY_SCAN_LIMIT remains only on the parked V2 scanner surfaces. Repeat-trial abuse (R- from the Phase-2 review) is now mechanically closed. Extends ADR-111/112; supersedes the first-person voice rule on product surfaces (deliberate succession, offer-lock session).

## ADR-114 — Auth email over Resend SMTP + the token_hash /auth/confirm flow (magic links that actually work under SSR)

**Date:** 2026-07-12 · **Status:** Accepted

**Context.** The prod smoke test after the ADR-113 push surfaced two auth failures with live evidence: (1) POST /login intermittently 503'd — the project had NO custom SMTP, so auth email rode Supabase's built-in sender (`noreply@mail.app.supabase.io`) with its hard `rate_limit_email_sent = 2`/hour cap (config read via the Management API confirmed both), and the login form rendered an empty error message as silence; (2) the guest-checkout sign-in link failed with `/login?error=invalid_link` — the default email template's `{{ .ConfirmationURL }}` produces an implicit-flow redirect whose `#access_token` hash fragment never reaches the server, while our SSR callback only handled `?code=` exchanges.

**Decision.**
- **Custom SMTP via Resend, configured through the Management API** (`PATCH /v1/projects/{ref}/config/auth`, PAT auth; note: Cloudflare 1010-blocks python-urllib — use curl): host `smtp.resend.com`, port 465, user `resend`, password = `RESEND_API_KEY` (verified against resend.com/docs/send-with-smtp), sender `Foil <alerts@foiltcg.com>` — the same verified domain as transactional mail. `rate_limit_email_sent` lifted to 30/hour.
- **token_hash + verifyOtp flow** (the Supabase SSR docs pattern): new public `GET /auth/confirm` calls `verifyOtp({ type, token_hash })` server-side and redirects to a SANITIZED `next` (`lib/auth/next-path.ts`, same-origin paths only, test-pinned). The magic-link template (also Management-API-managed) links to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` — RedirectTo, not SiteURL, as the base so localhost dev links resolve locally; every `signInWithOtp` sender must therefore pass `emailRedirectTo` pointing at `/auth/confirm?next=…` WITH a query string (pinned in `auth-next-path.test.ts`). `uri_allow_list` gained `http://localhost:3000/**`. The legacy `/auth/callback` stays for any in-flight links. Subject: "Your Foil sign-in link" (the offer-spec's em-dash subject line lost to John's own no-em-dash rule).
- **Honest error surfacing on /login:** the action maps rate-limit/failure cases to register-clean copy and NEVER returns an empty message; the form renders a fallback even if it somehow gets one, plus a distinct "link sent" confirmation block. `/login?error=invalid_link` renders an explanatory banner. The invisible-ink bug's root cause was `dark:` zinc variants flipping with the OS while the site forces cream with no dark override (ADR-029) — /login is now explicit-light. `/account` has the same latent OS-coupling; only its worst two contrast holes were patched (ADR-113 tour) — full palette migration is a separate task.

**Verification (live, localhost + real email):** /login send → visible confirmation → email received from `alerts@foiltcg.com` with subject/template ours → link hit `/auth/confirm` → landed SIGNED IN on /account as the test alias. The guest-checkout leg reuses the identical sender/template/route; its only unexercised step is a live card entry (runner-prohibited), covered by John's next smoke test.

**Consequences.** Auth email deliverability now rides the Resend domain reputation (also carrying alerts/digests — watch for volume coupling). The Supabase-side config (SMTP, template, allow list, rate limit) is NOT in the repo; this ADR + the Management API are the record. If the Resend key is ever rotated, `smtp_pass` must be re-PATCHed (added to the ENV-VARS RESEND_API_KEY row). Extends ADR-113.

## ADR-115 — /start is a place, not a form: the binder desk (scene-as-interface, honesty outranks delight)

**Date:** 2026-07-12 · **Status:** Accepted

**Context.** /start is the highest-emotion moment in the product (a collector naming their grails) and it was dressed as a shipping-address form. John's taste call during the stranger run: "the way users select their cards must be addictive or therapeutic." The reference John chose (baothiento.com, walked and INTERACTED with live before any code) supplied the grammar: scenes that are dormant until you lean in, life that runs its own loop, a cursor that becomes a real tool, inputs demoted and in-world, and delight that stays quiet.

**Decision.** /start becomes **the desk**: a nine-pocket binder page under a lamp, where filling a pocket IS adding a watch.
- **The mechanism is the sleeve, not a text input.** Tapping an empty sleeve fans REAL card art in one arc; picking seats the card with a settle animation; the typed path survives only as a demoted whisper ("know the exact card? type it") for power users and a11y. The dropdown-first affordance is gone.
- **The free cap is FURNITURE.** Three open sleeves, six visibly-Pro sleeves. The limit is an inviting object, never an error state or a modal.
- **The shimmer is the idle behavior.** Seated cards catch a slow staggered light sweep, exactly like real holos in a real binder when the light moves. This is the one idle animation that is *ours* by right — we are named Foil.
- **HONESTY OUTRANKS THE SCENE.** Every offered card is real (live `market_movers` + the committed sold snapshot, soft-failing); every payoff is a real sold average WITH its sale count, or an honest absence ("No clean sold read yet"); a blank price tag posts a genuine NULL (the ADR-091 market-basis watch); and a suggestion may never claim a relationship the data can't support — the reason rides with it, so a same-SET fallback says "Also from Destined Rivals," never "sits in the same run." No streaks, timers, scarcity, or confetti; that ban is now structurally pinned.
- `/start` moved force-static → **force-dynamic** (the deck is live and the tier is per-user; a cached render would have served one collector another's cadence copy). The old `components/start-page-form.tsx` is DELETED, and its invariants (honeypot, CAN-SPAM opt-in default, UTM capture, wire shape) were MOVED onto the new component rather than deleted with it.
- **`lib/start/wire.ts` is now the single wire contract** shared by `/api/start`, the client, and the tests.

**Consequences.** Three defects this taught us, all pinned: (1) **a test that names a contract but doesn't execute it is not a test** — the binder shipped a payload the route rejected (every submit would have 400'd) while a green test claimed to check exactly that; the schema is now executable and a regression test parses the real client payload. This was caught by `/security-review`, not the suite, because **I had not driven the submit** — launch-and-look is not verification. (2) Delight can lie: the "one more" suggestion invented a lineage; truth-density now has a test. (3) A client-imported module must stay server-free — `binder.ts` pulled `lib/offer.ts` → `vault-seeds.ts` → `node:fs` into the browser bundle and broke the build on first render; `FREE_POCKETS` is restated client-side and pinned equal to `FREE_WATCH_CAP`.

**Deferred on purpose:** the booster-pack drag-to-rip (the top follow-up, and the missing half of the joy ceiling), the price-guide magazine, the day/night lamp, the vault inheriting the desk, and the success metrics (time-to-first-watch, add-completion, adds/session). **Unverified:** a clean 390px render + Lighthouse mobile ≥90 — John should check a phone before merge. Extends ADR-093 (the vault) and ADR-113 (the locked offer's free cap).

**Amendment — cycle 2, the magic beats (2026-07-12, same branch).** Four decisions worth recording:
1. **Foil writes the tag first, and an untouched written tag POSTS the penciled number.** When a card seats, the tag fills in pencil with "Foil suggests: under $X", where X is `marketFloorCents` (ADR-091's 15%-under-30-day-average) imported from `lib/wishlist/alert-decision.ts` — never restated math — dollar-rounded, sample-gated at the deals engine's own `MOVER_MIN_SALES` floor (restated client-side as `SUGGEST_MIN_SALES`, pinned equal). The accepted suggestion posts as a concrete `target_price_cents` rather than NULL so the vault later shows exactly the number the collector saw on the tag (the tag never lies to the wire). Consequence: an accepted tag is a snapshot — it does not track the floor downward the way a NULL target does; that is the honest reading of "the collector accepted $X."
2. **The heartbeat is time-honest, deviating from the spec's literal copy.** The spec's line was "Foil checks this page tonight" — false for any add after the 17:00 UTC free run. `heartbeatLine` says "later today" / "tomorrow" / "every hour" (Pro), with `FREE_CHECK_HOUR_UTC` pinned equal to `FREE_ALERT_HOUR_UTC`. Precedent followed: honesty outranks the scene, and the scene's script.
3. **The pack deals truth.** The booster rip deals the top of the sale-count-ranked deck, dealt ONCE at rip time; no `Math.random` (pinned). One pack per visit, re-seals on reload — state, not storage; calm, not scarcity.
4a. *(cycle 3, same day)* John's veto verdict on the cycle-2 composition (`design-loop/CYCLE-3-BRIEF.md`) landed as the A1–A8 punch list: the pack scaled to hero-object size with a legible tear affordance (pull-tab + perforation + one glint pass), the lamp pool moved to belong to the pack/binder artifacts, the locked-sleeve wall deleted (see ADR-116 — free owns the page now; ONE quiet Pro line replaces six locked cells), the demo card dimmed at rest with a designed dismiss, the hero cut to one value sentence, one whisper per screen, the counter hidden until the first seat ("X of 9 sleeves filled"), and the rhythm tightened so the binder's top edge shows above the fold at 1440×900.

4b. **Binder art goes through the image optimizer behind a server-side host gate.** Cycle 2's Lighthouse trace showed one lazy 800KB `unoptimized` PNG (rendered at 104px) starving mobile LCP. `imageOptimizable()` in `lib/start/binder-data.ts` drops any card whose art host isn't in the `next.config.ts` `remotePatterns` allowlist (fewer cards over a hard optimizer error, per the soft-fail doctrine); the demo card is `priority`. A11y 96→100 (accessible-name mismatch on the pack, sub-24px tap target). Local mobile Lighthouse: /start 85 vs the /deals control at 70 on the same rig (96–97 on prod infra) — the residual is the site-wide body-font swap repaint, filed to IDEAS as the next `mobile-lcp-font-js-floor`-family item; prod ≥90 verification waits for the push.

## ADR-116 — Free = one binder page (9 sleeves); Pro = more pages + hourly

**Date:** 2026-07-12 · **Status:** Accepted (John's product decision, delivered via `design-loop/CYCLE-3-BRIEF.md` Part B; supersedes the 3-watch free cap ratified in the ADR-113 offer-lock)

**Context.** The cycle-2 binder made the mismatch visible: the scene is a nine-pocket page, but free stopped at 3 cards, so six pockets rendered as a locked-sleeve upsell wall — which John's veto named "dark-pattern furniture," our own anti-reference. The metaphor and the entitlement disagreed.

**Decision.** Free tier = **one full binder page: 9 active watches**, still checked once daily. Pro ($6/mo) = **more pages** (unlimited watches) + hourly checks + the daily drop. Canonical copy: **"Free fills a page. Pro fills the binder."** Mechanically: `FREE_PAGE_SLEEVES = 9` in `lib/offer.ts` is the single source; `FREE_WATCH_CAP` equals it, so all three server write paths (`/api/start`, `create-watchlist`, vault add) enforce the page with no per-path edits; the /start grid's `FREE_POCKETS` is pinned equal by test. The daily-vs-hourly cadence split is UNCHANGED. On /start the locked-pocket state is now unreachable and the wall is deleted; the one Pro affordance is a quiet line under the grid.

**Consequences.** (1) Every "3 watches" copy surface was swept (/pro free catcher, /deals gate + success CTA, /account free row, watch-limit errors, DESIGN.md CTA example, the V6.5 spec's comparison-table row: free = 1 binder page · 9 cards · daily). The locked-copy pins in `register-rule.test.ts` + `content-marker-verification.test.ts` were re-pinned to the new line — this is a deliberate amendment of ratified offer copy on John's instruction, not drift. (2) **Accepted cost, recorded honestly: this 3×'s the worst-case free scan volume per user.** At current user counts (tens of watches total) it is noise. **Revisit trigger:** if the daily 17:00 UTC alert run's card count approaches the eBay Browse call budget (`MAX_BROWSE_CALLS = 200` per run) or the run exceeds ~10 minutes, revisit — options then are per-user staggering, batch dedup by card (many watchers of one card = one Browse call), or a lower page count for new signups. (3) The free tier gives away more surface; the WTP bet is that a fuller binder is a better demo of the hourly/multi-page upgrade, and the A3 composition sells Pro with one honest line instead of six locked cells.

## ADR-117 — LinkedIn syndication is a PASTE RAIL to John's personal profile (human_only, no API client, ever)

**Date:** 2026-07-14 · **Status:** Accepted (John's decision, in-session; retargets the goal mid-flight)

**Context.** The goal `docs/goals/linkedin-page-syndication.md` was dispatched as a `/goal` one-liner but **the spec file did not exist** — Cowork authored it without repo access and the sandbox write never synced (all 140 files in `docs/goals/`, QUEUE.md, and every `docs/` mention of "linkedin" were checked; the only hits were an unrelated vending playbook line). The P0 premise check surfaced this before any build. John's call: author the spec in-session. His second call, after seeing the first draft: **retarget from a Foil company page to his PERSONAL LinkedIn profile** — that is where his ~1,800 followers and the job-proof value live.

Two things were verified against LinkedIn's official docs (Microsoft Learn, li-lms-2026-05) before the retarget, and they support it: (a) org-page posting needs `w_organization_social` via the **Community Management API**, which requires a developer-portal application + approval (calendar-time, John's hands); (b) access tokens live **60 days** and programmatic refresh is **partner-only**, so an API integration would carry a recurring human re-auth ritual and a token-expiry watchdog. The retarget deletes that whole branch.

**Decision.** LinkedIn is a **`human_only`** channel in the ADR-085 policy layer, transport **`manual_paste`**. The automated rail ends at a Discord card: `lib/social/linkedin-caption.ts` builds a deterministic, voice-swept, UTM-tagged caption from a published post's own frontmatter; `scripts/generate-linkedin-post.ts --slug <slug>` is the primary entry point (publish volume is ~zero while `AUTO_PUBLISH_WEEKLY_POSTS=false`, so a publish-only tap would never fire); an env-gated tap in `scripts/generate-weekly-post.ts` does the same automatically when a post really publishes. **John posts it himself. No LinkedIn API client exists in this repo and none may be added without a new decision from him** — pinned in `syndication-channels.test.ts`.

**Consequences.** (1) Authenticity is the feature, not a limitation: a personal post from the founder is the job-proof artifact; an API-posted company-page share is not. (2) Zero new credentials, zero OAuth, zero token rot — the cheapest possible distribution surface. (3) The caption is **deterministic, not LLM-generated** (assembled from frontmatter), so it is fabrication-proof by construction, same doctrine as the deterministic digest (ADR-080); John edits before pasting anyway. (4) Voice rules are enforced in code (no em dashes, "chasing" never "hunting") and pinned by test — the banked voice rules get a machine guard for the first time outside the email templates. (5) **The channel is measured, not assumed:** every caption carries `utm_source=linkedin&utm_medium=social&utm_campaign=<slug>`, and the standing kill criterion is that after ~8 posted captions with zero `utm_source=linkedin` signups in `npm run subscriber-sources`, the channel gets parked. LinkedIn is off-audience for Pokémon collectors — the job-proof value is real regardless, but the funnel claim gets evidence, not vibes. (6) Process lesson (for COWORK-CONTEXT): **a goal file that Cowork "wrote" is not on disk until it is verified on disk.** The one-liner's own instruction to reconcile before building is what caught it; a runner that had trusted the filename would have invented a spec silently.

## ADR-118 — Price basis is a TYPE, not a caption + the listed fallback that survives a dead sold vendor

**Date:** 2026-07-14 · **Status:** Accepted · **Goal:** `docs/goals/pricing-bridge.md` (Phase 1) · **Risk:** R-070

**Context.** The PokeTrace key lapses ~2026-07-15 (John's "don't renew" call). Premise-checked in code: a missing/401 key makes `lib/poketrace/by-uuid.ts` return `null` — graceful, never a crash — so `getHeroSoldStat` returns null and **every card page falls to "Sold data pending for this card."** Honest, and useless: the site loses its price data on every card, in one day.

Two premise checks changed the plan before any code was written:

1. **The goal's Phase 2 (close the 541-card catalog gap, automate the bake) was ALREADY DONE.** The spike memo it was written from (2026-07-13) predates the `quality-bar-fixes` merge (`f90db64`) by hours. Verified on disk: `baked-metadata.json` carries **3,248 cards / 163 sets** (`bakedAt: 2026-07-13`), me2pt5=295 / me3=124 / me4=122 all present (1,885 → 3,248 = **+1,363 exactly**), and `.github/workflows/daily-catalog-bake.yml` is on main with a daily cron that has already committed autonomously (`03cb076`). Phase 2 was dropped, not built.
2. **The goal's Phase 1 named the wrong module.** It said "pricing adapter chain in `lib/pricing.ts`." But `lib/pricing.ts`'s `PriceQuote {source, tier, amount}` is consumed **only by the parked `/upload` scanner** — the card page uses a completely separate `SoldHistory`/`SoldStat` model. Building the chain there would have shipped a change with **zero user-visible effect**. The bridge had to land where the card page actually reads.

**Decision.**

**(a) Basis is a type, not prose.** `lib/pricing/basis.ts` introduces `PriceBasis = "sold" | "listed" | "guide"` and `SourcedPrice {source, basis, amount, lastUpdated}`. Until now the brand promise ("Foil doesn't guess prices. It reads real sales.") was enforced only by hand-written copy in one component — ADR-110's "may lag" label was **prose, not a primitive**; `grep "may lag"` over `.ts/.tsx` returned zero hits. Nothing in the type system stopped a TCGplayer LISTED number from rendering under a SOLD label, and the pressure to do exactly that is highest when the sold spine goes dark. Now a sold-labeled surface's type is `SoldBasisPrice` (`basis: "sold"` literal → a listed price is a **compile error**), plus a runtime `assertSoldBasis` that **throws** on violation, plus a pinned test. The failure mode being guarded is a silent lie, not a crash — hence belt and braces.

**(b) The listed fallback needed no new vendor.** The spike proposed a tcgcsv adapter. It wasn't necessary: the committed catalog snapshot **already carries `tcgplayerPrices` per `variantKey`** (the same key scheme the page's variant picker uses) plus `tcgplayerUpdatedAt` — 2,705 of 3,248 cards priced (83%). So `lib/pricing/listed-fallback.ts` reads what's already in-tree: **zero new vendors, zero new keys, zero id-mapping, zero network — and it cannot fail with PokeTrace because it never touches PokeTrace.** When `heroStat` is null the card page renders that figure under `LISTED_LABEL` ("TCGplayer listed (may lag)") with its date and the line "No recent sold data for this card right now, so this is what it's listed at, not what it sold for." Sold **always** wins when it exists; this is a fallback, never a promotion. Freshness ceiling 30 days (vs sold's 35 — a completed sale stays a fact longer than an asking price); an unparseable or missing date is treated as **stale**, never as fresh. `high` is never used as the representative amount (a $9,999 ceiling ask is noise, not a price — see `base1-2`).

**(c) The fallback must not rot.** The daily bake runs `--only-missing`, which by design leaves an already-baked card untouched — **including its prices**. Measured 2026-07-14: median listed-price age **13 days**, worst **1,231**. Fine while prices were decoration; fatal once they are the safety net, because they would all age past the 30-day window and the fallback would silently resolve to null exactly when it's needed. So: a `--refresh-prices` bake mode (`overlayListedPrices` — surgical, price fields only, so a refresh can **never** clobber the baked PokeTrace `variants`, the exact bug `overlayFreshMetadata` exists to prevent) + a `weekly-price-refresh.yml` cron **with its own Discord alarm**, per the standing rule that any recurring script feeding prod content gets a cron and an alarm the day it's born.

**Consequences.** (1) **Measured: a lapse now leaves 2,673 of 3,248 cards (82.3%) showing an honest, dated, clearly-labeled price instead of 0.** The remaining 17.7% render the honest pending line — null-over-guess is preserved, not weakened. (2) The `basis` keystone makes the ADR-110 register a reusable primitive; future surfaces (deals, alerts, vault, newsletter) can adopt `SourcedPrice` instead of re-deriving the honesty rule per component. (3) `lib/pricing.ts` (the `/upload` `PriceQuote` model) was deliberately **left alone** — extending it would have been an 8-file no-op for users. Unifying the two price models is a real follow-up, but it is not the lapse mitigation and was not smuggled into this goal. (4) The weekly refresh adds ~3.2k pokemontcg.io fetches/week against a flaky upstream; it soft-fails per card (upstream failure → prior entry preserved untouched), and R-071 (the pokemontcg.io→Scrydex continuity risk) now has a second consumer to consider. (5) **Honest limitation:** TCGplayer listed prices have **no per-condition split** — the fallback answers "roughly what is this printing asking," never a condition-laddered sold number, and the code says so in-module so nobody later dresses it as one.
