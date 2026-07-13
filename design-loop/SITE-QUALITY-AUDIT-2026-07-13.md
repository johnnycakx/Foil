# Site Quality Audit — 2026-07-13 (Fable, full prod walk in rendered Chrome)

John's verdict after his own walk: "not even close to being able to start working on ads." This audit is the evidence and the measurement system behind that verdict. Walked: `/`, `/start` (with real interactions: sleeve tap, fan open, type-path, live search queries), `/pro`, `/deals` (rendered + fetched). Desktop ~1100px; mobile spot-read via fetch (the repo's 390 harness remains the mobile source of truth — the extension window refused the 390 resize, same blocker as cycle 1/2).

## The framework: the Foil Quality Bar

Fused from four researched frameworks, weighted for a conversion-stage consumer product:
- **LIFT model** (WiderFunnel/Conversion.com — value proposition, clarity, relevance, distraction, urgency, anxiety) for the conversion surfaces.
- **Nielsen's 10 heuristics** for interaction quality (visibility of status, match to real world, error recovery).
- **Google HEART** (happiness, engagement, adoption, retention, task success) for product-level outcomes.
- **Trust/credibility** (Baymard-style: freshness, proof, no broken promises) — weighted heaviest because Foil's entire brand line is "Foil doesn't guess prices. It reads real sales." A single broken promise on a data product is fatal in a way it isn't for a content site.

Six axes, 0–10 each. **Ads gate: every axis ≥7 AND zero open P0s.** Score honestly, re-score after each fix goal, and the axis scores live in this file's history.

| Axis | What it measures | Today |
|---|---|---|
| 1. Promise integrity | Every claim the site makes, tested against the live product | **2** |
| 2. Task success | A stranger completes the core job (watch a specific card) without confusion | **3** |
| 3. Performance & stability | Main-thread health under real interaction, not just Lighthouse | **2** |
| 4. Design craft & composition | Hierarchy, register, the "place not form" bar (ADR-115) | **5** |
| 5. Proof & trust surface | Live data freshness, social proof, inspectable evidence | **3** |
| 6. Conversion architecture | CTA clarity, tier story, friction ordering | **6** |

**Overall: 3.5/10. The ads gate needs ≥7 across the board. John's read was correct.**

---

## P0s (each one alone blocks ads)

### P0-1 · "moonbreon" — the query the homepage TEACHES — fails live
The homepage "How the chase works" step 01 literally demos `moonbreon → Umbreon VMAX alt art · Evolving Skies` and says "Foil knows every printing." Typed exactly that into the live /start search: **"Foil doesn't recognize that one yet. Try the full card name, or add the set name."** The single most likely first query from anyone who read the homepage — the product's flagship example — is a dead end. This is a promise-integrity kill: on a "we read real data" product, the first interaction proving the marketing wrong ends the relationship. Fix = nickname/alias resolution layer (moonbreon, zard, base zard, tina, giratina alt, etc. — the community vocabulary IS the register rule) + the search-fail state must never be a dead end (see P0-4).

### P0-2 · /start froze the renderer twice during a normal walk
Desktop Chrome, prod: (a) clicking an empty sleeve → viewport black, header displaced, renderer unresponsive ~7s before the fan tray painted; (b) a later interaction froze the tab hard enough that a CDP screenshot timed out at 30s. Whatever the cause (fan mount thrash, petal/shimmer animation loops, image decode storms), a marketing page that locks the main thread is a bounce machine and would burn ad spend invisibly — analytics can't even record what the user saw. The 390 puppeteer harness and Lighthouse (92 perf) did NOT catch this because neither drives mid-interaction on a loaded desktop profile. Fix = profile the sleeve-tap and type paths (React Profiler + Performance trace), cap animation work at rest, and add a long-task assertion to the harness.

### P0-3 · The daily data pipeline looks DEAD since July 11
/deals is stamped "July 11, 2026" on a board promising "refreshed daily" — walked on July 13. The market-temperature stat (due after "the next 09:00 UTC movers run") is absent, consistent with the movers cron not having run since the 11th. On the axis the brand lives on (fresh real data), the flagship free surface is visibly stale. Investigate the movers/deals cron: failure, silent soft-fail, or PokeTrace credit exhaustion (renewal is ~Jul 15 — if the key lapsed early, EVERYTHING soft-fails to empty exactly like this). Fix = root-cause + a freshness alarm: a board older than 26h pings #errors; the page itself should say "last refreshed" honestly.

### P0-4 · Search latency + dead-end failure state
"umbreon vmax" sat on "Searching…" 4+ seconds without a result. Suggestion latency on the ONLY input that matters is conversion friction of the worst kind. And when search fails it offers nothing: no near-matches, no "post it to @FoilTCG" loop (the homepage HAS this mechanic), no request-tracking capture (the exact IDEAS.md entry banked from round 2 — this walk is its proof of value). Fix = latency budget (<600ms perceived, optimistic UI), near-miss suggestions, and the fail state converts into a request ("Foil will hunt this one down and email you when it has data").

