# Foil Vending — Business Overview (Context for Claude Code)

> **Status:** Strategic pivot, 2026-06-13. Foil is being repurposed from a buyer-side Pokémon
> deal-finder into a **B2B lead-gen site for a Pokémon trading-card vending-machine placement
> business**. This doc is grounding context for any Claude Code session working on the new site.
> The deal-finder product is being retired from the public surface (code stays in-tree, dormant —
> see `02-WEBSITE-REPURPOSE-PLAN.md`).

> **Source:** John's operator blueprint PDFs (General Overview, Establishment Owner Q&A &
> Rebuttals, Frame of Closing, Location Owner AI, Machine Setup & Installation, Products You'll
> Need, Ordering Machine Guide, Sales Job Listing, Simple Contract, Card Flyer, Contracts Guide).
> Uploaded 2026-06-13.

---

## What the business actually is

Foil places **high-tech touchscreen vending machines that sell sealed Pokémon trading-card
packs** inside high-foot-traffic businesses (the "host locations"). Foil owns, stocks, services, and
operates the machines. The host provides space, power, and wifi. Foil pays the host a revenue
share. The host does essentially nothing operationally.

**Two distinct audiences — do not conflate them:**

1. **Host / location owners** (PRIMARY for the website) — business owners who let Foil place a
   machine in their venue for a revenue share. The website's whole job is to attract and convert
   these.
2. **Location scouts / connectors** (SECONDARY, optional) — commission-based people with
   existing relationships to small-business owners who introduce Foil to new host locations. There
   is a job-listing/recruitment angle here (see "Scout program" below). Could become a secondary
   page later; NOT the focus of the first build.

Product is **Pokémon only for now** (highest demand). May expand to other TCGs (Magic,
Yu-Gi-Oh, sports) later — write copy so "Pokémon" is swappable/extensible, but lead with Pokémon.

---

## The economics (why this works)

- **Margin is the whole game.** Packs are bought for ~$7–$10 and sold for ~$19–$35. >100%
  margin; roughly 5× what traditional retail pulls, on an impulse product.
- **High ticket, high margin, low maintenance.** A card machine doing $2,000/mo needs restocking
  ~once a month vs. a snack machine's twice a week — because of capacity (22mm coils fit ~2× the
  product) and because **cards don't expire** (no spoilage; a pack can sit for years and hold/gain value).
- **Capacity:** machines hold ~150–400 packs depending on size (mini wall → mega tower).
- **Stocking cost:** a full stock-up runs ~$1,500–$4,000 by machine size. Operators can quarter-fill
  and reinvest profits (not directly relevant to host-facing copy, but useful background).
- **Per-location revenue (host-facing benchmark):** comparable spots typically do **$1,000–$4,000+/mo
  in sales**. (This is gross machine sales, NOT host take-home — see split below.)

## Pack assortment (what the machine sells)

- Sealed Pokémon packs, mix of mid-tier and premium, roughly **$18–$100 each**.
- Mix of older/sought-after releases and whatever is currently hot; product rotates by what's trending
  and what a given location's customers respond to.
- New set drops drive a visible uptick in machine traffic.

## Customer demographic (kills the "no kids here" objection)

- ~**60% of core Pokémon buyers are 25–40 year-olds** — collectors and resellers with disposable
  income, who spend the most. The buyer base spans every age; it is NOT a kids' product.

---

## The machine hardware

All Foil/VTM trading-card machines ship with **22mm coils** by default (the card-vending standard;
~2× capacity of standard coils).

| Machine | Type | SKU options (selections) |
|---|---|---|
| Mini Wall | Wall-mounted | 8 |
| Slim Wall | Wall-mounted | 10 |
| Mega Wall | Wall-mounted | 15 |
| Slim Tower 2.0 | Freestanding | 24 |

**Footprint (host-facing):** wall units are about **jukebox-sized** (~3×2 ft, extends ~1 ft off the wall).
The standing/tower unit is ~6×2.5 ft. Needs ~**3–4 sq ft** of wall or floor space.

**Power:** standard 120V outlet, draws about as much as a TV (~$4/mo in electricity).

**Mounting options:** wall-mount, pedestal, or freestanding — whatever fits the space. Pedestal/
freestanding avoids drilling.

