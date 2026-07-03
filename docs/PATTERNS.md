# Ideas

Cross-cutting patterns spotted during build that aren't goal-shaped yet but are worth pinning so the next time we hit the same shape, we recognize it. Promote an entry to ADR-N once it's been applied a second time — two instances is the bar for "this is a pattern, not a one-off."

Append new entries at the top. When an entry is promoted, leave it here with a `Promoted: ADR-N` line so the history is preserved.

---

## I-012 — CSS custom-property math is TYPED; number+length invalidates silently and UNSETS every dependent declaration

**Spotted:** hero-fan-widescreen-fix, 2026-07-03 (iter-23).

**Shape.** A fluid scale factor authored as `--fan-s: clamp(1, 1 + (100vw - 1440px) / 2600, 1.34)` parsed fine, served fine, and looked right in the source — but CSS math is typed: a NUMBER (`1`) cannot add to a LENGTH (`(100vw - 1440px) / 2600`), so the property is *invalid at computed-value time*. The failure mode is the trap: an invalid custom property doesn't fall back to the previous cascade declaration — every declaration that consumes it via `var()` becomes **unset**. The hero's `lg:` widths/rotations/margins all won the cascade then evaporated, rendering giant flat natural-width cards. Nothing errored anywhere: not the build, not the console, not tests — only a screenshot caught it.

**The general fix.** (a) To divide two lengths into a unitless number, use `tan(atan2(a, b))` — exactly `a/b`, Baseline 2023. (b) Give every `var()` consumer an explicit fallback (`var(--fan-s, 1)`): a PARSE-invalid declaration (old browser, typo) drops the property → the fallback applies → graceful degrade; note the asymmetry — the fallback does NOT rescue *computed-value-time* invalidity, so the math itself must be type-correct. (c) Screenshot-verify any custom-property math change at the widths it targets; the failure is invisible to every code-level gate.

**Promotion trigger.** Second surface adopting the tan(atan2) unitless-division + fallback recipe → promote to a dedicated ADR (candidate: any future fluid-composition system on /lines or the vault).

---

## I-011 — var() inside a CSS keyframe forces the animation onto the main thread; quantize to literal keyframe variants

**Spotted:** petal-fidelity-pass, 2026-07-02. The sakura drift rig fed per-petal variety (breeze/amplitude/wobble) through CSS custom properties referenced INSIDE `@keyframes` (`translateX(var(--breeze))`). Elegant authoring — one keyframe pair, N petals — but a keyframe that references var() cannot be resolved ahead of time, so the browser re-evaluates it in style recalc EVERY FRAME on the main thread for EVERY animated element. Invisible at 28 petals; at 3x density (84 petals × 2 nested animations) a 4x-CPU-throttled scroll measured ~50-55fps, and a reduced-motion baseline of 240fps pinned the cost to the animation rig itself, not the page.

**The general fix.** Quantize: a small set of LITERAL keyframe variants (four fall breezes × four sway amplitudes) that the compositor can run off the main thread, with per-element variety carried by properties that stay compositor-safe — `animation-duration`/`animation-delay` via var() in the animation SHORTHAND are resolved once at style time and are fine; size/rotation/opacity/shape carry the rest. 4×4 variants + unique duration/delay per element ≈ visually indistinguishable from fully-continuous variety. Homepage scroll went 63 → 76fps at 4x throttle from this change alone. Corollary for profiling: measure the real device matrix, not a synthetic worst case — a phone-class CPU never renders the desktop layout, so "1440px at 4x throttle" is a layout/CPU combination no user has.

**Promotion trigger.** Second surface that adopts the quantized-keyframe recipe for an N-element ambient animation → promote to a dedicated ADR.

---

## I-010 — Committed data artifacts need DATA-level tests; duplicated parsers WILL drift

