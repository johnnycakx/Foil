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

**Entity:** ✅ **Foil TCG, LLC** — Delaware LLC, EIN 42-2917646, incorp. 2026-05-29 (Stripe Atlas;
DE registered agent Legalinc). Representative John Craig. Business address (= home base) **2710 Southern
Hills Court, Fairfield, CA 94534**, phone (707) 344-3857. (Confirmed 2026-06-13.)

**Real-world homework (on John, not the code) — do before pitching any host:**
- [ ] **CA foreign LLC registration** — a Delaware LLC *doing business in California* must register with the
      CA Secretary of State as a foreign LLC (Form LLC-5) and pay the **$800/yr CA franchise tax** (+ the
      CA gross-receipts LLC fee above $250k). Operating in CA unregistered risks penalties and inability to
      enforce contracts in CA courts. **Top priority — confirm with Chad (CPA) / CA SoS.**
- [ ] **CDTFA seller's permit + resale certificate** — required to collect/remit CA sales tax on card sales
      and to buy inventory tax-free for resale. (Card packs are fully taxable tangible goods.)
- [ ] **Business bank account** — confirm one is open in the LLC's name (Atlas usually pairs with one) so
      NAYAX payouts + clean books flow through the entity, not personal accounts.
- [ ] **Insurance** — general-liability + equipment coverage. "We handle insurance / host isn't liable" is a
      load-bearing promise in the pitch; the site keeps it omitted/`[PLACEHOLDER]` until real (flagged by the
      build's honesty pass, 2026-06-13).
- [ ] **Local business license** — check City of Fairfield (and any city where a machine is placed) for a
      business license / vending permit requirement.
- [ ] **NAYAX onboarding (KYC)** — now unblocked (have LLC + EIN + bank); start when first machine ships.
- [x] **LLC + EIN** — done (Foil TCG, LLC). ✅

**Inputs that sharpen the website:**
- [x] **Home base** — confirmed Fairfield, CA 94534 (2026-06-13). Anchors the Google Business Profile +
      Tier 1 city distances. Business phone (707) 344-3857 available for the site if John wants it public.
- [x] **Lead-notification email** — confirmed `john.c.craig24@gmail.com` (2026-06-13). Build also keeps
      the existing `host_leads` Supabase table (DB + email).
- [ ] **Revenue-share** public treatment: publish a % or "details on a call" (recommended).
- [ ] **Install timeline** to advertise (honest).
- [ ] **Proof assets:** real machine photos (Drive folder in doc 06/01); set up + verify Google Business Profile.
- [ ] Confirm/trim the **Tier 1 city list** for the first city pages.
- [ ] Decide whether to expose the **scout/referral** program publicly (now or later).

## Build status

- **2026-06-13:** Goal A (full repurpose) running in Claude Code. Premise check reconciled a collision with
  prior **uncommitted 06-12 "additive-split" vending work** (a `/machines` hub, restock alerts, `host_leads`
  + `machine_restock_alerts` tables already applied in prod, dual-role `/pricing-methodology`). Resolution:
  proceed with full-repurpose, **evolve/reuse** the 06-12 foundation (keep the DB, reuse `/host` + lead form),
  leave additive-only artifacts (`/machines`, restock alerts) uncommitted, supersede
  `STRATEGY-VENDING-2026-06-12.md`. (There is prior vending work in the repo from another session —
  noted for context.)
