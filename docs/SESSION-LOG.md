# Session Log

Reverse-chronological log of meaningful work sessions. Each entry: date, commits shipped, one-paragraph summary, and any follow-ups added to [ROADMAP.md](ROADMAP.md).

The point: when I open this repo three weeks from now, the most-recent entry tells me what state we're in without re-deriving from `git log`.

Append new entries at the TOP. Don't edit old entries except to add a "Related: see <date>" link if subsequent work reframes them.

---

## 2026-05-22 — Session 12: Real OpenAI embeddings + outbound Discord notifications

**Commits:** this commit only

**Summary.** Two pieces landed in one goal:

**1. Real embeddings.** `bot/src/embed.ts` wraps OpenAI's `text-embedding-3-small` (1536 dims, $0.02/M tokens) with an in-memory LRU cache (SHA-256 of content as key, capacity 512). `bot/src/db.ts::embedOrFallback` tries OpenAI first; on missing key, network error, or non-2xx response it falls back to the deterministic hash placeholder from Session 11. Both `insertMessage` and `semanticSearchMessages` use the same path so the write and read embeddings live in the same vector space. Backfill script (`bot/scripts/backfill-embeddings.ts`) walks every `bot_messages` row, embeds the content, and upserts into `bot_embeddings`. Safe to re-run; idempotent.

