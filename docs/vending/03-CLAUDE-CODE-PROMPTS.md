# Foil — Claude Code Build Prompts (vending repurpose)

> Ready-to-paste goal prompts for Claude Code, sequenced per `02-WEBSITE-REPURPOSE-PLAN.md §8`.
> They assume the three context docs (`00`/`01`/`02` in `docs/vending/`) are committed so Claude
> Code can read them. Each prompt follows the repo's goal conventions (P0 premise check, read
> ROADMAP + SESSION-LOG first, closure gates, conventional commits, second-brain updates).

---

## Before pasting: fill these in

Open `docs/vending/01-HOST-LOCATION-OFFER.md` and `02-WEBSITE-REPURPOSE-PLAN.md §7`
and replace as many `[PLACEHOLDER]`s as you can (service area, lead email, revenue-share treatment,
install timeline, proof assets, entity name). The prompts will instruct Claude Code to leave any remaining
placeholders visibly marked rather than invent — but the more you fill, the better the first pass.

---

## Goal A — Repurpose the public site to vending host lead-gen (the big one)

```
/goal Repurpose the public foiltcg.com surface from the Pokémon deal-finder to the Pokémon
card vending-machine HOST lead-gen site.

FIRST: read docs/vending/00-BUSINESS-OVERVIEW.md, 01-HOST-LOCATION-OFFER.md,
02-WEBSITE-REPURPOSE-PLAN.md, and 04-LOCAL-SEO-AND-TOOLS.md in full — they are the source of
truth for content, structure, local-SEO architecture, and guardrails. Also read docs/ROADMAP.md +
docs/SESSION-LOG.md per the second-brain contract, and PRODUCT.md + DESIGN.md before any UI work.

P0 premise check first: confirm (a) the deal-finder routes are what's actually linked/indexed today,
(b) lib/notifications/resend.ts is the live email boundary, (c) lib/supabase/proxy.ts is still default-deny
with PUBLIC_ROUTES. Surface anything that contradicts the plan before building.

Scope:
1. New public surfaces (copy strictly from 01-HOST-LOCATION-OFFER.md; do NOT invent facts —
   leave any [PLACEHOLDER] visibly in place):
   - `/` homepage: vending pitch (hero + value props + how-it-works + proof + FAQ teaser + lead form CTA).
   - `/host`: long-form pitch + the lead form.
   - `/faq`: full host FAQ with FAQPage JSON-LD.
   - `/service-areas` hub + `/service-areas/[city]` unique city pages for the priority Bay-Area cities in
     01-…OFFER.md (start with ~5–8). Generate each from a structured city-data file (name, blurb, local
     venue notes, city-specific FAQ) so they are genuinely unique — NOT one template with the city name
     swapped (doorway pages; see doc 04 §1). LocalBusiness JSON-LD with areaServed on / and each
     city page. Add all new routes to PUBLIC_ROUTES + the proxy test, and to the rebuilt sitemap.
2. Lead capture (email-only): a Server Action that validates the form (business name, location type,
   city/area, contact name, email, phone optional, free-text about-the-space) and emails the lead to
   [LEAD EMAIL] via lib/notifications/resend.ts. Honeypot + basic rate-limit. No DB persistence in v1.
   Add the handler path to PUBLIC_ROUTES in lib/supabase/proxy.ts and update lib/__tests__/proxy.test.ts.
3. Make the deal-finder dormant (DO NOT delete code): remove all nav/footer/home links to it;
   add robots noindex to /cards, /cards/[slug], /cards/sets/*, /deals, /start, /pricing-methodology,
   /newsletter, /blog; rebuild app/sitemap.ts (+ lib/seo/sitemap-landings.ts) to contain ONLY the new
   vending routes.
4. Disable scheduled jobs so they stop firing against the dead product: remove/guard the Vercel crons
   wishlist-alerts, deals-refresh, x-post in vercel.json; set AUTO_PUBLISH_WEEKLY_POSTS=false and
   neutralize the weekly-content GitHub Action schedule. Keep X_BOT_LIVE=false.
5. SEO/AEO: new title/description/OG for the 3 surfaces; LocalBusiness/Service JSON-LD on /;
   FAQPage JSON-LD on /faq and the homepage FAQ block. Self-host hero/OG images.
6. Brand: reuse the cream/navy/gold system unless it fights the new audience; extend
   visual-regression.test.ts guards to the new surfaces.

Honesty guardrails (hard): no earnings guarantees, no fabricated scale/locations/testimonials, no AI
photos-as-real, no install-timeline promise we can't keep. Unconfirmed facts ship as visible
[PLACEHOLDER], never invented. (See 02-…PLAN.md §6.)

Closure gates (per CLAUDE.md): npm test green, npx tsc --noEmit clean, npm run build clean,
npm run design:lint no new failures, /security-review with no High findings (the new lead-form input +
email send is the area to scrutinize — injection, header-injection in the Resend payload, open-redirect,
PII handling). Update docs/SESSION-LOG.md + docs/ROADMAP.md, add an ADR for the pivot
(supersede/relate ADR-020), and update docs/ENV-VARS.md if any env var changes. Conventional
commit prefixes only.
```

---

## Goal B — Proof + polish pass (after John provides assets)

```
/goal Polish the vending host site with real proof assets and finalize placeholders.

Read docs/vending/01- and 02- first. Replace the remaining [PLACEHOLDER]s with John's confirmed
values (service area, revenue-share treatment, install timeline, entity name, contact). Add the real
machine photos (self-hosted in public/), wire OG/twitter images, add any testimonial. Design-quality
pass with the impeccable skill (critique → polish) against PRODUCT.md/DESIGN.md. Keep all honesty
guardrails. Closure gates as in Goal A.
```

---

## Goal C — Content engine reframe to vending/local SEO (optional, later)

```
/goal Repoint the autonomous content engine from deal-finder topics to vending host-acquisition +
local SEO topics.

Read docs/vending/02-…PLAN.md §4 first. Rewrite SYSTEM_PROMPT in lib/seo/content-engine.ts for
host-acquisition intent (audience = business/location owners) and replace the topic backlog in
docs/seo-strategy.md with host-acquisition + local-SEO clusters ("is a card vending machine worth it
for a [business type]", "how vending revenue share works", "[city] vending placement"). Per the repo
hard rule for prompt changes: regenerate one post via the changed pipeline routed to _pending
(AUTO_PUBLISH_WEEKLY_POSTS=false) and report the concrete before/after delta in SESSION-LOG.
Only then re-enable the Mon/Thu schedule. Keep all 10 quality gates; adjust gate semantics that
assumed deal-finder/Foil-scan data. Closure gates as usual.
```

---

## Goal D — Scout / referral program page (optional)

```
/goal Add a public "Refer a location / partner with us" page for the commission-based scout program.

Read docs/vending/00-BUSINESS-OVERVIEW.md "scout/connector program" section. Build /refer with the
program explanation (warm-intro model; comp framing per John — do NOT publish exact $ figures unless
John confirms) and a referral lead form reusing the Goal A Resend pattern (separate subject tag
"New scout/referral"). Add /refer to PUBLIC_ROUTES + proxy test. Closure gates as usual.
```

---

## Notes for whoever runs these

- The deal-finder's open work (the pending "collection" prefilter fix, Tranche B, X-bot go-live) is now
  **moot for the public product** but the code/tests remain. Don't spend cycles finishing deal-finder
  work unless John decides to revive or sell that surface.
- Keep commits small and conventional. The pivot itself warrants a dedicated ADR that relates to
  ADR-020 (the original deal-finder pivot) and supersedes the public-product framing.
```
