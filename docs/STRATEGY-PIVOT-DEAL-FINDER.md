# Strategy Pivot: Foil as Pokemon TCG Deal Finder

**Date proposed:** 2026-05-23
**Status:** Committed direction (pending Session 21 ADR-021)
**Author:** John Craig, with strategic-peer input via Cowork

This document supersedes the prior product framing of Foil as a card-valuation tool. It is the source-of-truth for the new direction; ROADMAP, ADRs, CLAUDE.md, and bot grounding all reconcile against this file.

## The pivot in one paragraph

Foil is repositioning from a seller-side card valuation tool ("scan a card, get a multi-source valuation") to a buyer-side deal-finder ("tell us a card you want, we find you the best live deal across the major marketplaces"). The new product is built around per-card landing pages mapped to high-commercial-intent search queries (e.g., "charizard base set for sale"), aggregating live eBay listings into a single best-deal recommendation per card, with affiliate-tracked CTAs and email-capture for wishlist alerts. Revenue flows from affiliate commissions on every purchase that originates from a Foil-attributed click, with the newsletter and wishlist-alert email infrastructure compounding subscriber engagement around buyer intent rather than seller curiosity.

## Why this is the right shift

The deal-finder framing aligns the business model with user value in a way valuation cannot. A valuation user comes 3-4 times to value cards they already own, then leaves. A deal-finder user returns every time they want a card, which for active collectors is weekly or more. Each visit has direct purchase intent by definition, and every click is monetizable through the affiliate layer. The conversion economics shift dramatically: search-page affiliate URLs convert at 2-3% industry standard, but algorithmically-selected best-listing recommendations convert at 8-15% because the recommendation is the entire value. The newsletter mechanics improve in parallel — deal newsletters have 35-45% open rates vs 20% for market commentary, and wishlist-driven alerts (sent only when a watched card hits a target price) convert at 15-25% because the recipient self-identified as a buyer with a specific budget.

Three structural advantages reinforce the direction. First, the Pokemon TCG deal-aggregator niche is genuinely empty — Eyevo and PokeTrace are valuation tools, PokeCenter does sealed-product drop alerts, but nobody is aggregating singles listings cross-marketplace for buyers specifically. Slickdeals built a billion-dollar business on this exact pattern in adjacent verticals. Second, the founder credibility wedge holds and arguably strengthens — a Level-4 TCGplayer Verified Seller writing about which listings are actually good deals carries authority that anonymous SEO operators cannot match. Third, the SEO play compounds: 25K Pokemon cards times one indexable landing page per card equals a long-tail content surface that grows defensible search position over time, with each per-card page targeting "[card] for sale" and "cheap [card] for sale" — the highest commercial-intent buyer queries in the niche.

## What the V1 scope actually is

The MVP launching by September 21 covers the top 200-500 most-searched Pokemon cards (this captures roughly 80% of search volume at 2% of the eventual content surface). Each card gets a `/cards/[card-slug]` landing page with the following above-the-fold content: card image, name, set, current best eBay listing with price + condition + seller rating + shipping + affiliate-wrapped CTA, wishlist-alert email form ("Notify me when this drops to $___"). Below the fold: condition breakdown, related cards, programmatic internal links to similar-set pages, schema.org Product markup for SERP enrichment. The newsletter pivots from market commentary to a weekly best-deals digest with wishlist-personalized sections for subscribers who have set watches. The content engine reframes from "Pokemon TCG market analysis" posts to "Best [card name] deals this week" auto-regenerating posts that update with current pricing on a Mon/Thu cron, giving Google fresh signals on commercial-intent URLs.

What V1 explicitly defers: the scanner functionality (positioned as "coming soon," not load-bearing for launch), TCGplayer listing aggregation (depends on Scrydex or scraping; affiliate-only via search URL fallback works without it), Mercari/COMC/Cardmarket expansion (post-launch), price history charts (nice-to-have, not core), Pro subscription tier (the product is mostly free; affiliate is primary revenue), wishlist UI dashboard with login (V1 watchlists are email-anchored, no auth required), cross-listing condition matching beyond basic filtering. Each of these is a real V2 candidate; none belongs in V1.

## The eBay-only decision

V1 ships with eBay as the sole live-listing source. This eliminates the Scrydex/TCGplayer-listing-data dependency entirely and gets Foil to first revenue day fastest. eBay dominates the high-value segments of Pokemon TCG buyer activity — graded slabs, vintage, international — where affiliate dollars per transaction are highest. TCGplayer affiliate approval is still pending and will land as a V1.5 upgrade rather than a launch blocker; when it does, the same `lib/affiliate/links.ts` lib accommodates both vendors via the per-vendor soft-fail pattern already designed. "One source done well beats two sources done halfway" is the operating principle.

## Revenue model

