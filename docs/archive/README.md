# 🗄️ Archive — superseded docs, kept for history

> **Nothing here is deleted** (the never-delete rule). These are one-off, dated, or superseded documents that no longer describe current state. They're **kept in their original location** and marked with an archived banner, because they're cross-linked into `DECISIONS.md` (ADRs), `SESSION-LOG.md`, `ROADMAP.md`, and `IDEAS.md` — physically moving them would break those links in both directions. This index is the single place to find them.
>
> Current state lives in [`../HOME.md`](../HOME.md). Full directory: [`../MAP.md`](../MAP.md).

## Cataloged as archived (banner added in place)

| Doc | Was | Superseded by |
|---|---|---|
| [`../CONTEXT-HANDOFF-2026-06-02.md`](../CONTEXT-HANDOFF-2026-06-02.md) | Session handoff, Jun 2 | later handoffs → now `NEXT-SESSION-BRIEF.md` |
| [`../CONTEXT-HANDOFF-2026-06-04.md`](../CONTEXT-HANDOFF-2026-06-04.md) | Session handoff, Jun 4 | ″ |
| [`../CONTEXT-HANDOFF-2026-06-05.md`](../CONTEXT-HANDOFF-2026-06-05.md) | Session handoff, Jun 5 | ″ |
| [`../CONTEXT-HANDOFF-2026-06-07.md`](../CONTEXT-HANDOFF-2026-06-07.md) | Session handoff, Jun 7 | ″ |
| [`../PLAN-2026-06-05.md`](../PLAN-2026-06-05.md) | Point-in-time plan, Jun 5 | `ROADMAP.md` + `NEXT-SESSION-BRIEF.md` |
| [`../STRATEGY-VENDING-2026-06-12.md`](../STRATEGY-VENDING-2026-06-12.md) | Vending-track strategy | deprioritized secondary track (ADR-020 pivot; `/host` kept but parked) |
| [`../BRAND-LOGO-CONCEPTS.md`](../BRAND-LOGO-CONCEPTS.md) | Logo exploration | shipped brand (blackout wordmark, ADR-106) |

## Why "marked in place" instead of moved

The second brain is also a **runtime dependency** — code and the bootstrap read many docs by hardcoded path, and the historical ADR/session record links to these files. A physical move to `archive/` would:
1. break inbound links from `DECISIONS.md` / `SESSION-LOG.md` / `ROADMAP.md` / `IDEAS.md`, and
2. break the moved files' own outbound links to still-in-root docs.

So the archive is an **index + banner** layer. If a true physical relocation is ever wanted, it's a separate goal that rewrites every affected link in the same pass.