**Reliability features (host-facing trust points):**
- **Guaranteed-drop system with a built-in refund sensor** — if a customer pays and product doesn't
  drop, they're auto-refunded and the screen tells them on the spot.
- **QR-code support sticker** on every machine — customers report any issue directly to Foil, never to
  the host's staff. Host staff never touch refunds or complaints.
- **Touchscreen that educates the buyer** — tapping a pack shows a description that does the selling.
- **Fully cashless** — all transactions tracked in real time.

Machine sizing logic (internal): high-traffic or far-from-operator → go bigger (Slim Tower); lower-traffic
or close → smaller is fine; owner averse to drilling → freestanding. Wrong machine can always be
relocated. (Internal — not host-facing copy.)

---

## The operations stack (how Foil runs it remotely)

- **VTM** — the software platform/manufacturer. VTM app controls the machine (product, pricing,
  stock, settings) and shows sales + inventory in real time. Machines ship from **Cleveland, Ohio**.
- **NAYAX** — payment processor behind the card reader; handles KYC + payouts. **MoMA app**
  (NAYAX's) monitors card-reader transactions and issues remote refunds. **Payouts hit every Friday.**
- **Restock notifications** push to the operator's phone when a machine runs low.
- Bad wifi (~1 in 5 locations) → a **$20/mo cellular kit** keeps it online.

This stack is operator-internal. For the website it only matters as proof of "real-time monitored,
professionally run, cashless, hands-off for the host."

---

## Revenue share with the host (the offer)

> Full host-facing treatment in `01-HOST-LOCATION-OFFER.md`. Summary here:

- Standard host split: **10–15% of net profit** (net = after product cost, sales tax, software/card-reader
  fees, maintenance). Up to **30%** for genuine A+ locations. Hold the line at 30%.
- **Positioning is critical:** the machine is a **value-add and amenity** (foot traffic, novelty, experience,
  passive income on the side), **NOT** a primary income source. Never pitch it as "this will pay your rent."
- Payout methods: direct deposit, ACH, check, Zelle, Venmo, Cash App. (Corporate/chains → lead with
  check or bank transfer; don't offer Zelle/Venmo to corporate contacts.)
- Host provides: ~3–4 sq ft, a 120V outlet, wifi. Foil handles everything else — **licensing, insurance,
  compliance, install, stocking, servicing, refunds.** Zero work, zero liability for the host.
- **No contract required** (handshake is standard); a written **"placement agreement"** is available for
  hosts who want it, sketchy situations, or corporate/chain accounts. Trial-month, zero-risk framing is the
  standard de-risker.

---

## Secondary: the scout / connector program (context only)

There is a **commission-based "Location Scout / Connector"** recruitment angle: people with existing
relationships to small-business owners introduce Foil to host locations. Comp in the blueprint: **$350
upfront per placed location + $1 per pack sold for the life of that machine.** This could become a
"Refer a location / partner with us" page later. NOT in the first website build unless John says so.

There is also an **AI cold-call trainer GPT** and a **group chat / mentor network** in the blueprint — these
are operator-training tools, entirely internal, not website material.

---

## ⚠️ Internal-only tactics — DO NOT put on the public website

These appear in the blueprint as sales coaching. They are fine person-to-person but must **never** be
baked into public site copy (trust + legal risk):

- Claiming scale Foil doesn't have ("say we have 30+ machines," name-dropping fake locations).
- AI-generated headshots presented as real photos.
- Fudged install timelines ("say 30 days even if…").
- Any earnings claim stated as a guarantee. Host-facing numbers must be framed as ranges/
  "comparable locations," never promises.
- The exact net-profit-split mechanics as a haggling script.

**Rule for the site:** truthful, range-based, amenity-framed. If a fact isn't confirmed by John, it goes in
as a `[PLACEHOLDER]`, not an invention. See the honesty guardrails in `02-WEBSITE-REPURPOSE-PLAN.md`.

---

## Brand note

Domain `foiltcg.com` and the "Foil" name still fit — "foil" = holofoil cards / foil packs. Keep **Foil** as
the brand for the vending business. Visual identity can carry over the existing cream/navy/gold system
(ADR-029) or be re-evaluated; see the website plan.
