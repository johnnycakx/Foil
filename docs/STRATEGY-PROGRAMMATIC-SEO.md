# Strategy: Programmatic SEO at Scale

**Date proposed:** 2026-05-25
**Status:** Committed direction for post-Growth-Check execution
**Author:** John Craig, with strategic-peer input via Cowork
**Companion to:** [STRATEGY-PIVOT-DEAL-FINDER.md](STRATEGY-PIVOT-DEAL-FINDER.md) (the why of the pivot) and [ADR-020](DECISIONS.md#adr-020--pivot-to-buyer-side-deal-finder-positioning) (the formal record). This doc is the how of scaling the surface that ADR-020 promised.

## The bet in one paragraph

ADR-020's load-bearing claim was that a long-tail per-card SEO surface — every Pokémon card with its own indexable landing page, mapped to high-commercial-intent search queries like "charizard base set for sale" — compounds defensibly over 6-18 months as Google rankings establish. We have 200 cards live today. The bet this doc commits to: scaling to 3,000-5,000 cards with genuine editorial credibility per page is what turns Foil from "a Pokémon TCG deal-finder" into "the reference site for Pokémon TCG pricing." Everything else Foil ships — watchlists, alerts, newsletter, the deal-finder UX — is supporting infrastructure for that surface. The per-card pages are the actual moat.

## Why 5,000 cards, not 25,000

The full Pokémon TCG catalog has ~18,000 unique prints. The realistic *commercial demand* (cards anyone actually searches for, buys for value, or invests in) is far smaller. A common 1996 Base Set #89/102 worth $0.10 has zero search demand and zero affiliate-conversion potential. The practical target is the top 3,000-5,000 cards by search volume + collector demand. That captures roughly 95% of total search intent at 20% of the catalog. Going past 5K hits diminishing returns sharply and risks Google's thin-content filters.

The 25K framing from ADR-020 is the *ceiling*, not the target. We may extend toward it gradually once the 5K base is producing real organic traffic; we will not chase it as a goal.

## Where we are vs. where we're going

**Current state (Session 33, GSC data as of 2026-05-25).** 200 curated cards across 18 sets, basic per-card template (image + listing + watchlist form + minimal editorial), daily revalidate, sitemap submitted and read by Google on 2026-05-22 (Status: Success, 209 pages discovered), GSC verified and active, schema.org Product markup, no per-card editorial generation, no hub pages, picker bug surfaces junk listings (Task #17 in queue).

**Important GSC reality check.** Of the 209 sitemap-discovered URLs, only 2 are indexed (~1%). 208 are in Google's "Discovered - currently not indexed" state — Google knows they exist but hasn't crawled them yet. This is normal for a 4-day-old GSC property and a new site without backlink authority; new-site crawl budget is intentionally throttled. Expect 5-20%/week organic flip from "discovered" to "indexed" over the first 4-8 weeks, then plateau. **This data is the operational gate on catalog expansion — see Sprint timing below and the "indexing-rate gating" section under Risks.**

**Target state (~Week 14 of post-Growth-Check execution, roughly mid-September 2026).** 3,000-5,000 cards live, per-card AI-generated editorial through a content-engine pipeline with quality gates, ~50 hub pages capturing comparison and "best of" intent, expanded schema.org (AggregateOffer, FAQPage), per-card OG images, sold-comps data integrated if PokeTrace Scale tier is unlocked, founder Twitter/Reddit presence driving direct traffic, first creator outreach landed.

**Day-90 organic baseline target:** 1,000-5,000 sessions/day from search; 10-50 watchlist signups/day; first sustainable affiliate revenue.

## The three transformative moves

Everything else (sold comps, hub pages, OG images, schema.org expansion, multi-marketplace) is *in service of* these three. Doing them in order matters — out-of-sequence work compounds badly.

**1. Quality of curation (Task #17 picker fix).** Turns Foil from "lowest-price aggregator" into "trustworthy curator." Without this, every page is leaking trust on every render. This is the precondition for all SEO work. Until #17 ships, expanding the catalog only multiplies the credibility damage.

**2. Surface area (catalog expansion 200 → 5K).** Turns Foil from "200-page niche site" into "structural SEO surface for the entire Pokémon TCG buyer market." Compound flywheel: more pages → more keywords indexed → more organic traffic → more affiliate revenue → more capital. Must be paced, not dumped — Google penalizes massive overnight expansion.

**3. Editorial credibility (per-card content engine + founder voice).** Turns Foil from "templated thin content" into "the actual reference site." Without per-card editorial, expanded catalog is thin content and gets penalized. With it, every card page has 100-200 words of credible context that no competitor has at this scale.

## The 14-week sprint plan

Each sprint = roughly 2 weeks of focused work. Goals are concrete /goal candidates; success criteria are observable.

### Sprint 1: Foundations of scale (gated on indexing rate, not calendar)

**Timing:** Begins when ≥40% of the current 209 known URLs are indexed in Google Search Console (~85 pages). Expected window: 3-6 weeks from sitemap submission (2026-05-22 baseline) based on typical new-site Google crawl behavior. If indexing stalls below 40% past 6 weeks, the right move is to diagnose crawl issues (orphan pages, internal-linking weakness, page-quality signals) BEFORE expanding the catalog.

> **Amendment (Session 47.4 / [ADR-046](DECISIONS.md#adr-046--tiered-per-card-rendering--catalog-expansion-to-1000-cards)).** The 40%-indexed bar is now a **signal, not a hard pre-expansion gate.** Rationale: that gate was written to guard against expanding into *thin templated pages* (the failure mode that gets programmatic-SEO sites de-indexed — the PriceCharting/PokeScope "50,000 cards, one stale market price each" precedent). Foil's per-card pages are not thin: each carries unique PokeTrace 30-day sold-history (per-condition + per-variant) AND a baked TCGplayer price range — data those competitors don't surface per page. The first long-tail wave (207 → 1,007) matched **1006/1007** cards to real PokeTrace sold data, so the expansion adds *data-bearing* pages, not templates. We therefore expanded ahead of the 40% bar and instead **track indexing rate as the feedback signal** that gates the *second* wave (1,008 → 2,000): if the first wave's long-tail pages aren't flipping discovered→indexed at a healthy rate, diagnose before adding more. Indexing rate informs pace; page uniqueness is the real de-indexing guard.

**Goal:** Picker fix lands and stabilizes; catalog expands to 500 cards (once indexing-rate gate clears); per-card content engine MVP generates structured data on every page.

**Concrete goals:**
- /goal: Task #17 quality-aware picker (outlier rejection + title scoring + condition parsing).
- /goal: Catalog expansion 200 → 500 cards (curated list, no editorial yet).
- /goal: GSC verification finalized (if Task #7 still pending).
- /goal: Per-card content engine v1 — pure template + Pokemon TCG SDK data injection (release year, rarity, set context, comparable cards from same set). No AI editorial yet.

**Success criteria:** All 500 pages render with the new picker; Search Console shows crawl health green; daily Browse-call volume bounces visibly higher in telemetry.

### Sprint 2 (Weeks 3-4): Editorial maturity at 500 scale

**Goal:** AI editorial generation pipeline shipping per-card 100-200 word paragraphs that pass quality gates. No expansion past 500 yet — prove quality before scaling further.

**Concrete goals:**
- /goal: Per-card content engine v2 — Sonnet 4.6 pass with the 8-gate quality stack adapted for card pages (citable claims, $-figure consistency with live price block, no banned phrases, named-entity density). Generated content gets cached in the database; regenerates when price moves materially.
- /goal: First hub page templates — "Most valuable [set] cards," "[Era] price guide," "Cards under $X from [set]." Initially 5-10 hubs, hand-curated.
- /goal: Sold-comps evaluation — either PokeTrace Scale tier upgrade ($) or eBay sold-listings API access. Both have cost/access friction; pick one this sprint or document the deferral rationale.

**Success criteria:** 500 cards each have a fresh editorial paragraph; quality gates pass on >95% of generations; first hub pages ranking for long-tail queries within 3-6 weeks.

### Sprint 3: Surface expansion to 1,500 cards (gated on Sprint 1's indexing rate)

**Timing:** Begins when ≥40% of the 500-card surface is indexed (~200 pages). Triple-the-surface only makes sense if Google is keeping pace with the previous tier. If indexing falls behind, this sprint stalls until crawl-budget catches up.

**Goal:** Triple the indexable surface. Editorial pipeline runs on the new 1,000 cards. Internal linking density compounds.

**Concrete goals:**
- /goal: Catalog 500 → 1,500 cards (next tier of commercial-demand prioritized cards from the SDK).
- /goal: Backfill editorial for the new 1,000 cards via the Sprint 2 pipeline.
- /goal: Schema.org expansion — AggregateOffer with min/max/median pricing per card, FAQPage with 3-5 common questions per card, BreadcrumbList (set → era → card).
- /goal: Per-card OpenGraph image generation (card art + price + Foil chrome) — every Twitter/Reddit share becomes visually distinctive.

**Success criteria:** Sitemap reflects 1,500 URLs; Search Console crawl rate healthy; first AggregateOffer rich snippet appears in SERP results.

### Sprint 4 (Weeks 7-8): Marketing seed + conversion polish

**Goal:** Founder presence + first external traffic. Per-card pages optimized for conversion now that quality is real.

**Concrete goals:**
- John's manual work: daily Twitter presence sharing specific data findings ("This week 19 watched cards triggered alerts; here's the chart"). Reddit r/PokemonTCG comments + posts (with the Level-4 TCGplayer seller credential visible). Discord presence in 2-3 relevant Pokémon TCG communities.
- /goal: Watchlist form upgrade — add condition selector (NM/LP/MP) and "alert me at $X or below" target with optional condition floor. Doubles signal quality, sharply lifts conversion of watchlist → affiliate-purchase.
- /goal: Newsletter cross-pollination — Mon/Thu blog posts that already exist start linking into per-card pages; per-card pages link out to relevant blog posts.
- /goal: First creator outreach — pitch 5-10 Pokémon TCG content creators (YouTube, blogs) with a specific Foil data hook. One placement = months of backlink value.

**Success criteria:** First 100 direct visits/day from social; first creator backlink lands; watchlist→affiliate conversion measurably improves.

### Sprint 5: Scale to 3,000-5,000 + multi-marketplace (gated on Sprint 3's indexing rate AND first ranking signal)

**Timing:** Two gates: (a) ≥40% of the 1,500-card surface indexed, AND (b) measurable ranking-signal data from Search Console (first non-zero impressions for at least 50 distinct queries across the existing catalog). If either gate isn't cleared, the right move is *deepening editorial quality on existing pages* rather than expanding surface. Catalog growth without ranking is just thin-content amplification.

**Goal:** Surface reaches commercial-demand saturation. Affiliate revenue diversified beyond eBay.

**Concrete goals:**
- /goal: Catalog 1,500 → 3,000 cards (next demand tier).
- /goal: Catalog 3,000 → 5,000 cards (gated on Sprint 4 traffic data — if rankings establishing, proceed; if not, pause and triage).
- /goal: TCGplayer affiliate plumbing (V1.5) — `lib/affiliate/tcgplayer.ts` mirroring the EPN shape, `lib/affiliate/links.ts` selector — *if* affiliate approval has landed. Otherwise defer.
- /goal: Conversion optimization — exit-intent capture, lead-magnet email captures ("Get the 2026 Foil price guide PDF for [set]"), email-list growth campaigns.

**Success criteria:** 5K cards live; affiliate revenue split across at least eBay + TCGplayer; newsletter list crossing 100 subscribers.

### Sprint 6 (Weeks 13-14): Measure, plan Sprint 7+

**Goal:** Pause shipping, measure. Plan the next 14 weeks based on actual signal, not pre-formed assumption.

**Concrete work:**
- Search Console deep dive: which pages rank, which queries convert, which clusters underperform.
- Affiliate revenue audit: per-card, per-source, per-funnel-stage.
- Conversion-funnel analysis: page render → CTA click → affiliate redirect → (if measurable) purchase.
- Plan Sprint 7+: likely candidates are sold-comps integration if not yet shipped, Reddit/Discord/Twitter scale-up if early-stage traction is real, Pro tier monetization design if engaged-subscriber count justifies, or pivot/deepening based on data.

## What we are explicitly NOT doing

These come up in conversation regularly; documenting the deferrals so they don't sneak in.

- **Direct banner ads.** Affiliate is the model; competing display-ad inventory dilutes brand without material revenue at our scale.
- **Multi-TCG expansion (MTG, Yu-Gi-Oh).** Parked per ADR-020 until $5K MRR. Distracts from the Pokémon wedge.
- **Mobile app.** Foil is web-first; mobile-responsive web covers 95% of the use case. App is a V3+ surface.
- **User accounts / login system.** Watchlists stay email-anchored per ADR-020 until usage demands otherwise.
- **Marketplace functionality (Foil-hosted listings).** Defocus. We're a discovery + alerts surface, not a marketplace.
- **YouTube channel ownership.** Creator outreach yes; running a channel ourselves is full-time work.
- **Paid Google Ads.** SEO compounds; paid acquisition does not. Reserved for V2+ if there's a specific play.

## Risks and gating decisions

**Risk: Google penalty for sudden catalog expansion.** Mitigation is paced expansion: 200 → 500 → 1,500 → 3,000 → 5,000 across 4 sprints with **explicit indexing-rate gating at each tier (≥40% indexed before expanding to next)**. If Search Console shows crawl issues or de-indexing, pause the next tier and triage. The calendar timing in earlier drafts of this doc was wrong; pacing is signal-driven, not week-driven.

**Indexing-rate gating (the operational rule).** Each tier transition requires the previous tier's indexed-page count to reach ≥40% of total URLs in that tier, measurable directly from GSC's Pages report. Numerically: 200-card tier needs ≥80 indexed before 500 expansion; 500-card tier needs ≥200 indexed before 1,500 expansion; 1,500-card tier needs ≥600 indexed before 3,000 expansion; 3,000-card tier needs ≥1,200 indexed before 5,000 expansion. Treat the threshold as a hard gate — bypassing it amplifies thin-content risk and wastes editorial-generation spend on URLs Google won't crawl in a reasonable timeframe. If a tier stalls below threshold for >6 weeks, that's a quality signal, not a patience signal — investigate orphan pages, internal-linking weakness, schema problems, or page-quality issues before pushing more URLs.

**Risk: Per-card editorial quality fails gates at scale.** Mitigation is Sprint 2's prove-it-at-500-before-expanding sequencing. If quality gates pass <85% of generations at 500 scale, we don't expand to 1,500 — we tighten gates and re-generate.

**Risk: Browse API rate limits at 5K-page scale.** 5,000 cards × even sparse traffic = thousands of Browse calls/day. Application Growth Check is the first lift; tiered freshness (top 200 = render-time, tier 2 = 1h cache, tier 3 = 24h cache, tier 4 = weekly batch) is the architectural next step if traffic forces it.

**Risk: Sold-comps stays parked because PokeTrace Scale tier is expensive.** Mitigation: per-card pages remain commercially useful without sold comps (live listing + editorial is enough). Sold-comps is a *richness* multiplier, not a precondition. Acceptable to ship without it.

**Risk: Catalog expansion outpaces editorial generation budget.** Each per-card editorial run is a Sonnet 4.6 call ≈ $0.01-0.05. 5,000 cards × 0.03 average = ~$150 one-time + ~$30/month for re-generations on material price moves. Cheap; not actually a budget risk. Flagged for completeness.

**Gating decision (Sprint 5 catalog 3K → 5K).** If Sprint 4 doesn't show ranking establishment, pause 5K and investigate. The catalog expansion is not a goal in itself; it's an instrument for ranking. Without rankings, expansion just amplifies the same thin content.

## How this strategy supersedes / extends prior docs

This doc does not supersede [STRATEGY-PIVOT-DEAL-FINDER.md](STRATEGY-PIVOT-DEAL-FINDER.md). The pivot doc set the *direction* (buyer-side deal-finder); this doc is the *execution plan* for scaling the deal-finder surface the pivot promised. ADR-020 remains authoritative; ADR-021 through ADR-025 (compliance ecosystem) and the existing content engine (lib/seo/) remain intact. Per-card content engine work in Sprint 2 reuses the same lib/seo/ patterns and quality-gate primitives.

## Open follow-ups (tracked here, not yet in ROADMAP)

Post-merge of Sessions 34 + 35, ROADMAP should pull these into NEXT and LATER buckets:

- Sprint 1: Task #17 picker (already in NOW backlog), catalog expansion 200→500, per-card content engine v1
- Sprint 2: per-card content engine v2 (AI editorial), first hub pages, sold-comps evaluation
- Sprint 3: catalog 500→1500, schema.org expansion, OG images
- Sprint 4: founder marketing, watchlist UX upgrade, creator outreach
- Sprint 5: catalog 1500→5000, TCGplayer affiliate, conversion optimization
- Sprint 6: measure + plan

ROADMAP edits land in a separate `docs:` commit after Sessions 34+35 merge to avoid third-source merge conflicts.
