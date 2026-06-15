# Foil SEO Strategy — Topic Clusters (vending host-acquisition + local SEO)

**Owner:** John Craig
**Last reviewed:** 2026-06-15
**Status:** Living doc — update when shipping any new pillar or cluster post.

> **2026-06-15 reframe (ADR-062 / docs/vending Goal C):** the content engine was repointed from
> deal-finder/collector topics (which drew the WRONG audience — "near mint vs lightly played,"
> "venusaur ex") to **vending HOST-acquisition + local SEO**. The reader is now a Bay-Area business or
> location owner deciding whether to host a Pokémon card vending machine, NOT a card collector. The old
> three collector pillars (Japanese cards, valuation, conditions) are retired from the backlog; the live
> deal-finder blog posts stay in-tree but dormant (noindexed). The autonomous Mon/Thu schedule stays
> disabled and `AUTO_PUBLISH_WEEKLY_POSTS=false` — drafts route to `_pending/` for John's review until he
> re-enables cadence. Source of truth for copy/voice/honesty: `docs/vending/01-HOST-LOCATION-OFFER.md`,
> `docs/vending/02-WEBSITE-REPURPOSE-PLAN.md §4`, `docs/vending/04-LOCAL-SEO-AND-TOOLS.md`.

Foil's SEO bet is topic clusters: a small number of authoritative **pillar pages** each surrounded by
deeply linked **cluster posts** that target long-tail variants of the pillar intent. Cluster posts link up
to their pillar; the pillar links down to its cluster posts. For the vending business the bet has two
halves: (1) **host-acquisition intent** — owners researching "is a vending machine worth it for my [venue]"
and "free vending machine placement" — funneled to `/host`; and (2) **local intent** — owners searching
"[Bay-Area city] vending machine placement / company" — funneled to the matching `/service-areas/[city]`
page. Local SEO is central here: Foil is a service-area business across the Bay Area (doc 04).

Every cluster post must obey the honesty guardrails (doc 02 §6): no earnings guarantees, no published
revenue-share percentage, no "fully insured"/liability claim, no fabricated scale/locations/testimonials.
The quality gates (lib/seo/quality-gates.ts) enforce the structural half of this automatically.

---

## Pillar 1 — Hosting a Pokémon Card Vending Machine

**URL:** `/host`
**Primary keyword:** *host a pokemon card vending machine*
**Status:** `/host` pitch page live (vending Goal A). Cluster build-out begins with this reframe.
**Why this pillar:** Host-acquisition is the conversion event. These posts answer the owner's real
questions ("is this worth it for a place like mine," "what does it cost me," "how does it work") and route
high-intent traffic straight to the `/host` lead form. Most queries here have low competition and clear
commercial intent.

### Cluster posts (target 8–12)

1. **Is a trading card vending machine worth it for a gas station?** — venue-specific ROI post, the highest-intent gas-station angle. Long-tail: *vending machine for gas station, trading card vending machine gas station.*
2. **Is a Pokémon card vending machine worth it for a bar or brewery?** — venue-specific, the bars/breweries angle. Long-tail: *vending machine for a bar, pokemon vending machine in a bar.*
3. **Should an arcade or barcade add a Pokémon card vending machine?** — venue-specific, arcades/entertainment. Long-tail: *vending machine for an arcade, trading card machine arcade.*
4. **Does a barbershop or salon make money hosting a vending machine?** — venue-specific, barbershops/salons. Long-tail: *vending machine for a barbershop, barbershop side income.*
5. **How vending machine revenue-share hosting works** — explainer of the host model end to end. Long-tail: *vending machine revenue share, how vending machine hosting works.*
6. **Passive income ideas for small business owners in 2026** — broad-intent topic post; positions hosting as one low-effort option without promising earnings. Long-tail: *passive income for small business owners, passive income ideas small business.*
7. **The best businesses for a vending machine placement** — listicle mapping venue types to fit. Long-tail: *best businesses for a vending machine, best places for vending machines.*
8. **What does it cost to host a vending machine? (Spoiler: nothing)** — cost-objection post; footprint + ~$4/mo power, no purchase or lease. Long-tail: *cost to host a vending machine, free vending machine placement.*
9. **Free vending machine placement: how "we handle everything" actually works** — operations explainer for the fully-managed model. Long-tail: *free vending machine placement, fully managed vending machine.*
10. **Who actually buys from a Pokémon card vending machine?** — counters the "I don't get kids in here" objection with the adult-buyer reality. Long-tail: *who buys pokemon cards, pokemon vending machine customers.*
11. **Vending machine placement companies: how the host relationship works** — category explainer + how to evaluate an operator. Long-tail: *vending machine placement company, vending machine placement services.*
12. **How much space does a Pokémon card vending machine need?** — footprint/format post (wall, pedestal, freestanding; ~3 to 4 sq ft). Long-tail: *vending machine size for a store, how much space for a vending machine.*

---

## Pillar 2 — Bay Area Vending Machine Placement

