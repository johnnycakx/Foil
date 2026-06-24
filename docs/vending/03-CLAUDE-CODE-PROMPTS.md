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

## Goal B — Post-launch polish pass (must-fixes from the 2026-06-13 live review)

> Goal A shipped + deployed (commit 808eeae, live on foiltcg.com). A live review found 3 must-fix items
> + visuals. This goal addresses them. John's decisions baked in: **take the revenue-share % OFF the
> public pages** (quote on a call instead); insurance stays unclaimed until real.

```
/goal Post-launch polish of the live vending host site. Read docs/vending/01-HOST-LOCATION-OFFER.md
and 02-WEBSITE-REPURPOSE-PLAN.md first (honesty guardrails in 02 §6 are binding). Also read
PRODUCT.md + DESIGN.md before UI work, and ROADMAP.md + SESSION-LOG.md per the contract.

Fixes (all surfaced by the live review):

1. REMOVE the published revenue-share percentage everywhere it appears (homepage, /host, and every
   /service-areas/[city] page). Do NOT print "10-15%", "gross", or "net". Replace with value-add framing
   + "we'll walk through the revenue share on a quick call." Reason: the playbook split is % of NET (the
   live copy wrongly said "gross"), and keeping the number off the page preserves negotiating room.

2. STOP rendering internal [PLACEHOLDER...] notes on public pages — especially the two insurance/
   liability answers on /faq. Reword each to the honest statement that stands on its own ("it's our
   equipment and our responsibility to operate and keep running") and DELETE the visible bracket text.
   Do NOT claim the machine is "fully insured" or that damage/theft is "fully covered" until John confirms
   coverage (track that as a non-rendering code comment or a docs note, not on-page). Grep the whole
   app/ tree for "[PLACEHOLDER" and ensure none renders in any public route.

3. REGENERATE the social-share images for the vending brand. The OG + Twitter images (and the
   twitter:image:alt "Foil — the best price on any Pokémon card") are leftover deal-finder assets. Update
   app/opengraph-image, app/twitter-image (+ any per-route variants) and all OG/twitter metadata so a
   shared foiltcg.com link previews as the vending host pitch, not the deal-finder.

4. SOFTEN overstated presence: change "We operate across 8+ Bay Area cities" (and similar) to "serve"
   / "placing machines across" — no machines are live yet, so don't imply an active multi-city footprint.

5b. EMAIL: point the host-lead notification recipient AND the form reply-to at john@foiltcg.com (John's
   new Google Workspace mailbox) instead of john.c.craig24@gmail.com — ONLY if John has confirmed the
   mailbox is live and receiving; otherwise leave the gmail recipient and flag it as a one-line follow-up.
   Keep sending via the existing Resend boundary; do not touch SPF/DNS from code.

5. ADD real machine visuals. Four optimized photos are already in public/vending/:
   machine-tower-1.webp, machine-tower-2.webp (freestanding tower units), machine-wall-1.webp,
   machine-wall-2.webp (wall units) — all 1200x1600 portrait, real unbranded VTM machines in venues.
   Wire them in: a hero image on /, a product/how-it-works shot, and images on /host and the city pages.
   CAPTION THEM NEUTRALLY as the machine model ("our touchscreen card machine," "the freestanding
   tower," etc.) — do NOT name any venue, do NOT claim these are Foil's own installs/locations, and do
   NOT add partnership/network/scale claims (John's preference: don't draw attention to the partnership).
   They are product imagery, full stop. Self-host only. Portrait aspect (3:4) — size/crop accordingly (e.g.,
   object-fit cover in a fixed frame). If you need a wider hero, frame one portrait shot in a device-style
   container rather than stretching it.

Keep all honesty guardrails. Closure gates (per CLAUDE.md): npm test, npx tsc --noEmit, npm run build,
npm run design:lint (no new failures), /security-review no High. Update SESSION-LOG + ROADMAP, amend
ADR-060 if needed. Conventional commits. Commit but do NOT push — deploy is John's call.
```

**Photo prerequisite (John, before/with Goal B):** Claude Code cannot pull from the Google Drive
machine-photo folder (no auth). The actual image files must be in the repo first at `public/vending/`. Easiest
path: John downloads the machine photos from the Drive folder (doc 06/01) and either drops them in
`public/vending/` or uploads them to the Cowork chat so they can be placed + optimized there. Until the
files exist, Goal B wires clean placeholders and the real images drop in when available.

---

## Goal C — Content engine reframe to vending/local SEO (refined 2026-06-13)

> Reframes the SEO content engine from collector/deal-finder topics (which were drawing the WRONG
> audience — "near mint vs lightly played," "venusaur ex") to HOST-acquisition + local SEO, so search
> momentum compounds toward business owners who'd host a machine. Two important refinements over the
> first draft: (a) the 10 quality gates were built around deal-finder data (dollar figures, Foil-scan
> stats, card citations) that don't map to vending content — they must be refactored, not just kept;
> (b) do NOT blindly re-enable twice-weekly auto-publish on a brand-new, narrow topic space — generate a
> small reviewed batch first and let John decide cadence.

