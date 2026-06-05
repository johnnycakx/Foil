# Website copy — deal-finder front (v1 draft)

**Status:** Draft for John's review, 2026-06-04. NOT applied to the site yet.
**Frame (decided 2026-06-04):** eBay now, more marketplaces coming. Free + affiliate, no subscription yet.
**Voice:** per docs/BRAND-VOICE.md — calm, confident, exact numbers, no em dashes, no banned phrases, no hype.
**Note:** every `[N]` is a placeholder to fill with the real catalog count at build time.

---

## Homepage hero

**Headline (pick one):**
1. The best live deals on Pokémon cards, found for you.
2. Pokémon card deals, already scrubbed for you.
3. The best price on the card you want, right now.

**Subhead:**
We scan live eBay listings against real recent sold prices and surface the cards selling below market right now. You stop scrubbing listings. We already did it. eBay today, more marketplaces coming.

**Primary CTA:** See today's best deals
**Secondary CTA:** Get the free weekly deals email

**Microcopy under the CTA:** Free to use. We earn an eBay commission if you buy through our link, at no extra cost to you.

---

## How it works (3 steps)

1. **We watch the market.** Every day we check live eBay listings for [N] Pokémon cards against their recent sold prices.
2. **We flag the real deals.** When a listing is priced below what the card actually sells for, in matching condition, it makes the board.
3. **You buy with confidence.** See the exact listing, the sold-price context, and buy on eBay in one tap.

---

## The leaderboard — "Today's best deals"

**Section title:** Today's best deals
**Subtitle:** Ranked by how far below recent sold price each live listing is. Updated daily.

**Columns:** Card · Live ask · Recent sold (condition-matched) · Below by · See it on eBay

**Honest note (small print under the board):**
We only list a card when we are confident the listing matches the sold data. We would rather show you fewer deals we trust than a long list we do not. That is why the board is curated, not exhaustive.

---

## Trust strip

Built by a Level-4 TCGplayer seller. Real sold-price data, transparent methodology, no hype. See how we price.

---

## Affiliate disclosure (footer + near CTAs)

Foil is free. When you buy through a link on Foil, eBay pays us a commission. It costs you nothing, and it does not change which deal we show you. We rank by the best deal, not the biggest payout.

---

## Newsletter CTA

**Get the week's best Pokémon card deals, free.**
One email a week. The biggest below-market listings we found. No spam, unsubscribe anytime.

---

## Twitter / screenshot framing (for the traffic bot)

The leaderboard must screenshot cleanly on a phone:
- Title "Today's Best Pokémon Deals" + the date + "foiltcg.com" visible in-frame, so every shared screenshot is self-branding.
- Top 5 to 10 rows legible without zooming.
- The "below by" number is the hook — make it the most prominent column.

---

## Guardrails (what we do NOT say)

- No "guaranteed profit", no "this will grade a 10", no countdown-timer urgency.
- No claim of buying on Cardmarket or TCGplayer until those are wired. "More marketplaces coming" only.
- No fabricated counts or stats. Fill every [N] with a real number at build.
- Affiliate disclosure stays visible (eBay Partner Network + FTC requirement, not optional).
