# 🏠 Foil HQ — Operating Dashboard

> **The cockpit.** Open the vault at `C:\Users\John\dev\foil\docs`. Start here every session. Files stay the source of truth (versioned with code, read/written by Claude Code); Obsidian only *views* them. Full directory: [`MAP.md`](MAP.md).

---

## ⭐ NORTH STAR — the first dollar

**The one number that means Foil is working: revenue.** Affiliate dollars that actually convert + any paid signup. Everything below is either a leading indicator of it or a defect blocking it. Today: **$0.**

> Rule: if a proposed piece of work doesn't move a Scorecard number, it's probably procrastination wearing a productivity costume. Name the number first.
>
> **⚡ The shortest path to the FIRST dollar (verified 07-06): it's affiliate, and the pipe already works.** A real buyer clicking a live `/deals` link and buying on eBay pays a commission today — no Stripe, no $6 tier, no new build required. So the binding constraint on the first dollar is **DISTRIBUTION** (getting one real Pokémon buyer to the working board), which is the *human* lever — John in the replies / warm threads / collector outreach. Rocks 1–3 below build the *subscription* revenue line; they are NOT the fastest first dollar.

---

## 📊 SCORECARD — the few numbers that decide everything

Check these weekly. Most are ~0 or not-yet-instrumented today — that's the point: making them *measurable* is Rock 1.

| Metric | Now | Target | Source / note |
|---|---|---|---|
| **💵 Revenue (affiliate + paid)** | $0 | first $1 | the North Star |
| Affiliate clicks → eBay | not instrumented | trend up | ✅ pipe VERIFIED live 07-06: `/deals` links carry `campid=5339154326` + `customid`. The tag works. The gap is *no traffic*, not a leak. |
| Real email signups (ex-test) | ~0 | first 10 organic | Supabase `newsletter_subscribers`, exclude John/tests |
| Signup source attribution (UTM) | **missing** | every path tagged | can't prove traffic converts without it → **Rock 1** |
| **Gate-to-ads trio** (once live) | — | — | — |
| ↳ email-signup % | — | TBD | instrument before ad spend |
| ↳ trial-start % (card entered) | — | TBD | the willingness-to-pay signal → **Rock 3** |
| ↳ trial → paid % | — | TBD | the conversion truth |
| **Founder input:** X replies posted / wk | manual | steady cadence | the only live discovery lever at ~4 followers |
| Known data-trust bugs open | ≥3 (fabrications, stale price) | **0 before ads** | a wrong number burns a paid trial → **Rock 1** |

---

## 🪨 THE 3 ROCKS — this cycle (the revenue-critical path)

The money path has never been closed end-to-end. These three close it, in order. (Diagnosis: [`AUDIT-2026-07-01-FABLE.md`](AUDIT-2026-07-01-FABLE.md) + the 07-06 handoff.)

**🪨 Rock 1 — Close the real conversion gaps (defects; but NOT the binding constraint).**
Verified 07-06: the affiliate pipe already works in prod — so the "100% affiliate leak" was false. The *real* gaps: the "Browse on eBay" CTA is a card-level SEARCH, not the specific underpriced listing (weaker click→buy); `/start` signups' UTM/registration; live blog fabrications. Worth fixing, but they optimize conversion of traffic that *isn't arriving yet* — so they rank BELOW distribution. = handoff links 1–2, demoted.

**🪨 Rock 2 — Wire the ability to charge (John's gate).**
Stripe live + LLC banking. Nothing changes hands without it. *Financial action — John's to execute.* = handoff link 3.

**🪨 Rock 3 — Run the bounded willingness-to-pay test → produce the first-dollar signal.**
The $6 gated-drop test. Offer / ICP / pricing = the one genuinely judgment-heavy call. = handoff link 4. → [`goals/foil-gated-drop-paid-test.md`](goals/foil-gated-drop-paid-test.md)

> **Fable posture (updated 07-06):** Fable goes metered July 8, so it's no longer a *gate* — it's an optional ~$2 consult for the Rock 3 pricing call only. Rocks 1–2 don't need it; **start actioning Rock 1 now, don't wait.** Keep Claude Code execution on Opus 4.8.

---

## 🧭 Current state — read every session

- 📌 [`NEXT-SESSION-BRIEF.md`](NEXT-SESSION-BRIEF.md) — the rolling "right now": what just shipped + the plan.
- 🌳 [`goals/QUEUE.md`](goals/QUEUE.md) — the living goal tree (PENDING / IN-FLIGHT / CLOSED-UNPUSHED / LIVE / GATED / PARKED).
- 📓 [`SESSION-LOG.md`](SESSION-LOG.md) — reverse-chronological narrative of what happened last.
- 🧠 [`COWORK-CONTEXT.md`](COWORK-CONTEXT.md) — the co-CEO operating contract + hard-won LEARNINGS.

## 🗂️ The second brain

- 🗺️ [`MAP.md`](MAP.md) — **full PARA directory** (every doc sorted Project / Area / Resource / Archive).
- 🛣️ [`ROADMAP.md`](ROADMAP.md) · 💡 [`IDEAS.md`](IDEAS.md) · 🏛️ [`DECISIONS.md`](DECISIONS.md) · ⚠️ [`RISKS.md`](RISKS.md) · 🔑 [`ENV-VARS.md`](ENV-VARS.md) · 🧵 [`PATTERNS.md`](PATTERNS.md)
- 📚 [`knowledge/`](knowledge/) — evergreen operating playbooks (read the newsletter-business-playbook before any list/monetization work).
- 🗄️ [`archive/`](archive/README.md) — superseded one-offs, kept for history (never deleted).

---

## ⏰ Dated decisions only John owns

- **Fable → metered July 8** — enable usage credits or lose Fable access mid-session; keep Claude Code on Opus.
- **PokeTrace renewal (~Jul 15, decide by Jul 10)** — pricing spine; the deals-freshness diagnosis *weakens* the $98/mo case → `RISKS.md` R-062.
- **Stripe live + LLC banking** — gates any charging (Rock 2).
- **Is the $20K business capital or personal runway?** — sizes paid acquisition.
- **GCP billing** — `n8n-content-project` (hosts the GSC service account) flagged for suspension; confirm the card is fixed, then record it.

---

*Framework: PARA (filing) + an EOS-lite operating layer (this Scorecard + Rocks). Dashboard rebuilt 2026-07-06.*
