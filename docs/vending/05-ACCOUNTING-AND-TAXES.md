# Foil Vending — Accounting & Taxes (Context)

> Captured from "Accounting and Taxes in Vending.pdf" (uploaded 2026-06-13). Source PDF archived at
> `docs/vending/source-pdfs/`. This is **business context for COO/CEO-level advising**, not website copy
> and **not tax advice** — confirm everything with a qualified accountant.

---

## Key tax advantages of owning vending machines (per the blueprint)

- **100% first-year write-off** — deduct the full cost of machines in year one (vs. depreciating over 5–7
  years). Immediate cash back.
- **Section 179 deduction** — for 2026, up to **$2,560,000** in equipment purchases deductible, even if
  financed or leased. Makes scaling cheaper.
- **20% QBI deduction** — LLCs / sole proprietors can often deduct 20% of net profit, lowering taxable
  income.
- **Sales-tax resale exemption** — most states let you buy inventory (the sealed packs) **without paying
  sales tax upfront** (resale certificate). Improves cash flow.
- **Tax-inclusive vending pricing** — vending prices include tax, which often yields **lower taxable
  revenue** than traditional retail.
- **Mileage deduction** — **72.5¢/mile (2026 rate)** for restocking routes. Material at scale.
- **100% deductible startup costs** — software, onboarding, scouting, processing fees, operating tools.

## Compliance baseline

- A tax return is required whether you run 1 machine or 100.
- The blueprint recommends an accountant who is also a vending operator: **Chad Kufro — cmk@delpizzo.com**.

---

## COO notes / implications for Foil

- **Entity:** CLAUDE.md flagged LLC formation as pending and gates several things (Stripe live mode,
  banking, Google OAuth). The QBI + liability + NAYAX KYC + resale-certificate angles all point to
  **forming the LLC early** as a real near-term priority. `[ACTION: confirm LLC status; if not formed,
  prioritize — it unblocks banking, clean books, the resale certificate, and the tax posture above.]`
- **Resale certificate (California — CDTFA):** to buy sealed packs for resale without paying sales tax
  upfront, Foil needs a CA seller's permit + resale certificate. Worth setting up before scaling inventory.
- **Sales tax on machine sales:** California sales tax applies to the card sales; NAYAX/VTM reporting
  feeds the numbers. Keep machine-level sales records (the VTM/MoMA apps already track this) for the
  filing.
- **Bookkeeping from day one:** track per-machine revenue (VTM), payouts (NAYAX, Fridays), COGS
  (pack costs), software/processing fees, mileage (restock routes), and host revenue-share payments.
  Clean books make the Section 179 / QBI / mileage deductions defensible.
- **Mileage logging:** because restock routes are deductible at 72.5¢/mi and Foil is starting with the
  nearest cities (see service area), a simple mileage log (or an app) is low-effort, real money at scale.
- **Host payments are a deductible expense** — the revenue share paid to locations reduces taxable
  income; keep records (method + amount + date per the contract/handshake).

> None of the above is tax advice — it's a checklist to take to Chad (or another CPA). Decisions like
> entity type and Section 179 timing should be made with the accountant.
