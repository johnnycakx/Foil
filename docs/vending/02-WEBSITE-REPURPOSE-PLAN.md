# Foil — Website Repurpose Plan (deal-finder → vending host lead-gen)

> Technical plan for turning `foiltcg.com` into a B2B landing site for the Pokémon card vending
> placement business. Written against the existing repo (Next.js 16 App Router, Tailwind 4,
> Supabase auth proxy, Resend, the `app/(site)/` group). Content source: `01-HOST-LOCATION-OFFER.md`.
> Business context: `00-BUSINESS-OVERVIEW.md`.

> **Decision (John, 2026-06-13):** repurpose the public site **in its entirety** to vending. Deal-finder
> code stays in-tree but **dormant** (not deleted) — unlinked, de-indexed, scheduled jobs disabled.
> Lead capture is **email-only via Resend** for now.

---

## 1. Public site architecture (new)

Keep it tight — a lead-gen site, not a catalog. Target surfaces:

| Route | Purpose | Notes |
|---|---|---|
| `/` (homepage) | The full vending pitch + primary "Host a machine" CTA | Hero, value props, how-it-works, social proof, FAQ teaser, lead form |
| `/host` | Dedicated long-form pitch + lead form | Optional if homepage covers it; good for ad/QR landing + SEO. Can be the form target. |
| `/faq` | Full host FAQ (from `01-…OFFER.md`) | Powers FAQPage JSON-LD (AEO) |
| `/service-areas` | Bay-Area hub listing all cities served | Links to each city page; local-SEO clarity |
| `/service-areas/[city]` | Unique city landing page per priority Bay-Area city | **NOT** a swapped-variable template — each needs distinct local content (doc 04 §1). Start ~5–8 cities. |
| `/legal/privacy`, `/legal/terms` | Keep existing | Update entity/contact; already public |
| `/refer` | Scout/connector program | **Phase 2 / optional** — only if John wants the scout funnel public |

> **Local SEO is central to this build** — Foil is a service-area business across the Bay Area. The full
> city-page architecture, Google Business Profile setup, schema, citations, and recommended tooling live
> in **`04-LOCAL-SEO-AND-TOOLS.md`**. Read it before building the public surfaces.

Everything else (deal-finder) becomes dormant — see §3.

**Single source of truth for copy:** pull all human-readable copy from `01-HOST-LOCATION-OFFER.md`.
Do not invent facts; unresolved facts are `[PLACEHOLDER]` until John confirms.

---

## 2. Lead capture (email-only, via Resend)

- **Form fields:** business name, location type (select from ICP list), city/area, contact name, email,
  phone (optional), free-text "about your space / foot traffic."
- **Mechanism:** a **Server Action** (repo convention — no client fetch) that validates input and calls
  the existing `lib/notifications/resend.ts` boundary to email John the lead. Reuse the existing sender
  (`Foil <alerts@foiltcg.com>` or a new `leads@`/`hello@` alias — `[PLACEHOLDER: John pick the
  inbound notification address; default to john.c.craig24@gmail.com as recipient]`).
- **Subject line:** `New host lead: {businessName} ({city})`.
- **Anti-spam:** honeypot field + minimal rate-limit (reuse any existing pattern). No PII stored in a DB
  for v1 (email-only keeps it simple and avoids Supabase schema work).
- **Routing:** the form POST/handler path must be added to `PUBLIC_ROUTES` in
  `lib/supabase/proxy.ts` (the proxy is default-deny). Update `lib/__tests__/proxy.test.ts` accordingly.
- **Confirmation UX:** success state on the page ("Thanks — we'll reach out within [X]"). Optional
  auto-reply email to the lead is a nice-to-have, phase 2.
- **Discord:** John chose email-only, so skip the Discord ping for now. (The `#subscribers`-style hook
  via `lib/notifications/discord.ts` is available later if he wants it.)

---

## 3. Deal-finder dormancy (keep code, kill the public surface)

The goal: nothing about the Pokémon deal-finder is visible to a human or a crawler, but the code isn't
deleted (reversible).

