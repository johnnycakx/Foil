# Foil Vending — Second-Brain Index (COO context)

> **Purpose.** This folder is John's persistent business context for the **Foil Pokémon card vending
> machine** operation (a pivot from the deal-finder — see `00-BUSINESS-OVERVIEW.md`). It exists so any
> Claude session can operate as a **COO/CEO-level advisor** with full context: strategy, ops, the website
> buildout, local SEO, finances. When John asks "what should I do about X," start here.

> **Operating posture:** advise like a COO — honest, decision-oriented, numbers-aware, willing to push
> back. Ground every recommendation in these docs + the source PDFs. Don't fabricate facts; flag
> `[PLACEHOLDER]` / `[ACTION]` where John's real input is needed.

## Docs in this folder

| File | What it covers |
|---|---|
| `00-BUSINESS-OVERVIEW.md` | The business model, economics, machines, ops stack (VTM/NAYAX/MoMA), scout program, internal-only tactics NOT for the public site |
| `01-HOST-LOCATION-OFFER.md` | Host-facing offer, **service area (Napa/Fairfield/Walnut Creek + 50-mi tiers)**, ICP, public FAQ, established-operator positioning, CTA spec |
| `02-WEBSITE-REPURPOSE-PLAN.md` | Technical plan to repurpose foiltcg.com → vending lead-gen; lead capture, dormant deal-finder, brand, honesty guardrails, placeholders |
| `03-CLAUDE-CODE-PROMPTS.md` | Ready-to-paste `/goal` prompts for Claude Code to build the site |
| `04-LOCAL-SEO-AND-TOOLS.md` | Service-area local SEO playbook (city pages, GBP, schema, citations) + recommended tools/connectors |
| `05-ACCOUNTING-AND-TAXES.md` | Tax advantages (Section 179, QBI, mileage, resale exemption), entity/bookkeeping COO notes |
| `06-SALES-AND-OUTREACH-PLAYBOOK.md` | Internal outreach stack (DM/call/email/walk-in), closing toolkit, CRM discipline, **machine-photo asset link** |
| `07-OPERATIONS-PLAYBOOK.md` | Account management, product sourcing/COGS, machine sizing, ad-revenue stream, equipment |
| `08-TEAM-LEGAL-AND-MINDSET.md` | Sales reps/scouts + agreement, placement-contract templates (simple/hardcore), **LLC/EIN priority**, mindset |
| `09-ADVISORS-AND-OUTREACH.md` | Outside advisors (accountant Chad, insurance, legal) + the ready-to-send Chad email + answers log |
| `10-GOOGLE-BUSINESS-PROFILE.md` | Paste-ready GBP setup pack: name/category/service-areas/description, video-verification guide, post-setup levers |
| `11-SOURCING-STRATEGY.md` | Product sourcing: market-arbitrage vs wholesale, seller's-permit-first path, GTS eligibility caveat, Pokémon allocation reality, distributor checklist |
| `source-pdfs/` | **Archived originals** of all 29 blueprint PDFs (verbatim source of truth) |

## Source PDFs archived — COMPLETE: 29 of 29 (as of 2026-06-13)

All blueprint PDFs are now in `source-pdfs/`: General Overview · Establishment Owner Q&A & Rebuttals ·
Frame of Closing · Location Owner AI · Machine Setup & Installation · Products You'll Need Eventually ·
Ordering Machine Guide · Sales Job Listing · Simple Contract · Card Flyer · Contracts Guide · Accounting
& Taxes · Account Management · Closing The Deal · Cold Call Script · Cold Calling · Cold DM Guide ·
Cold DM Template · Cold Email Guide · Cold Email Template · Getting LLC & EIN Prompt · Hardcore
Contract · Hiring Sales Reps · Mindset & Work · Running Ads Guide & Script · Sales Representative
Agreement · Sourcing Product · Walkins · Warm Email Guide & Template.

> **Convention going forward:** every PDF John shares gets archived to `source-pdfs/` AND distilled into a
> numbered context doc here, so the second brain stays complete across sessions.

