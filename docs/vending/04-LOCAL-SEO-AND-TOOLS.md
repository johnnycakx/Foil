# Foil — Local SEO Strategy & Buildout Tooling (Bay Area)

> Local-SEO playbook + recommended tools/connectors for the vending host site. Researched against
> current (2026) best practice — sources at the bottom. Pairs with `02-WEBSITE-REPURPOSE-PLAN.md §4`.

> **Business type:** **Service-Area Business (SAB)** — Foil goes to the host's location, it has no public
> storefront. This shapes everything below (GBP setup, schema, page architecture).

---

## 1. The core decision: get specific, not "Bay Area"

Google needs **explicit, bounded location signals**. A single page that says "we serve the Bay Area"
ranks for almost nothing. The 2026 playbook for an SAB across many cities:

- A **service-areas hub** page listing all cities served (clarity for users + Google).
- **Unique city landing pages** for priority cities — each with genuinely distinct content. Copy-pasting one
  template and swapping the city name = **doorway pages**, which Google penalizes. Each city page needs
  local substance (neighborhoods/venue types in that city, a city-specific FAQ, local hook).
- Keep keyword targets **non-overlapping** per page (one city = one primary geo target).
- Your **site, GBP service area, and copy must tell the same geographic story** — if GBP says you serve
  San Jose but the site only vaguely says "Bay Area," Google can't connect you to local intent.

### Recommended page architecture

```
/                          → main pitch, "Bay Area" framing, primary CTA
/host                      → long-form pitch + lead form (also the ad/QR landing target)
/faq                       → host FAQ + FAQPage JSON-LD
/service-areas             → hub: all Bay Area cities served, links to each city page
/service-areas/[city]      → unique city page per priority city — START Tier 1 home-radius cities:
                              Napa, Fairfield, Vacaville, Vallejo, Walnut Creek, Concord, Benicia,
                              Suisun City (full tiered list in 01-HOST-LOCATION-OFFER.md)
```

> **Rollout is closest-first** (Napa/Fairfield/Walnut Creek corridor). This matches both local-SEO
> proximity AND the operational reality that nearby cities have the best restock economics. Full Tier 1 /
> Tier 2 (50-mile) list lives in `01-HOST-LOCATION-OFFER.md → Service area`.

**City-page content recipe (so they're NOT doorway pages):** city-specific H1 ("Pokémon Card Vending
Machines for [City] Businesses"), 2–3 paragraphs referencing that city's real venue landscape (e.g., Napa:
downtown tasting-room foot traffic + First Street shops; Fairfield: Solano Town Center, gas stations off I-80;
Vacaville: the outlets + arcades; Walnut Creek: Broadway Plaza, bars/restaurants), the same offer/value
props worded freshly, a short city-specific FAQ, internal links to `/host` + `/faq` + neighboring city pages,
and ideally one real local proof element (a photo of a machine in that city once available).

> Start with ~5–8 Tier 1 city pages, not all 40. Quality > volume. Expand into Tier 2 as real placements
> give you local proof to add.

---

## 2. Google Business Profile (the single biggest lever)

For an SAB, **GBP is the most powerful local asset** and the strongest "established" signal.

