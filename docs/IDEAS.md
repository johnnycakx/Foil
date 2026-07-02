# Ideas

Idea backlog — the queue **upstream** of [ROADMAP.md](ROADMAP.md). Anything raised in Cowork, Discord, a Twitter DM, or a 1-line shower thought lands here first. The idea sits in `captured` until a Sunday review session triages it; from there it gets promoted (added to ROADMAP NEXT or LATER, status flips to `promoted`), rejected (status flips to `rejected`, leave the row — the no-decision is the record), or marked `shipped` once the related ROADMAP item closes.

The point: stop losing ideas between the moment they surface and the moment we have capacity to act on them. The roadmap is the "yes, queued" list; the idea bank is the "noticed, undecided" list. They are not the same surface.

See [ADR-019](DECISIONS.md#adr-019--idea-bank-as-the-6th-second-brain-doc) for the design rationale and review cadence.

## Format

Each entry is a YAML frontmatter block + a heading + a 1-3 sentence idea + a `**Context:**` line naming what triggered it. The frontmatter `---` fences are how the bot's parser (`extractRecentIdeas` in `bot/src/system-prompt.ts`) finds the entry boundaries — keep them on their own lines.

Status values: `captured` (default), `triaged` (review session looked at it, decided to keep but not promote yet), `promoted` (now lives on ROADMAP), `rejected` (no — but the record stays), `shipped` (the ROADMAP item closed).

Categories: `product` · `marketing` · `content` · `infra` · `monetization` · `ux` · `growth`.

Append new entries at the TOP so the bot's "recent 30" window sees the newest ideas first.

---

---
date: 2026-07-02
category: ux
status: captured
---
## Extend the night register beyond the homepage (one attribute per page)

The overnight design loop shipped the chrome-tone mechanism (`data-tone="night"` + `--chrome-*` vars, ADR-096): any page can join the dark "lit room" register with one attribute. Candidates in order of leverage: /lines/[pokemon] (holo art on dark + sakura could be spectacular for the eve audience), /cards/[slug] hero block (the card IS the light source thesis, per-card), /deals (screenshot-share surface). Counter-argument: the marketing-dark / task-light split is a classic pattern and form legibility is safer on cream. Needs John's eyes on the merged homepage first.

**Context:** overnight-design-loop, 2026-07-02 — the DIVERGE face-off proved holo art dims on cream (design-loop/gallery iter-01 vs iter-02); the mechanism was built page-scoped on purpose.

---

---
date: 2026-07-02
category: growth
status: captured
---
## The holo-tilt as a shareable toy (per-card page + OG loop)

HoloCard (the pointer-tracked foil tilt) is currently hero-only. On /cards/[slug] it would make every card page's hero art a small toy collectors play with and screen-record — "the site where the cards actually foil" is an X-clip waiting to happen (pairs with the eve line-tracker reveal). Cheap: the component is built, reduced-motion-safe, and transform-only; the card-page hero image is one wrap away.

**Context:** overnight-design-loop built the component for the homepage fan; the card-page application was deliberately left for a scoped follow-up (tiered-render surface too load-bearing for unattended overnight edits).

---

---
date: 2026-07-02
category: monetization
status: captured
---
## "Foil for sellers" — the agent-SaaS B2B lane (Greg Isenberg playbook applied to the TCG niche)

The collector product is B2C with no paycheck attached; the paycheck in this niche sits with card shops and volume sellers who pay real hours for repricing, sourcing underpriced listings, and buylist decisions. An agent that watches the market and drafts repricing/sourcing actions (draft-and-approve first, per the ladder) sold like labor — setup fee + monthly, eventually outcome pricing — scores 5/5 on the workflow filter (hourly frequency, clear finish line, touches TCGplayer/eBay, learnable edge cases, felt loss). John IS the human to shadow (L4 seller). The collector product becomes the data moat + distribution wedge. Explicitly Layer 4: after free-product validation → eve → concierge v0. Full playbook: youtube.com/watch?v=83fWzQSWB10 ("sell the pilot like labor, productize the repeated parts").

**Context:** John found the Isenberg "agents are the new SaaS" episode 2026-07-01; Cowork's read — it validates the current pull-model/concierge trajectory (wrapper=trust, approve gates, autonomy ladder are already our architecture) rather than requiring a rename/repivot; the genuinely new piece is this B2B lane. Sunday review.

---
date: 2026-07-02
category: product
status: captured
---
## Reference-agreement benchmark vs CardLadder (+ partnership email, + PSA public API)

CardLadder has NO public API (consumer sub, PSA/Collectors-owned; scraping = ToS + trust suicide). What we actually need is AGREEMENT with the reference collectors price against at conventions: add a CardLadder column to the ~Aug-10 data benchmark (25 cards, our 30d sold avg vs CL value, manual via a normal sub — ToS-clean). Agreement → marketing claim ("same sold reality the reference tools use"); divergence → find out why before a vendor mocks a Foil number publicly. Side doors: partnership email (support@cardladder.com, post-traction), and the PSA PUBLIC API (real, free — cert verification + pop counts) for graded-card depth later.

**Context:** John, 2026-07-01 — "CardLadder and Collectr are what vendors reference at conventions, where most deals happen." Also seeds the buy-signal/at-the-table market-check surface (#388) as the eventual convention wedge.

---
date: 2026-07-02
category: ux
status: captured
---
## Design-tooling research: give the build loop professional-grade design leverage

John is underwhelmed with the site's visual bar (2026-07-01, pre-design-overhaul homepage). Research track for Cowork: (a) design-capable MCPs/plugins for the Claude Code loop — Figma MCP (already installed as a plugin), component registries (shadcn/21st.dev-class), Playwright screenshot design-review loop (already an IDEAS/repo concept — promote it); (b) three.js/R3F for ONE hero showpiece once traction justifies it (deferred in the overhaul spec, reconsider after eve); (c) AI creative-asset tooling for social/OG/video (Higgsfield-class video gen, Adobe plugin already connected in Cowork) — the X market-card and banner assets are the near-term consumers. Deliverable: a recommended toolchain + what to install where (Cowork vs Claude Code), THEN the design overhaul runs with it.

**Context:** John, 2026-07-01 session close — "we should research better design tools… whatever would make this website and all our creative assets look more professional." Cowork to research at next session start, before fable-design-overhaul runs.

---
date: 2026-07-02
category: growth
status: captured
---
## Line-tracker as a repeatable acquisition channel — the "collector with reach → their line page → share" playbook

The `/lines/[pokemon]` surface ([ADR-095](DECISIONS.md#adr-095--the-line-tracker-lines pokemon-shareable-pages-sakura-register-accent-null-over-guess-sold-data-the-gift-economy-acquisition-play)) is built config-driven so a new line is a data entry, not a build. The play generalizes: find a high-reach collector who's *known for one line*, build their line page in a day (dedicated to them), hand it over, let the "made-for-me" feeling drive the share. Each run leaves a permanent SEO page ("every X card" is a real query) whether or not the share lands. **Candidate next lines/collectors to queue once the eve launch teaches us the conversion reality:** other Eeveelution mains (Sylveon, Vaporeon, Glaceon have their own fandoms), Charizard (the biggest but most saturated), Gengar, Lugia, or any creator whose brand IS a single Pokémon. Also a natural fit for a "vote for the next line" engagement loop on X. **Trigger to promote: eve launch produces a measurable signup lift (the goal's 30–100 tracked-users target), OR a second reach-collector asks for one.** Don't build line #3 until its target exists.

**Context:** eve-line-tracker goal (2026-07-02); strategy John + Cowork (2026-07-01) — "reusable product surface, not a one-off; the win case is a repeatable playbook."

---
date: 2026-07-01
category: monetization
status: captured
---
## Layer-3 "Foil Concierge" — the paid grail-hunt service on top of demand-driven data

The demand-driven hydration doctrine ([ADR-092](DECISIONS.md#adr-092--demand-driven-poketrace-hydration-watches-allocate-the-data-budget)) builds the free layers: watch a card → we hydrate its sold data → honest evidence-line alerts. Layer 3 is the paid packaging: a concierge grail-hunt — you name the exact card/grade/budget, Foil actively hunts (deeper scan cadence, cross-marketplace, maybe human-in-the-loop verification on the hit) and you pay for the find (flat fee or % of save vs 30-day avg). It's the natural monetization of the same machinery at higher intensity, and it prices on outcome, not access. **Packaging deferred until the eve concierge-v0 run teaches us what the service actually contains** — don't spec the product before the manual run reveals the real work.

**Context:** demand-driven-data goal (2026-07-01); strategy John + Cowork same day (watch service needs depth-on-demand, not breadth).

---
date: 2026-07-01
category: infra
status: captured
---
## Double-opt-in for /start + newsletter signups (deferred from the funnel-integrity goal)

[ADR-090](DECISIONS.md#adr-090--start-funnel-integrity-tri-store-opt-in-idempotent-watches-attribution-and-an-unsubscribe-that-stops-alerts) explicitly kept double-opt-in OUT of scope — the funnel now has a honeypot + per-IP limit + per-email watch cap, which handles pre-traffic abuse without adding a confirm-email step that costs real conversions on a list of ≈0. When it fires, the shape is: an HMAC confirmation token (reuse `lib/unsubscribe-token.ts` machinery inverted) + a `confirmed_at` column on `newsletter_subscribers` + the digest send filters unconfirmed. Also the natural moment to revisit a real (Redis/Upstash) rate limiter — the current per-instance in-memory one resets per cold start by design. **Trigger: first deliverability complaint OR >100 real subscribers.**

**Context:** start-funnel-integrity goal (2026-07-01) — audit graded the funnel D; guards shipped, double-opt-in consciously deferred.

---
date: 2026-07-01
category: product
status: captured
---
## Japanese-set catalog expansion — the top-5-per-set follow-up (English is done; JP needs a different data source)

The [ADR-088](DECISIONS.md#adr-088--catalog-breadth-expansion-every-english-sets-top-5-by-value-chase-card-coverage) breadth expansion added every **English** set's top-5-by-value cards (catalog 29 → 159 sets, 1,190 → 1,840 cards) — but pokemontcg.io is **English-only**, so Japanese sets (which carry their own chase cards + a real collector market: JP alt arts, SAR/SIR, promo boxes) are entirely uncovered. The follow-up: source a JP catalog + pricing feed (pokemontcg.io has no JP; candidates — TCGplayer's JP product lines if the API exposes them, PriceCharting JP, or a JP-specific catalog API), range the top-5-per-set by value the same way, and reuse the exact same pipeline (`expand-top5-per-set.ts` generalized to a JP source → a second generated file → `bake:cards`). The rendering + tiering + lazy-PokeTrace boundary all carry over unchanged.

**Context:** 2026-07-01 — flagged as explicitly OUT of scope in the top-5-per-set goal ("decide in a follow-up once English top-5 lands"). Decision deferred to a Sunday review: is the JP collector audience worth the extra data-source integration + the ~N more indexable pages, or does the English long tail need to prove SEO/traffic lift first ([R-012](RISKS.md))? Blocked on identifying a reliable JP pricing source (the AGENTS.md "read the docs before asserting" rule applies — no JP source is confirmed yet).

---

---
date: 2026-06-30
category: monetization
status: captured
---
## X creator-subscription model (Atikin) — study the FORMAT, reject the persona-sub model for Foil's monetization

John found @Prof_Atikin (19.8K followers, $3/mo X Creator Subscription: "exclusive content + first-hand alpha," subscriber badge on replies) and asked whether an X-sub creator model could be Foil's long-term play, better than Discord/Whop. **Co-CEO take: no on the model, yes on the format.** Atikin's asset is a 4-yr-old PERSONA (181K posts ≈ ~100/day, "Final Boss of Scalping / rage baiter," crypto/web3-native, `atikin.sol`) — a *person*-business on a *rented* platform (X owns the audience + the payment rail + the rules). That conflicts head-on with Foil's thesis: an OWNED email list + an automatable PRODUCT that runs without John. Discord/Whop/X-subs are all the same category (rented, persona/community-dependent monetization) Foil already deprioritized for good reasons — X-subs isn't an upgrade over Discord/Whop, it's the same axis. The DURABLE version of his $3 sub is **Foil's own Pro tier** (faster/instant alerts, multi-marketplace, condition filtering) on owned Stripe + owned data, PLUS **sponsorships** against the 10K-list goal (a newsletter monetizes via sponsors — scales without a daily-alpha persona treadmill). What IS transferable: his winning CONTENT FORMAT — data-chart market-analysis posts (his pinned "the 14k PSA 10 pop that's overlooked," a graded-pop + price-chart post, is *pure Foil data*) + sharp contrarian takes — pipe it into Foil's format-mining/content engine ("steal the container, keep the soul": keep Foil's calm, trustworthy voice; drop the rage-bait). And engage him + his network (he's followed by PokeNotify + other niche accounts) — a high-reach node for reply-based discovery.

**Context:** 2026-06-30 — John, exploring @Prof_Atikin's pink Subscribe button, asked to research his model as a possible long-term direction "beyond just this prompt." Sub-conversion/revenue figures are SPECULATIVE (Chrome dropped mid-research; no live sub-count pulled). Follow-up: a live content teardown (his top posts by engagement, posting cadence, which formats actually convert to subs) when Chrome is stable, to ground the format-borrow.

---

---
date: 2026-06-29
category: infra
status: captured
---
## Does Beehiiv earn its keep? Consider a single-source Supabase+Resend list

Beehiiv has now cost two build cycles at ≈0 real subscribers: the welcome-email surprise (it auto-sends despite `send_welcome_email: false`) and the silent `unsubscribeEmail` no-op ([ADR-083](DECISIONS.md#adr-083--resend-is-the-sole-send--unsubscribe-surface-beehiiv-is-passive-fixes-the-silent-beehiiv-unsubscribe-no-op)). It's now a passive dual-write (signup capture + archive); the SEND + unsubscribe both run on Resend. Its only forward-looking value is the hosted signup form + Beehiiv's recommendation-network / referral growth levers (real, but list-size-dependent and unused today). Decision to make on a Sunday: keep Beehiiv passive (status quo, accept the small coherence surface), or **rip it out for a single-source Supabase + Resend architecture** (fewer stores = fewer coherence bugs, one less vendor). If kept, at minimum pause the "Foil welcome" automation (R-059).

**Context:** 2026-06-29 — flagged at the close of the Beehiiv-coherence-fix goal (`docs/goals/newsletter-beehiiv-coherence-fix.md`). The dual-write was justified when Beehiiv was the planned sender; ADR-078 moved the send to Resend, so Beehiiv's role shrank to capture/archive — worth re-deciding whether that role justifies a third subscriber store.

---

---
date: 2026-06-28
category: growth
status: triaged
---
## Autonomous content-syndication + engagement-brief engine (multi-platform distribution)

Fan the existing content-engine output (daily card-hero, weekly board, blog) out to every surface where Pokémon collectors gather, adapted per platform, via Postiz (28+ channels). Plus a daily auto-generated "engagement brief": surface ~20 relevant X/Reddit posts where Foil's sold-data adds value, with a drafted reply each → Discord; John posts the replies (the human send is the ToS firewall). HARD LINE: automate content DISTRIBUTION, never engagement ACTIONS (auto-reply/follow/DM = suspension). Researched best-fit: Reddit (r/pkmntcgdeals, r/PokeInvesting — highest intent, strict self-promo rules), Instagram (new FoilTCG acct), TikTok / YouTube Shorts (the MP4), Threads/Bluesky (free safe cross-posts). Needs John to create FoilTCG IG + TikTok.

**Context:** 2026-06-28 — John pushed hard to "automate the distribution process, don't cut corners." The legit version: automate syndication + engagement-targeting research; keep the human on the actual reply (50x/day autoposting = spam-flag/suspension, confirmed via research). **Triaged 2026-06-29 (the syndication half):** a goal spec was written (`docs/goals/postiz-multichannel-autosyndication.md`) but the P0 premise check STOPPED the build — Postiz is not installed, has no account/API key/connected channels (it was never set up), and connecting channels is OAuth-via-dashboard = John's hands (account creation, which the agent can't do). The safe-vs-human channel split is now policy ([ADR-085](DECISIONS.md#adr-085--content-syndication-safe-vs-human-channel-split-postiz-as-the-headless-layer-build-gated-on-setup)); the build is **parked pending John's Postiz setup** (prerequisites in `docs/runbooks/postiz-syndication-setup.md`; tracked as ROADMAP SYND-POSTIZ). **The engagement-brief half SHIPPED 2026-06-29 ([ADR-086](DECISIONS.md#adr-086--x-engagement-brief-engine-automate-the-research--drafting-a-human-posts-every-reply-zero-x-write-firewall)):** the daily read+draft+deliver engine (recent-search → filter → real-sold-data reply draft → ranked Discord brief; John posts every reply by hand; zero-X-write invariant test-pinned). P0 verified recent-search is entitled on our tier (HTTP 200, pay-per-usage). Built behind `ENGAGEMENT_BRIEF_ENABLED` (default off). The SYNDICATION half stays parked on Postiz setup (above). Net-new syndication value once that unblocks = Bluesky/Threads/Mastodon (X already syndicated direct; owned Discord already auto-postable via our webhook lib).

---
date: 2026-06-28
category: product
status: captured
---
## Up-mover ("heating up") post angle + direction color-coding on the card-hero number

Add an up-mover post angle so the X bot covers cards heating up, not only deals cooling. It's the prerequisite for two things: (1) color-coding the giant % number at a glance (down/up), and (2) the "scoreboard" call→result series. Note the buyer-semantics twist: on a deal-finder, DOWN is the good news, so "red = down" (stock convention) sends a faint "bad" signal — resolve deliberately, or use the brand's gold as the accent instead. Until up-movers post, every card-hero is a down-mover so color would be monochrome and convey no direction.

**Context:** 2026-06-28 — John wanted the "17%" colored red to imply "down" at a glance. Right instinct, but it only earns its keep once posts have directional variety + the down=good semantics are resolved.

---
date: 2026-06-28
category: growth
status: captured
---
## Paid X boost/ads as a LATER gated growth experiment

Once there's a post proven to convert organically AND a tracked impression→/newsletter→subscribe funnel, test a small boost on the best evergreen post with a target cost-per-subscriber. NOT now — boosting a 0-engagement post from a ~1-follower account to cold users converts terribly and teaches nothing. (Distinct from buying followers, which is rejected outright: bots = zero clicks, polluted metrics, suppression + suspension risk.)

**Context:** 2026-06-28 — John asked about X's "Boost visibility" + buying followers. Boost = premature-but-valid-later; follower-buying = rejected. Logged so the boost lever isn't forgotten once the funnel is proven.

---
date: 2026-06-27
category: growth
status: promoted (partial — the niche-format half; the own-metrics half remains)
---
## Close the content→metrics loop: let x_post_metrics steer what the X bot posts

We built `x_post_metrics` (daily cron capturing likes/reposts/replies/impressions per post) but aren't feeding it back — post selection + copy structure are still informed guessing. After a few weeks of posts, read which hooks, formats, cards, and angles actually drove engagement and let that steer the generation prompt (or at minimum a monthly "what performed" review). Turns the X bot from "post and hope" into a system that learns on real engagement, not vibes. The plumbing exists; it just needs the feedback path. Pairs with the v2.1 copy rework — measure whether the new hook/format actually lifts engagement instead of assuming it.

**Context:** 2026-06-27 — John invited expansion of the v2.1 copy work. The highest-leverage idea: stop guessing virality, measure it with the metrics we already capture.

**Promoted 2026-06-30 → [ADR-087](DECISIONS.md#adr-087--content-intelligence-mine-winning-formats-from-the-niche-generate-foil-posts-steal-the-container-keep-the-soul) (the niche-format half).** Since we have ≈0 own-post history to learn from, the content→metrics loop is bootstrapped from the WHOLE niche's engagement first: the format-mining sweep ranks the niche's engagement-RATE outliers, extracts the winning FORMATS (the container), and feeds them into Foil's gate-validated own generation (the soul). **The own-`x_post_metrics` feedback half is NOT yet built** — once Foil has a few weeks of its own posts, the same generation prompt should also be steered by which of OUR hooks/formats/cards actually drove engagement (and a "scoreboard" of whether the mined formats lifted our numbers). That closes the loop on first-party data and is the natural next step; engagement RATE is reach, not signups, so the conversion check stays the UTM attribution + Sunday review ([ADR-084](DECISIONS.md#adr-084--acquisition-phase-0-utm-channel-attribution-on-the-owned-newsletter-row--a-founder-only-readout)).

---
date: 2026-06-27
category: content
status: captured
---
## "Scoreboard" series: call, then result (recurring credibility + virality play)

Each daily deal post ends on a forward hook ("now we watch whether it bounces or keeps sliding"). Turn that into a recurring follow-up 1-2 weeks later: "Two weeks ago Base Set Blastoise was down 17%. Here's where it landed." An honest scoreboard — hits AND misses — builds the rarest currency on Pokémon X (credibility), is dead-on brand (real numbers, accountable, no hype), and doubles the content surface from one daily post into a call + a payoff. Needs the `market_movers`/post history to look up each original call's outcome.

**Context:** 2026-06-27 — surfaced expanding the v2.1 copy work; pairs with the metrics-loop idea above.

---
date: 2026-06-27
category: content
status: captured
---
## Borrow Collectrics' data-story framings for X + newsletter (PSA 10 premium movers, graded-vs-raw gap, set heating/cooling)

Turn three of Collectrics' best analytics framings into recurring Foil content, all computable from PokeTrace data we already hold (raw + full PSA ladder + `saleCount` + daily history — the gem-rate/population gap in `grading-leaderboard-data-sources.md` does NOT block these, since the premium story needs only PSA-10-vs-raw prices): (1) **"biggest PSA 10 premium movers this week"** (PSA-10-over-raw premium jumps), (2) a **"graded vs raw gap" leaderboard** (largest PSA-10-over-raw multiple), (3) **"sets heating up / cooling off"** by rolling the existing card-level `market_movers` up to set level. All thumb-stopping, on-brand (calm/numbers, anti-hype), feeding the X bot + newsletter. Plus two low-lift engagement levers he uses: **community polls on X** (reach, amplified by Premium reply-boost) and a **"fair price for this card" mini-calculator** as a newsletter lead-magnet analog to his pack-EV calculator.

**Context:** 2026-06-27 — John flagged mycollectrics.com (built by data-analyst YouTuber @PokeDataDadGuy). Full competitive reassessment in `docs/competitive-collectric.md` (2026-06-27 update). These are the borrowable CONTENT framings (not product); stay in lane (buyer-side live-deal + email moat), steal the framings.

---
date: 2026-06-27
category: growth
status: captured
---
## Collectrics is now a fast-shipping, monetized competitor with a YouTube funnel — watch + out-distribute

Collectrics (PokeDataDadGuy / `@TheDayFamilyProject`) grew from a valuation-slider tool (observed 2026-06-01) into a full analytics platform in ~3 weeks: market-trends dashboard, card/sealed leaderboards, set EV, pack-rip calculator, ripping simulator (coming), PSA 10 premium leaderboard, community polls, and a LIVE freemium store. Solo data-analyst dad shipping fast with a YouTube distribution engine (≥1 viral video) — same builder profile as John, so differentiation must stay sharp. His structural gap: no live eBay listings (can't do per-card "is this a good buy right now" = Foil's moat). The freemium store is a proof point that a data-tool freemium can monetize in this niche (reference for Foil's later Pro tier). Action: don't chase his EV/rip-sim lane; out-distribute on buyer-side live-deal + the email moat; revisit next Sunday review.

**Context:** 2026-06-27 — John: "a youtuber is behind it." Confirmed + reassessed; see `docs/competitive-collectric.md` 2026-06-27 update.

---
date: 2026-06-27
category: content
status: captured
---
## Animated/motion card-hero for X (the highest-virality version of the deal post)

Upgrade the static card-hero X image to **motion**: the real card art with an animating holographic shimmer/light-sweep (and/or a subtle 3D tilt), exported as MP4/GIF. X autoplays video in-feed and weights it for reach, and motion is core to how @getcollectr's content performs — a shimmering foil card is far more thumb-stopping than a static one. Ship the static card-hero first (validated this session: scored 8.35 vs the 7.75 movers-board on the virality rubric, see `docs/goals/x-flywheel-card-hero-and-homepage.md` + `f_hero.png`/`f_board.png`), prove it, then animate. Bigger build than the static render (video encode in the pipeline, larger asset, the approval card must preview the clip). **John wants to attempt this 2026-06-28.**

**Context:** 2026-06-27 — after prototyping the static card-hero (10+ renders, 3 rounds, virality-scored against the Collectr benchmark), motion surfaced as the clear next lever. Deferred one day by John.

---
date: 2026-06-26
category: content
status: captured
---
## Demand-weighted content selection — sales volume + search + Pokémon popularity across X, newsletter, blog

Pick what the bot tweets and what we write newsletters/blogs about by DEMAND, not just price movement. Weight toward cards with high gross sales volume over the last 7/30 days (`saleCount`, already in the PokeTrace pipeline + `market_movers`) as a proxy for "people are actively hunting this," blended with actual search demand from Google Search Console queries (more direct for SEO than sales), plus a popularity layer for perennially-hot Pokémon and their chase cards (Charizard, eeveelutions/Moonbreon, Pikachu, etc.). Keep the $10 materiality floor so cheap high-volume bulk doesn't win. Derive "popularity" from sustained volume where possible (self-updating, less subjective) over a hand-maintained list. The simple "rank deal/spotlight candidates by `saleCount`" piece is folded into `docs/goals/x-bot-followups.md`; the cross-surface blog/newsletter + GSC + popularity layer is the bigger follow-on (ties into restoring PokeTrace + mining GSC queries).

**Context:** 2026-06-26 — John: high 7d/30d sales volume signals people are searching for that card specifically; also factor in general Pokémon popularity + their popular cards. Strong, on-strategy (demand-driven content); spans all three content surfaces.

---
date: 2026-06-26
category: growth
status: captured
---
## X bot self-learning loop — learn from high-performing posts and adjust future generation

Make the daily X bot closed-loop: capture per-post engagement (likes/reposts/replies/impressions), identify outperformers vs the account's own rolling baseline, and feed their characteristics (angle, hook style, card type, length, time-of-day) back into the post-generation prompt so future posts skew toward what resonates. The X Activity API (XAA) can deliver engagement events in real time as the data source. NOT to build yet — premature with ~0 followers and no post history; there is no signal to learn from until there's a base of posts + traffic, and a feedback loop on noise overfits. Revisit after the approval bot has run several weeks. Cheap precursor worth considering sooner: start logging each post's ~48h metrics into a table now so the dataset exists when we're ready to act on it.

**Context:** 2026-06-26 — John asked whether the bot is self-learning. It isn't: the current ADR-058/071 bot is open-loop (deterministic angle rotation + prompt, no engagement feedback). Right direction, deferred until there's data to learn from.

---
date: 2026-06-24
category: infra
status: captured
---
## Card page (/cards/[slug]) loads semi-slowly — perf pass after the homepage-v2 goal

John observed `/cards/[slug]` (e.g. base1-2-blastoise) renders noticeably slowly on the live site. Likely root cause: the page is `export const dynamic = "force-dynamic"` (the R-008 mechanism — every render re-fetches live data) AND it fans out to multiple live APIs per request (PokeTrace by-uuid + price-history + eBay listing), so TTFB stacks all of them serially/uncached on each hit. Candidate fixes to weigh (без breaking R-008's "always-live listing" intent): parallelize the fetches (`Promise.all`), add a short edge/data cache on the price-history + variant/market-range calls (which don't need to be real-time like the live listing does), stream the page (Suspense boundaries so the card image + static metadata paint before pricing resolves), or revisit the ADR-047 metadata-tier idea. Deferred by John to AFTER the homepage-v2 goal — not a blocker, but it hurts conversion on the exact ranking pages we're driving traffic to.

**Context:** 2026-06-24 live review of the dual-track restore — pricing renders correctly (PokeTrace key still valid), but page load is sluggish. Flagged as a follow-up, not urgent.

---
date: 2026-06-24
category: growth
status: promoted
---
## Email list is the north star — reorient the homepage's primary goal to subscription, and mine GSC queries for the content/newsletter calendar

Reaffirms (does not invent) the committed [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md) direction: the owned email list is the compounding moat ("Twitter is the discovery layer; the email list is the moat"; the 100→1K→10K curve). Make email capture the homepage's PRIMARY CTA (lead with the value/knowledge + newsletter promise; demote the deal-finder buttons to "the reason to subscribe"), and add tasteful inline capture to the ranking blog/pillar pages — because at avg position 18.2 the impressions land on deep pages, not `/`. Use the live GSC queries as the content + newsletter calendar. Promoted to ROADMAP NOW (row G-EMAIL).

**Context:** 2026-06-24 GSC review (3-month: 1.37K impressions, 9 clicks, 0.7% CTR, avg pos 18.2; top queries all informational/research-intent — "lightly played vs near mint," "near mint foil meaning," "are lightly played cards worth buying," "pokemon card value checker," "venusaur 151"). Research-intent + near-zero affiliate CTR = the right conversion for this traffic is an email signup, not a buy click. John raised it as a "new idea"; it's actually his own pre-vending strategy resurfacing, validated by real search data.

---
date: 2026-06-15
category: content
status: captured
---
## Newsletter draft-generator still collector-voiced — reframe for vending before newsletters resume

Goal C ([ADR-062](DECISIONS.md#adr-062--content-engine-reframe-deal-findercollector--vending-host-acquisition--local-seo)) reframed the BLOG content engine (SYSTEM_PROMPT + gates + backlog) to vending host-acquisition, but the **newsletter** path (`lib/newsletter/draft-generator.ts`) was deliberately left untouched — it still has the collector/deal-finder voice + its own gate set (the source-figure provenance gate, em-dash, banned-phrase). If John ever resumes the best-deals digest as a vending host newsletter, the newsletter SYSTEM_PROMPT + gates need the same reframe (audience = host owners, honesty guardrails, no rev-share %, conversion links to /host). Note: the newsletter step is currently dead anyway (the blog pipeline routes to `_pending` and the workflow's newsletter step is gated on `BEEHIIV_*`), so this is a clean follow-up, not a regression. Small lift; mirrors the blog reframe.

**Context:** 2026-06-15 Goal C content-engine reframe — `voice-check.ts` (the newsletter's voice lens) kept its `FOIL_DATA_CITATION_TRIGGERS` detector when the blog gate that shared it was retired, which surfaced the seam: the newsletter still assumes collector content.

---

---
date: 2026-06-12
category: product
status: captured
---
## Absent-aspects admission channel — the resolver's remaining false-accept surface (Tranche B input)

A listing with NO identifying aspects at all (no Set/Number/Language/Graded) passes every corroborating gate on absence and verifies if its title survives the prefilter — the 2026-06-12 base6 audit caught plushies, a Roblox virtual item, you-pick multi-listings, and a title-only PSA slab riding this channel (all now dropped by observed-shape prefilter patterns, but that's whack-a-mole by construction). The principled lever is an identity-gate design change — e.g. require ≥1 corroborating aspect present, OR title-number/name corroboration as a fallback admission requirement when ALL aspects are absent — which touches the corroborating-semantics decision John made 2026-06-06, so it's a Tranche B checkpoint input, not a unilateral fix. Counter-pressure to weigh: the 2026-06-12 sweep also verified a genuine aspect-less Magnemite whose title was an exact single-card match — a hard present-aspect requirement would null it.

**Context:** 2026-06-12 "collection" prefilter fix — the spot-audit's 6 newly admitted false-accepts ALL had absent or near-absent aspects; the per-gate `present` telemetry the resolver already records is the measurement surface.

---
date: 2026-06-12
category: product
status: captured
---
## /deals can't surface Legendary Collection until the deals cron leaves the set-blind picker

The set-aware prefilter fix is deliberately NOT wired into `getBestListing` (the deals cron's path) because that path has no downstream identity gate — so every Legendary Collection card still nulls out of the `/deals` board today (the `"collection"` collision lives on there). Don't wire `setName` into the picker for it; the right fix is Tranche B #4 (migrate the deals refresh cron onto `resolveVerifiedListing`), which makes the question moot and gets the board the same 17→104 recall lift with verified admissions.

**Context:** 2026-06-12 "collection" prefilter fix scope decision — recall levers are only audit-safe behind the identity gate.

---
date: 2026-06-11
category: product
status: captured
---
## Finish-query expansion ladder — measure-then-extend the resolver's query bias per rarity class

The Tranche A finish-aware query lever is deliberately restricted to the exact WOTC `Rare Holo` rarity (+ explicitly requested variants) because that's the only class the certification measured (12/12 vintage holos recovered, zero false-accepts). The same candidate-starvation mechanism plausibly exists for other classes — modern reverse-holo variants buried under cheaper normals, 1st-Edition listings, graded-heavy modern ultra-rares (the cert's k=8 probe recovered 3/10 of those). Idea: an expansion ladder where each rung (rarity class → query term) ships only after a paired-arm live measure (the per-card back-to-back OFF/ON arms pattern from the 2026-06-11 audit — seconds apart, so every flip is attributable to the term, not listing rotation) proves recovery > starvation for that class. Preserves the certified invariant: query terms only change which candidates are fetched; identity gates stay the sole admission gate.

**Context:** 2026-06-11 Tranche A #2/#3 goal — the full-sweep I-009 measure showed lever ON 81.2% vs OFF 69.1% curated coverage; the lost-arm audit motivated the paired-arm method.

---
date: 2026-06-09
category: monetization
status: captured
---
## Pokemon vending machine route (Gage Kushner / "Jessica Wang" partnership pitch) — evaluated, diligence failed

Inbound pitch to John: partner on Pokemon card vending machines (VTM hardware, $2,850–5,000/machine). Cowork diligence on the sent docs found: 2 of 5 attachments duplicated; the "Memphis Pokemon" case study is the machine vendor's (VTM) own marketing PDF with markup mislabeled as margin; the operator P&Ls show uniform ~50% margins with COGS ($4.65–7.09 for Prismatic Evolutions) roughly half of realistic 2026 acquisition cost during the documented supply crunch — contradicted by VTM's own case study ($16.99 COGS for the same SKU); the pitch deck prices ($20–35/pack) contradict the P&Ls ($9–13/pack); the pitcher runs a GoHighLevel coaching funnel (cardvendingblueprint.com, "limited spots") matching FTC vending biz-opp warning patterns. Standalone-vending economics even at face value: ~$300–860/mo gross profit/machine before venue split, fees, restock labor — 1–2yr payback, not passive. If vending exposure is ever wanted: buy one machine direct from VTM post-launch, source via the existing TCGplayer storefront, skip the middleman; the route data could feed Foil content.

**Context:** Email from "Jessica Wang" (yanaiwang44@gmail.com) 2026-06-09 with P&Ls + case study after a call; Gage Kushner YouTube (634 subs, "#1 Pokémon Vending Operator In America"). Evaluated in Cowork against PriceCharting/TCGplayer market data + FTC biz-opp criteria. Key timing conflict: MVP sprint ends 8/7, soft launch 9/21 — founder-manual queue (X-bot go-live, eBay Growth Check submission, resolver cert review) is already the bottleneck.

---
date: 2026-06-07
category: infra
status: triaged
---
## Catalog-data integrity check (the resolver's Set/Number corroboration as a QA tool)

The resolver's identity gates double as a data-integrity probe: run them (or a cheap structural check) across the catalog periodically and FLAG cards whose catalog set/number disagrees with reality before bad data nulls out live listings or mislabels a page. Could gate catalog-expansion waves. **A live market-cross-check must distinguish legitimate market noise from real defects** — the holo/non-holo reprint gap (Jungle holo #1 vs non-holo #17), secret rares (136/135), and cross-set reprints all look like "the market disagrees" but are correct. The cheap, deterministic FIRST instance shipped 2026-06-07: `lib/__tests__/catalog-qa.test.ts` (offline structural QA — setId↔setName consistency vs the baked `sets` map, id/setId/number consistency, no sibling-setName splits, + WOTC ground-truth pins). The LIVE market-cross-check remains the open idea.

**Context (CORRECTED 2026-06-07):** This idea was first captured citing the "16 corrupted `base2-*` entries" the calibration flagged — but that was a **MISREAD**, not a catalog bug. In pokemontcg.io (the bake's source) `base2` IS "Jungle" (Base Set 2 is `base4`); the +16 offset was Jungle's holo(#1–16)/non-holo(#17–32) numbering, so the resolver was correctly rejecting a different print. The catalog-QA sweep then found the catalog **clean** (0 inconsistencies across 1,007 cards). See the "Correction addendum" in [calibration-resolver-2026-06.md](calibration-resolver-2026-06.md). The episode is itself the case for the idea: an automated QA pass (now partly realized as the test above) would have caught — or correctly cleared — this without a goal cycle.

---

---
date: 2026-06-06
category: infra
status: captured
---
## Auto-ping Google when the catalog/sitemap expands (sitemap-freshness monitor)

When the catalog grows (207 → 1,007, and Wave 2 → ~5K coming), `sitemap.xml` updates instantly but Google may not re-read it for weeks — so newly-added per-card pages sit undiscovered. A lightweight monitor (or a step in the expand-catalog pipeline) could detect a URL-count jump and re-submit/ping the sitemap (GSC API or the deprecated-but-working ping endpoint), and optionally surface "Google last read sitemap N days ago vs current URL count" to `#deploys` so staleness is visible, not silent.

**Context:** Surfaced 2026-06-06 in the GSC review during the roadmap-reconciliation goal. The live sitemap had **1,023 URLs but Google last read it 2026-05-22 at 209 URLs** (pre-expansion) — an ~800-page indexing gap that nothing flagged; John had to manually resubmit + request indexing. Distinct from the `/deals`-missing-from-sitemap defect (fixed this session) — this is about *freshness/discovery latency*, not *completeness*. Ties into the "it is a distribution problem" frame ([ADR-059](DECISIONS.md#adr-059--utility-first-positioning--subscription-ready-not-paywalled)).

---

---
date: 2026-06-04
category: product
status: captured
---
## Foil as the deal-data layer AI agents cite (+ possible MCP monetization)

Expose Foil's best-deal and buy-signal data to AI agents (a structured feed or an MCP server) so when a collector asks an assistant "where is the best deal on <card>," Foil is the cited source and the purchase routes to eBay with our affiliate tag. Stripe's "monetize your MCP app" could later charge agents or devs for premium access to Foil's deal data.

**Context:** Raised 2026-06-04 in the Cowork strategy session while reviewing the Stripe Agentic Commerce page. Stripe Agentic Commerce itself is not a fit (it is for first-party merchants selling a catalog, and Foil is an affiliate with no inventory), so the angle is positioning Foil as the deal-data layer agents cite. Threat side: agentic checkout could disintermediate the affiliate-click middle layer, so the defense is owning the recommendation and trust layer plus the owned email list. See CONTEXT-HANDOFF-2026-06-04.md.

---

---
date: 2026-06-02
category: marketing
status: shipped
---
## IP risk: the live logo is a literal Pokeball (Nintendo trademark) — refresh before driving paid creator traffic

**SHIPPED 2026-06-05 ([ADR-055](DECISIONS.md#adr-055--fredoka-foiltcg-wordmark--foil-corner-card-mark-pokeball-retired)).** The Pokeball is retired everywhere — replaced by an owned Fredoka "FoilTCG" wordmark (navy "Foil" + gold-sheen "TCG") + an abstract foil-corner card mark. Swapped the live surfaces the original note under-counted: `components/brand/logo.tsx`, the hero pills + "How it works" watermark in `page.tsx`, the sold-history bullet, `public/favicon.svg` + `public/icon.svg` + `public/apple-touch-icon.png` (the *actual* favicons, not the `app/favicon.ico` named here), `app/opengraph-image.tsx` + new `app/twitter-image.tsx` (the dynamic OG, not the static `public/og-image.png` which was deleted). Grep proves zero Pokeball remnants; DESIGN.md §5 updated. Built + gated; live-verify pending John's deploy.

The brand glyph at `components/brand/logo.tsx` (per [ADR-040](DECISIONS.md#adr-040--brand-glyph-is-the-classic-redwhite-pokeball-section-pattern-density-reduced)) is a pixel-art Pokeball — a registered Nintendo/Pokémon trademark — sitting in the brand position of a buyer-side affiliate business. Almost certainly below Nintendo's enforcement-detection threshold at current traffic, but it's exactly the wrong thing to *compound* by pointing paid creator traffic (PokeBeard) at it. **Action:** logo refresh promoted to a pre-PokeBeard-launch blocker. Four concept directions captured in [BRAND-LOGO-CONCEPTS.md](BRAND-LOGO-CONCEPTS.md) (Light Split / Faceted F / Foil Corner / The Tilt); recommendation is to generate Direction 1 (Light Split) + Direction 3 (Foil Corner) via Canva Magic Media, pick one, and swap `logo.tsx` + `app/favicon.ico` + `app/opengraph-image.tsx` before the PokeBeard send. Resolves the docs/code drift in the same swap (DESIGN.md §5 still documents the retired Foil Spark as canonical).

**Context:** Surfaced 2026-06-02 while grounding the logo-concept drafting task. The docs/code "disagreement" investigation is **resolved by git history**: the Foil Spark was *built, then reverted*, not spec'd-and-never-built. Spark shipped Session 46 (ADR-036, `0cc9034`) → founder replaced it with a navy Pokeball Session 47.1 (ADR-038, `b9e1eca`) → classic red/white Pokeball Session 47.3 (ADR-040, `4227be8`). DECISIONS.md (line ~1437) records ADR-036's "not a Pokeball" reasoning being *explicitly reversed* by the founder. The drift is simply that DESIGN.md §5 was never updated to follow ADR-038/040 — a stale doc, not a silent code divergence. The trademark angle is the net-new finding the original logo decisions never weighed.

---

---
date: 2026-06-01
category: product
status: captured
---
## Live-deal leaderboard (B.4) — out-discover Collectrics IQ on the live-deal axis

Sort all curated cards by current buy-signal BELOW magnitude into a leaderboard of "the best live deals right now." This is the discovery surface that counters Collectrics IQ Price Lab's sticky "undervalued cards" leaderboard — except Foil's ranks by LIVE eBay asks (condition-matched, post-#32.3), which Collectric structurally can't do (it's a backward-looking valuation model, not pulling live listings). Gated on ROADMAP #10 (eBay Growth-Check ceiling lift) for the same Browse-quota reason as #32.2: a leaderboard ranking by live BELOW needs a live ask per card, so it can't ship on the static catalog grids until the ceiling lifts. Adjacent reference-enrichment candidates worth pursuing independently (signal augmentation, NOT a pivot to valuation): (1) grading intensity (PSA pop / time) — free data, useful where the 30-day sold sample is thin; (2) in/out-of-print status — rotated manually per set release; (3) pack scarcity / cost tracking — cheap scrape, high signal. Stealable UX (in-lane): per-card "why" explanation inline using the #32.3 data already surfaced (inferred condition + matched tier + delta), and honest-subjectivity framing ("if you disagree, adjust") per ADR-048. Explicitly do NOT steal: character premium (subjective, fights ADR-048), adjustable sliders (no natural inputs for a comparison-based signal), or the full multi-factor model (the 1-input MVP just survived three de-risking rounds). Strategic posture: don't pivot to valuation; out-discover on the live-deal axis; stay in lane.

**Context:** Raised 2026-06-01 by John from a pokedatadadguy YouTube walkthrough of Collectrics IQ Price Lab (youtube.com/watch?v=0s0YMFOsrjY). Full competitive writeup in [competitive-collectric.md](competitive-collectric.md). The threat is discovery-beats-search for casual users; the counter is a live-deal leaderboard native to Foil's moat (live asks). Pairs with the buy-signal work (#32 / #32.1 / #32.3) as the consumer surface for the condition-matched signal once #10 lands.

---

---
date: 2026-05-31
category: product
status: captured
---
## Halo-watch signal: predict price lift on existing cards when new same-Pokemon cards are announced

Compute a leading "halo watch" indicator: when creator transcripts mention a Pokemon name near a set-pulse marker (e.g. "Umbreon SIR coming in the 30th anniversary set"), flag ALL cards in the catalog with that Pokemon name as likely to see a price lift. Documented market pattern: new high-rarity card of Pokemon X drives demand bleed-up to all existing X cards (Moonbreon attention lifted vintage Umbreons; Charizard ex SIR lifted Base Set Charizards 8-12% in 30 days post-release). All inputs already in hand: C.1's set-pulse detection works, creator transcripts ingested, catalog has Pokemon name on every entry. Three pieces of work: (1) Pokemon-name proximity extraction near set-pulse markers in transcripts; (2) catalog cross-reference (`lib/cards/catalog.ts` filter by name); (3) halo-watch output in digest with confidence tag (HIGH for top-tier mons — Charizard/Pikachu/Umbreon/Lugia/Mewtwo/Rayquaza; LOWER for B-tier or over-printed Pokemon like Pikachu). Honest caveats to encode: reprint-in-same-set downgrades the halo (old card may DROP if new SIR is paired with reprint); time decay (halo strongest 0-21 days post-announcement, fades by 45); not always true (probabilistic). Methodology page documents accuracy ("~70% of HIGH-confidence halo signals see lift within 21 days") with PRODUCT.md "earned trust over persuasion" framing. Consumers via the market-pulse library: buy signal gets "halo-rising candidate" tag, per-card pages show halo-watch status, newsletter leads with "Halo alert" sections, content engine generates predictive posts. Moat: no Pokemon TCG competitor publishes a predictive halo signal — PriceCharting/PokeScope are backward-looking. Over 6-12 months of accuracy-tracked halo predictions, Foil becomes the cited source for "what will spike next."

**Context:** Raised 2026-05-31 by John during C.1 close, after the 30th anniversary set-pulse signal landed at HIGH confidence in the actual digest. Example reasoning: "if we find out umbreon is getting a new SIR that means we will likely see a bump in all umbreon cards." This is the kind of leading-indicator product feature that turns C.1's transcript ingestion from a content-engine input into a market-prediction surface. Architecturally part of the market-pulse library (sibling idea above) — the halo signal is one of the highest-leverage consumers of that library.

---

---
date: 2026-05-31
category: product
status: captured
---
## Market-pulse as a shared library, not a content-engine private input

The C.1 creator-content digest should be a shared market-context source for the WHOLE product, not just the content engine. Dual-format output: `docs/transcript-digests/{date}.md` (human + content engine prompt) + `docs/transcript-digests/{date}.json` (structured, parseable by code). A thin `lib/market-pulse/digest.ts` exposes `getLatestDigest()`, `getCardMentions(slug)`, `getCreatorVelocity(slug, windowDays)`, `isSpeculatorSpikeCandidate(slug)`, `getSentiment(slug)`. Server-side only, 1h-SWR cached. Consumers, in priority order: (1) buy signal (#32) — creator-spike flag becomes a contrarian "WAIT" input per market research; (2) per-card pages "Creator commentary this week" sidebar (builds cited-source moat); (3) wishlist alert emails ("PokeChuck just covered this card" context line); (4) watchlist proactive nudges (3+ creators mention -> "interest building" email); (5) newsletter "what creators are watching" section; (6) homepage trending widget; (7) buy-signal explainer copy; (8) Discord bot grounding; (9) content-engine topic selection (creator-velocity weighting on seo-strategy.md backlog); (10) catalog-expansion ranking; (11) per-set landing pages; (12) Claude Code + Cowork session grounding (per CLAUDE.md "Project Second Brain" pattern — every goal touching market reasoning automatically informed). The library is the architectural unlock that turns the digest from a one-pipe input into a foundation surface.

**Context:** Raised 2026-05-31 by John during C.1 execution: "this market information from the youtubers [should be utilized] in other parts of the build. It gives claude code and you more context into what is actually happening in the markets." Scope: not a C.1 change (let that pilot land first), but the natural shape of C.2 OR a separate "Market-pulse library" goal that comes after C.1 proves the input lift.

---

---
date: 2026-05-31
category: content
status: captured
---
## Google Trends + keyword-search ingestion alongside YouTube transcripts

Add Google Trends + keyword-search velocity as a parallel signal source alongside the YouTube transcript pipeline (creator-content ingestion idea below). Google Trends often LEADS creator commentary by days — creators see search velocity rising and then make videos about it. Pulling both gives the content engine leading + lagging indicators in the same digest. Data sources to consider: Google Trends API (free, rate-limited; pytrends library wrappable in scripts/ingest-google-trends.ts), TCGplayer hot list (publicly scrapeable, daily-refresh), Pokellector trending pages. Architecture should treat these as additional contributors to the same docs/transcript-digests/{date}.md file (or a parallel docs/market-pulse/{date}.md if richer), keyed by card name for cross-source corroboration. When a card spikes on Google Trends AND appears in 2+ creator transcripts in the same week, that's a high-confidence trend signal worth surfacing in the content engine AND in the buy-signal feature (ROADMAP #32) as a "rising interest" indicator. Scope: C.2 or C.3 (after the YouTube pilot proves its lift).

**Context:** Raised 2026-05-31 by John during C.1 pilot scoping. Sits adjacent to the YouTube transcript ingestion idea — same pipeline shape, different source. The "monitor uploads + scrape Google keyword search" framing came directly from John's curated-channel list message.

---

---
date: 2026-05-31
category: content
status: promoted
---
## Creator-content ingestion for content engine market signal

Feed the autonomous content engine a weekly digest of commentary from a curated whitelist of Pokemon TCG creators (YouTube transcripts via yt-dlp auto-subs first; Reddit + Twitter in V2). Provides real-time market-sentiment signal that PokeTrace's `avg30d` can't surface — creators react in days to anniversary moments, set drops, tournament rotation, viral spikes. Ingestion pipeline strips eBay-listing references (R-008 defense), filters hype words per BRAND-VOICE.md ban list, writes a digest at `docs/transcript-digests/{date}.md`. Content engine extends `SYSTEM_PROMPT` to draw on the digest with synthesis + attribution discipline (never quote >25 words verbatim, always attribute by name, treat hype language as speaker-data not card-data). New quality gate: attribution check on any creator-cited claim. Path A (1 session pilot): one creator, manual ingestion, measure lift in blog quality. Path B (full): multi-creator automated pipeline + attribution gate + transcript-aware buy-signal input (creator-spike often = contrarian SELL signal per market research). Copyright posture: synthesis + attribution = fair use, standard journalism shape (same as Money Stuff / Sports Card Investor / PokeBeach). John curates the creator list.

**Context:** Raised 2026-05-31 by John during V.2 drafting. Sits adjacent to ROADMAP NEXT #10 (content engine reframe) and #32 (buy-signal). Builds toward the longer-term "be the cited source" play (captured below).

---

---
date: 2026-05-31
category: content
status: captured
---
## Foil as the cited reference source (PriceCharting-shape moat)

Once per-card pages carry buy signals + sold-history + transparent methodology + per-card editorial, creators will START linking to Foil in their video descriptions and tweets. That turns the creator-ingestion pipeline two-way: we cite them, they cite us. PriceCharting's moat is that they ARE the reference for video-game prices; this play makes Foil the reference for Pokemon TCG buyer-side. 6-12 month compound. Triggers and accelerators: shipping the buy-signal feature (#32), per-card editorial, creator sponsorships (capital plan), publishing the `/pricing-methodology` page (already captured).

**Context:** Raised 2026-05-31 alongside the creator-content ingestion idea above. The two compound: ingestion gets us in the conversation; methodology + signal quality gets creators to cite us back.

---

---
date: 2026-05-31
category: product
status: promoted
---
## Buy-signal feature — "is now a good time to buy this card?"

Turn the per-card page from a price display into a buy *recommendation* (the deal-finder's actual job-to-be-done). Compare the current best eBay listing against the PokeTrace 30-day sold median/range already baked per card, and surface a calm signal (below median / at median / above median) with a confidence note and the exact numbers behind it. No hype, no fabricated confidence (BRAND-VOICE.md); no caching the eBay side (R-008). Scope + thresholds need defining before any build.

**Context:** Raised 2026-05-31 in Goal V (brand-voice) as a ROADMAP NEXT addition (#32). Promoted straight to ROADMAP NEXT since it's the natural next product surface after the catalog + voice work, but the signal definition is genuinely TBD so it carries a "scope TBD" flag.

---

---
date: 2026-05-24
category: infra
status: captured
---
## eBay Browse API Application Growth Check — submit before active watchlists exceed ~200 distinct slugs

Submit eBay's Application Growth Check at developer.ebay.com to lift the Browse API daily quota beyond the default 5,000/day cap. Math: the hourly wishlist cron (ADR-024) is capped at 200 Browse calls per run = 4,800/day, leaving 200-call headroom for per-card page renders. The cap binds when active watchlists span more than ~200 distinct card slugs. Triggers: (a) first Discord summary post showing `capHit: true`, or (b) active distinct-slug count over watchlists table crosses ~150 (proactive). Submission requires a written usage rationale + recent traffic stats — both available from the cron's run logs.

**Context:** Captured 2026-05-24 in Session 27 as part of ADR-024 consequences. Not urgent today — production watchlists table is empty — but the cap is real and binding once usage grows. Adding to IDEAS rather than ROADMAP because the trigger is observational, not date-based.

---

---
date: 2026-05-23
category: product
status: promoted
---
## Full programmatic catalog generation (25K+ cards via Pokemon TCG SDK)

Replace the curated 200-card CARD_CATALOG with programmatic generation from the Pokemon TCG SDK — every set, every card, every printing (~150 sets, ~25K cards). Architecture: hybrid SSG (top-N most-searched cards pre-rendered at build) + ISR (long-tail cards revalidate on demand), backed by a Supabase `cards` table rather than a hardcoded array. Sitemap splits into multiple files per Google's 50K-URL-per-sitemap limit. SDK rate-limit handling during bulk import.

**Context:** Decision made 2026-05-23 evening after Session 24 shipped the 200-card era→sets→cards browse. Visual UX is now in place; gap is catalog coverage. Curated 600-card "cheap path" was on the table as Session 25, explicitly rejected by John — full programmatic generation is the correct path because it captures the long tail of "anything Pokemon for sale" search intent permanently, eliminates the "missing sets" problem, and makes the watchlist useful for any card not just curated ones. Session 25 (or 25 + 26 split) implements this. Likely needs ADR for the SSG+ISR hybrid + catalog-table-vs-hardcoded-array decision.

**Update (Session 47.4 — first wave shipped via [ADR-046](DECISIONS.md#adr-046--tiered-per-card-rendering--catalog-expansion-to-1000-cards)):** the tiered-rendering + ranked-expansion approach landed the first wave (207 → 1,007 cards) — kept the hardcoded-array path (generated long-tail file spread into `CARD_CATALOG`) rather than the Supabase-table path, because the array regenerates cleanly and `generateStaticParams` stays deterministic. The SSG+ISR-hybrid idea was simplified: `/cards/[slug]` is `ƒ (Dynamic)` for all tiers; the quota concern the ISR idea targeted is solved by the curated/longtail tier split (long-tail skips the eBay Browse call) instead. Full 25K coverage + the Supabase-table migration remain open for later waves (2,000 → … gated on indexing + Browse telemetry).

---

---
date: 2026-05-23
category: product
status: promoted
---
## Pivot to deal-finder product positioning

Foil ships V1 as a buyer-side Pokemon TCG deal-finder rather than a seller-side scan-and-valuate tool — per-card landing pages, eBay-aggregated best-listing recommendations, wishlist email alerts, affiliate-primary revenue. The scanner work is preserved in-tree as a V2 surface; the content engine, newsletter, ops bot, and full autonomy stack remain intact and re-frame topic content from market analysis to buyer-intent.

**Context:** Promoted from Cowork strategy conversation 2026-05-23; [ADR-020](DECISIONS.md#adr-020--pivot-to-buyer-side-deal-finder-positioning) formalizes; [STRATEGY-PIVOT-DEAL-FINDER.md](STRATEGY-PIVOT-DEAL-FINDER.md) is canonical.

---

---
date: 2026-05-22
category: product
status: captured
---
## Japanese-card support

Add Japanese-language card recognition to the Vision pipeline. Eyevo's FAQ lists EN/DE/FR/ES/IT only — no Japanese — despite their "foreign-language" claim. Pokemon TCG's largest secondary market (yen-denominated) is sitting in the gap.

**Context:** Eyevo gap-analysis review on 2026-05-22 — competitor FAQ + landing page surveyed in Cowork.

---

---
date: 2026-05-22
category: product
status: promoted
---
## Sleeved-card test fixture

Add a fixture of sleeved cards (penny + perfect-fit sleeves, with and without reflection artifacts) to `lib/__fixtures__/cards/` and a regression test pinning identification accuracy under that condition. The current fixtures are all unsleeved.

**Context:** Already lives on ROADMAP NEXT — capturing here to keep the idea bank's history complete. Status `promoted` flags it as "already on ROADMAP" so a review session doesn't double-count it.

---

---
date: 2026-05-22
category: product
status: captured
---
## Android MVP

Ship an Android client even if it's a thin webview wrapper of the existing PWA. Eyevo is iOS 26+ only — the global smartphone market is ~70% Android, ~30% iOS, and that's the half they're conceding. Doesn't need to be native to land the wedge.

**Context:** Eyevo platform-support review on 2026-05-22 — their app store listing surfaced the iOS-26-only requirement.

---

---
date: 2026-05-22
category: monetization
status: captured
---
## Lifetime tier $59.99 with 70% off promos

Add a $59.99 lifetime tier behind a 70%-off launch promo. Eyevo runs this exact pattern; it converts on-the-fence users who balk at a $14.99/mo recurring but bite on "one charge, done forever."

**Context:** Eyevo pricing-page review on 2026-05-22. Cross-ref [ADR-004](DECISIONS.md) (Stripe pricing — Pro tier $14.99/mo) — the lifetime tier sits orthogonal to the subscription, not a replacement.

---

---
date: 2026-05-22
category: content
status: captured
---
## Programmatic SEO at card/set/series level

Generate an indexable landing page per card (and per set, per series). Eyevo has a per-card page in their public index; Foil doesn't have any equivalent surface. With ~25K Pokemon cards across English + Japanese sets, this is a long-tail SEO play that compounds with the existing content engine.

**Context:** Eyevo site-map crawl on 2026-05-22 surfaced their per-card URLs. Blocked on Scrydex per-card API — already tracked on ROADMAP item #9 (Scrydex migration).

---

---
date: 2026-05-22
category: product
status: captured
---
## Grading matrix hero feature with explicit low-sample handling

Build a "grading matrix" surface that shows estimated value at every condition tier (NM / LP / MP / HP / DMG) AND every PSA grade (1-10), with explicit "low sample" labels when the data thins out. This is the most credible single claim on Eyevo's site; we'd improve on it by being honest about confidence at the long tail.

**Context:** Eyevo feature-page review on 2026-05-22. The PokeTrace API already exposes `byCondition` rollups — the data exists; what's missing is the UI + the confidence-band logic.

---

---
date: 2026-05-22
category: infra
status: captured
---
## Scrydex vs PokeTrace vs in-house pricing benchmark

Run a head-to-head accuracy + coverage + cost benchmark across Scrydex, PokeTrace, and a hypothetical in-house (TCGplayer + eBay scrape) pipeline before committing to a single backend long-term. Pricing architecture is a one-way door once we have programmatic per-card pages and per-card landing-page SEO.

**Context:** Triggered by the per-card-SEO idea above — the pricing source decides what fields the SEO pages can credibly display. Cross-ref ROADMAP item #9 (Scrydex migration).

---

---
date: 2026-05-22
category: product
status: captured
---
## Bulk binder-page scan, 9 cards at once

Ship a binder-page scan mode that handles 9 cards in a single shot. Eyevo has no claim around binders; PokeLenz tried and broke the experience (their fragile entrant). This is the highest-leverage product gap competitive analysis surfaced — it's the only mode where Foil's value scales with the seller, not the buyer.

**Context:** Competitive scan on 2026-05-22. Note that the current pipeline already supports multi-card photos via `detectScan` + per-card crops — what's missing is the binder-specific UX (9-up grid hint, per-cell numbering on results).

---

---
date: 2026-05-22
category: content
status: captured
---
## Transparent pricing methodology page

Publish a `/pricing-methodology` page that documents exactly how Foil sources prices, what tiers it covers (NM/LP/.../PSA-X), how it handles low-sample conditions, and what its known blind spots are. Eyevo publishes none of this. Trust wedge against competitors who blackbox the number.

**Context:** Eyevo content audit on 2026-05-22. Aligns with the foil-card-id-framework's "null over guess" principle — same posture in marketing copy as in the pipeline.

---

---
date: 2026-05-22
category: growth
status: captured
---
## Community moat: Reddit + Discord + creator partnerships

Build out r/PokemonTCG presence (high-signal posts, not spam), a public Foil Discord for users (separate from the private ops Discord), and partnership outreach to 3-5 mid-tier (10K-100K) Pokemon TCG creators on YouTube + TikTok. Eyevo has zero community footprint; this is a hand we can play asymmetrically because of John's TCGplayer Level-4 seller signal.

**Context:** Cowork competitive review on 2026-05-22. Cross-ref ROADMAP item #10 (content syndication — partial overlap, but this idea is broader than syndication).

---

---
date: 2026-05-22
category: monetization
status: captured
---
## Newsletter affiliate links to TCGplayer + eBay

Embed affiliate links to TCGplayer and eBay listings in the newsletter — every per-card price citation becomes a click-through. John already runs a Level-4 TCGplayer storefront, so the affiliate enrollment is one form away. Revenue is bonus; the bigger play is the signal it sends ("this person sells the cards he writes about").

**Context:** Cross-cut between the newsletter pipeline ([ADR-011](DECISIONS.md#adr-011--newsletter-drafts-auto-generated-never-auto-sent)) and John's existing TCGplayer storefront. Surfaced 2026-05-22.

---

---
date: 2026-05-22
category: infra
status: captured
---
## Cross-Cowork-to-bot sync mechanism

Cowork conversations don't propagate to the Discord bot's grounding by default — every idea raised in Cowork lives only in chat history until manually copied into a second-brain doc. Build a sync mechanism (export-on-end webhook, or a periodic pull) so the bot's `<foil_context>` sees Cowork context the same way it sees `docs/`. Architectural gap, not a bug.

**Context:** Surfaced 2026-05-22 while transcribing 12 ideas into this file by hand — the friction itself was the evidence the gap is real.

---

## Review cadence

Sunday review session (target weekly, ad-hoc if missed):

1. Scan the `captured` entries from the past week.
2. For each, decide: promote (→ ROADMAP NEXT/LATER, status `promoted`), reject (status `rejected`, leave the row), keep as `captured` for now (no change), or mark `triaged` (looked at but undecided).
3. If promoted, add the ROADMAP row with a `<!-- promoted from IDEAS 2026-MM-DD -->` comment so the lineage is visible.
4. If rejected, add a one-line **Why rejected:** under the entry. The history of nos matters as much as the history of yeses.

Goal-time discipline: any goal that surfaces a non-trivial idea adds an entry HERE before commit. Same contract as SESSION-LOG. See [CLAUDE.md → Project Second Brain](../CLAUDE.md#project-second-brain).
