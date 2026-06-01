// Transcript cleaning for the creator-content ingestion pipeline (ADR-050).
//
// Turns a YouTube auto-sub VTT into deduped plain text, then redacts it for
// safe synthesis (R-008: no eBay listing data; BRAND-VOICE.md: no AI-tell
// phrases). Pure functions so they're unit-tested (lib/__tests__/
// transcript-clean.test.ts) and reused by the digest + the attribution gate.
//
// YouTube auto-sub VTT quirk: each spoken segment appears TWICE — once as a
// "live" line carrying inline word-timing tags (Are<00:00:00.400><c> you</c>…)
// and once as a plain rolled-up repeat on the next cue. We keep the live lines
// (strip the tags) and drop the plain repeats, then collapse any remaining
// consecutive duplicates. That yields one clean line per segment.

const CUE_TIMING = /^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->/;
const INLINE_TS = /<\d{2}:\d{2}:\d{2}\.\d{3}>/g;
const C_TAG = /<\/?c[^>]*>/g;
const HAS_INLINE_TS = /<\d{2}:\d{2}:\d{2}\.\d{3}>/;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

/** VTT (auto-sub) -> deduped plain text, one line per spoken segment. */
export function cleanVtt(raw: string): string {
  const lines = raw.replace(/\r/g, "").split("\n");
  const kept: string[] = [];
  let lastPlain = "";

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t === "WEBVTT") continue;
    if (/^(Kind|Language|NOTE|STYLE|Region):/i.test(t)) continue;
    if (CUE_TIMING.test(t)) continue;

    const hadInline = HAS_INLINE_TS.test(t);
    const text = decodeEntities(t.replace(INLINE_TS, "").replace(C_TAG, "")).replace(/\s+/g, " ").trim();
    if (!text) continue;

    if (hadInline) {
      // A "live" segment line: this is the authoritative text for the segment.
      if (kept[kept.length - 1] !== text) kept.push(text);
      lastPlain = "";
    } else {
      // A plain line: keep only if it isn't the rolled-up repeat of what we
      // just kept (auto-subs echo the prior segment as lead-in to the next).
      if (text !== kept[kept.length - 1] && text !== lastPlain) {
        kept.push(text);
      }
      lastPlain = text;
    }
  }

  // Final collapse of any consecutive duplicates that slipped through.
  const out: string[] = [];
  for (const l of kept) if (out[out.length - 1] !== l) out.push(l);
  return out.join("\n");
}

const URL_RE = /\bhttps?:\/\/[^\s)]+/gi;
const EBAY_FRAGMENT = /\b(?:www\.)?ebay\.[a-z.]+\/[^\s)]*|\/itm\/\d+/gi;

/**
 * Redact cleaned transcript text for synthesis use:
 *  - strip all URLs + eBay listing fragments (R-008: never persist eBay
 *    listing data; spoken transcripts shouldn't carry them, but defend anyway).
 *  - strip the BRAND-VOICE.md AI-tell ban phrases so they can't seed synthesis.
 * Market-hype sentiment words are intentionally PRESERVED — they're signal the
 * digest tags as speculator-spike candidates, not noise to remove.
 */
export function redactForSynthesis(text: string, bannedPhrases: readonly string[]): string {
  let out = text.replace(URL_RE, "[link removed]").replace(EBAY_FRAGMENT, "[ebay ref removed]");
  for (const p of bannedPhrases) {
    const re = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, "");
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
