#requires -Version 5
# Foil residential transcript ingestion (R-018 Path B, ADR-052).
#
# Runs daily via Windows Task Scheduler ("FoilTranscriptIngest", 06:00 local).
# GitHub Actions datacenter IPs are bot-walled by YouTube even with cookies
# (runs 26778566985 + 26779657010 ruled out Path A + A.5), so ingestion runs
# here on John's residential IP instead. Uses --cookies-from-browser chrome:
# the live Chrome session auto-refreshes, so there's NO secret to set and NO
# rotation cadence. Rebuilds the digest and pushes it to main.
#
# Safe failure: transcript-digest.ts skips the write when 0 transcripts are
# ingested (Chrome closed, offline, cookie miss), so a failed fetch leaves the
# last good digest in place and commits nothing. See docs/runbooks/
# local-ingest-cron.md.

$ErrorActionPreference = "Continue"
$repo = "C:\Users\John\dev\foil"
$logDir = Join-Path $env:LOCALAPPDATA "Foil"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$log = Join-Path $logDir "ingest.log"

function Log($m) { "$(Get-Date -Format o)  $m" | Out-File -Append -Encoding utf8 $log }

Set-Location $repo
Log "=== ingest run start ==="

# Pull latest main first so the digest commit fast-forwards (the Mon/Thu content
# engine + any other commits land here without a push conflict).
git pull --ff-only origin main *>> $log

node --experimental-strip-types --no-warnings scripts/ingest-transcripts.ts --days 30 --max 30 --cookies-from-browser chrome *>> $log
node --experimental-strip-types --no-warnings scripts/transcript-digest.ts *>> $log

git add docs/transcript-digests/
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git -c user.name="foil-content-bot" -c user.email="john.c.craig24@gmail.com" commit -m "docs(transcripts): daily creator-commentary digest $(Get-Date -Format yyyy-MM-dd)" *>> $log
  git push origin main *>> $log
  Log "committed + pushed digest"
} else {
  Log "no digest change (0 transcripts or no new data) — nothing to commit"
}
Log "=== ingest run done ==="
