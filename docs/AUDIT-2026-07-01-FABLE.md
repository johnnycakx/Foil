# FoilTCG Full Audit — 2026-07-01 (Fable 5 fresh-eyes pass)

Six parallel read-only agents: live surfaces · SEO/indexation · funnel/alerts · content engines · code/ops + goal specs · X/distribution. Every finding graded 🟢 fine / 🟡 fix-later / 🔴 fix-before-traffic. Criteria weighted to conversion-readiness (40%), discovery (30%), trust (20%), ops risk (10%).

## Scorecard

| Branch | Grade | One-line verdict |
|---|---|---|
| Live conversion surfaces | C+ | Looks trustworthy, renders real data — but the hero is still push-model and /start is invisible |
| SEO / indexation | D+ | Link architecture is B+, but the sitemap omits the fast hub layer and the 650 new pages time out on Googlebot |
| Signup funnel + alerts | **D** | The top of funnel writes to the wrong stores, alerts emit provably false emails, unsubscribe doesn't stop them |
| Content engines | C- | A-grade gate architecture; shipped content has live fabrications the gates can't see |
| Code / ops | B- | Disciplined, but one systemic blind spot shipped an empty data artifact for 5+ weeks |
| X / distribution | C+ | Safety architecture A-grade; the actual grow-loop (friction, timing, feedback) under-served |

**Overall: the site would not survive the eve moment today.** Her audience would hit a slow page, a signup that silently goes nowhere, and (if they set no target) a "$100,000" alert within 24h whose unsubscribe button doesn't work.

---

## The five headline discoveries (things nobody knew)

### 1. 🔴 The baked snapshot has had ZERO prices for every card since ≥May 30
`scripts/bake-card-metadata.ts:76-113` carries its own stale duplicate of `parseCard` that captures only 8 fields — no `tcgplayer.prices`. Every snapshot ever committed (May 30, Jun 25, Jul 1) is price-empty for 100% of cards. Consequences: the JSON-LD `AggregateOffer` on card pages has been rendering from nothing on every fallback; **Part B of the paused perf goal ("re-bake so the fallback has real prices") would silently no-op**; and fixing it naively by reusing `sdk.ts::parseCard` would clobber all 1,189 cards' PokeTrace `variants` (sdk parser sets `variants: []`; the overlay spread would wipe them). Why it never surfaced: `tsconfig.json` excludes `scripts/`, so the closure-gate typecheck never sees it. This is the second writer/reader-drift incident (after R-015) — same class, new instance.