**Spotted:** perf-and-data-foundation goal, 2026-07-01 ([ADR-089](DECISIONS.md#adr-089--baked-first-card-rendering--the-one-parser-bake-fix-perf-and-data-foundation), incident record [R-061](RISKS.md)).

**Shape.** A repo-committed data artifact (`lib/cards/baked-metadata.json`) was produced by a script carrying a stale duplicate of the SDK's parser. The duplicate captured 8 of ~17 fields, so every snapshot ever committed had `tcgplayerPrices` empty on all 1,840 cards — the AggregateOffer JSON-LD silently emitted nothing on every card page for ~5 weeks. THREE blindness layers stacked: (1) the producer script lived outside the typecheck (`tsconfig exclude: scripts/`), so the shape mismatch never errored; (2) every test asserted on CODE (the page uses the builder; the SDK parses fields) — none opened the committed JSON and asserted on the DATA; (3) the consumer soft-failed by design (null offer, skip render), so the absence looked intentional. Sibling of I-008 (writer ≠ reader): here the writer and reader agreed on the path but disagreed on the SHAPE, and nothing arbitrated.

**The general fix.** For any committed artifact a page/pipeline consumes: (a) **one parser** — the producer script imports the consumer's parser, never re-inlines it (pin structurally: a test that forbids the local duplicate); (b) **producer code inside the typecheck** — an excluded `scripts/` dir is a drift incubator; (c) **data-level invariant tests on the committed artifact itself** (floors on counts/coverage, a known-good record's load-bearing fields non-empty) so a regressed regeneration fails the suite before commit; (d) when regenerating, guard merge-overlays against clobbering fields only the artifact carries (the variant-wipe class — `overlayFreshMetadata`).

**Promotion trigger.** Second committed artifact that adopts the one-parser + data-invariant-test recipe (candidates: `catalog-top5-per-set.generated.ts`, the OG card-art manifest) → promote to a dedicated ADR.

---

## I-009 — External-source context needs attribution discipline baked in, not bolted on

**Spotted:** Goal C.1, feeding curated-creator YouTube commentary into the content engine.

**Shape.** The moment a generator draws on an external source (creator transcripts, competitor copy, scraped SERP text, a partner's data), two failures become possible that pure first-party generation can't have: (1) **plagiarism** — reproducing the source's words, and (2) **laundering** — presenting a source's opinion/hype as your own fact. Both quietly erode trust and create legal exposure, and neither is caught by structure/quality gates (word count, dollar figures) — the text looks fine. The fix can't be a post-hoc "please attribute" nudge in the prompt; it has to be enforced at three layers: **ingestion** (strip what must never appear — R-008 eBay refs, the source's identifiers), **prompt** (synthesize never copy, a hard verbatim cap, attribute by name, label opinion as opinion), and **gate** (fail unattributed collective claims + fail >N-word verbatim runs against the source corpus). Attribution is a *pipeline property*, designed in, not a writing tip.

**The general fix.** For any external-source feed: (a) redact-at-ingestion the things that must never surface; (b) a synthesis + named-attribution prompt rule with a concrete verbatim-word cap; (c) a gate that mechanically checks both — unattributed-source-claim detection AND verbatim-overlap against the corpus (the gate needs the corpus, so it runs where the corpus is available). Treat the source's claims as *speaker-data* (what they said) distinct from *fact-data* (what's true), and never let speaker-data become a cited fact without independent grounding.

**First instance.** Gate 11 (ADR-050): 11a (unattributed collective claim) + 11b (>25-word verbatim run vs transcript corpus), paired with ingestion redaction (`transcript-clean.ts`) + the SYSTEM_PROMPT creator-commentary rules. The pilot caught the discipline working: the generated post cited two creators by name with zero unattributed claims.

**Promotion trigger.** Second external-source feed (competitor copy, partner data) that reuses the redact-prompt-gate recipe → promote to a dedicated ADR.

---

## I-009 — Code-passing gates are blind to signal SEMANTICS; reference-derived smoke tests can't catch comparison-basis bugs