## Majors

- **M-1 · Homepage hero renders five EMPTY black rectangles at first paint.** The grail-card carousel fades in late; the first thing a visitor (or ad-clicker) sees is blank card frames on black. The hero object must be present at first paint (priority-load the first card, stagger the rest).
- **M-2 · /start IA is inverted.** The core job — "I know exactly which card I'm chasing" — is demoted to a small underlined text link ("know the exact card? type it") BELOW a fan of most-traded cards. The homepage's step 01 is "type a name." Search-first, fan-as-fallback. Flip the hierarchy: the type-it input should be visible without any click, the fan is the "not sure where to start" path.
- **M-3 · The picker teleports you.** Tapping sleeve 2 (top of grid) opens the chooser tray at the BOTTOM of the page — auto-scroll, header lost, and the transition renders as a black flash. The choice should happen at or beside the sleeve you touched (popover/inline), not in a distant tray.
- **M-4 · Desktop /start abandons the "place" premise.** At ≥1100px the binder is a narrow centered strip adrift in black; no desk, no lamp pool, no scene — 8 near-black empty sleeves and a big gray disabled button read as an unfinished form, which is exactly the pre-ADR-115 state the redesign was meant to kill. Desktop needs its own composition (desk surface, side placement of pack/note, sleeves with visible texture at rest).
- **M-5 · Proof surfaces are thin everywhere.** /deals live-listings section: TWO deals ("That's the whole board today"). No testimonials, no subscriber count, no inspectable sample alert email anywhere on the funnel. For a product whose pitch is evidence, the funnel itself carries almost none. Cheap wins: a permanent /alert-sample page (the real Moonbreon specimen from V6.5), digest subscriber count once it clears ~100, the X thread embeds.
- **M-6 · Naming drift across the funnel.** Nav says "Your vault," /start's title says "Fill your binder," the H1 says "page," homepage says "vault" — three names for one object in one click path. Pick "binder" (it matches the scene) and sweep.

## Minors (sweep-level)
- "Fill a sleeve to start" disabled state is a giant gray slab — reads dead, not waiting; restyle as quiet until armed.
- Sticky-note email shows the raw signed-in address with no way to change it inline (edge: shared/old alias — John himself is signed in as +smoke2).
- Petals on / feel decorative-only at desktop; they never interact with anything (contrast the Bao reference: ambient life reacts to you).
- The homepage "How the chase works" mock and /start's real UI don't match visually (mock shows a search box first — which is also the correct IA, see M-2).
- Register: /pro holds the two-voice rule well; /start's "tell Foil your grail" whisper is good; homepage fine. No new violations spotted.

## What's genuinely good (don't regress it)
/pro (V6.5) is the strongest surface on the site: honest $0-due trial framing, the free-vs-Pro table with true mechanics, the Card Ladder $20 anchor, FAQ with real answers. The alert mock on / with real Moonbreon numbers is compelling. The affiliate-disclosure line on /deals is clean and honest. The registered voice is consistent. The one-email promise ("No feed to check") is a real differentiator — it just needs the product underneath to keep it.

## The Collectr test (John's standing frame, 2026-07-13)

**"Would someone use foiltcg.com over the Collectr app? If not, keep going."** Collectr (getcollectr.com): 2M+ collectors, 1M+ product catalog, scan any card → exact set/number/variant identified instantly → live portfolio value, trends, gains/losses on screen immediately. That's the bar for "knows every card" and "instant payoff."

Honest answer today: **no.** Collectr delivers rich personal value in the first 30 seconds; Foil delivers a form and a promise of a future email — and its typed search fails on a nickname Collectr's scanner would resolve from a photo. What Foil has that Collectr doesn't: **buyer-side deal alerts judged against real sold data, and live-listing hunting.** Collectr tells you what your collection is worth; Foil finds you the card you don't own yet at a price worth paying. That wedge is real — but it's invisible at the moment of first use.

The product consequence (this is the biggest finding in the audit): **the binder must pay off ON SCREEN, immediately.** The instant a card seats, its pocket should show the live market brain working — what it really sells for, today's best live listing, how far from your number. "Your binder, with a market brain" is the homepage's exact promise; today the brain only ever manifests as a future email. Seat card → see the market → THEN the email is the ongoing service. That single change converts /start from a lead-capture form into a product demo, and it's the answer to "why this over Collectr" a visitor can feel in 10 seconds.

## Scoring history
- **2026-07-13 (this audit): 2 / 3 / 2 / 5 / 3 / 6 — overall 3.5. Ads: NO.**

Next re-score: after `docs/goals/quality-bar-fixes.md` closes.
