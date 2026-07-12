> 🗄️ **ARCHIVED / SUPERSEDED (2026-07-06)** — historical record, kept per the never-delete rule. Not current state. See [HOME.md](HOME.md) · index: [archive/README.md](archive/README.md).

# Cowork strategy session handoff — 2026-06-04

Read after CONTEXT-HANDOFF-2026-06-02.md. Captures the direction set in the 2026-06-04 Cowork strategy session. Feature-level ROADMAP / ADR / SESSION-LOG updates are written by each Claude Code goal as it runs. This doc captures the cross-cutting strategy no single goal owns.

## Direction decided today

1. **Deal-discovery is the front door.** Shift the primary surface from per-card watchlists to a "Best Deals Right Now" leaderboard. Watchlists demoted to a quiet retention mechanic. Rationale: discovery lets us show only the cards we are confident on and hide UNKNOWNs, turning the condition-data weakness into a non-issue. A watchlist forces a correct answer on every card a user picks; a leaderboard only on the ones we choose to show. Audience widens toward deal-hunters/flippers while keeping the collector SEO long tail.

2. **Market framing: eBay now, more marketplaces coming.** Only eBay is buyable today (lib/affiliate/ebay-browse.ts is the only live-listing source). PokeTrace gives eBay/TCGplayer/Cardmarket REFERENCE prices, not buyable listings. Copy must not claim multi-market buying. Real multi-market is a build (TCGplayer affiliate #26 + Cardmarket).

3. **Money model: free + affiliate now, subscription later.** Ship free + affiliate. Subscription is parked but now UNBLOCKED by banking (item 7). The "charge for leads" synthesis when we monetize: free shareable leaderboard (the funnel) + paid depth (full deal list, instant alerts, grading lane). Do NOT paywall the leaderboard itself (it is the Twitter funnel bait).

4. **Grading-gains leaderboard: ship without gem %.** Per docs/grading-leaderboard-data-sources.md: raw + PSA10 + the full ladder + price history are ALREADY wired (PokeTrace + PriceCharting). The only gap is gem % (PSA population), which is paid-only (PokemonPriceTracker ~$99/mo or Scrydex) and is NOT hiding in any key we already pay for (live-probe confirmed). A PSA pop hyperlink is only partly feasible (needs a spec-id map, psacard.com blocks fetch, and a link gives the user the page but not a rankable number). gem % is non-core to the buyer decision, so defer it. Ship the spread + live-deal board first.

5. **Logo: drop the Pokeball entirely.** Resolves the Nintendo trademark exposure (the PokeBeard blocker). New mark = "FoilTCG" wordmark, navy "Foil" + gold/foil-themed "TCG", on-brand palette. Explicitly avoid the Pokemon yellow+blue trade dress. The first flat wordmark concept read too generic/SaaS — the logo needs craft and character (foil/card motif). Being generated in Canva (Foil Corner + Light Split icon concepts from BRAND-LOGO-CONCEPTS.md); wordmark text set in a real font (AI garbles letterforms). Logo must land BEFORE the X bot posts screenshots; it does NOT block the leaderboard build.

6. **Traffic lever: automated X content bot.** Daily own-account posts: a screenshot of the live /deals leaderboard + rotating CTA/company/founder-story copy. Direct X API v2 (official, ToS-safe, pay-per-usage ~$6/mo daily; a post WITH a URL is $0.20). Ship dry-run-first (X_BOT_LIVE kill-switch, human review before posting, mirrors the newsletter never-auto-send rule). YouTube comments and Facebook deferred (spam/ToS + community-trust risk). Test link-in-reply vs in-post for reach.

7. **Banking unblocked.** Stripe Atlas LLC formed; Mercury application submitted (received Jun 5, ~1 day to approval). On approval: connect Mercury to Stripe as the payout account + clear the Stripe "verify business" task = live mode ready = subscription path un-parked. California home is the operating/business address everywhere (fix the 2710 vs 3710 mismatch). Delaware registered agent is the legal address.

8. **Stripe Agentic Commerce: parked.** Not a fit — it is for first-party merchants selling a catalog; Foil is an affiliate with no inventory. The relevant trend is Foil as the deal-data layer AI agents cite (see idea below), not this product.

## Goals queued (run order)

1. Leaderboard build (/deals) — KEYSTONE, independent of the logo. (pasted/running)
2. Logo wordmark swap — parallel; must land before the X bot goes live.
3. X content bot — after /deals is live; ships dry-run.

Each goal updates its own ROADMAP rows + ADR + SESSION-LOG + the relevant IDEAS entry.

## Open items
- John: pick a homepage headline in docs/website-copy-deal-finder.md (feeds the leaderboard build).
- John: on Mercury approval, connect to Stripe + clear the verify-business task.
- John: create X API v2 credentials at console.x.com (app + user-context tokens) and set a spending limit.
- Logo concepts in flight (Canva).
- Fix the 2710 vs 3710 home-address mismatch across Stripe + Mercury.

## Idea to file in IDEAS.md
- **Foil as the deal-data layer AI agents cite (+ MCP monetization).** Expose Foil's best-deal / buy-signal data to AI agents (a feed or an MCP server) so when someone asks an assistant "where is the best deal on X," Foil is the cited source and the purchase routes to eBay. Stripe's "monetize your MCP app" could later charge for premium data access. Threat side: agentic checkout could disintermediate affiliate clicks; the defense is the recommendation/trust layer + the owned email list. Raised 2026-06-04 from the Stripe Agentic Commerce page.