**Spotted:** ROADMAP #32 → #32.1, 2026-06-01. The buy-signal MVP shipped clean: pure compute, 19 unit tests, tsc, build, security-review, all green. The step-9 smoke test even ran against three real cards and "passed." Yet the moment it hit production it was systematically wrong — every flagship card flashed a large green BELOW (Charizard −88.5%) because the live ask (the cheapest listing, usually a played/damaged/junk copy) was compared against a Near-Mint-weighted sold average. The code was correct; the *premise of the comparison* — that ask and reference describe the same condition — was false.

**Shape.** Two failure layers stack here. (1) **Gates verify code, not meaning.** Type-checks, unit tests, and a security pass all confirm the function does what it says; none confirm the function is *measuring the right thing*. A signal that compares two independently-sourced numbers (a live ask vs a sold reference; a forecast vs an actual; a quote vs a benchmark) can be flawless in code and meaningless in semantics. (2) **A smoke test is only as honest as its inputs.** The step-9 smoke synthesized asks *from* the reference (`ask = reference × 0.8/1.0/1.2`), so by construction the ask and reference were already on the same scale — it could never surface a basis mismatch. It tested the arithmetic, not the comparison.

**The general fix.** For any signal that compares two independently-sourced numbers: (a) **normalize the axis before comparing** — here, infer the listing's condition and compare only against the *same* condition's reference, never cross-condition, and emit UNKNOWN rather than guess; (b) add an **outlier guard** that refuses implausible inputs (an ask below half the lowest sold tier is junk, not a deal); and (c) write a **live-smoke test that pulls BOTH numbers from their real, independent sources** and asserts the *output is sensible* (no large-false-BELOW signature), not that the math is right. Reference-derived synthetic inputs are banned in that test — they re-introduce the exact blindness. Make the live-smoke a standing test (creds-gated so credentialless CI stays green; the closure gate runs it with creds).