1. **Navigation/links:** remove all header/footer/homepage links to `/cards`, `/cards/[slug]`,
   `/cards/sets/*`, `/deals`, `/start`, `/pricing-methodology`, `/newsletter`, the blog, etc.
2. **Indexing:** add `noindex` to all dormant routes (metadata `robots: { index: false }`) AND remove
   them from `app/sitemap.ts` / `lib/seo/sitemap-landings.ts`. Rebuild the sitemap to contain only the
   new vending surfaces.
3. **Old indexed URLs:** the deal-finder catalog (~1,000+ card pages) is/was in Google's index.
   Decide per `[PLACEHOLDER]`: simplest is leave them `noindex` and let them drop out; cleaner for
   crawl budget is a `410 Gone` or a `301` to `/`. Recommendation: `noindex` + drop from sitemap now;
   revisit redirects after the vending pages are indexed.
4. **Disable scheduled jobs (IMPORTANT — stops ongoing API/eBay spend on a dead product):**
   - GitHub Actions `weekly-content.yml` (Mon/Thu content engine) → disable, or set repo variable
     `AUTO_PUBLISH_WEEKLY_POSTS=false` and/or comment out the `on.schedule` block.
   - Vercel crons: `wishlist-alerts`, `deals-refresh`, `x-post` (`/api/cron/*`) → remove from
     `vercel.json` crons (or guard with an env kill-switch) so they stop firing eBay Browse / PokeTrace /
     X calls. This also protects the eBay Growth-Check standing (no longer relevant, but avoids weird
     traffic).
   - Any X-bot live flag (`X_BOT_LIVE`) stays `false`.
5. **Auth gate:** the dormant gated routes (`/upload`, `/account`) can stay gated/dormant; no change
   needed beyond unlinking.
6. **Tests:** existing deal-finder tests can stay (they still pass against dormant code) OR be marked
   skipped if they assert public-surface behavior that's changing. Don't delete fixtures.

> Do NOT `rm` the deal-finder code, `lib/listing/*`, `lib/affiliate/*`, the scanner, etc. The pivot is a
> surface change; preserving the code keeps the option to revive or sell it.

---

## 4. SEO + AEO strategy (attract the right clients)

> **Local SEO is the main channel here.** The full service-area-business playbook (city pages, GBP,
> `LocalBusiness`/`areaServed` schema, citations, NAP consistency, recommended tools) is in
> **`04-LOCAL-SEO-AND-TOOLS.md`**. This section is the summary; doc 04 is canonical for local.

**Audience for search:** business/location owners researching passive income, vending placement, and
"what's that Pokémon card machine." Plus AI-assistant answers (AEO) when owners ask ChatGPT/Claude
"how do I get a vending machine in my store."

**On-page SEO:**
- New `<title>` / meta description / OpenGraph for `/`, `/host`, `/faq` focused on host-acquisition intent.
- One clear H1 per page; benefit-led, location-owner framed.
- Internal links between `/`, `/host`, `/faq`.
- Self-hosted OG/hero images of the machine (`public/`), not hotlinked.

**Target query themes (for copy + future content):**
- "pokemon card vending machine in my store / business"
- "host a vending machine" / "free vending machine placement"
- "passive income for my [gas station / smoke shop / arcade / barbershop]"
- "trading card vending machine placement [city]"
- "[city] vending machine company"
- Location-type × city long-tail (gas station, smoke shop, arcade, barbershop, laundromat × metro).

**AEO (answer-engine optimization):**
- `FAQPage` JSON-LD on `/faq` (and a FAQ block on `/`) using the Q&A in `01-…OFFER.md`. Reuse the
  repo's existing JSON-LD patterns (the deal-finder already emitted FAQPage/Article schema).
- `LocalBusiness` (or `Service`) JSON-LD on `/` with name, area served, contact.
- Short, declarative, standalone-fact sentences (the repo already has a "citable claim" discipline from
  the content engine — apply the same shape).

**Content engine (phase 2 — John mentioned updating it):**
- The `lib/seo/` content engine + Mon/Thu autonomy can be **repointed** from deal-finder topics to
  **host-acquisition + local SEO** topics ("Is a card vending machine worth it for a gas station?",
  "How vending revenue share works," "Best businesses for a trading-card machine," city pages).
