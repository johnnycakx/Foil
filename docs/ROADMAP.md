# Foil Roadmap

**Last updated:** 2026-05-23 (pivoted to deal-finder per [ADR-020](DECISIONS.md#adr-020--pivot-to-buyer-side-deal-finder-positioning) and [STRATEGY-PIVOT-DEAL-FINDER.md](STRATEGY-PIVOT-DEAL-FINDER.md))
**Owner:** John Craig (solo)
**Cadence:** Updated at the end of every goal. See [Project Second Brain](../CLAUDE.md#project-second-brain) for the auto-maintenance contract.

The roadmap has four buckets. NOW is what's actively blocking the next ship. NEXT is the queue I'll pull from once NOW clears. LATER is committed direction but not yet scheduled. PARKED is explicitly deferred — re-check at launch + 30d.

**Strategic context (2026-05-23 onward).** Foil ships V1 as a buyer-side Pokemon TCG deal-finder — per-card landing pages, eBay-aggregated best-listing recommendation, wishlist email alerts. Scanner functionality is preserved in-tree but deferred from V1 launch scope (V2 candidate). Content engine + newsletter + autonomy stack remain intact and reframe content topics to buyer-intent shape. Source: [STRATEGY-PIVOT-DEAL-FINDER.md](STRATEGY-PIVOT-DEAL-FINDER.md), formalized in [ADR-020](DECISIONS.md#adr-020--pivot-to-buyer-side-deal-finder-positioning).

---

## NOW — this week (≤ 2026-05-27)

| # | Item | Why it's NOW | Owner | Status |
|---|------|--------------|-------|--------|
| 1 | **GitHub Actions secrets:** set `ANTHROPIC_API_KEY`, `BRAVE_SEARCH_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | The Monday + Thursday autonomous workflow can't run without these. First scheduled fire is Mon 2026-05-25 14:03 UTC. | John (manual GitHub settings) | Pending |
| 2 | **v0.dev homepage redesign — deal-finder hero** <!-- reframed via pivot 2026-05-23 --> | Current `app/page.tsx` hero is functional but plain AND now framed for the old valuation product. v0 generates a stronger hero + social-proof block for the launch surface, oriented around "Find the best Pokemon TCG deals across eBay, instantly" rather than "Snap a card, get a valuation." | John (paste output) | Pending |
| 3 | **Google Search Console:** add `foiltcg.com` property, TXT-verify, submit `/sitemap.xml` | Indexing latency is 1-4 weeks. The earlier we submit, the earlier the three pillars + blog + (soon) per-card landing pages start appearing in search. | John (Vercel DNS + GSC UI) | Pending |
| 4 | **Decision: keep or kill the 2 auto-generated posts** | `how-to-read-a-japanese-pokemon-card` + `near-mint-vs-lightly-played-…` shipped via the new autonomy pipeline on 2026-05-20. Both passed gates on first attempt. Read them in the live preview and decide: leave up, edit, or delete. Doubles as the calibration corpus for the founder-voice work coming in Session 22-23. | John (manual review) | Pending |
| 5 | **Per-card landing page MVP at `/cards/[slug]`** <!-- promoted via pivot 2026-05-23 --> | First concrete proof of the deal-finder direction. Charizard Base Set is the launch card — highest-value/highest-recognition single SKU, exercises every part of the stack (image, eBay listing, condition picker, schema.org Product, wishlist form). One real page beats 200 templated ones for de-risking the design. | Claude Code (next goal) | Pending |
| 6 | **eBay Browse API integration in `lib/affiliate/ebay-api.ts`** <!-- promoted via pivot 2026-05-23 --> | The data dependency for #5. Need: search by card name + set filter, parse listing nodes (price/condition/seller/shipping), wrap output URL with affiliate Campaign ID. Soft-fail per the lib/ pattern — eBay outage shouldn't 500 a landing page. Open question per strategy doc: actual quota at 500 cards × hourly refresh. Start with 1-card hourly to characterize. | Claude Code (next goal) | Pending |
| 7 | **Watchlist table schema in Supabase** <!-- promoted via pivot 2026-05-23 --> | The data dependency for the wishlist alerts cron in NEXT. Schema: `watchlists(id, email, card_slug, target_price_cents, created_at, last_notified_at)`. Email-anchored (no auth in V1 per ADR-020). Migration in `supabase/migrations/`. | Claude Code (next goal) | Pending |
| 8 | **eBay Browse API access — keyset compliance + OAuth client + page swap** <!-- Done 2026-05-24, Session 26 --> | Closed via [Session 25](SESSION-LOG.md) (Marketplace Account Deletion webhook → keyset compliant per [ADR-022](DECISIONS.md#adr-022--marketplace-account-deletion-compliance-via-subscribe-path-over-exemption)) + [Session 26](SESSION-LOG.md) (Browse API client + OAuth helper + per-card page swap per [ADR-023](DECISIONS.md#adr-023--browse-api-client-ships-libaffiliatelinksts-multi-source-selector-deferred-until-tcgplayer-access-lands)). `getBestListing()` now returns real Browse API listings end-to-end. | John (compliance form) + Claude Code (code swap) | ✅ Done 2026-05-24 |
| 9 | **Resend domain verification + `DEFAULT_SENDER` flip** <!-- Done 2026-05-24, Session 30 --> | Closed via [Session 30](SESSION-LOG.md). Resend records for `foiltcg.com` verified in the Vercel-managed DNS between Session 28's 403 test (~21:11 UTC) and the natural 22:00 UTC hourly cron tick on 2026-05-24 — 6 production wishlist alert emails delivered end-to-end pre-flip from the test-mode `onboarding@resend.dev` sender. This goal flipped `DEFAULT_SENDER` + the inline `sendTransactionalEmail` fallback to `Foil <alerts@foiltcg.com>`; structural regression-guard test pinned `onboarding@resend.dev` cannot reappear in `lib/` or `app/` outside the test file. | John (DNS + Resend dashboard) + Claude Code (sender flip) | ✅ Done 2026-05-24 |
| 10 | **14-day eBay Application Growth Check evidence push** <!-- added 2026-05-24 --> | Per the Application Growth Check prerequisites (`developer.ebay.com/my/support/tickets?tab=app-check`), eBay requires "application is live and approaching the default 5000/day call limit" before they'll approve a ceiling lift. We just went live with Browse on 2026-05-24 with ~100 calls/day usage. The 14-day window (submission target ~2026-06-07) accumulates real production data + builds the supporting compliance artifacts (`docs/EBAY-COMPLIANCE.md`, `/legal/ebay-api-compliance` public page, privacy/ToS update, architecture one-pager PDF) so the application is bulletproof at submission. Phase 1 (telemetry) closed Session 28. **Phase 1 evidence amplified Session 31 — 19 watchlist rows across 19 unique slugs, cron volume distributed across 24h via staggered `last_notified_at`.** Phase 2 (`docs/EBAY-COMPLIANCE.md` + invariants) closed Session 32. Phase 3 (`/legal/ebay-api-compliance` public page) closed Session 33. **Phase 4 (PDF one-pager artifact at `public/compliance/foil-ebay-api-compliance.pdf`, served from `https://foiltcg.com/compliance/foil-ebay-api-compliance.pdf`) closed Session 35.** Phase 5 (privacy/ToS update) next. | John (manual seeding + Resend + submission) + Claude Code (Phase 2 goals sequentially) | In progress |

---

## NEXT — next 2 weeks (2026-05-28 → 2026-06-10)

| # | Item | Trigger | Notes |
|---|------|---------|-------|
| 8 | **200-card landing page generation pipeline** <!-- promoted via pivot 2026-05-23 --> | Once #5 (one-card MVP) proves the design end-to-end. | Generate `/cards/[slug]` for the top 200 most-searched cards. Build offline (one-shot script that writes MDX or DB rows), regenerate on demand. Catalog source: Pokemon TCG SDK (pokemontcg.io, free) per the strategy doc Q3. Schema.org Product on every page; programmatic internal links to same-set siblings. |
| 9 | **Wishlist alert cron** <!-- Done 2026-05-24, Session 27 --> | Closed via [Session 27](SESSION-LOG.md) — hourly Vercel Cron Job at `/api/cron/wishlist-alerts` walks watchlists, dedups Browse calls per slug, sends Resend emails when current price ≤ target, stamps `last_notified_at`. See [ADR-024](DECISIONS.md#adr-024--wishlist-alert-cron-on-vercel-cron-jobs-vs-github-actions-or-supabase-edge-functions). | Claude Code | ✅ Done 2026-05-24 |
| 10 | **Content engine reframe → "Best [card] deals this week"** <!-- promoted via pivot 2026-05-23 --> | Once #5 + #6 land — the content posts will link into the per-card pages. | Update `SYSTEM_PROMPT` in `lib/seo/content-engine.ts` from market-analysis framing to buyer-intent framing. Topic backlog in `docs/seo-strategy.md` reshuffles toward "[card] price under $X" / "Best [set] deals" topics. Mon/Thu cron + gates pipeline stays exactly as-is per ADR-020. |
| 11 | **9th quality gate: "Citable claim density"** — 8+ standalone factual statements per post | AI Overview optimization. Google's SGE pulls atomic sentences that read as standalone facts; current gates reward presence of $/dates/Foil-cites but not the citable-sentence shape. | `lib/seo/quality-gates.ts` + positive/negative test in `lib/__tests__/seo-quality-gates.test.ts`. Heuristic: count sentences ≤ 25 words that contain a named entity + a verb + a specific noun. |
| 12 | **Content engine prompt: AI Overview citation discipline** | Same trigger as gate 11. Prompt needs to bias toward short declarative sentences with named entities. | Edit `SYSTEM_PROMPT` in `lib/seo/content-engine.ts`. Add a "Citable claim" rule. Lands alongside #10's reframe. |
| 13 | **Run `searchfit-seo:ai-visibility` baseline** | Once domain is GSC-verified. Establishes the "before" snapshot we'll re-measure monthly. | Document the report location in `docs/SESSION-LOG.md`. |
| 14 | **Expand `seo-strategy.md` cluster topics for deal-finder framing** | Backlog currently has ~35 cluster topics from the valuation framing. Need to recompose around buyer-intent queries — "[card] for sale," "cheap [card] for sale," "[set] booster value," etc. | Hand-curate from competitive-gap reports + the [card] for sale long-tail. |
| 15 | **Scrydex API migration evaluation** <!-- reframed via pivot 2026-05-23 --> | Triggered by Pokemon TCG SDK gaps in #8 OR PokeTrace rate limits. Scrydex has per-card endpoints we'd use for richer per-card landing pages (price history, sold-comps). | Tracked in [DECISIONS.md](DECISIONS.md). Now downstream of the deal-finder direction rather than scanner-driven. |
| 16 | **Slack (or Discord) ops workspace expansion** | [ADR-014](DECISIONS.md#adr-014--outbound-discord-notifications-per-channel-webhooks-soft-fail-single-import-boundary) wired the four Foil HQ channels. Next: wire Stripe events, ebay-affiliate clicks (sampled), wishlist alert send-volume per cron. | Mostly already plumbed via `lib/notifications/discord.ts`; this is "wire one more producer per concern." |

---

## LATER — 1-3 months (2026-06-11 → 2026-08-20)

| # | Item | Why later |
|---|------|-----------|
| 17 | **V2 — Scanner relaunch as a deal-finder companion surface** <!-- moved via pivot 2026-05-23 --> | Per [ADR-020](DECISIONS.md#adr-020--pivot-to-buyer-side-deal-finder-positioning), the scanner code stays in-tree (`app/upload/`, `lib/vision*.ts`, `lib/poketrace.ts`, detect→identify→confirm pipeline). V2 surface is "snap a card → land directly on its `/cards/[slug]` deal page" — completes the loop between the scanner and the deal-finder product. Triggers V2 once V1 deal-finder is producing affiliate revenue. |
| 18 | **Content syndication: Reddit r/PokemonTCG, Medium, Substack republish** | Owned channels first; syndication adds reach but only matters once we have ≥10 posts worth republishing. |
| 19 | **A/B test Gemini 3.1 Pro on the visual-confirm pass** | Sonnet 4.6 confirms work well; Gemini 3.1 Pro is ~8× cheaper at similar quality on side-by-side image tasks. Worth measuring once we have ≥1K confirm-pass calls of baseline data. Re-prioritizes once #17 (scanner V2) approaches launch. |
| 20 | **HowTo + Product + Review schema rollout** | Pillars and posts currently emit Article + FAQPage only. Adding HowTo (for guides), Product (extra on per-card landing pages — beyond the basic Product markup in #5), Review (for graded comps) widens SERP feature eligibility. |
| 21 | **Monthly AI Visibility tracking cadence** | Manual snapshot every month-end via searchfit-seo. Compare deltas. |
| 22 | **`scan_cards` per-card persistence table** <!-- scanner stack, deferred to V2 -->  | Currently `scans` only stores image metadata; per-card identification results live in transient `scanResults`. Persisting unlocks accuracy diagnostics, "your scan history," and the `mostScannedCards` data-injection helper. Schema TBD. Lands with #17 scanner relaunch. |
| 23 | **Manual spot-check OR 24-hr noindex window before autonomous posts are search-visible** | Risk mitigation for [content engine fabrication](RISKS.md#r1). Trigger: first time the gates pass something embarrassing OR sustained organic traffic begins. |
| 24 | **Vercel Pro Trial decision** | Trial expires 14 days from activation date. If we're on it, log expiry to ROADMAP NOW the day it falls within 7d. |
| 25 | **Lifetime founding-member tier ($59 Stripe payment link)** <!-- promoted via pivot 2026-05-23 --> | Per [ADR-020](DECISIONS.md#adr-020--pivot-to-buyer-side-deal-finder-positioning) secondary revenue path. Marketed via newsletter launch send to capture highest-intent prospects at fixed upfront price. Triggers once newsletter list crosses ~100 active subscribers. |
| 26 | **TCGplayer affiliate plumbing** <!-- promoted via pivot 2026-05-23 --> | V1.5 — eBay-only is V1, TCGplayer is the planned second affiliate source per ADR-020. Plumbed through `lib/affiliate/links.ts` (designed in #6 to accommodate). Triggers once TCGplayer affiliate approval lands. |

---

## PARKED — explicitly deferred

| Item | Reason parked | Re-check trigger |
|------|---------------|------------------|
| Google OAuth login | Needs domain whitelist + LLC formation | Post-LLC banking |
| Stripe live mode | Needs LLC banking | Post-LLC banking |
| Multi-TCG (MTG, Yu-Gi-Oh) | Distracts from Pokémon wedge | $5K MRR |
| WebSocket price streams | PokeTrace Scale tier feature | Pro waitlist > 100 |
| Sold-listings endpoint | PokeTrace Scale tier feature | Pro waitlist > 100 |
| Programmatic per-card landing pages (large catalog beyond top-200) | Promoted to NOW (#5) for top-1 / NEXT (#8) for top-200 via [pivot 2026-05-23](DECISIONS.md#adr-020--pivot-to-buyer-side-deal-finder-positioning). Large-catalog (1K+ cards) remains parked behind Scrydex migration. | Scrydex migration (item #15) |
| Anomaly detection beyond PokeTrace flags | Insufficient scan volume to ground heuristics | 10K scans |

---

## How to use this doc

- **Adding an item:** which bucket fits? NOW = blocking this week's ship. NEXT = queued behind NOW. LATER = direction but no week assigned. PARKED = "no, not now."
- **Removing an item:** move to a SESSION-LOG entry naming the commit that closed it. Don't silently delete — the history matters for understanding past decisions.
- **Re-prioritizing:** edit the table in place. If something moves from NEXT to NOW because external state changed, drop a `<!-- promoted from NEXT 2026-05-22 -->` comment on the row.