```
/goal Reframe the autonomous content engine from deal-finder/collector topics to vending HOST-acquisition
+ local SEO. Read docs/vending/02-WEBSITE-REPURPOSE-PLAN.md §4, docs/vending/01-HOST-LOCATION-OFFER.md,
and docs/vending/04-LOCAL-SEO-AND-TOOLS.md first. Commit, don't push. Keep AUTO_PUBLISH_WEEKLY_POSTS=false
the whole time — this goal does NOT re-enable autonomous publishing.

1. SYSTEM_PROMPT (lib/seo/content-engine.ts): rewrite for audience = Bay Area business/location owners
   considering hosting a Pokémon card vending machine (NOT collectors). Voice = the "confident local
   operator" register (per the vending design ADR), honest, no hype. Bake in the same honesty guardrails
   as the site: no fabricated stats/locations/testimonials, no earnings guarantees, no "fully insured"
   claim, no published revenue-share %. Bias toward short, citable, locally-relevant sentences.

2. Topic backlog (docs/seo-strategy.md): replace the collector clusters with host-acquisition + local
   clusters, e.g. "is a trading-card vending machine worth it for a [gas station / bar / arcade /
   barbershop]", "how vending revenue-share hosting works", "passive income ideas for small business
   owners", "best businesses for a vending machine", "[Bay Area city] vending machine placement". Tie
   posts to internal links to /host, /faq, and the relevant /service-areas/[city] page.

3. Quality gates (lib/seo/quality-gates.ts + tests): REFACTOR the gates that assumed deal-finder data —
   the dollar-figure-count gate, the Foil-scan/Foil-data-citation gate, and the card-citation gate do not
   apply to vending content. Replace them with vending-appropriate gates (e.g. host-benefit clarity,
   a local/geo reference, an internal link to /host or a city page, banned-hype-phrase check, valid
   Article/FAQPage JSON-LD) and update the gate tests accordingly. Don't keep gates that force
   irrelevant content.

4. MEASURE (repo hard rule for prompt changes): generate 2-3 posts through the reframed pipeline routed
   to app/blog/posts/_pending/ (NOT live), and report in SESSION-LOG the concrete before/after delta
   (topic shape, gate pass/fail, honesty-guardrail adherence, voiceCheck/em-dash). Do NOT publish them or
   touch the Mon/Thu cron — John reviews the _pending drafts and decides cadence + re-enable separately.

Closure gates: npm test (updated gate tests), tsc, build, design:lint, /security-review. Update
SESSION-LOG + ROADMAP + an ADR for the content reframe. Conventional commits. Commit, do not push.
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

## Goal E — Homepage redesign + design-system evolution (added 2026-06-13, post-launch design review)

> John's live review: homepage copy is overwhelming, the whole site lacks contrast / feels bleak, and the
> hero machine photo feels awkward floating on cream. Root cause (from reading DESIGN.md): the system is
> the deal-finder's "Dealer's Quiet Backroom" register — Flat-At-Rest + Scarce-Gold + all-cream — tuned for
> quiet collector browsing, wrong for a B2B vending pitch. Fix = evolve the canon for the vending audience,
> then redesign. Keep the palette + anti-references; add contrast, depth, energy.

```
/goal Redesign the vending homepage and evolve the design system for the B2B vending audience. This is a
design + copy overhaul. Use the impeccable skill (critique → bolder → polish) and read PRODUCT.md,
DESIGN.md, and docs/vending/01-HOST-LOCATION-OFFER.md first. Commit, don't push.

PHASE 1 — Evolve the design canon (so the change sticks). Amend DESIGN.md + PRODUCT.md and add an ADR
superseding ADR-029's "quiet backroom" register FOR THE VENDING SURFACES:
- KEEP: cream/navy/gold palette, Fraunces/Geist, coral-hover-only, no-pure-black/white, and all four
  anti-references (no generic-AI-SaaS / crypto-hype / sterile-enterprise / bargain-bin).
- CHANGE: allow dark navy feature sections (cream↔navy alternation for rhythm/contrast); relax
  "Flat-At-Rest" to permit subtle resting elevation on feature cards; relax "Scarce Gold ≤10%" to let gold
  act as a structural accent (eyebrows, step numbers, key figures, rules on navy) without becoming a large
  fill. New north star for vending: "confident local operator" — energetic but not hype.

PHASE 2 — Redesign the homepage with that system:
- TRIM copy ~40%. "Why owners say yes": 6 cards → the 4 strongest. CUT the homepage "Quick answers" block
  (link to /faq instead). Tighten the hero and the "real operation" block. Shorten the on-homepage form to
  essential fields (full form stays on /host).
- ADD contrast: at least one dark navy section (e.g. "How it works" with gold step numbers, or the
  hardware/trust block on navy), real depth on feature cards, confident gold accents, a stronger hero.
- FIX the hero machine photo: place it on a dark/navy panel (dark-on-dark) and/or in a device-style frame,
  cropped tighter to the lit screen so it reads intentional, not floating on cream. Same on-dark treatment
  wherever machine photos appear. Keep the honest "product model shown" caption; product imagery only,
  never implied installs.
- REMOVE the lines admitting no locations/testimonials ("As placements go live, their locations and photos
  get listed here. We won't show you testimonials we don't have yet.") from the homepage AND /host. Do NOT
  replace with any claim of existing placements — end on the true credibility line. (docs/vending/01
  "stay silent on count" rule.)

PHASE 3 — REGENERATE the social-share images for the vending brand (app/opengraph-image + app/twitter-image
+ all og/twitter metadata + alt text; grep "best price on any" and remove).

Apply the evolved system consistently to /host, /faq, and the city pages. Update visual-regression +
design:lint guards to the new rules (don't keep stale pins that fight the redesign). Gates: tsc, npm test,
build, design:lint, /security-review. Commit, don't push, then report what changed.
```

---

## Notes for whoever runs these

- The deal-finder's open work (the pending "collection" prefilter fix, Tranche B, X-bot go-live) is now
  **moot for the public product** but the code/tests remain. Don't spend cycles finishing deal-finder
  work unless John decides to revive or sell that surface.
- Keep commits small and conventional. The pivot itself warrants a dedicated ADR that relates to
  ADR-020 (the original deal-finder pivot) and supersedes the public-product framing.
```
