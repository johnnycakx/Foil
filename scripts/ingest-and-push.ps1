#requires -Version 5
# Foil residential transcript ingestion (R-018 Path B, ADR-052).
# ASCII-ONLY by design: PowerShell 5.1 reads a UTF-8-no-BOM file as Windows-1252,
# so non-ASCII chars (em dashes, arrows) corrupt parsing. Keep this file ASCII.
#
# Runs daily via Windows Task Scheduler ("FoilTranscriptIngest", 06:00 local).
# GitHub Actions datacenter IPs are bot-walled by YouTube even with cookies
# (runs 26778566985 + 26779657010 ruled out Path A + A.5), so ingestion runs
# here on John's RESIDENTIAL IP instead. It runs COOKIELESS: the residential IP
# alone clears the bot wall (verified - the original C.1 run fetched 74
# transcripts cookieless from this machine). We deliberately do NOT use
# --cookies-from-browser chrome here: on Windows it fails "Could not copy Chrome
# cookie database" while Chrome is running (yt-dlp #7271), and it isn't needed.
# (The script still SUPPORTS --cookies-from-browser as a fallback if YouTube
# ever blocks the residential IP too - run it with Chrome closed.)
#
# Safe failure: transcript-digest.ts skips the write when 0 transcripts are
# ingested (offline, YouTube change), so a failed fetch leaves the last good
# digest in place and commits nothing. See docs/runbooks/local-ingest-cron.md.

$ErrorActionPreference = "Continue"
$repo = "C:\Users\John\dev\foil"
$logDir = Join-Path $env:LOCALAPPDATA "Foil"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$log = Join-Path $logDir "ingest.log"

function Log($m) { "$(Get-Date -Format o)  $m" | Out-File -Append -Encoding utf8 $log }

Set-Location $repo
Log "=== ingest run start ==="

# Pull latest main first so the digest commit fast-forwards.
git pull --ff-only origin main *>> $log

node --experimental-strip-types --no-warnings scripts/ingest-transcripts.ts --days 30 --max 30 *>> $log
node --experimental-strip-types --no-warnings scripts/transcript-digest.ts *>> $log

git add docs/transcript-digests/
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git -c user.name="foil-content-bot" -c user.email="john.c.craig24@gmail.com" commit -m "docs(transcripts): daily creator-commentary digest $(Get-Date -Format yyyy-MM-dd)" *>> $log
  git push origin main *>> $log
  Log "committed + pushed digest"
} else {
  Log "no digest change (0 transcripts or no new data) - nothing to commit"
}
Log "=== ingest run done ==="