**URL:** `/service-areas`
**Primary keyword:** *bay area vending machine placement*
**Status:** `/service-areas` hub + 8 Tier-1 city pages live (vending Goal A). Cluster posts deepen the
local graph and feed each city page.
**Why this pillar:** Local intent is where a service-area business wins. Each city post targets one
bounded geo (doc 04 §1, non-overlapping per page), references that city's real venue landscape, and links
to the matching `/service-areas/[city]` page so the site, copy, and city pages tell one geographic story.
These are NOT doorway pages — each carries genuinely local substance.

### Cluster posts (target 6–10)

1. **Pokémon card vending machine placement in Napa** — Napa-specific (downtown/First Street, tasting-room foot traffic, Soscol corridor). Long-tail: *napa vending machine placement, vending machine company napa.*
2. **Vending machine placement for Fairfield businesses** — Fairfield-specific (I-80 corridor, Solano Town Center, travel plazas). Long-tail: *fairfield vending machine placement, vending machine company fairfield.*
3. **Pokémon card vending machine placement in Vacaville** — Vacaville-specific (Premium Outlets, Nut Tree, arcades). Long-tail: *vacaville vending machine placement.*
4. **Vending machine placement in Vallejo** — Vallejo-specific (Georgia Street downtown, waterfront, smoke shops/barbershops). Long-tail: *vallejo vending machine placement.*
5. **Pokémon card vending machine placement in Walnut Creek** — Walnut Creek-specific (Broadway Plaza, North Main, BART foot traffic). Long-tail: *walnut creek vending machine placement.*
6. **Vending machine placement in Concord** — Concord-specific (Todos Santos Plaza, Sunvalley, Monument corridor). Long-tail: *concord vending machine placement.*
7. **How to choose a Bay Area vending machine company** — buyer's-guide for owners evaluating operators; routes to the hub + `/host`. Long-tail: *bay area vending machine company, vending machine company near me.*
8. **Pokémon card vending machine placement in Benicia and Suisun City** — pairs the two smaller Solano downtowns (First Street, the Waterfront District). Long-tail: *benicia vending machine placement, suisun city vending machine.*

---

## Anchor text conventions

Consistent anchor text gives Google an unambiguous signal about which page owns which intent.
**Vary surrounding prose, not the linked phrase.**

| Link destination          | Approved anchor phrases                                                                 |
|---------------------------|-----------------------------------------------------------------------------------------|
| `/host`                   | "host a Pokémon card vending machine", "host a machine", "place a machine in your business" |
| `/faq`                    | "host FAQ", "common host questions", "questions owners ask"                              |
| `/service-areas`          | "Bay Area vending machine placement", "the cities we serve", "our Bay Area service area" |
| `/service-areas/[city]`   | "[City] vending machine placement", "vending machines for [City] businesses"             |

**Rules:**

- Cluster posts MUST link to their pillar once with the pillar's primary keyword as anchor.
- A city cluster post MUST also link to the matching `/service-areas/[city]` page (the conversion target).
- Every post links to a conversion page (`/host`, `/faq`, or a `/service-areas/[city]` page) at least once —
  the quality gate (V-link) enforces this.
- Never link to the dormant deal-finder (`/cards`, `/start`, `/deals`, `/upload`, `/newsletter`, the old
  collector pillars). A link to one of those fails the link-existence gate.
- Never use "click here", "read more", or naked URLs as anchor text. Use `TopicLink` in MDX for visual
  consistency.

---

## Cluster post template (apply to every new post)

Every cluster MDX post should:

1. Open with a 1–2 sentence answer to the post's primary keyword (the featured-snippet answer), in the
   confident-local-operator voice.
2. Within the first ~300 words, link to its pillar once using the pillar's primary keyword anchor.
3. Reference the Bay Area or a served city at least once (local relevance; quality gate V-geo).
4. Use `<Callout variant="tip">` or `<Callout variant="warning">` at least once to break up the page.
5. Include at least one link to a conversion page (`/host`, `/faq`, or a `/service-areas/[city]` page).
6. Close with a "Keep reading" section linking to 2–3 sibling clusters via `<TopicLink>`.
7. Use frontmatter: `title`, `description`, `date` (ISO), `tags` (array), `pillar` (matching the pillar URL
   slug, e.g. `host` or `service-areas`).
8. **Do NOT** use `<CardScannerEmbed>` (deal-finder component) and **do NOT** print a revenue-share
   percentage, an earnings guarantee, or an insurance/liability claim (honesty gates).

---

## Out of scope for V1 vending SEO

- Collector/deal-finder topics (card valuation, grading, Japanese-set decoding) — retired with the pivot;
  the existing posts stay noindexed and dormant.
- City pages beyond the Tier-1 home radius — expand into Tier-2 (doc 01) only as real placements give
  local proof to add. Quality over volume; Google penalizes thin duplicate city content.
- Backlink outreach — defer until at least 4–5 cluster posts per pillar are published.
- Non-Pokémon vending verticals (snacks, drinks) — Foil is the Pokémon-card category specifically.
