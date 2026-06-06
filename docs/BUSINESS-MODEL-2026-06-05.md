# Foil business model — economics, assets, and what actually drives profit (2026-06-05)

Written in the Cowork strategy session after the /deals board shipped with only 4 live deals, which prompted the right question: how does this actually make money long-term?

## The model in one line

The per-card pages are the revenue engine. The deals leaderboard + Twitter bot are the marketing hook. Affiliate is the baseline; a subscription is the real profit lever once an audience exists. The bottleneck is not the product, it is traffic.

## What we are actually shipping

- **Revenue engine (already built):** ~1,007 per-card pages, each showing the best live eBay listing for that card with an affiliate link. This is "the best near-mint listing for any card at any moment" — it already exists for 1,007 cards. Affiliate revenue comes from EVERY card a visitor lands on, not just the few below market.
- **Marketing hook (just built):** /deals leaderboard (the ~4 below-market cards at a time) + the planned daily X bot. Job: pull attention NOW while SEO compounds. It is a billboard, not the store.
- **Differentiator:** the buy-signal / condition-matched "below sold" read. Builds trust vs a bare affiliate page.
- **Audience assets:** newsletter + (coming) social. The owned audience is the deepest moat and the path to subscription revenue.

## Unit economics (affiliate)

Funnel: visitors -> click "see on eBay" -> complete a qualifying eBay purchase (EPN ~24h window) -> commission (a % of eBay's fee, roughly 1-4% of sale price).

Base scenario (adjust in the live calculator): 20,000 visitors/mo, 20% click, 4% of clicks buy, $40 average card, 3% commission.
- ~160 sales/mo, ~$1.20 per sale = **~$192/mo**.
- Revenue per 1,000 visitors (RPM): **~$10**.
- To hit **$1,500/mo on affiliate alone: ~150,000 visitors/mo.**

The punchline: affiliate is a thin, high-volume game (tens to hundreds of thousands of monthly visitors for real money). The SAME $1,500/mo is **150 subscribers at $10/mo**. One paying subscriber is worth roughly what 1,000 monthly affiliate visitors are worth. Affiliate bootstraps and pays the bills early; subscription is where the margin is.

## Asset map — have vs missing (for the "best price on any card" positioning)

HAVE (the product is largely built):
- 1,007 per-card best-listing + affiliate pages (the engine)
- Buy-signal / condition-matching + /pricing-methodology (the differentiator)
- /deals leaderboard (the hook)
- Autonomous content engine + newsletter pipeline (a traffic engine)
- EPN affiliate tracking with per-card/tier/creator customid
- Card search + set/era browse
- Founder credibility surfaced (Level-4 TCGplayer seller)
- LLC + banking in flight -> subscription becomes switch-flip ready

MISSING / WEAK (almost all distribution, not product):
- **Traffic.** This is THE bottleneck. GSC showed ~1 of 209 pages indexed; organic traffic is near zero. The engine is built but unfueled.
- **Catalog scale.** 1,007 of ~25K cards, so most "[card] for sale" searches have no Foil page. Caps the SEO long tail. (Wave 2/3 expansion, gated on eBay quota.)
- **eBay quota ceiling (Growth Check #10).** Caps serving live listings across a big catalog at traffic.
- **Condition coverage (F4).** Thin best-listing/buy-signal coverage (the 4-deal symptom) also weakens per-card pages.
- **Click-time redirect.** "See it on eBay" currently lands on a card-name search, not the specific listing. Conversion + trust leak. R-008-safe fix: re-fetch best listing on click and redirect to the item.
- **Distribution channels.** Newsletter list tiny; no social presence yet (X bot pending).
- **Subscription product.** The paid value bundle (instant alerts, full deal list, grading lane, CSV) is not built. Parked until audience exists.
- **Positioning.** Currently leads with scarce deals; the bigger-TAM framing is the utility ("best price on any Pokemon card you want, instantly, free") with deals as a feature.

## Strategic implications (where effort should go)

1. **It is a distribution problem, not a product problem.** The engine exists; it has no fuel. Prioritize traffic: SEO (get pages indexed + expand the catalog), the X bot, the newsletter.
2. **Lead with the utility, not the scarcity.** "Best price on any card, instantly" is a far bigger audience than "today's 4 deals." Same assets, broader funnel, more affiliate surface. Deals/Twitter become the hook that feeds it.
3. **Affiliate is the bootstrap; subscription is the profit lever.** Build the audience on free affiliate value, then convert a slice to a paid tier. 150 subscribers ~= 150K monthly affiliate visitors.
4. **Fix the conversion leaks first** (click-time redirect, F4 coverage) before pouring traffic in — do not fill a leaky bucket.
5. **Honest risks:** affiliate per-sale value is low and eBay can change terms on short notice (R-007). The defensible moat is SEO position + owned email audience + founder credibility + the buy-signal smarts, not the links themselves.

## Near-term sequence that serves the engine (not the billboard)

1. Logo (unblocks the paid-traffic surfaces).
2. Click-time redirect fix (stop the conversion leak).
3. F4 condition coverage (fatten the board AND improve every per-card page).
4. Traffic: get the catalog indexed (GSC/SEO) + ship the X bot + grow the newsletter.
5. Catalog scale + eBay Growth Check (expand the SEO surface and the live-listing capacity).
6. Subscription product, once there is an audience to sell it to.