Primary revenue: eBay affiliate commissions on every Foil-attributed click that results in a sale. Default rate is 50% of eBay's take rate on most categories; effective rate per converted click runs $1-5 depending on card price and category. Compounding factors: per-card landing pages compound search traffic over 6-18 months as Google rankings establish; wishlist alerts compound retention engagement per existing subscriber (one user watching 30 cards generates ~30 conversion moments per year); newsletter list growth compounds total reach per send.

Secondary revenue paths, in priority order: lifetime founding-member tier ($59, sold via Stripe payment link, marketed via newsletter launch send — captures highest-intent prospects at fixed upfront price); newsletter sponsorships (deferred until list crosses ~1,000 active subscribers); premium tier for power buyers (e.g., $5-10/month for instant alerts vs hourly batch, multi-marketplace coverage, condition-grade filtering — V2 at earliest).

## The moat thesis

Nothing about scraping listings and wrapping affiliate links is individually defensible. The moat emerges from the combination of: speed and freshness of data (technical — hourly minimum refresh, faster for hot cards), quality of curation ("best deal" includes price + seller rating + condition + shipping + return policy + ship time, not just lowest price), SEO position (compounds over 6-18 months but eventually becomes a structural advantage), the owned newsletter and wishlist email list (direct relationship with buyers, not platform-dependent), and founder credibility as a Level-4 TCGplayer Verified Seller (signals authority that anonymous SEO operators cannot replicate). The newsletter and wishlist list are the deepest moat because they're owned audience — they don't depend on Google's algorithm or any vendor's affiliate terms staying favorable.

## Open questions and risks

Three questions that need answers before V1 implementation begins in earnest. First, eBay Browse API rate limits at scale — what is the actual quota, and at 500 cards refreshed hourly, do we hit ceilings? The architecture decision is whether to cache aggressively (4-hour TTL) and risk staleness, or run higher refresh and risk rate-limit incidents. Second, card disambiguation UX — "Charizard" matches dozens of printings; the autocomplete + canonical-URL design needs to route ambiguous searches to a disambiguation page rather than picking arbitrarily, but the routing logic and the URL slug taxonomy need to be defined before per-card pages get generated. Third, the data source for the card catalog itself — we have PokeTrace and PriceCharting for pricing reference, but we need a canonical list of every Pokemon card with images, set codes, and metadata; the cleanest sources are Pokemon TCG SDK (pokemontcg.io, free, comprehensive) or Scrydex (waitlist).

Risks worth flagging now. The single biggest risk is eBay's 1-day affiliate term change clause — they can drop the commission rate or change attribution with one day's notice, and Foil would have effectively no recourse. Mitigation is to aggressively diversify affiliate sources as soon as V1 stabilizes (TCGplayer when approved, then Mercari, then COMC), but during the eBay-only launch window this is a real concentration risk. Secondary risk: programmatic SEO at scale can trip Google's thin-content filters if per-card pages don't have enough unique substance beyond the listing data; mitigation is to write meaningful editorial content per card (history, pricing context, condition notes) generated by the content engine, not just templated listing tables.

## Content voice direction

The content engine and newsletter need a defined voice that matches the founder's actual writing style. Process: founder writes 2-3 sample blog posts in his natural voice (or pulls existing material from TCGplayer storefront copy, Slack messages, Reddit posts, etc. — anything that sounds like him). Those samples feed into the `brand-voice:guideline-generation` skill which extracts tone attributes, signature phrasing, what-to-avoid stances, and opinionated positions. The output guidelines get baked into the `lib/seo/content-engine.ts` SYSTEM_PROMPT and the newsletter draft generator. Captured separately as a near-term goal (Session 22 or 23).

## Naming and positioning

The Foil brand name still works in the new framing — short, memorable, on-theme with rare-card culture. Home page copy needs a full rewrite from "Snap a Pokémon card, get a multi-source valuation in under 10 seconds" to something like "Find the best Pokemon TCG deals across eBay, instantly." Tagline, hero, primary CTA all reframe around buyer intent. Domain stays foiltcg.com.

## What this supersedes

This document supersedes the product framing implicit in the prior CLAUDE.md description, the original ROADMAP NOW items oriented around content-engine launch surfaces, and any IDEAS entries premised on the scanning-as-primary-product model. The autonomous content engine architecture (ADR-005, ADR-006, ADR-007, ADR-011, ADR-012) remains intact — its output reframes from market analysis to deal-focused content but the pipeline itself doesn't change. The Beehiiv newsletter infrastructure (ADR-010, ADR-011, ADR-012) remains intact. The Discord ops bot (ADR-013) remains intact and re-grounds against this strategy doc on next deploy.

## Open follow-ups (post-pivot tracking)

Session 21 should land ADR-021 formalizing this strategic decision, rewrite ROADMAP NOW/NEXT to reflect the deal-finder priorities, update CLAUDE.md's project description, and add an IDEAS entry promoting the pivot to `status: promoted` with this doc as the canonical reference. The current ROADMAP NOW items (GitHub Actions secrets, v0 homepage redesign, Google Search Console verification, decision on 2 auto-generated posts) all remain valid under the new strategy and carry over unchanged.
