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

## How to add an ADR

1. Pick the next number (don't reuse).
2. Title: short, specific. The choice + the rationale, not the topic.
3. Sections: Status (Accepted / Superseded / Deprecated), Context (what was true that forced the choice), Decision (what we chose, concretely), Consequences (what now follows — costs, constraints, follow-ups).
4. If superseding an old ADR, edit the old one to add "Superseded by ADR-N" to its Status — don't delete it.
