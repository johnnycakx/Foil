# Runbook: local transcript-ingestion cron (R-018 Path B)

The creator-commentary digest ([ADR-050](../DECISIONS.md#adr-050--creator-content-ingestion--attribution-gate)) is refreshed by a **daily scheduled task on John's residential machine**, not in GitHub Actions. CI is bot-walled by YouTube at the player API even with cookies + client overrides (Path A + A.5 empirically ruled out — runs `26778566985` and `26779657010`; [R-018](../RISKS.md#r-018--ci-youtube-bot-block-on-transcript-ingestion), [ADR-052](../DECISIONS.md#adr-052--transcript-ingestion-on-a-residential-scheduled-box-path-b)).

## What runs

| | |
|---|---|
| **Scheduled task** | `FoilTranscriptIngest` (Windows Task Scheduler) |
| **Schedule** | Daily, 06:00 local time |
| **Action** | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\John\dev\foil\scripts\ingest-and-push.ps1` |
| **Runs as** | John (current user); needs the desktop session for Chrome cookie access |
| **Log** | `%LOCALAPPDATA%\Foil\ingest.log` (i.e. `C:\Users\John\AppData\Local\Foil\ingest.log`) |
| **Auth** | `--cookies-from-browser chrome` — reads the live Chrome session. **No secret, no rotation.** |

The script: `git pull --ff-only` → `ingest-transcripts.ts --cookies-from-browser chrome` → `transcript-digest.ts` → commit+push `docs/transcript-digests/` to `main`.

## Setup (already done; re-create if the task is lost)

```powershell
schtasks /Create /TN "FoilTranscriptIngest" `
  /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\John\dev\foil\scripts\ingest-and-push.ps1" `
  /SC DAILY /ST 06:00 /F
```

Inspect / run-now / remove:
```powershell
schtasks /Query  /TN "FoilTranscriptIngest" /FO LIST /V
schtasks /Run    /TN "FoilTranscriptIngest"     # trigger immediately
schtasks /Delete /TN "FoilTranscriptIngest" /F
```

## Failure modes (pilot: no alerting — check the log if signal goes stale)

- **0 transcripts fetched** (Chrome closed/locked DB, offline, cookies stale, YouTube change): `transcript-digest.ts` **skips the write** (clobber-guard), so the last good digest stays and nothing is committed. Symptom: digest date stops advancing. Check `ingest.log` for `done. 0 new transcript(s)`.
- **Chrome cookie DB locked** while Chrome is running: yt-dlp usually copies the DB and proceeds; if it errors, close Chrome or switch the browser arg in `ingest-and-push.ps1` (`chrome` → `edge` / `firefox` / `brave`).
- **Push conflict**: the script `git pull --ff-only` first; if local `main` has diverged, the pull (and thus push) is skipped — `git status` in the repo and reconcile.
- **Machine off at 06:00**: the run is missed (no catch-up configured for the pilot). Add `/RI`/`/DU` or a "run on logon if missed" option later if it matters.

## Graduation path

If local-box uptime becomes unreliable, graduate to a **residential proxy** in the GitHub workflow: add a `RESIDENTIAL_PROXY_URL` secret and pass `--proxy` to yt-dlp in `transcript-ingestion.yml`. That re-enables the (currently dormant, soft-failing) CI workflow. The `YT_DLP_COOKIES` secret is intentionally retained for that future proxy use.

## Why CI stays wired but dormant

`.github/workflows/transcript-ingestion.yml` is left in place (cookieless → fetches 0 → clobber-guard skips write → green no-op). It's the fallback we'd reactivate with a proxy. Deleting it would lose the wiring; it does no harm dormant.