- This is a **separate, later goal** — disable the engine now (§3.4), reframe and re-enable in phase 2.
  Reframing requires editing `SYSTEM_PROMPT` in `lib/seo/content-engine.ts` + the topic backlog in
  `docs/seo-strategy.md`, and a before/after regeneration measurement (per the repo's hard rule for
  prompt changes).

---

## 5. Brand / design

- Keep the **Foil** name and domain. "Foil" fits (holofoil / foil packs).
- The existing **cream/navy/gold** system (ADR-029), Bricolage Grotesque / Geist / Fraunces type, and
  Aceternity primitives can carry over — it reads premium and collectible, which suits a Pokémon brand
  pitched to businesses. Re-evaluate only if John wants a more "B2B/operations" register.
- Update `PRODUCT.md` + `DESIGN.md` (the impeccable design-context docs) to reflect the new
  audience (business/location owners), purpose (lead-gen), and personality. The current "trusted
  collector concierge" persona shifts toward "trusted, low-pressure local operator." Run
  `/impeccable teach` + `document` to regenerate rather than hand-editing to diverge from code.
- Honor existing a11y/reduced-motion bars and `npm run design:lint` / `visual-regression.test.ts`
  closure gates — extend the guards to the new surfaces.

---

## 6. Honesty guardrails (hard rules for the build)

1. No earnings **guarantees**. Only ranges, clearly framed as "comparable locations," never promises.
2. No fabricated scale, fake locations, or fake testimonials. Per John's directive the site reads as an
   **established operator** — achieved via confident present-tense voice, real infrastructure (VTM/NAYAX/
   monitoring), real photos, GBP, and John's TCGplayer Level-4 track record. If a specific proof number
   doesn't exist, **omit it** (do NOT write "we're just starting"). See the positioning section in
   `01-HOST-LOCATION-OFFER.md`.
3. No AI-generated photos presented as real installs. Use real machine photos John provides, or clearly
   illustrative/product renders.
4. No install-timeline promise shorter than what can actually be delivered.
5. All unconfirmed facts ship as `[PLACEHOLDER]`, not inventions — surfaced to John for fill-in.
6. The exclusivity/auto-renew terms in the contract template are legal terms — keep them in the
   placement-agreement doc, not as casual website claims.

---

## 7. Open placeholders for John (blocking good copy)

- **Service area:** confirmed as the **SF Bay Area** (2026-06-13). Confirm/trim the priority city list in
  `01-…OFFER.md` and provide the **physical base city/address** (required for Google Business Profile
  verification — see doc 04 §2).
- **Lead-notification email** address (default: john.c.craig24@gmail.com).
- **Revenue-share** public treatment — state a % or "competitive, details on a call" (recommended).
- **Install timeline** to advertise (honest).
- **Proof assets:** real machine photos, # of machines/locations live (if any), any testimonial.
- **Public phone number / contact** (optional) for the site.
- **Business entity name** for legal pages (LLC formed? — CLAUDE.md notes LLC was pending).
- Whether to expose the **scout/referral** program now or later.

---

## 8. Suggested build sequencing

1. **Goal A — Repurpose public surface (this is the big one):** new `/` + `/host` + `/faq`, lead-capture
   server action via Resend, PUBLIC_ROUTES + proxy test update, dormant-route unlinking + `noindex`
   + sitemap rebuild, disable scheduled jobs, new metadata + JSON-LD. Closure gates per CLAUDE.md
   (npm test, tsc, build, security-review, design:lint).
2. **Goal B — Proof + polish:** drop in John's real photos, finalize placeholders, OG images, design pass.
3. **Goal C — Content engine reframe (optional, later):** repoint `lib/seo/` to vending/local-SEO topics;
   re-enable autonomy with the before/after measurement.
4. **Goal D — Scout/referral page (optional):** if John wants the connector funnel public.

Ready-to-paste prompts for these are in `03-CLAUDE-CODE-PROMPTS.md`.