**Instances.** (1) Buy signal: cheapest-any-condition ask vs NM-weighted sold avg → false BELOW on every card. Fixed by `lib/buy-signal/condition-infer.ts` (axis normalization) + `classifyConditionMatched` outlier guard + `buy-signal-live-smoke.test.ts` (real-ask standing test). See [ADR-053](DECISIONS.md#adr-053--buy-signal-mvp--gate-13-anti-hype) closing amendment.

(2) **The #32.1 smoke was necessary but NOT sufficient — flagship-coverage matters.** #32.1's live-smoke covered only the 3 vintage flagships, which all resolve to **UNKNOWN** (no condition keyword in title). So the smoke was green while the **graded path** (coarse PSA-9-vs-PSA-10-blend) and the **abbreviation path** ("NM 7" → Near Mint) shipped broken — a full-catalog hit-rate scan (ROADMAP #32.3) is what caught them: 9 of 19 rendering badges carried I-009-signature deltas. **Lesson: a real-source live-smoke only guards the code paths its corpus exercises. If every card in the smoke corpus hits the same branch (here: UNKNOWN), the other branches are ungated.** The smoke corpus must include cards that actually produce each output (BELOW / AT / ABOVE / graded), not just the easy/empty path — so #32.3 expanded it from 3 UNKNOWN flagships to 8 including the cards that rendered badges. Corollary: a periodic full-population scan (not just the curated smoke set) is the real backstop for a population-level signal — the smoke pins regressions, the scan finds the unknowns.

**Promotion trigger.** Two instances now (the original mismatch + the insufficient-coverage smoke), both inside the buy signal. If a THIRD comparison-signal bug appears in a *different* feature, promote "axis-normalize + symmetric outlier-guard + real-source live-smoke whose corpus exercises every output branch + periodic full-population scan" to a dedicated ADR.

---

## I-008 — Write path ≠ read path in autonomous pipelines (extends I-003)

**Spotted:** Goal V.1/V.2, 2026-05-31. The autonomous content engine wrote blog posts to `app/blog/posts/`; the live route read `app/(site)/blog/posts/`. Different directories. So every autonomous post silently never went live, and two rounds of edits (the 47.4 fact-check, the first V.1 voice pass) corrected files nobody served.

**Shape.** Whenever one process *produces* artifacts into a location and another *consumes* them from a location, and those two locations are specified **independently** (two hardcoded paths, two env vars, two config keys), they can drift. The drift is silent because each side succeeds on its own terms: the writer writes (exit 0), the reader reads whatever is there (maybe stale, maybe empty). Nothing compares the two endpoints. This is the [I-003](#i-003--silent-autonomy-chain-regressions-integrations-can-disconnect-because-nothing-happens) "nothing happens" failure mode, specialized to a shared *data location* instead of a webhook/deploy hop. Candidates beyond the blog dir: a cache writer vs reader, a bake script's output path vs the app's import path, an upload bucket vs the serve bucket, a queue producer's topic vs the consumer's topic.

**The general fix.** Give the location exactly ONE definition (a shared constant / single env var) that both sides import, and add a test that pins producer-path === consumer-path so a refactor can't re-split them. Then, because a path can be right yet the *content* wrong, verify the consumed artifact's content end-to-end, not just its presence (this is where I-008 meets [I-006](#i-006--green-build--green-tests-are-blind-to-runtime-config-conflicts-verify-on-a-real-deploy): a 200 OK serving stale content is worse than a 500).

**Instances.** (1) `app/blog/posts` (engine write) vs `app/(site)/blog/posts` (route read) → fixed by `lib/blog/posts-dir.ts` + `posts-dir-consistency.test.ts` + `no-duplicate-blog-paths.test.ts` ([ADR-049](DECISIONS.md#adr-049--content-pipeline-writeread-pinning--content-marker-verification-as-a-standing-closure-gate)). (2) The 47.4 fact-check + V.1 voice cleanup both edited the orphan `app/blog/posts` while the live route read `(site)` — the same drift, twice, before it was named. (3) **CI infra, the class's most expensive surface:** `.github/workflows/weekly-content.yml` still `git add`-ed the deleted `app/blog/posts` after the V.2 consolidation, so the autonomous run `26776700075` failed with **exit 128**. The earlier guards only scanned `lib/` + the route; nothing scanned `.github/workflows/`. Fix: the workflow now DERIVES the path from `POSTS_DIR` via a node one-liner (no literal), and `posts-dir-consistency.test.ts` gained a standing guard that fails the build if ANY `.github/workflows/*.yml` carries a literal posts path (old or new). The lesson sharpened: a "shared constant + equality test" isn't enough if the test only covers code — the guard must scan **every** surface that can name the path (code, workflows, scripts, docs that are executed).

(4) **Field-level, not file-level — same shape one layer in.** Gate 12 (em-dash HARD gate) scanned `body + faq` but not the frontmatter `description`/`title`, so the autonomous post `66da22d` shipped an em dash in its meta description (rendered in `<meta>`/OG/the blog-index card) while the gate reported PASS. Fix: Gate 12 now scans `title + description + body + faq`; the newsletter gate gained parity (it scans the **subject** line now, not just body+html — same writable-field gap). Tests pin an em dash in each newly-covered field. **Lesson: when you promote a check to a gate, audit EVERY field the model writes (title, description, subject, preview text), not just the obvious body — a gate that covers the body but not the metadata is a coverage gap, not a gate.**

**Promotion trigger.** Now four instances across two altitudes (directory drift in code + CI; field-coverage gaps in gates). Promote the combined recipe — "one source-of-truth constant + scan every surface AND every writable field" — to a dedicated ADR if a fifth instance appears.

---

## I-006 — Green build + green tests are blind to runtime-config conflicts; verify on a real deploy

**Spotted:** Session 47.5, when an ISR refactor that passed the build + 626 tests 500'd on every page in production.

**Shape.** Some failure classes live entirely at request time in production mode and are invisible to both `next build` and `node --test`:
- **`DYNAMIC_SERVER_USAGE`** — a route exports `revalidate` (ISR) but reads a dynamic API at render (`searchParams`, `cookies()`, `headers()`, `connection()`). The build doesn't catch it when `generateStaticParams` is empty (nothing prerenders), and dev mode doesn't enforce it. It only throws on a real request against the production server.
- **Metadata-route assumptions** — e.g. assuming `generateSitemaps()` emits an index at `/sitemap.xml` (it doesn't — children are at `/sitemap/[id].xml`, no index). The build "succeeds"; the URL just 404s at runtime.
- **Middleware/proxy interactions** — a new route path is correct in isolation but the default-deny auth proxy (`lib/supabase/proxy.ts`) 307s it to `/login` because it's not in PUBLIC_ROUTES. Tests pin the proxy contract for *known* routes, not routes a refactor newly introduces.

The common thread: **the test suite asserts on source text + pure functions; the build asserts on compilation + what it chooses to prerender. Neither exercises a real HTTP request through the production runtime + middleware.** A refactor can be 100% green locally and 100% broken in prod.

**Two instances in the repo so far.**
1. Session 47.5 ISR refactor → `DYNAMIC_SERVER_USAGE` 500s on all `/cards/[slug]` (caught only by the P6 production curl).
2. Session 47.5 sitemap split → `/sitemap.xml` 404 + child shards 307→`/login` (same P6 curl).

**The general fix.** (1) For anything touching route-segment config, metadata routes, or middleware, a green build + green tests is NOT sufficient closure — `curl` the actual deploy (the goal's P6 "no '?'" verification is exactly this discipline, and it earned its keep here). (2) Two of these were also knowable *before* building, from the page source (`searchParams` read ⇒ can't ISR) and the platform docs (`generateSitemaps` has no index) — the P0 premise check is the cheaper place to catch them. Verify-on-deploy is the backstop; read-the-source/read-the-docs is the front line.

**Related:** [ADR-047](DECISIONS.md#adr-047--ssgisr-hybrid-rendering--metadata-only-tier-for-the-18k-long-tail) "Runtime reality", R-010 (tests passing ≠ correct), AGENTS.md "read the docs before touching any external platform".

---

## I-005 — Resumable long-running scripts: checkpoint state + snapshot together

**Spotted:** Session 47.5, building toward the 18K-card bake (ADR-047).

**Shape.** A script that loops over thousands of items, each doing a rate-limited API call (the PokeTrace/SDK bakes — 20-40 min on 1,000 cards, far longer at 18K), will eventually get killed partway (timeout, network, Ctrl-C, CI cap). If it only persists at the end, a kill loses everything; if it persists per-item but the "what's done" marker and the "actual output" live in separate writes, they drift — on resume you skip an item the output never captured. The fix has two parts: **(1) persist progress periodically, not just at the end** (`SAVE_EVERY` flush), and **(2) flush the done-marker and the output snapshot together, marking an item done only AFTER its data is in the snapshot** — so the state never claims an item the snapshot lacks. A `--resume` flag then reads the state and skips done items; a killed run + restart converges to the same result as an uninterrupted one.

**Two instances in the repo so far.**
1. `scripts/bake-poketrace-uuids.ts` — `--resume` skips already-matched cards; flushes snapshot + `.bake-poketrace-state.json` every 25 via the shared `createBakeCheckpoint`.
2. `scripts/bake-card-metadata.ts` — same helper; `mark()` is called *after* `mergedCards[id]` is set so a flush always includes the card's data.

**The general fix.** Factor the checkpoint into one tested helper (`scripts/bake-checkpoint.ts`) — `done` set, `shouldSkip(id)`, `mark(id)` (flushes every N), `finalize()` — with the snapshot-persist injected and fs swappable for tests. The ordering invariant (mark after the data is written) is the subtle bug-magnet; pin it with a kill-mid-run == uninterrupted equivalence test.

**Related:** `scripts/bake-checkpoint.ts`, `lib/__tests__/bake-checkpoint.test.ts`, [ADR-047](DECISIONS.md#adr-047--ssgisr-hybrid-rendering--metadata-only-tier-for-the-18k-long-tail).

---

## I-004 — Structural gates pass factually-wrong content; quantity ≠ validity

**Spotted:** Session 47.4, fact-checking the autonomous posts the 47.4 deploy-fix smoke tests shipped.

**Shape.** Our quality gates check *structural* properties — word count, ≥5 dollar figures, ≥2 internal links, banned phrases, valid JSON-LD. A draft can satisfy every one of them and still be embarrassingly wrong, because the gates count tokens, not truth. Two failure axes show up together: (a) **factual fabrication** — a Moonbreon valued at "$120-140 raw" passes the dollar-figure gate while real market is ~$2,100 (15-20× off); an invented "Foil's scan data shows ~18% spread" passes the Foil-data-citation gate because the trigger phrase is present, even though the pipeline computes no such number; and (b) **target validity** — three `/blog/...` links passed the "≥2 internal links" gate while all three 404'd, because the gate counted well-formed hrefs without resolving them. The meta-lesson: any gate of the form "≥N things of shape X" is satisfiable by N *invalid* things of shape X. To bite, a gate must validate each thing against the real world (does the link resolve? does the number trace to a real source?), not just count shapes.

**Two instances in the repo so far.**
1. The link-count gate (h) shipped 3 dead `/blog` links live → fixed by **gate 9** (resolve every internal link against the post dir + catalog + route allowlist).
2. The Foil-data-citation gate (d) rewarded the *presence* of "Foil's scan data" regardless of whether the attached number was real → four posts shipped invented stats → fixed by **gate 10** (every %/$/n= in a Foil-data sentence must trace verbatim to `data-injection.ts`'s actual return; null snapshot → no number allowed).

**The general fix.** When adding a "must contain N of X" gate, pair it with an existence/provenance check on each X. Counting is necessary but never sufficient. (R-010 is the adjacent lesson for *tests*; this is the same shape for *content gates*.)

**Related:** R-001 (content fabrication), gates 9 + 10 in `lib/seo/quality-gates.ts`, R-010.

---

## I-003 — Silent autonomy-chain regressions: integrations can disconnect because nothing happens

**Spotted:** Session 19, while diagnosing the Railway auto-deploy gap that Session 18 first surfaced.

**Shape.** Vendor integrations (GitHub→Railway, GitHub→Vercel, Beehiiv subscribe → Foil DB, etc.) share an auth-chain pattern: a long-lived OAuth grant or App install on one side, a token/webhook target on the other, and a push-vs-pull boundary in between. When that grant lapses, gets revoked, never gets installed in the first place, or has its branch filter changed, the failure mode is *not* a noisy error — it's *nothing happens*. A push to main returns 0 exit code; the deploy never fires; the next session assumes the running service matches main. The drift can run for days before anyone notices, and the moment of noticing is usually a side-quest while doing something else ("wait, why is the bot still on the old behavior?").

**Two instances in the repo so far.**

1. **Session 13's Vercel `#deploys` proxy** caught five silently-failing Vercel deploys that had been broken since the tsconfig drift. Before the proxy + webhook fired, those failures lived in the "no notification = it must be fine" category.
2. **Session 18 → 19's Railway auto-deploy gap.** Six historical foil-bot deploys, every one user-triggered, zero github-triggered. Auto-deploy was on the implicit "we'll wire this up later" list — and only got noticed because Session 18 happened to check the deploy timestamp against the push timestamp.

**Suggested mitigation (capture only — don't build in this goal).** A daily cron job that compares `git rev-parse origin/main` against the deployed commit SHA on each integration target (Vercel's API for the web app, Railway's `lib/railway-api.ts::getServiceStatus` for foil-bot, etc.). If they diverge by more than one deploy cycle (~10 min), post a drift alert to `#errors`. That's the inverse of the "nothing happens" failure mode — it turns silence into a daily attestation.

**The shape worth flagging.** Anywhere we have **vendor X auto-acts on event Y from source Z** and the success path is "no notification," there's a latent drift class. Catalogue candidates: GitHub→Railway (Session 19), GitHub→Vercel (Session 13 precedent), Beehiiv ingest→Discord, Stripe webhook→Supabase, the autonomous-content cron→Beehiiv newsletter. Each gets the same drift-cron treatment when worth building.

**Promotion trigger.** Third silent-regression incident OR the day John decides to build the drift cron — at that point the mitigation pattern is concrete enough to ADR.

**Status:** Pattern noted; mitigation captured but deferred.

---

## I-002 — Cowork as tactical edit surface; Claude Code as autonomous/shipping surface

**Spotted:** Session 18, while iterating on the bot's system prompt + output cap.

**Shape.** Small, scoped edits with deterministic local verification (file change + `tsc --noEmit` + `npm test`) are faster done directly in a Cowork session than authored as a Claude Code goal — Cowork has no Stop-hook overhead, no goal-criterion framing tax, and the feedback loop is the same `npm test` you'd run by hand. Claude Code earns its keep when the work needs **git/deploy authority** (commit + push + Railway/Vercel deploy verification), **second-brain doc discipline** (SESSION-LOG entry, ADR, ENV-VARS, IDEAS capture — the hard-contract rules in CLAUDE.md), or **a multi-hour autonomous loop** (multi-file refactor, full pipeline build, anything that benefits from the Agent tool spawning subagents). Below that bar, Cowork is the lighter path.

**The compose.** Cowork validates and hands off the commit step to Claude Code via a goal exactly like this one — diff already in the working tree, criteria reduced to "stage these N paths, run the contract steps, push, verify deploy." That's the seam: edit-and-test in Cowork, ship + log in Claude Code.

**First instance.** Session 18 (this commit). System-prompt rewrite + token-cap bump + chunker threshold — five files, <60 lines net, validated in Cowork with 69/69 green and a clean typecheck; goal-authored only to take the diff through commit + push + SESSION-LOG + PATTERNS update + Railway deploy verification.

**Promotion trigger.** Third or fourth instance of this exact handoff shape (Cowork edits → Claude Code goal that just commits + logs). At that point the workflow is real enough to warrant an ADR codifying when to start in Cowork vs. when to start in Claude Code.

**Status:** Pattern noted; will promote to a dedicated ADR after the third instance lands.

---

## I-001 — Stop fighting interactive-first CLIs

**Spotted:** Session 15, while trying to verify a Railway redeploy.

**Shape.** Vendor CLIs sit on a spectrum:

- **TTY-optional CLIs** (`gh`, `vercel`, `supabase`, `aws`) take a credential, a flag set, and produce output a script can parse. Token auth + non-interactive flags = headless-clean.
- **TTY-required CLIs** (`railway`, parts of `gcloud`, some Heroku flows) assume a human is at the prompt. They prompt for workspace/project/environment picks, write `.<vendor>` link files into the CWD, and produce streamed text that an agent has to scrape.

A headless agent fighting a TTY-required CLI burns Stop-hook loops on prompts it can't answer. `--non-interactive` flags partially close the gap but the link-state handshake reappears every time.

**The pattern.** For TTY-required CLIs, **bypass the CLI** by wrapping the vendor's REST/GraphQL endpoint in a thin `lib/<vendor>-api.ts` module. Token in, JSON out, no link files, no environment picks. Keep the CLI installed for surfaces where it *is* clean (write-only ops that don't need link state).

**First instance.** [`lib/railway-api.ts`](../lib/railway-api.ts) wraps `backboard.railway.com/graphql/v2`. Replaces `railway status` / `railway logs --service ...` for goal verification. See [ADR-009 Session 15 amendment](DECISIONS.md#adr-009--local-cli-tooling-for-autonomous-infra-changes) for the routing rule.

**Promotion trigger.** Second vendor that fits the same shape. Likely candidates: Linear (search/filter UIs in the CLI), Stripe (`stripe listen` is fine; `stripe customers list` paginates interactively).

**Status:** Pattern noted; will promote to a dedicated ADR after the second instance lands.
