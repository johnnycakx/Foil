# Foil Roadmap

**Last updated:** 2026-05-20
**Owner:** John Craig (solo)
**Cadence:** Updated at the end of every goal. See [Project Second Brain](../CLAUDE.md#project-second-brain) for the auto-maintenance contract.

The roadmap has four buckets. NOW is what's actively blocking the next ship. NEXT is the queue I'll pull from once NOW clears. LATER is committed direction but not yet scheduled. PARKED is explicitly deferred — re-check at launch + 30d.

---

## NOW — this week (≤ 2026-05-27)

| # | Item | Why it's NOW | Owner | Status |
|---|------|--------------|-------|--------|
| 1 | **GitHub Actions secrets:** set `ANTHROPIC_API_KEY`, `BRAVE_SEARCH_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | The Monday + Thursday autonomous workflow can't run without these. First scheduled fire is Mon 2026-05-25 14:03 UTC. | John (manual GitHub settings) | Pending |
| 2 | **v0.dev homepage redesign** | Current `app/page.tsx` hero is functional but plain. v0 generates a stronger hero + social-proof block for the launch surface. | John (paste output) | Pending |
| 3 | **Google Search Console:** add `foiltcg.com` property, TXT-verify, submit `/sitemap.xml` | Indexing latency is 1-4 weeks. The earlier we submit, the earlier the three pillars + blog start appearing in search. | John (Cloudflare DNS + GSC UI) | Pending |
| 4 | **Decision: keep or kill the 2 auto-generated posts** | `how-to-read-a-japanese-pokemon-card` + `near-mint-vs-lightly-played-…` shipped via the new autonomy pipeline on 2026-05-20. Both passed gates on first attempt. Read them in the live preview and decide: leave up, edit, or delete. | John (manual review) | Pending |

---

## NEXT — next 2 weeks (2026-05-28 → 2026-06-10)

| # | Item | Trigger | Notes |
|---|------|---------|-------|
| 5 | **9th quality gate: "Citable claim density"** — 8+ standalone factual statements per post | AI Overview optimization. Google's SGE pulls atomic sentences that read as standalone facts; current gates reward presence of $/dates/Foil-cites but not the citable-sentence shape. | `lib/seo/quality-gates.ts` + positive/negative test in `lib/__tests__/seo-quality-gates.test.ts`. Heuristic: count sentences ≤ 25 words that contain a named entity + a verb + a specific noun. |
| 6 | **Content engine prompt: AI Overview citation discipline** | Same trigger as gate 9. Prompt needs to bias toward short declarative sentences with named entities. | Edit `SYSTEM_PROMPT` in `lib/seo/content-engine.ts`. Add a "Citable claim" rule. |
| 7 | **Run `searchfit-seo:ai-visibility` baseline** | Once domain is GSC-verified. Establishes the "before" snapshot we'll re-measure monthly. | Document the report location in `docs/SESSION-LOG.md`. |
| 8 | **Expand `seo-strategy.md` before week-10 topic exhaustion** | Backlog currently has ~35 cluster topics. At 2/week we run out around 2026-08-19. Need to add another 10-15 cluster topics OR introduce a new pillar. | Either ask the engine to propose new topics from competitive-gap reports, or hand-curate from PokeScope's blog. |
| 9 | **Scrydex API migration** | Triggered by waitlist hitting ~50 signups OR PokeTrace rate limits biting. Scrydex has per-card endpoints we'd need for programmatic per-card landing pages. | Tracked separately in [DECISIONS.md](DECISIONS.md). |

---

## LATER — 1-3 months (2026-06-11 → 2026-08-20)

| # | Item | Why later |
|---|------|-----------|
| 10 | **Content syndication: Reddit r/PokemonTCG, Medium, Substack republish** | Owned channels first; syndication adds reach but only matters once we have ≥10 posts worth republishing. |
| 11 | **A/B test Gemini 3.1 Pro on the visual-confirm pass** | Sonnet 4.6 confirms work well; Gemini 3.1 Pro is ~8× cheaper at similar quality on side-by-side image tasks. Worth measuring once we have ≥1K confirm-pass calls of baseline data. |
| 12 | **HowTo + Product + Review schema rollout** | Pillars and posts currently emit Article + FAQPage only. Adding HowTo (for guides), Product (for the scanner), Review (for graded comps) widens SERP feature eligibility. |
| 13 | **Monthly AI Visibility tracking cadence** | Manual snapshot every month-end via searchfit-seo. Compare deltas. |
| 14 | **`scan_cards` per-card persistence table** | Currently `scans` only stores image metadata; per-card identification results live in transient `scanResults`. Persisting them unlocks accuracy diagnostics, "your scan history", and the `mostScannedCards` data-injection helper. Schema TBD. |
| 15 | **Manual spot-check OR 24-hr noindex window before autonomous posts are search-visible** | Risk mitigation for [content engine fabrication](RISKS.md#r1). Trigger: first time the gates pass something embarrassing OR sustained organic traffic begins. |
| 16 | **Vercel Pro Trial decision** | Trial expires 14 days from activation date. If we're on it, log expiry to ROADMAP NOW the day it falls within 7d. |

---

## PARKED — explicitly deferred

| Item | Reason parked | Re-check trigger |
|------|---------------|------------------|
| Google OAuth login | Needs domain whitelist + LLC formation | Post-LLC banking |
| Stripe live mode | Needs LLC banking | Post-LLC banking |
| Multi-TCG (MTG, Yu-Gi-Oh) | Distracts from Pokémon wedge | $5K MRR |
| WebSocket price streams | PokeTrace Scale tier feature | Pro waitlist > 100 |
| Sold-listings endpoint | PokeTrace Scale tier feature | Pro waitlist > 100 |
| Programmatic per-card landing pages | Blocked on Scrydex per-card API | Scrydex migration (item #9) |
| Anomaly detection beyond PokeTrace flags | Insufficient scan volume to ground heuristics | 10K scans |

---

## How to use this doc

- **Adding an item:** which bucket fits? NOW = blocking this week's ship. NEXT = queued behind NOW. LATER = direction but no week assigned. PARKED = "no, not now."
- **Removing an item:** move to a SESSION-LOG entry naming the commit that closed it. Don't silently delete — the history matters for understanding past decisions.
- **Re-prioritizing:** edit the table in place. If something moves from NEXT to NOW because external state changed, drop a `<!-- promoted from NEXT 2026-05-22 -->` comment on the row.
