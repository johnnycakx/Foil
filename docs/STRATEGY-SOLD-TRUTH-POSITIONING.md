# STRATEGY: Sold-Truth Positioning — Foil as the buyer's source of truth on real sold prices

**Persona lens:** category-design / positioning strategist + brand-honesty guardian.
**Status:** DRAFT for John's ratification (2026-07-14). SHARPENS, does not replace, the already-ratified line **"Foil doesn't guess prices. It reads real sales."** (offer-implementation / ADR, 2026-07-11). Extends `STRATEGY-DATA-INSIGHT-ENGINE.md` + `STRATEGY-AUDIENCE-MOAT.md`.

## The founder insight (John, 2026-07-14) — the origin story
On eBay, cards are LISTED at absurd prices — often hundreds to thousands more than the same card has actually SOLD for on the same platform. There was no easy, done-for-you way to see SOLD data on a specific card; the closest existing tool (PriceCharting) is old, outdated, and not done-for-you. In the age of AI agents, people want the work done for them. **Foil exists to be the buyer's source of truth on ACTUAL sold prices — so collectors are informed and don't overpay or get scalped.**

## Why this is the right center of gravity
- It's where the strategy has been pointing all along (the ratified "reads real sales" line; the @mollipen wow was the trustworthy "what's it actually worth"; the 07-05 learning that the honest-price ENGINE is the desirable core, not a board of $1 movers).
- It moves us OUT of a crowded category ("deal finder" competes with Slickdeals / r/PkmnTCGDeals) INTO a less-crowded, higher-trust one ("know the real price / don't get ripped off").
- It's emotionally resonant and structurally sound: **villain** (asking-price theater / scalpers), **victim** (the buyer about to overpay by hundreds), **hero** (Foil shows the real sold comp), **enemy incumbent** (PriceCharting: old, manual, not done-for-you), **tailwind** (AI age: an agent that watches for you).

## The core contrast that IS the product
eBay shows ASKING prices. Foil shows what it ACTUALLY SOLD for. The gap between them is where buyers get hurt — and Foil already holds BOTH numbers (eBay Browse lowest live listing + real sold comps). Surfacing listed-vs-sold side by side is the "aha."

## HARD honesty guardrails (the brand IS trust — these cannot be violated)
1. **The claim is only as true as the spine.** (See the lead dependency below — this is the make-or-break.)
2. **We are not "the one true price."** Collector value is inherently uncertain → a confidence-gated READ (sold comps + dates + how-sure), never false precision. Say "what it actually sold for," never "THE value." (Same DNA as null-over-guess.)
3. **"Only PriceCharting existed" is an overclaim — do not put it in copy.** eBay's own sold/completed-listings filter (free, manual), 130point.com (free eBay sold lookup), and Card Ladder (sold-based, subscription/graded-leaning) all exist. Our honest edge is **done-for-you + watches/alerts + curated + free**, NOT "nobody else has sold data." Never make an "only" claim a collector can debunk in ten seconds — it torches the exact trust the whole brand runs on.
4. **A high listing is not literally a "scam."** Use villain/scalper/anti-overpay energy in ADS + X (top-of-funnel, externally framed); keep evergreen SITE copy precise ("asking prices lie, sold prices don't"). Same rule as the cooling-market narrative: punch in ads, precision on-site.
5. **Avoid the literal word "AI" on product/price surfaces** (collectors read it as hallucinated prices). Foil is "an agent that watches the market for you," anchored to sold data. "AI age / done-for-you" is fine for the founder / investor / ads story, not for product price copy.

## THE dependency that makes or breaks this (LEAD FLAG)
The sold-data spine is CURRENTLY degraded: PokeTrace's eBay sold ingest is frozen at 2026-07-05 and the key lapses ~Jul 15 (see `_results/data-source-spike.md` + the `pricing-bridge` goal). **You cannot credibly become "the source of truth on sold data" on a frozen or empty spine** — that is the precise lead-with-proof / capability-before-claim violation the brand cannot afford. So: this positioning is the DESTINATION, and it RAISES the stakes on Track A. **Do not ship the sharpened "source of truth on sold data" ads/site copy until `pricing-bridge` lands** (fresh, honest, self-degrading sold data). The positioning and the pricing-bridge are the same thread — the marketing promise is only honest if the data engine holds.

## Messaging pillars (ratify these; copy flows from them)
1. **Truth** — See what it actually sold for, not what someone's asking.
2. **Protection** — Don't overpay. Know the real number before you buy.
3. **Done-for-you** — An agent that watches the market and pings you; you don't scrub eBay.
4. **Honesty** — Real sold comps with dates and confidence. I'd rather show nothing than a made-up number.

## Ad hooks to TEST (buyer-protection is a NEW third hook for the WTP ads run)
- "eBay says $800. It sold for $310. Foil shows you the difference." (side-by-side, using OUR real windowed data honestly labeled — never a viral number that contradicts our own figure, per the R-001 / Moonbreon lesson)
- "Asking prices lie. Sold prices don't."
- "Stop overpaying for cards."
- "Know the real price before you buy."
The existing ads A/B was daily-drop vs grail-watch; add a **buyer-protection cell** as a third hook. Loss aversion is the strongest motivator in the deck — it may out-convert both.

## Website copy directions (John's voice veto — drafts, never auto-shipped)
- Hero: lead with the contrast + protection, not "deal finder."
- Card page: surface the listed-vs-sold gap explicitly.
- Reframe the /deals "good buy" = a live listing at or below the real sold average → anti-overpay proof, not a generic "deal."

## Product implications (candidate, POST-Track-A)
- Card page: show "cheapest live listing $X vs real sold avg $Y (n, dates)" contrast. We already have both numbers.
- Daily drop: "cards selling BELOW their sold average right now."
- Watches: "ping me when my grail is actually a fair price" (at/below sold).
- **Affiliate tension, named:** telling people "this listing is inflated" does NOT kill affiliate revenue — we route them to the FAIREST listing, so clicks stay honest, trust compounds, and click-through grows over time.

## What this does NOT change
ICP (modern chaser), the $6 offer shape, the two-voice architecture, the register rules (card-shop language), the honesty DNA. It sharpens the PAIN (overpaying) and the PROOF (sold-vs-listed gap), not the product.

## Recommended sequence
1. **Land `pricing-bridge` (Track A)** — the honest spine. Non-negotiable precondition.
2. Ratify these pillars (John).
3. Add the buyer-protection hook to the ads test (WTP validation).
4. Then re-copy the hero + card page (John's voice veto) + build the listed-vs-sold product contrast.
**Do NOT re-copy the site to "source of truth on sold data" before step 1.**