## Open decisions / actions for John (live list)

**Entity:** ✅ **Foil TCG, LLC** — Delaware LLC, EIN 42-2917646, DE file #10642900, incorp. 2026-05-29
(Stripe Atlas; DE registered agent Legalinc). ✅ **Registered to do business in California 2026-06-17** —
**CA SoS Entity No. B20260280279** (foreign LLC), file date 2026-06-15. Representative John Craig. Business
address (= home base) **2710 Southern Hills Court, Fairfield, CA 94534**, phone (707) 344-3857. (Entity #
confirmed 2026-06-17.)

**Real-world homework (on John, not the code) — do before pitching any host:**

> **REGISTRATION CHAIN IN PROGRESS (started 2026-06-15).** Order: DE good-standing cert → CA foreign-LLC
> registration (LLC-5) → CA SoS entity # → finish CDTFA seller's permit (draft saved). Each step gates the
> next.
> 1. ✅ **DE Certificate of Good Standing** — ordered via Legalinc (order #2731177, $79); **received
>    2026-06-15** (`docs/vending/source-pdfs/2731177-final_packet.pdf`). DE file #10642900, formed 2026-05-29,
>    good standing as of 2026-06-15, annual taxes assessed to date.
> 2. ✅ **CA foreign-LLC registration (bizfile, Form LLC-5)** — **APPROVED 2026-06-17** (submitted 2026-06-15;
>    receipt ref cf968562-f3e7-4b02-8e17-8538ad912f4a; total $75 = $70 filing + $5 certified copy). **CA SoS
>    Entity No. B20260280279.** Filed as: Foil TCG, LLC · Delaware · principal/mailing/CA-office all 2710
>    Southern Hills Court, Fairfield CA 94534 · agent = John Craig (self) same address · file date 2026-06-15.
>    A "Welcome Letter" with key contacts is in bizfile "My Work Queue."
> 3. ⭐⏳ **CDTFA seller's permit** — **NOW UNBLOCKED** (have entity # B20260280279). **draft SAVED** at
>    cdtfa.ca.gov → resume, paste entity #, submit → permit issues (often immediately). TOP UNLOCK: gates every
>    wholesale distributor account + tax-free inventory buying.
> 4. ⏳ **Statement of Information (Form LLC-12)** — due **by ~2026-09-15 (within 90 days of the 2026-06-15
>    file date)**, $20, filed at bizfileonline.sos.ca.gov. Do after (or alongside) the seller's permit.

- [ ] **CA foreign LLC registration** — see chain above (in progress). Triggers the **$800/yr CA franchise
      tax** + a **Statement of Information within 90 days**. Confirm both with Chad (CPA).
- [ ] **CDTFA seller's permit + resale certificate** — ⭐ **TOP UNLOCK** (draft saved; see chain). Gating
      document for every wholesale distributor account + tax-free inventory buying. See doc 11.
- [ ] **Business bank account** — confirm one is open in the LLC's name (Atlas usually pairs with one) so
      NAYAX payouts + clean books flow through the entity, not personal accounts.
- [ ] **Insurance** — line up **general-liability + equipment/property (inland-marine) coverage** (or a BOP
      that bundles them) **before the first machine is placed** / before signing any placement agreement
      where Foil covers damage. (Decision 2026-06-13: insurance/liability is **removed from the website
      entirely** — call/in-person topic only — so this is a pure operational to-do, not a site gate.) **Course
      gap:** the blueprint tells you to *say* "it's insured" but has **no module on actually buying coverage** —
      get quotes from an online insurtech (Next / Hiscox / Thimble / Coterie) or a local commercial agent.
      Not legal/insurance advice; confirm with a broker.
- [ ] **Local business license** — check City of Fairfield (and any city where a machine is placed) for a
      business license / vending permit requirement.
- [ ] **NAYAX onboarding (KYC)** — now unblocked (have LLC + EIN + bank); start when first machine ships.
- [x] **LLC + EIN** — done (Foil TCG, LLC). ✅

**Inputs that sharpen the website:**
- [x] **Home base** — confirmed Fairfield, CA 94534 (2026-06-13). Anchors the Google Business Profile +
      Tier 1 city distances. Business phone (707) 344-3857 available for the site if John wants it public.
- [~] **Lead-notification email** — Goal A ships to `john.c.craig24@gmail.com` + `host_leads` DB table.
      **Switching to `john@foiltcg.com`** (new Google Workspace, set up 2026-06-13) — flip the site
      recipient + reply-to in Goal B ONCE the mailbox is confirmed receiving. ⚠️ DNS: keep a **single
      root SPF record that includes BOTH Google Workspace and Resend** (two SPF records breaks email);
      Resend stays the send path.
- [ ] **Revenue-share** public treatment: publish a % or "details on a call" (recommended).
- [ ] **Install timeline** to advertise (honest).
- [~] **Google Business Profile** — CREATED 2026-06-13 ("Foil TCG", Vending machine supplier, SAB,
      Fairfield base hidden, phone + foiltcg.com set). Remaining: confirm verification (video), add hours +
      description + services, upload the 4 metadata-clean machine photos from `public/vending/`, post the
      FAQ Q&A, then collect host reviews. Full pack: doc 10.
- [ ] Confirm/trim the **Tier 1 city list** for the first city pages.
- [ ] Decide whether to expose the **scout/referral** program publicly (now or later).

## Build status

- **2026-06-23 — DUAL-TRACK restore, committed, NOT pushed (John deploys).** The deal-finder was
  restored as the **primary public, indexed SEO surface** (homepage at `/`, `/cards` + `/cards/[slug]`,
  `/deals`, `/start`, `/newsletter`, `/pricing-methodology`, the 3 pillars, `/blog` + all 10 posts, the
  content engine reverted to card-focus + the Mon/Thu cron + `vercel.json` crons re-enabled), recovering
  the organic traffic the full repurpose ([ADR-060](../DECISIONS.md#adr-060--vending-host-lead-gen-pivot-public-surface--vending-deal-finder-dormant))
  had cut off. **Vending is fully PRESERVED + still indexed as a secondary lead-gen track at `/host`:**
  `/host` (now the canonical vending landing — it carries the LocalBusiness/Service JSON-LD moved off the
  homepage), `/faq`, `/service-areas` + the 8 city pages, the `host_leads` table, the lead form +
  `LEAD_NOTIFICATION_EMAIL`, the **3 published vending blog posts** (live + indexed — they support `/host`
  local SEO), and the `public/vending` GBP assets — all untouched. Nav/footer carry a clear `/host` entry
  point so vending isn't orphaned. Documented in **[ADR-064](../DECISIONS.md#adr-064--dual-track-site-deal-finder-restored-as-primary-indexed-seo-surface-vending-lead-gen-kept-at-host)**
  (supersedes ADR-060's full-repurpose framing; reverses ADR-062). **Gates:** `tsc` clean · `npm test`
  941/923-pass/0-fail/18-skip · `build` exit 0 · `design:lint` exit 0 (no new findings) · `/security-review`
  no High. **Notes:** (1) `/machines` was un-noindexed but kept OUT of the sitemap (no live locations yet —
  recommend re-noindex until machine #1). (2) **`AUTO_PUBLISH_WEEKLY_POSTS` stays `false` (reviewed mode);**
  one-line flip to autonomy = set the repo var to `true`. **Pending John:** restore the **PokeTrace + eBay
  keys** to Vercel (card-page pricing depends on them — pages soft-fail to a no-pricing render, never a 500,
  if absent), review via `npm run dev` → push to deploy → resubmit the sitemap to GSC + request reindexing →
  run `CONTENT_VERIFY_BASE_URL=https://foiltcg.com npm test`.
- **2026-06-15 — Goal C (content reframe) + vending blog PUBLISH, committed, NOT pushed (John deploys).**
  Goal C (`0d38ab3`, [ADR-062](../DECISIONS.md)) repointed the content engine to vending host-acquisition +
  local SEO (SYSTEM_PROMPT + 2 vending pillars in `seo-strategy.md` + refactored gates) and regenerated 3
  posts to `_pending/`. This follow-up **published those 3 reviewed posts to the live `/blog`** and
  **re-enabled the blog surface for vending only** ([ADR-063](../DECISIONS.md)): `/blog` index + the 3 posts
  are now indexable, nav/footer-linked, and in the sitemap, gated by **pillar** (`host`/`service-areas` =
  live; the 7 dormant deal-finder posts stay noindexed + unlisted + off the sitemap). Swapped the dormant
  newsletter/`/pricing-methodology` funnels for `/host` CTAs on vending posts; fixed the gas-station age
  range (25 to 45 → 25 to 40). Internal links verified (all `/service-areas/[city]` targets exist). **Autonomy
  stays OFF** (`AUTO_PUBLISH_WEEKLY_POSTS=false`, Mon/Thu cron commented). Gates: `tsc` clean · `npm test`
  green · `build` clean · `design:lint` no new findings · `/security-review` no High. **Pending John:**
  `npm run dev` review → push to deploy → run `CONTENT_VERIFY_BASE_URL=https://foiltcg.com npm test` (the
  content-marker gate now covers the 3 vending posts) → resubmit the sitemap to GSC.
- **2026-06-13 — Goal A COMPLETE, committed `808eeae` (63 files), NOT pushed/deployed (John's call).**
  Public site is now a Pokémon-card-vending host lead-gen site. Shipped: `/` (hero → value props →
  how-it-works → proof → FAQ teaser → lead form), `/host` (reworked), `/faq` (FAQPage JSON-LD),
  `/service-areas` hub + `/service-areas/[city]` for **8 Tier-1 cities** (Napa, Fairfield, Vacaville, Vallejo,
  Walnut Creek, Concord, Benicia, Suisun City) each with unique local content; LocalBusiness/Service/
  FAQPage JSON-LD. Lead capture = Resend email to john.c.craig24@gmail.com **+ `host_leads` DB write +
  Discord** (email primary; input validated/escaped, header-injection-guarded). Deal-finder dormant
  (nav/links removed, noindex on /cards · /deals · /blog · /start · /newsletter · /pricing-methodology ·
  pillars · /machines; sitemap rebuilt vending-only). Crons disabled (vercel.json emptied; weekly-content
  off; `AUTO_PUBLISH_WEEKLY_POSTS=false`; `X_BOT_LIVE=false`). Documented in **ADR-060** (supersedes
  ADR-020/059 public framing); SESSION-LOG/ROADMAP/ENV-VARS updated.
- **Gates:** `tsc` clean · `npm test` 932 / 0 fail / 15 skip · `build` clean · `design:lint` clean ·
  `/security-review` **no High/Medium findings** (lead-form + Resend send audited: validated input, fixed
  recipient = no open relay, CR/LF-stripped subject, parameterized DB write, escaped JSON-LD, no PII path).
- **Premise-check resolution:** full-repurpose chosen; the 06-12 additive work was *evolved* (kept the
  `host_leads` DB + `/host` + lead form), while `/machines` + restock + machine-pricing disclosure are
  **preserved but dormant** (noindex/unlinked) for a possible Phase V-2. ADR-060 is where to unwind if the
  additive model is ever wanted instead.
- **Source PDFs:** `docs/vending/source-pdfs/` was **git-ignored by the build** (it holds internal sales
  scripts/contracts that shouldn't ship in the repo). The distilled `docs/vending/*.md` ARE committed; the
  raw PDFs persist locally + originals live in Whop.
- **Pending on John:** (1) review locally (`npm run dev`) → **push to deploy** (Vercel auto-deploys) →
  resubmit the new sitemap to GSC. (2) Fill Goal-B placeholders: insurance claim (ships as visible
  `[PLACEHOLDER]` on /faq until confirmed), install timeline, public revenue-share treatment, real machine
  images. (3) **Set up the Google Business Profile** (Fairfield base) — highest-ROI local-SEO lever, code-
  independent.