**2. Outbound Discord notifications ([ADR-014](DECISIONS.md#adr-014--outbound-discord-notifications-per-channel-webhooks-soft-fail-single-import-boundary)).** Four channels in Foil HQ — `#deploys`, `#content-engine`, `#subscribers`, `#errors`. Shared library: `lib/notifications/discord.ts` with `postWebhook` (retry on 429 with `retry_after` + exponential backoff on 5xx, soft-fail on every error path) plus shaped helpers `postSubscriberJoined`, `postContentPublished`, `postError`, `postDeploy`. Wiring:
- **#content-engine** — `scripts/generate-weekly-post.ts` fires a combined blog + newsletter embed after the newsletter step completes; falls back to a blog-only embed when newsletter is skipped (`--skip-newsletter` flag or missing BEEHIIV env vars).
- **#subscribers** — `app/actions/subscribe.ts` fires `postSubscriberJoined` (with masked email) on every successful Beehiiv subscribe. Fire-and-forget so a slow Discord doesn't add latency to the form.
- **#errors** — fires from content engine gate exhaustion, content engine newsletter-step failure, subscribe action Beehiiv failure, AND the workflow's `if: failure()` step (raw curl + jq, the one exception to the "all webhook calls go through `lib/notifications/discord.ts`" rule, justified because the Node script is exactly what failed).
- **#deploys** — Vercel native Discord integration; pending manual UI setup (no Vercel CLI for that flow).

**Env mirroring.** `OPENAI_API_KEY` to `.env.local` + Vercel (prod/preview/dev) + GitHub Actions + Railway (foil-bot service). Four `DISCORD_WEBHOOK_*` URLs to `.env.local`; the two needed by the workflow (`CONTENT_ENGINE`, `ERRORS`) to GitHub Actions; the two needed by the Server Action (`SUBSCRIBERS`, `ERRORS`) to Vercel across all environments.

**Tests added.**
- `lib/__tests__/discord-webhook.test.ts` (13 tests) — empty URL, empty payload, POST shape, Bearer-less header check, 429 retry with `retry_after`, 503 retry then give-up, no-retry on 4xx other than 429, soft-fail on fetch-throw, `maskEmail` happy/edge cases, `postSubscriberJoined` field shape, `postError` code-block + runUrl.
- `bot/src/__tests__/embed.test.ts` (8 tests) — endpoint URL, Bearer auth, payload shape, cache hit on identical input, cache miss on different input, throws on missing key / empty input / non-2xx / malformed body / wrong-dim.

**Manual prereq for #deploys.** John needs to install the Vercel→Discord integration once via `Vercel dashboard → Project → Integrations → Browse Marketplace → Discord`. The `DISCORD_WEBHOOK_DEPLOYS` URL is already in `.env.local` as the target. After install, Vercel handles the formatting + delivery; the URL just routes to the channel.

**Backfill execution.** Manual run pending — `cd bot && node --experimental-strip-types --no-warnings scripts/backfill-embeddings.ts` will rewrite every existing `bot_messages` embedding from the hash placeholder to OpenAI real semantic. Idempotent + restartable; skip via `--all` flag set differently (default = "missing only", `--all` = re-embed every row).

**End-to-end verification — recorded below after the live smoke.**

**Key decisions made.**
- [ADR-014](DECISIONS.md#adr-014--outbound-discord-notifications-per-channel-webhooks-soft-fail-single-import-boundary) — per-channel webhook URLs, soft-fail policy, single import boundary at `lib/notifications/discord.ts`, mask-on-emit for subscriber events.

**Follow-ups.** Goal C (daily-digest aggregator to batch events per-channel rather than per-event; Beehiiv MCP integration directly into the bot's tool layer).

**State at session end.** All tests + tsc clean. Vercel #deploys integration is the only remaining manual step.

---

## 2026-05-21 — Session 11: Foil HQ Discord ops bot (persistent memory, curated tools)

**Commits:** this commit only

**Summary.** Shipped a new `bot/` subtree at the repo root — a Discord bot that lives in Foil HQ and answers @mentions with Foil-docs grounding, persistent per-channel memory, and curated tool access. Stack: discord.js v14 + Anthropic SDK + Supabase Postgres + pgvector + Railway deploy. Architecture rationale lives in [ADR-013](DECISIONS.md#adr-013--foil-hq-discord-bot-persistent-memory-ops-chat-with-curated-tools). Closes [ROADMAP NEXT #9.5](ROADMAP.md#next--next-2-weeks-2026-05-28--2026-06-10).

**What landed.**
- `bot/migrations/001_bot_memory.sql` — pgvector extension + `bot_messages` (id, channel_id, user_id, role, content, created_at) + `bot_embeddings` (1:1 sidecar, 1536-dim, HNSW index, cosine) + `bot_semantic_search` RPC + service-role RLS policies. Schema isolated from main Foil app.
- `bot/src/db.ts` — typed Supabase client + `insertMessage` / `getRecentChannelMessages(50)` / `semanticSearchMessages(topK)` / `resetChannel`. Embeddings use a deterministic SHA-256 → 1536-float placeholder; Voyage/OpenAI swap is Goal B (TODO anchored in `hashEmbedding`).
- `bot/src/system-prompt.ts` — reads `../docs/BRIEFING.md` + ROADMAP NOW/NEXT + RISKS High/Medium + latest SESSION-LOG, wraps in `<foil_context>`, caps at 15k tokens. Four channel personas (content / subscribers / errors / general).
- `bot/src/tools/index.ts` — five curated read-only tools: `read_file`, `search_codebase`, `get_recent_subscribers`, `get_publication_stats`, `get_session_log`. All wired into Anthropic's `tools[]` surface.
- `bot/src/handlers/{mention,conversation,slash-commands}.ts` — @mention listener with progressive Discord edits (1.2s debounce under Discord's 5/5s budget), Anthropic tool-use loop, `/sonnet` prefix routes a single turn to Sonnet 4.6 instead of the default Opus 4.5, slash commands `/reset` `/recall` `/help`.
- `bot/src/index.ts` — discord.js client boot with Guilds + GuildMessages + MessageContent intents; registers slash commands on ready; routes messageCreate + interactionCreate to handlers.
- `bot/Dockerfile` + repo-root `railway.json` — Node 22 alpine multi-stage; build context is the repo root so the image can include `docs/` for runtime grounding.
- Tests: 35 in `bot/src/__tests__/` covering db round-trip, channel-prompt selection (incl. section extractors), @mention parsing (incl. `/sonnet` switch), tools, `/reset`. All green; `tsc --noEmit` clean.

**Manual prereqs already done by John (pre-goal):** Foil HQ Discord server created with 6 channels; bot user created with Message Content Intent ON; bot invited to server with Administrator permission; Railway empty project + payment method on file. Tokens collected this session and stored in `bot/.env.local` (gitignored) — DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID=1507171299422765116, RAILWAY_PROJECT_ID=08088ed2-f78d-48de-9559-67a528d1c7cd.

**Live verification (end-to-end).** Migration applied by John via Supabase Dashboard SQL Editor. Railway CLI installed (`@railway/cli` v4.59.0), John ran `railway login`, then linked to project `perceptive-communication` (id `08088ed2-…`). Service `foil-bot` created via `railway add` with all 7 env vars pushed inline. `railway up` from the repo root uploaded the Docker context and Railway built + deployed.

First deploy crashed with `Used disallowed intents` — the Message Content privileged intent was OFF in the Discord Developer Portal. After John toggled it ON, `railway redeploy` brought the bot up cleanly:

```
[boot] online as Chat#7787 (id=1507171299422765116)
[slash] registered 3 command(s) globally
```

Smoke-tested in #general by John: (a) `@Chat what's on the roadmap?` correctly cited ROADMAP NOW items; (b) `/recall Beehiiv` returned semantic hits; (c) `@Chat /sonnet ping` routed to Sonnet 4.6. All three paths green.

**Key decisions made.**
- [ADR-013](DECISIONS.md#adr-013--foil-hq-discord-bot-persistent-memory-ops-chat-with-curated-tools) — Path 2 (Discord bot over web dashboard or Slack). Postgres+pgvector memory, curated tools (not full MCP), Opus 4.5 default + `/sonnet` opt-in, prompt caching on grounding context, Railway deploy.

**Follow-ups.** Goal B (full MCP integration on top of the curated-tools baseline). Goal C (outbound webhook notifications for deploys/content/subscribers/errors → bot posts to channels). Real embeddings (Voyage AI / OpenAI text-embedding-3-small) tracked as a TODO in `bot/src/db.ts::hashEmbedding`.

**Deploy note for next session.** First-deploy intent crash is a documented gotcha: the Discord Developer Portal's "Privileged Gateway Intents → Message Content Intent" toggle is independent of the OAuth invite scope. If a future bot version (or a re-created bot) crashes on `Used disallowed intents`, that's the toggle to check first.

**State at session end.** Bot is online in Foil HQ as **Chat#7787**. Service is `foil-bot` in Railway project `perceptive-communication` (`08088ed2-…`). 7 env vars set on the service. Slash commands registered globally (1-hour propagation for new commands; set `DISCORD_GUILD_ID` env var to make them instant).

---

## 2026-05-21 — Session 10: Newsletter manual-paste fallback via email (supersedes ADR-011 API path)

**Commits:** this commit only

**Summary.** [Session 9](#2026-05-21--session-9-autonomous-beehiiv-draft-generation-never-auto-send)'s end-to-end verification confirmed Beehiiv's Posts API is Enterprise-gated (HTTP 403 `SEND_API_NOT_ENTERPRISE_PLAN`). Today's goal closed the loop: every gate-passing newsletter draft now lands in `docs/newsletter-drafts/{slug}.md` (the canonical, version-controlled artifact) AND ships to `john.c.craig24@gmail.com` via Resend with paste-ready copy + topic rationale + 5-step publish instructions. John pastes the body into Beehiiv's UI, picks a send time, hits Schedule. The manual paste IS the R-001 review step — same checkpoint ADR-011 envisioned would happen inside Beehiiv's draft UI, just relocated.

`lib/notifications/resend.ts` is the new transactional channel (free tier: 3K emails/month, 100/day — comfortable headroom). Sender is Resend's default `onboarding@resend.dev` so no DNS work was required for self-to-self transactional. Email body has 4 labeled sections per ADR-012: (a) WHY THIS TOPIC, (b) NEWSLETTER PREVIEW (subject + preview text + full HTML body), (c) HOW TO PUBLISH (numbered steps), (d) SOURCE BLOG POST (slug + URL + word counts).

Topic rationale is now first-class: `pickNextCandidateWithRationale` in `lib/seo/keyword-backlog.ts` returns the chosen candidate plus a human-readable explanation ("Selected from the **X** pillar (URL: /…). This was rank #N of M cluster posts; K remain unshipped …"). Threaded through `generateWeeklyPost` → script → email payload + .md frontmatter.

Beehiiv 403 is now an info-level log line, not a warning. On our tier it IS the steady-state outcome — the fallback path is the supported route. If/when we upgrade to Enterprise, `createDraftPost` will start succeeding and the artifact's `beehiivStatus` field will flip from `"deferred-manual-paste"` to `"auto-drafted"` automatically (no code change required).

**Key decisions made.**
- [ADR-012](DECISIONS.md#adr-012--newsletter-manual-paste-fallback-via-email-supersedes-adr-011-api-path) — manual-paste fallback. Supersedes ADR-011's API write path. ADR-011's R-001 reasoning + the 6 newsletter quality gates remain in force.
- [ADR-011 status flipped](DECISIONS.md#adr-011--newsletter-drafts-auto-generated-never-auto-sent) to "Superseded by ADR-012 for the write path".

**ROADMAP update.** Added NEXT item #9.5 — Slack/Discord ops workspace. Rationale: as we wire more ops pings (Stripe events, scan errors, autonomy failures, deploy outcomes, AI ask-back), Gmail becomes the lowest-density surface for any of them. Threaded channel per concern would be cleaner.

**R-001 update.** Channel-amplification subsection rewritten to reflect the new architecture: now four baked-in mitigations including "manual paste IS the review step" and the soft-fail-at-every-stage property.

**Tests added.**
- `lib/__tests__/newsletter-file-writer.test.ts` (5 tests) — frontmatter shape, separator literal, YAML quote-escaping, omits `emailMessageId` when undefined, includes all 3 subject candidates.
- `lib/__tests__/resend.test.ts` (8 tests) — endpoint URL, Bearer auth header, subject prefix, 4-section HTML body, XSS escaping, all 3 failure paths return `ok:false` without throwing, missing API key never touches the network.

**End-to-end verification — manual-paste path proven against a real blog post.**

Ran the production pipeline against `near-mint-vs-lightly-played-the-difference-that-doubles-a-card-s-price` (1,499-word source):

| Step | Result |
|---|---|
| `generateNewsletterDraft` | PASS on attempt 1/3 ✓ |
| Subject (45 chars) | "The NM/LP gap that costs you $180 on one card" |
| Preview text | "One condition grade, 38-45% less money — here's the line" |
| 3rd candidate | "Why sellers miss the NM disqualifier most often" |
| Newsletter word count | 534 (gate band 300-600) ✓ |
| Artifact written | `docs/newsletter-drafts/near-mint-vs-lightly-played-the-difference-that-doubles-a-card-s-price.md` ✓ |
| Resend response | HTTP 200, `messageId=5b2c1061-b902-4a6f-94f5-3391e59a90ef` ✓ |

The artifact carries all 11 frontmatter fields (subject, preview, word counts, generatedAt, beehiivStatus = `"deferred-manual-paste"`, the email message id, 3 subject candidates, multi-line topicRationale block) plus the paste-ready body section after the `## Newsletter body (paste-ready)` separator. John should see the email in his Gmail inbox within ~2-3 minutes (subject prefixed with `[Foil Draft]`); first arrival may land in Promotions until he drags it to Primary. The artifact is also on `main` as part of this commit, so even if the inbox copy is lost the paste-ready record is in the repo.

**Subject quality read.** All three candidates are concrete, specific, on-brand. Subject + preview together convey "one condition grade flips a $313 card into $180" in 100 characters — that's what we want.

**State at session end.** Tests + typecheck green. Resend key added to `.env.local` + mirrored to GH Actions secrets. The Mon 2026-05-25 cron will be the first scheduled exercise.

---

## 2026-05-21 — Session 9: Autonomous Beehiiv draft generation (never auto-send)

**Commits:** this commit only

**Summary.** Wired the autonomous content engine to produce a companion Beehiiv newsletter draft for every blog publish. `lib/beehiiv-posts.ts` is the second module in the Beehiiv-import boundary (joining `lib/beehiiv.ts` from [Session 8](#2026-05-21--session-8-beehiiv-email-capture-on-the-blog)); it wraps `client.posts.create` with `status: "draft"` hard-coded — there is no code path in this repo that calls posts.create with any other status. `lib/newsletter/draft-generator.ts` calls Sonnet 4.6 once per attempt to emit `{ subjects: [3 candidates], htmlBody }` in a single JSON output, then runs 6 quality gates (word count 300-600, blog backlink, Foil CTA, NO new-$ figures, no banned phrases, subject 30-65 chars) and retries up to 3x. Wired into `scripts/generate-weekly-post.ts` AFTER the blog file is written — soft-fail try/catch so any newsletter regression cannot undo a successful blog publish. `--skip-newsletter` flag added for local testing. `.github/workflows/weekly-content.yml` now passes `BEEHIIV_API_KEY` + `BEEHIIV_PUBLICATION_ID` to the script. Both are GH Actions secrets (set via `gh secret set` from `.env.local` this session).

**Key decisions made.**
- [ADR-011](DECISIONS.md#adr-011--newsletter-drafts-auto-generated-never-auto-sent) — auto-generated drafts; never auto-sent. R-001 amplification rationale + the architectural contract: status="draft" hard-coded, soft-fail wired, fact-grounding gate against the source blog post. Lifts the "deferred until ≥50 signups" trigger noted in ADR-010 because the audience-risk concern is now bounded by manual review.

**R-001 update.** Trigger-to-escalate now explicitly includes "first time a Beehiiv draft auto-generated by ADR-011 ships to subscribers without manual review" — that would mean the never-auto-send contract was broken and the engine needs an immediate audit. Channel-amplification subsection added with the three baked-in mitigations.

**Tests added.**
- `lib/__tests__/newsletter-quality-gates.test.ts` (13 tests) — every gate has a positive AND negative case, including a multi-failure case to prove no early-exit. The R-001 guard (gate d) has both a fabrication-rejection case and a comma-normalization passing case.
- `lib/__tests__/newsletter-draft-generator.test.ts` (10 tests) — happy path, parse-tolerance, stripHtml, retry-after-fabrication, 3-strike exhaustion, empty-input rejection without an API call. Stubs Anthropic via prototype patch (cheapest seam — production code unaltered).

**End-to-end MCP verification — Posts API gated to Enterprise tier, exactly as ADR-011 anticipated.**

Picked `near-mint-vs-lightly-played-the-difference-that-doubles-a-card-s-price` (the most recent autonomous post) and ran the production pipeline via a temp script. Generator output:

| Field | Value |
|---|---|
| Subject (35 chars) | "The NM/LP gap that costs you 38–45%" |
| Preview text | "One rounded corner, $180 gone — here's the math" |
| 3rd candidate | "Why sellers miss this NM disqualifier every time" |
| Word count | 529 (gate band: 300-600) ✓ |
| Quality gates | all 6 passed first attempt ✓ |
| Source blog word count | 1,499 |

Subject + body sit cleanly inside every quality gate. `createDraftPost` then hit Beehiiv with `status="draft"` and the API returned **403 Forbidden, `SEND_API_NOT_ENTERPRISE_PLAN`** ("This endpoint is only available on the enterprise plan") — exactly the failure mode ADR-011 calls out under Consequences. Our wrapper caught the error, logged it, returned `{ok:false}`. The blog publish path would have been unaffected.

`mcp__beehiiv__list_posts(publication_id, status="draft")` confirms zero new drafts landed (three pre-existing entries from Jan 2025 are unrelated Oracle/SDR-era content from before Foil). So the verification result is "every layer of our pipeline works; Beehiiv's tier gates the final upload" — the architectural contract held.

**What this means for the cron.** Mondays + Thursdays 14:03 UTC will now run the newsletter step. Until John upgrades to Beehiiv Enterprise (or Beehiiv exposes Posts API on lower tiers), every run will: ✓ generate a passing draft, ✗ get 403'd by the API, log the warning, send the failure webhook, exit 0. Blog publishes are unaffected. Workflow logs will show one warning per run; that's the signal to tier-upgrade if/when the newsletter value justifies it.

**Subject line + body are real artifacts available for review** — the structured logs from this verification capture the exact subject candidates Claude produced for that blog post, so John can sanity-check the tone/voice quality without needing the Beehiiv UI surface. Tone read: terse, direct, no padding. Subject "The NM/LP gap that costs you 38–45%" is on-brand.

**State at session end.** Tests + typecheck green. Newsletter pipeline is opt-in via env vars — Mon 2026-05-25 cron will be the first scheduled fire that touches it.

---

## 2026-05-21 — Session 8: Beehiiv email capture on the blog

**Commits:** this commit only

**Summary.** Wired up newsletter capture end-to-end. `@beehiiv/sdk` (v0.1.9) + `zod` installed. `lib/beehiiv.ts` is the single allowed entry point for any Beehiiv call (CORS forces server-side; the import boundary now enforces it structurally). `subscribeEmail({ email, source })` zod-validates input, calls `subscriptions.create` with the fixed UTM payload from [ADR-010](DECISIONS.md#adr-010--beehiiv-for-newsletter-list-management-official-sdk-single-field-form-server-side-key) (`utm_source="foil-blog"`, `utm_medium="email-capture"`, `utm_campaign={source}`, `referring_site="foiltcg.com"`), `reactivate_existing=true`, `send_welcome_email=false`. Rate-limit (429) errors retry once with linear backoff; other errors collapse to a generic `Could not subscribe. Try again.` so Beehiiv internals never leak. `app/actions/subscribe.ts` is the Server Action front door; `components/email-capture.tsx` is the Client Component reusing Foil's existing tokens from `app/page.tsx` (no new design surface invented). Rendered inline at the end of every `app/blog/[slug]/page.tsx` post and in the shared footer on `/blog` + `/blog/[slug]`. `BEEHIIV_API_KEY` + `BEEHIIV_PUBLICATION_ID` mirrored to Vercel across production + preview + development via `vercel env add` (Session 7's CLI tooling paid off — no UI clicks). `ENV-VARS.md` updated with both rows.

Test coverage: `lib/__tests__/beehiiv.test.ts` mocks the SDK via `__setClientForTests`, pinning (a) bad-input short-circuit before any network call, (b) the exact UTM payload shape, (c) one rate-limit retry then success, (d) reactivation collapses to `{ok:true,status:"subscribed"}`, (e) non-rate-limit errors never throw. `proxy.test.ts` pins `/api/subscribe` as the public-route anchor for the contract even though the Server Action piggy-backs on the host page today.

**13 legacy subscribers context.** Beehiiv shows 13 pre-existing subscribers from earlier experimentation. They're dead-list — the future segment that excludes them is deferred. Baseline for the verification step below is 13.

**End-to-end verification (via Beehiiv MCP + production wrapper).**
- `get_publication(pub_8bc42240-…)` → `{ name: "Foil", description: "Pokemon TCG market reads, …" }` ✓
- `list_subscriptions` baseline → 13 active subs (matches expected dead-list count) ✓
- Production wrapper invoked: `subscribeEmail({ email: "claude-code-verification+1779401770@foiltcg.com", source: "claude-code-verification" })` returned `{ ok: true, status: "subscribed" }` ✓
- Raw SDK call (second timestamp) returned a fresh subscription id `sub_088e035a-a76c-48c1-b700-abd4bb28ec48` with `status: "validating"`, `utm_source: "foil-blog"`, `utm_medium: "email-capture"`, `utm_channel: "api"`, `utm_campaign: "claude-code-verification"`, `referring_site: "foiltcg.com"` — the ADR-010 UTM contract was honored exactly.
- `list_subscriptions` post-call → still 13 active. Reason: Beehiiv parks new signups in `status=validating` while the email-validation worker reaches out to the recipient domain. `foiltcg.com` has no catch-all inbox (`mail.foiltcg.com` is send-only — see Session 7's domain verification work), so `+timestamp` plus-addresses can't be validated and never promote to `active`. The MCP `list_subscriptions` only filters by `active`/`inactive`/`pending`/`needs_attention`, so the `validating` row is invisible to that endpoint by design — the row exists, it's just not in any surface-able bucket.

The "13 → 14 active" check originally written into the goal criterion was the wrong oracle for a synthetic email; the right oracle (achieved here) is "wrapper returns ok + Beehiiv issues a sub_ id + UTM payload exact + utm_channel=api". A real user entering a real email through the blog form will land in `active` once Beehiiv's validator confirms the domain.

**Known wrapper behavior (worth tracking).** `lib/beehiiv.ts` currently collapses `status: "validating"` to `{ok:true, status:"subscribed"}`. That's correct for real-user UX (the form shouldn't gate on async validation), but means we cannot distinguish "subscriber confirmed" from "subscriber pending validation" at the wrapper layer. When we wire welcome automations (deferred), revisit this distinction.

**Key decisions made.**
- [ADR-010](DECISIONS.md#adr-010--beehiiv-for-newsletter-list-management-official-sdk-single-field-form-server-side-key) Official SDK + single-field form + server-side key. Newsletter draft generator deferred until ≥50 signups.

**Follow-ups added to ROADMAP.** None today — deferred items (welcome automation, sender change, legacy-sub segment, Posts API draft generator, Recommendations Network) are tracked in [ADR-010](DECISIONS.md#adr-010--beehiiv-for-newsletter-list-management-official-sdk-single-field-form-server-side-key) rather than ROADMAP because they're "after signups exist" triggers, not week-scoped work.

**State at session end.** All tests green (160 / 160 incl. 6 new beehiiv contract tests). Typecheck clean. Working tree carries the new lib + action + component + tests + docs. Push lands next.

---

## 2026-05-21 — Session 7: Local CLI tooling for autonomous infra changes

**Commits:** this commit only

**Summary.** [Session 6](#2026-05-21--session-6-vercel-deploy-hook-for-autonomous-content) ran into a ~50-min stop-hook loop because the deploy-hook goal's acceptance criteria required Vercel UI actions Claude Code couldn't perform. Fix: installed `vercel` CLI (v54.3.0, authed as `johnnycakx`, project linked) + Vercel Plugin for Claude Code (surfaces ~30 `vercel:*` skills) + `gh` CLI (v2.92.0, authed as `johnnycakx` via keyring with gist/read:org/repo/workflow scopes). Documented the routing rule in CLAUDE.md: any goal touching Vercel project settings / env vars / deploy hooks / domains uses `vercel ...`; any goal touching GitHub secrets / workflow dispatch / releases / PRs uses `gh ...`; manual playbooks are reserved only for actions the CLIs genuinely can't do (e.g. accepting an email-confirmation flow). Verified all three tools authenticated end-of-session.

**Key decisions made.**
- [ADR-009](DECISIONS.md#adr-009--local-cli-tooling-for-autonomous-infra-changes) Install local CLIs + plugin instead of continuing to write manual rollout playbooks. Cross-refs [ADR-008](DECISIONS.md#adr-008--vercel-deploy-hook-for-autonomous-content-not-github-integration-auto-deploys) (the precipitating incident).

**Path caveat surfaced during verification.** `gh` is installed at `C:\Program Files\GitHub CLI\gh.exe` but isn't on the PATH that Claude Code's spawned shells see in this session — the shells were created before the install. Until Claude Code is restarted, invoke `gh` via full path. Documented in CLAUDE.md's caveat section.

**Follow-ups added to ROADMAP.** None.

**State at session end.** Three CLI tools live, four docs updated (CLAUDE.md, DECISIONS, SESSION-LOG, ENV-VARS). Next infra-touching goal will be the proof point — should run end-to-end with no UI handoff.

---

## 2026-05-21 — Session 6: Vercel Deploy Hook for autonomous content

**Commits:** `e0edac8` (workflow + ADR + ENV-VARS), `5a4a5cc` (ROADMAP tracking), `f94b863` (rollout-complete docs), plus a small amend after rebasing on top of `045239b` (the autonomous workflow's first successful Thursday post)

**Summary.** Today's Thursday cron commit was rejected by Vercel because the bot identity `bot+content@foil.app` isn't on the Vercel team. Same outcome would fire every Monday + Thursday. Two fixes available: add the bot to the team (couples deploys to GitHub team membership) or use a Vercel Deploy Hook (decouples them). Picked the Deploy Hook. Added a "Trigger Vercel deploy" step to the autonomous workflow that fires after a successful commit, gated on a new `committed=true` output from the commit step — so the kill-switch (`AUTO_PUBLISH_WEEKLY_POSTS=false`) cleanly skips deploys for free. Deploy step logs a warning and exits 0 on non-200 responses rather than failing the run, since a missing deploy doesn't undo the commit and a manual redeploy is always available. Manual UI rollout completed by John end-of-session: Deploy Hook created, `VERCEL_DEPLOY_HOOK_URL` stored as GitHub secret, Ignored Build Step configured to skip `foil-content-bot` commits — so the rejection emails should stop on the next Mon/Thu cron and production should auto-deploy on each successful run.

**Key decisions made.**
- [ADR-008](DECISIONS.md#adr-008--vercel-deploy-hook-for-autonomous-content-not-github-integration-auto-deploys) Deploy Hook over adding the bot to the Vercel team. Rollout complete 2026-05-21.

**Note on contract enforcement.** The goal as written said "Add ADR-007" — but ADR-007 already exists (yesterday's skip-on-failure decision). New ADR landed as ADR-008. This is exactly the case the second-brain contract was designed to catch on its first real use.

**Note on workflow loop.** The autonomous Claude Code session burned ~10 cycles of the stop hook before John completed the manual UI steps and replied "done". Lesson: when a goal has acceptance criteria that require credentials or UI actions the agent can't perform, the agent should make that constraint visible upfront and offer to defer earlier — repeated re-asks added noise without value. Considered as feedback for the goal-authoring pattern, not a blocker today.

**Follow-ups added to ROADMAP.** None remaining. ROADMAP NOW item #5 (the deploy-hook rollout) removed in this commit since the rollout is complete.

**State at session end.** All four commits pushed. The end-to-end flow was validated unintentionally during this session: while John was completing the manual UI rollout, today's Thursday cron fired and successfully landed `045239b feat(blog): autonomous weekly post 2026-05-21` — meaning the deploy hook + Ignored Build Step combination is working as designed. Mon 2026-05-25 will be the second proof point.

---

## 2026-05-20 — Session 5: Second-brain docs + briefing generator

**Commits:** `7689801`, plus this commit

**Summary.** Shipped the 5 second-brain docs (ROADMAP, DECISIONS, SESSION-LOG, ENV-VARS, RISKS) and the CLAUDE.md hard contract that requires every future goal to read + update them. Follow-on: built `scripts/generate-briefing.ts`, which composes a single ~21KB briefing file (`docs/BRIEFING.md`) from CLAUDE.md + the top SESSION-LOG entry + ROADMAP NOW/NEXT + High/Medium risks. Use case: paste the briefing as the opening message of a fresh Claude.ai web chat to bring it cold-start up to current state without losing context to the message limit. Generator overwrites BRIEFING.md on each run so it always reflects the latest docs. Patch after first inspection: resolved Claude Code's `@<file>.md` import directives inline (otherwise they appeared as literal strings in the web chat) and stripped trailing horizontal rules per section to avoid stacked `---` dividers.

**Key decisions made.** None new — applied the existing contract.

**Follow-ups added to ROADMAP.** None.

**State at session end.** All work pushed to origin/main (latest `6e0a5e5`). Working tree clean of project changes. Run `node --experimental-strip-types scripts/generate-briefing.ts` before any new strategy chat to refresh the briefing.

---

## 2026-05-20 — Session 4: Content engine v2 (full autonomy)

**Commits:** `8848382`, `ce4f6d3`, `c969388`, `ad316e5`, `749b21a`

**Summary.** Four-stage build: (1) MDX blog infrastructure + topic-cluster strategy doc, (2) two new pillar landing pages for the value calculator and condition guide, (3) auth-proxy fix to stop the new marketing surfaces from getting gated to `/login`, (4) autonomous content engine v1 (drafts to `_pending/`, opens review PR), (5) full-autonomy upgrade (8 quality gates, 3-retry loop, twice-weekly direct-commit-to-main, SERP context injection via Brave Search, Foil data injection via Supabase). Two real posts shipped end-to-end via the autonomous pipeline: `how-to-read-a-japanese-pokemon-card` and `near-mint-vs-lightly-played-…`. Both passed all 8 gates on first attempt.

**Key decisions made.**
- [ADR-004](DECISIONS.md#adr-004--brave-search-for-serp-context-injection-2kmo-free-fits-2xweek-cadence) Brave Search over SerpApi/DataForSEO.
- [ADR-005](DECISIONS.md#adr-005--twice-weekly-content-cadence-mondays--thursdays-at-1403-utc) Twice-weekly Mon + Thu 14:03 UTC.
- [ADR-006](DECISIONS.md#adr-006--full-autonomy-no-human-review-step-gates-as-the-safety-net) Full autonomy, no review step.
- [ADR-007](DECISIONS.md#adr-007--8-quality-gates--3-retries--skip-on-failure-not-fail-the-build) Skip-on-failure (not fail-the-build) on gate exhaustion.

**Follow-ups added to ROADMAP.** Items #1-9 (NOW + NEXT) are net-new this session. The fabrication risk discussed in ADR-006 is tracked as [RISKS.md R-001](RISKS.md).

**State at session end.** Both commits pushed to `main` (`c969388..749b21a`). Vercel auto-deployed. Local working tree clean. First scheduled cron fires Mon 2026-05-25 14:03 UTC — blocked on GitHub Actions secrets (ROADMAP item #1).

---

## 2026-05-19 — Session 3: Pricing pipeline maturation + UX flip + first SEO surface

**Commits:** `ba35a63`, `6e9e360`, `c4842b8`, `86bc754`, `e16c1e4`, `f8046a5`, `522f194`, `a675475`, `1888d6c`, `f9305d8`, `1243ce9`, `7bfa259`, `30f393e`

**Summary.** Largest single-session count of the build so far. PriceCharting graded ladder added, condition multipliers killed in favor of per-tier quotes (`ba35a63`). Detect filter shipped to drop tiny/low-confidence/bad-aspect boxes and IoU-merge duplicates (`e16c1e4`). Visual confirmation pass gated behind low-confidence matches (`f8046a5`). Partial-id recovery via PokeTrace + PriceCharting candidate dedup (`a675475`). UX flipped: single-card scanning is now V1 primary, binder is an advanced toggle (`f9305d8`, see [ADR-003](DECISIONS.md#adr-003--single-card-scanning-is-the-v1-primary-ux-binder-mode-is-an-advanced-toggle)). First SEO landing page shipped: `/japanese-pokemon-cards-value` with Article + FAQPage JSON-LD (`7bfa259`). Waitlist attribution + UTM capture (`1243ce9`). Card Identification Framework documented (`30f393e`).

**Key decisions made.**
- [ADR-003](DECISIONS.md#adr-003--single-card-scanning-is-the-v1-primary-ux-binder-mode-is-an-advanced-toggle) Single-card primary.
- Pipeline rules established as "null over guess, don't auto-correct printed numbers, 3-letter set codes atomic, low-confidence requires visual confirm" (now codified in `docs/foil-card-id-framework.md` + CLAUDE.md).

**State at session end.** All shipped to main. First pillar page indexed-eligible.

---

## 2026-05-18 — Session 2: V1 critical path end-to-end

**Commits:** `0e19f6d`, `419fdf3`, `ca84b81`, `20a590c`, `311fac4`, `a6ee634`, `997f73f`, `25ce6a1`, `877c841`

**Summary.** End-to-end V1 stood up in a single day. Magic-link auth (`0e19f6d`), Claude Vision wired (`419fdf3`), end-to-end verified on Prismatic Evolutions fixtures (`ca84b81`), two-pass multi-card pipeline + null-safety (`20a590c`), Stripe paywall + Pro subscription verified (`311fac4`), retry pipeline + AGGREGATED price fallback (`a6ee634` — went from 0/9 to 9/9 on the Prismatic binder), Pokemon Card Identification Framework applied to the vision system prompt (`997f73f`), visual confirmation pass + reference images (`25ce6a1`), PokeTrace image cache in Supabase Storage (`877c841`).

**Key decisions made.**
- [ADR-001](DECISIONS.md#adr-001--domain-foiltcgcom-over-foilapp) Domain choice.
- [ADR-002](DECISIONS.md#adr-002--pricing-data-poketrace--pricecharting-scrydex-deferred) PokeTrace + PriceCharting; Scrydex deferred.

**State at session end.** V1 critical path complete. Ready for SEO + content phase.

---

## 2026-05-18 — Session 1: Scaffold

**Commits:** `a68731a`, `32810fc`

**Summary.** Initial Next.js 16 scaffold with Supabase, Stripe, Anthropic SDK wired. Project structure established (no `src/`, App Router, Tailwind 4, Turbopack).

**Key decisions made.** Stack choice (see CLAUDE.md → Stack section).

**State at session end.** Bare scaffold, no domain logic yet.

---

## How to log a session

Run at the end of any non-trivial goal:

1. Add a new entry at the top of this file.
2. Date format: `YYYY-MM-DD`. If a session crosses midnight UTC, use the day the bulk of work happened.
3. List the commit short-hashes shipped, in commit order.
4. **Summary paragraph:** 2-4 sentences. What changed, why it mattered. NOT a commit-by-commit recap (that's what `git log` is for).
5. **Key decisions:** link to the ADRs added or amended in [DECISIONS.md](DECISIONS.md). If no ADR was needed, omit this section.
6. **Follow-ups:** list any items added to [ROADMAP.md](ROADMAP.md) during the session.
7. **State at session end:** one sentence on the working-tree state, what's pushed, what's blocking the next ship.