### 2. 🔴 The /start funnel is a black hole
- **Newsletter opt-in never reaches the list that sends.** `app/api/start/route.ts:139-151` writes only to Beehiiv — but the weekly digest sends via Resend Broadcasts from Supabase/Resend. A /start opt-in never receives an issue. (`app/actions/subscribe.ts` does the tri-store write correctly; /start doesn't use it.)
- **Zero attribution.** No UTM/src capture on /start — if eve's audience signed up tomorrow you could not prove it. The one number the whole strategy needs ("does traffic convert?") is unmeasurable on the main funnel.
- **Duplicate re-submit 500s the whole batch.** `.insert()` not upsert + UNIQUE constraint → one already-watched card rejects all 50 rows.
- **Unsubscribe on alert emails stops nothing.** `/api/unsubscribe` touches only Beehiiv — not `watchlists`, not `newsletter_subscribers`. Gmail one-click on an alert: alerts keep coming hourly. CAN-SPAM + deliverability exposure on the highest-volume email type.
- **No rate limit / no double-opt-in.** Anyone can enroll a victim's email in 50 watches → up to 50 unsolicited emails/day whose unsubscribe doesn't work. Spam-cannon + domain-reputation kill.
- **The blank-target sentinel guarantees absurd alerts.** No target → 10,000,000¢ sentinel → alert fires on any listing, email renders "you wanted ≤ $100,000.00". This is the *default* /start behavior.
- **Alert prices are asking prices, can be live auction bids.** eBay Browse call has no `FIXED_PRICE`/location filter — a 3-days-left auction at $6 is a "verified" $6 price. Root cause of the Charizard-VSTAR-$6 alert.

### 3. 🔴 Live content contains fabrications a collector spots on sight
- **sv3a Raging Surf post is substantially fabricated**: claims a 92-card set (it's 62, secrets numbered /062), invents "SIR" rarities for a Japanese set (SAR), cites Mela/Crispin cards that aren't in the set, hangs a price table off fake collector numbers — while lecturing readers that "the collector number is the only reliable identification method." Verified against TCG Collector/TCGplayer live.
- **Moonbreon contradicts itself 12x across three live posts**: $2,100 raw NM (corrected post) vs $180 NM / $310–380 PSA 10 (two sibling posts still carrying hallucinated figures).
- **Why the gates missed it**: the 8+5 gates check structure and Foil-claim provenance only — no gate checks external facts against the 1,840-card SDK catalog *sitting in the repo*. Proposed: entity-grounding gate (card name↔set↔number must resolve in the baked catalog — zero network, would have blocked sv3a outright), price-sanity gate (0.4–2.5x band vs catalog price), cross-post consistency gate.
- **Deals page first-click failure**: "Raichu 23% below sold" resolves to a $19.95 *Ungraded-Poor* listing ~0% below the quoted sold price — on the page that promises condition-matched verification. Also the flagship $30,100 PSA 10 unlimited Base Charizard comp almost certainly mixes shadowless/1st-ed sales.
- **Editorial newsletter gates have three mechanical bypasses**: %-figures and sale counts aren't traced (only $-prefixed), a hallucinated cardName passes every gate, and the causal-hedge check is whole-body not per-sentence.

### 4. 🔴 The catalog expansion did NOT fix the "obscure movers" problem
Three independent blockers keep all 650 new cards out of the mover pool: `market-movers.ts:286` requires PokeTrace variants (new cards have none by design); the cron universe filter excludes tier "longtail" unless the set is in `MODERN_MOVER_SET_IDS`; and the 460-card daily momentum cap can't hold 1,840. The expansion was a prerequisite, not the fix — the wiring goal remains. **And the whole movers signal dies ~Jul 15 without the PokeTrace renewal** — newsletter WHY/CALL, engagement briefs, /deals all degrade to empty.

### 5. 🔴 SEO: the crawl invitation went out before the pages could answer
- Sequencing error: 650 pages at 32–52s TTFB pushed to a crawl-throttled domain, then the sitemap resubmitted — inviting Googlebot to spend its ration on pages that time out, teaching it to throttle harder. **Urgency: days, not weeks** — the refetch wave is starting now.
- **The cache hierarchy is inverted** (the structural mistake): the primary SEO surface fetches live pokemontcg.io *first* and uses the same-day, repo-committed baked snapshot only as a *failure fallback* (`sdk.ts:246-263`), with no timeout on any attempt. Baked-first + 2–3s abort on residual live fetches = sub-second TTFB on all 1,840 pages.
- **Sitemap omits the 159 prerendered set pages + the /cards hub** — the only fast card surfaces, exactly what a throttled crawler should be fed. And `lastmod` is fabricated (`now` on every deploy for all 1,840 URLs), destroying Google's prioritization signal.
- Also: double-brand title bug ("… · Foil | Foil") on every page; `twitter:title` ≠ `og:title` on card pages; canonical fallback drift (www vs non-www between page.tsx and layout.tsx).

---

## Secondary findings (fix-later 🟡 unless noted)

**Homepage/nav**: hero is negative + push-model ("Stop guessing what your cards are worth… emails you the best deals"); /start absent from nav, third tertiary text link on the page. The reposition goal already covers this — it's correctly scoped, just sequenced behind the funnel fixes. "Host a machine" in main nav confuses collectors → footer.

**Blog autonomy drift** (🔴-adjacent): newest live collector post Jun 11; the Jun 25 autonomous post landed in `_pending/` — AUTO_PUBLISH is effectively OFF in behavior despite docs saying ON. Reconcile the repo variable vs reality. Old posts still carry "Try the scanner → /upload" CTAs that bounce cold visitors to /login, and the seo-strategy template still mandates the scanner embed; 2 unshipped topics would reintroduce scanner positioning. Vending posts dominate the recent blog index (3 of 6) — a collector sees a vending blog; the Napa city post is near-verbatim duplication (doorway-page SEO risk).

**X/distribution**: bare "umbreon ex"/eeveelution aliases in `card-resolver.ts:69-89` map to the Prismatic SIR on a false "one printing" premise — the catalog now has same-name regular arts ($5 card gets the four-figure quote; a test *pins the wrong behavior*). Discord "Post" flow is 4–5 steps (copy→link→find→paste→post) — replace with a pre-filled `x.com/intent/post?in_reply_to=…&text=…` link: one tap, human-send firewall intact. Engagement cron runs 1×/day at 15:30 but freshness decays in hours — run 2–3×/day. The "views" leg of ranking is dead code (impressions are author-only). No format-mining graduation criterion exists anywhere — proposed: ≥10 approved previews at ≥70% approval + first 5 posted beating baseline median in `x_post_metrics`. Verify the @FoilTCG bio link actually carries the UTM params (30-second check — it's the entire reply→signup attribution thread).

**Ops**: RISKS.md missing rows for the render-blocks-on-pokemontcg.io class, the Jul-15 PokeTrace SPOF, and the empty-prices incident; R-004 (Vercel trial) long stale. ENV-VARS registry missing `PRICECHARTING_API_KEY` + `STRIPE_PRO_PRICE_ID`. Three Vercel crons (deals-refresh, market-movers, x-metrics) fail silently — route through `#errors`. `/start` partial failures (Beehiiv down) are silent. blog→newsletter `draft-generator` is vestigial — runs on every publish, produces artifacts nobody consumes; skip or repoint. 59 flat files in docs/goals — archive shipped ones. 18 skipped tests are all env-gated live-API tests, not rot 🟢.

**Genuinely good (don't touch)**: verified-listing resolver (no-alert-beats-wrong-alert), single affiliate boundary + customid taxonomy, deterministic digest fallback (fabrication-proof by construction), Resend unsubscribe webhook (Svix-verified, idempotent), internal link architecture (hub→set→leaf depth 3, no orphans), zero-X-write firewall + sold-data-only gates on engagement briefs.

---

## Queued-goal verdicts

| Goal | Verdict | Required amendments |
|---|---|---|
| `card-page-perf-regression` (paused) | **AMEND — do not resume as-is** | Part A ✅ but specify 2.5–3s AbortController/attempt, ~5s render budget (copy the bake script's own pattern). Part B is built on a false premise (snapshot never had prices): first fix the bake parser (import sdk parseCard, *exclude* `variants` + baked-only fields from the overlay), add an invariant test ("baked curated card has ≥1 price variant"), then FULL re-bake (--only-missing won't work). Add: baked-first render as the durable fix (kills the class); check the double `getCardMetadata` call per request; fold in sitemap hygiene (add /cards + 159 set pages, real lastmod). |
| `watchlist-alert-quality-overhaul` | **AMEND** | (1) Kill/redefine the $10M sentinel (blank target → "≥15% under 30-day sold avg"), never render it. (2) Add `FIXED_PRICE` + US-location filters to the Browse call. (3) Commit to state-transition + hysteresis re-arm (below→above→below) with 30-day sold avg as reference floor — no "either/or" language. (4) Specify first-observation semantics (already-below at first scan: honest "already below your target" copy, not "just dropped"). (5) Write `last_seen_price` every scan, not only on alert. (6) Add the sold-comp evidence line to the email ("30-day avg sold $92 — 18% under"). (7) Sibling P0 in same goal: `/api/unsubscribe` must stop alerts. |
| `homepage-reposition-watchlist` | **Resume as-is** | Just add: /start into the main nav. |
| `content-engine-market-card-upgrade` | **AMEND** | Premise check must verify value-rank's data source (if it reads baked `tcgplayerPrices`, it's ranking on nothing until the bake fix lands). Also note the mover-pool wiring gap (filter + variants + cap) as the real unblock. |
| `trust-hardening-currency-and-affiliate` | **AMEND — strip Bug 1** | Currency guard is owned by the alert overhaul (double-implementation conflict). Keep the affiliate render-guard half; add a loud-fail requirement (missing `EBAY_CAMPAIGN_ID` should page `#errors`, not silently drop copy = silent 100% revenue loss); pin the alert-email claim guard specifically. |

## NEW goals the audit surfaced (didn't exist)

1. **`start-funnel-integrity`** — the tri-store black hole (`recordSubscriber` from /api/start), UTM/src capture on StartPageForm + watchlists insert, upsert not insert, Discord #errors on soft-fail, per-email cap/rate limit (or double-opt-in). *This is co-#1 with perf — without it, driving ANY traffic is wasted because conversions neither register nor attribute.*
2. **`content-trust-hotfix`** — unpublish/regenerate sv3a, fix the two stale Moonbreon posts, sweep scanner CTAs from old post bodies + the seo-strategy template, fix the deals condition-mapping/staleness (re-verify at render + "verified Xh ago" stamp), audit the $30,100 PSA 10 comp. Then: entity-grounding + price-sanity + cross-post gates on the engine.
3. **`x-friction-and-aliases`** (small) — intent-link Post button, kill bare eeveelution aliases (+ fix the test pinning wrong behavior), cron 2–3×/day, verify bio UTM.

## Recommended resequenced queue

1. **Amended perf goal** (A + bake-parser fix + full re-bake + baked-first + sitemap adds) — GSC refetch wave makes this days-urgent; it also un-blocks JSON-LD prices and value-rank.
2. **`start-funnel-integrity`** — the conversion counter must work before any traffic push.
3. **Amended alert overhaul** (incl. unsubscribe fix) — the product promise must be true.
4. **`content-trust-hotfix`** — the fabricated post is a live moat breach; cheap, mostly manual.
5. **Homepage reposition** (as-is + nav) — now the funnel behind it works.
6. **eve** — only after 1–5. Sending her audience today converts nobody and burns the one warm lead.
7. Later: market-card upgrade (amended), trust-hardening remainder, x-friction goal, ops sweep (RISKS/ENV-VARS/cron alerting).

## Decisions John owns

- **PokeTrace renewal (~Jul 15)** — movers, newsletter WHY, engagement briefs, /deals all degrade to empty without it. This is now a dated business decision, not a watch item.
- **AUTO_PUBLISH reconciliation** — docs say ON, behavior says drafts land in `_pending`. Pick one and make reality match.
- **Vending track visibility** — keep the dual track, but decide whether vending posts stay in the collector-facing blog index.