- Set it up as a **service-area business** with a **hidden address** (Foil's base) + service area defined by
  Bay-Area cities/counties. `[PLACEHOLDER: John's physical base address/city — required for GBP
  verification even though it's hidden. Proximity to base still influences ranking, so the base city matters.]`
- **Cap: 20 service areas, no bonus for filling all 20.** Prioritize the top cities or use counties (e.g.,
  San Francisco, Alameda, Santa Clara, San Mateo, Contra Costa counties) to cover more ground cleanly.
- Google recommends service area **≤ ~2-hour drive** from base — the Bay Area fits comfortably.
- Treat GBP like a feed: post updates, **self-populate the Q&A** with your common host questions
  (mirrors the site FAQ), add real machine photos.
- **Reviews are a top ranking + trust factor** — recency and volume both matter. Ask every happy host for
  a Google review. (This is the legitimate way to build the "established" proof the site can't fabricate.)

> GBP is a John task (account/verification), not a code task — but it's the highest-ROI local-SEO action
> and should be flagged in the build's follow-ups.

---

## 3. On-site technical SEO / AEO

- **Schema (JSON-LD):** use `LocalBusiness` (or a specific subtype) on `/` and each city page with
  `areaServed` listing the cities/counties; for an SAB omit `streetAddress`, keep
  `addressLocality`/`addressRegion`/`addressCountry` (the base) and use `areaServed`/`serviceArea`.
  In 2026, this schema is also a **strong signal AI search engines use** to answer "best [service] near me"
  → directly serves AEO. Add `FAQPage` JSON-LD on `/faq` + homepage FAQ. The repo already has
  JSON-LD patterns from the deal-finder — reuse them.
- **Titles/meta:** geo + intent per page ("Pokémon Card Vending Machine Placement in San Jose | Foil").
- **NAP consistency:** Name / Address (base) / Phone identical across the site, GBP, and every citation.
- **Internal linking:** city pages ↔ `/host` ↔ `/faq` ↔ neighboring cities.
- **Core Web Vitals / mobile:** owners search on phones; keep it fast (the repo is already Next.js + fast).
- **Citations/directories:** consistent NAP listings on Google, Bing Places, Apple Business Connect, Yelp,
  and relevant local/industry directories — a recognized ranking + legitimacy factor (tooling below).

---

## 4. Recommended tools, connectors & services for the buildout

### Already available in this Cowork environment (use these first)
- **`searchfit-seo` plugin** — installed; has skills for SEO audit, technical SEO, on-page SEO, schema
  generation, keyword clustering, content strategy, **AI visibility (AEO)**, internal linking, broken links.
  Use `searchfit-seo:technical-seo`, `:schema-markup`, `:on-page-seo`, `:keyword-clustering`,
  `:ai-visibility` directly against the new pages.
- **`marketing` plugin** — `marketing:seo-audit`, plus an **Ahrefs** connector (keyword/volume/difficulty
  research for the Bay-Area + host-intent queries) and SimilarWeb.
- **Canva connector** — for the machine flyers, OG images, GBP post graphics, and the on-machine ad/
  standby-screen art (the blueprint already leans on Canva).
- **`/security-review`** (claude-code-security-review) — the repo's standing closure gate; this is the
  "Semgrep-style" static-analysis/security pass on the lead-form + email code. (Semgrep itself can be
  added to CI later if you want a second scanner, but `/security-review` already covers the goal's needs.)

### External SaaS worth adding (paid)
- **Local rank tracking + citations:** **BrightLocal** (all-in-one: rank tracking, citation building/sync,
  review monitoring; ~$39–59/mo, citations ~$2–3/submission) OR **Whitespark** (best-in-class citation
  finder + accurate local rank tracker; tools sold à la carte). Either covers citations + tracking; BrightLocal
  is the simpler all-in-one.
- **Keyword/competitor research:** Ahrefs (you have the connector) or Semrush.
- **Reviews:** automate Google-review requests to hosts (BrightLocal's review tools, or a simple SMS/email
  ask). Reviews are the highest-leverage legitimate "established" proof.

### Lead handling (already in repo — no new vendor needed for v1)
- **Resend** (`lib/notifications/resend.ts`) for the lead email. Discord (`lib/notifications/discord.ts`)
  available later if John wants pings. A CRM (HubSpot connector exists in this env) is a phase-2 option if
  lead volume justifies it; email-only is fine to start.

### Analytics (add during buildout)
- **Google Analytics 4** + **Google Search Console** (GSC already verified for foiltcg.com per CLAUDE.md
  — resubmit the new sitemap there). Optionally Plausible for privacy-friendly simple analytics.

> "Semgrep" interpretation: John referenced it as an example of a useful third-party tool. For *security/
> code-quality*, the repo's `/security-review` gate is the in-place equivalent and runs every goal; adding
> Semgrep to CI is optional polish, not required. The higher-value "tools" for THIS buildout are the
> local-SEO stack above (GBP, BrightLocal/Whitespark, the searchfit-seo skills).

---

## 5. Build implications (feed into the Goal A / future prompts)

- Add `/service-areas` + `/service-areas/[city]` to the public architecture and to `PUBLIC_ROUTES`.
- Generate city pages from a small structured data file (city name, blurb, local venue notes, FAQ items)
  so each is unique but maintainable — NOT a single template with a swapped variable.
- Include all new public routes in the rebuilt `sitemap.ts`; submit to GSC.
- `LocalBusiness` + `FAQPage` JSON-LD as above.
- Flag GBP setup + review-collection + citation building as **John/owner follow-ups** (not code).

---

## Sources
- [The Real Playbook for Multi-Location Local SEO in 2026 — Entrepreneur](https://www.entrepreneur.com/growing-a-business/the-real-playbook-for-multi-location-local-seo-in-2026/502959)
- [Local Landing Pages: Complete Guide 2026 — Arc4](https://arc4.com/local-landing-pages/)
- [Service area pages — Search Engine Land](https://searchengineland.com/guide/service-area-pages)
- [Local SEO City Landing Pages — Sangfroid Web Design](https://www.sangfroidwebdesign.com/local-seo/city-pages/)
- [Service Area Business: Google Business Profile Guide 2026 — RankAI](https://rankai.ai/articles/service-area-business-google-business-profile-guide)
- [How To Rank a Service Area Business in Multiple Cities — Datapins](https://www.datapins.com/seo-for-multiple-cities/)
- [Does the Service Area in GBP Impact Ranking? — Sterling Sky](https://www.sterlingsky.ca/does-the-service-area-in-google-my-business-impact-ranking/)
- [LocalBusiness JSON-LD: Maps, GBP & Local Pack (2026) — SchemaValidator](https://schemavalidator.org/guides/local-business-schema-guide)
- [Local Business Schema Markup: JSON-LD Guide 2026 — Gatilab](https://gatilab.com/local-business-schema-markup/)
- [Best Local SEO Tools for Small Businesses 2026 — Optuno](https://www.optuno.com/blog/local-seo-tools)
- [BrightLocal vs. Whitespark — SearchAtlas](https://searchatlas.com/blog/brightlocal-vs-whitespark/)
- [Whitespark — Local SEO Tools & Citation Services](https://whitespark.ca/)
