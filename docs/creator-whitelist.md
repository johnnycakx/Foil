# Creator Whitelist (content-engine market signal)

Curated list of Pokémon TCG creators whose YouTube auto-subs feed the content
engine's market-signal digest (ADR-050 / [C.1](ROADMAP.md)). **John owns
curation** — add or remove a row here and the daily ingestion picks it up on the
next run. Channels were verified (handle resolves + auto-subs fetchable) before
landing on this list; if a channel goes dark or blocks subs, the ingestion logs
it and skips that channel rather than failing the run.

## Parse contract

`scripts/ingest-transcripts.ts` reads the table below and ingests every row whose
**Status** is `active`. It extracts the `@handle` from the Handle column. To pause
a channel without losing the record, set Status to `paused` (keeps the row, stops
the pull). Keep the table shape stable: `| Display | @handle | Status | Notes |`.

## Channels (C.1 pilot — 5)

| Display | Handle | Status | Notes |
|---|---|---|---|
| PokeRev | @PokeRev | active | Large channel; openings + collection + market takes. Pilot anchor (verified first). |
| Pirate King Investments | @ninetalescorner | active | Investing/market-focused ("MUST-HAVE under $50" / invest framing). |
| PokeChuck | @PokeChuck | active | Market commentary + outlook ("things may get uglier"). |
| PikaPikaPapa | @PikaPikaPapa | active | Gains/drops + opportunity framing — strong sentiment signal. |
| PokeBeard | @PokeBeardTCG | active | Monthly investing outlooks (products + singles). |

All five verified 2026-05-31 (Goal C.1 P0/P1): handle resolves via
`yt-dlp --flat-playlist` AND a recent video's `en` auto-subs fetch as VTT.

## Curation principle

Prefer **market/analysis** voices over pure pack-opening for-entertainment
channels: the digest's job is sentiment signal (what's moving, what's hyped),
not hype amplification. Hype language is treated as *speaker-data* (a signal the
creator is excited, often a contrarian SELL marker) not *card-data* — see
[BRAND-VOICE.md](BRAND-VOICE.md) + the attribution discipline in
[ADR-050](DECISIONS.md#adr-050--creator-content-ingestion--attribution-gate).
