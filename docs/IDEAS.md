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
date: 2026-06-01
category: content
status: captured
---
## Google Trends + keyword-search ingestion alongside YouTube transcripts

A second market-signal source beside the C.1 creator transcripts: Google Trends + keyword-search volume for Pokémon TCG terms (card names, set names, "[card] price", anniversary terms). Search interest is an *earlier, broader* leading indicator than creator commentary — it captures demand spikes before creators make a video about them, and demand that no creator covers at all. Same pipeline shape as C.1 (fetch → clean → digest → inject with attribution), different data source. Feeds the same digest (a "search-interest pulse" section) and the buy-signal (#32). Explicitly OUT OF SCOPE for C.1 (different source, not just another channel). Lands as C.2 or C.3.

**Context:** Raised 2026-06-01 by John during C.1, captured as a deliberate scope boundary: "Google keyword-search ingestion is OUT OF SCOPE for C.1 (it's a different data source, not just another channel)." Adjacent signal that leads creator commentary.

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
