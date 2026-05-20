"use server";

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import { cropFromBuffer } from "@/lib/crop";
import {
  CARD_SCAN_SCHEMA,
  DETECT_SCHEMA,
  DETECT_SYSTEM_PROMPT,
  VISION_MODEL,
  VISION_SYSTEM_PROMPT,
  type BoundingBox,
  type DetectedCard,
  type DetectPayload,
  type IdentifiedCard,
  type ScanPayload,
} from "@/lib/vision";
import { filterDetections } from "@/lib/detect-filter";
import {
  priceByCardId,
  priceCard,
  priceCards,
  searchCandidates,
  PRICE_NEEDS_REVIEW,
  type CardPricing,
} from "@/lib/poketrace";
import { lookupMany, searchPriceCharting } from "@/lib/pricecharting";
import { collectionUngradedTotal, type PriceQuote } from "@/lib/pricing";
import { retryIdentify } from "@/lib/vision-retry";
import { confirmMatch } from "@/lib/vision-confirm";
import { applyLowConfidenceGate } from "@/lib/low-confidence-gate";
import { needsRecovery, recoverPartialIdentification } from "@/lib/identify-recovery";
import { aggregateByIdentity, identityKey } from "@/lib/aggregation";
import { getEntitlements, recordScan } from "@/lib/entitlements";
import { FREE_DAILY_SCAN_LIMIT } from "@/lib/stripe";

// PricedCard intentionally does NOT carry the user's crop. The crop is only
// used server-side by the visual-confirmation pass. The UI renders the
// PokeTrace reference image (pricing.candidate.image) for matched cards.
//
// `quotes` is the merged PokeTrace + PriceCharting price ladder. Empty for
// unmatched cards. UI consumes this exclusively — there is no longer any
// per-condition multiplier estimation.
export type PricedCard = IdentifiedCard & {
  pricing: CardPricing;
  quotes: PriceQuote[];
  quantity: number;             // ≥ 1; aggregated binder duplicates surface as one row with quantity = N
  recovered?: boolean;          // true when partial-ID recovery filled in collectorNumber
  retried?: boolean;
  visuallyConfirmed?: boolean;
  previousAttempt?: Pick<
    IdentifiedCard,
    "name" | "setCode" | "collectorNumber" | "rarity" | "confidence"
  >;
};

export type PricedScanPayload = {
  cards: PricedCard[];
  overallConfidence: number;
  unidentifiedCount: number;
  totalValue: number;
  pricedCount: number;
};

export type ScanResult =
  | {
      ok: true;
      fileName: string;
      sizeBytes: number;
      mimeType: string;
      latencyMs: number;
      pricingMs: number;
      passes: "single" | "multi";
      detectedCount: number;
      cache: { read: number; written: number; input: number };
      data: PricedScanPayload;
    }
  | { ok: false; error: string; rateLimited?: boolean; remainingFreeScans?: number };

export type DetectResult =
  | { ok: true; count: number; cards: DetectedCard[]; detectMs: number }
  | { ok: false; error: string; rateLimited?: boolean; remainingFreeScans?: number };

const SUPPORTED_MEDIA: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

type Source = { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string };

const RATE_LIMIT_MESSAGE = `${FREE_DAILY_SCAN_LIMIT}/${FREE_DAILY_SCAN_LIMIT} free scans used today — upgrade to Pro for unlimited.`;

async function readUploadedImage(
  formData: FormData,
): Promise<
  | {
      ok: true;
      supabase: SupabaseClient;
      userId: string;
      buffer: Buffer;
      source: Source;
      fileName: string;
      sizeBytes: number;
      rawMime: string;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file uploaded." };
  }

  const mediaType = SUPPORTED_MEDIA[file.type.toLowerCase()];
  if (!mediaType) {
    if (file.type === "image/heic" || file.type === "image/heif" || /\.hei[cf]$/i.test(file.name)) {
      return {
        ok: false,
        error:
          "HEIC photos aren't supported yet. On iPhone: Settings → Camera → Formats → Most Compatible, or export this photo as JPG.",
      };
    }
    return { ok: false, error: `Unsupported image type: ${file.type || "unknown"}` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    ok: true,
    supabase,
    userId: user.id,
    buffer,
    source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") },
    fileName: file.name,
    sizeBytes: file.size,
    rawMime: file.type,
  };
}

type IdentifyOutcome = {
  payload: ScanPayload;
  cacheRead: number;
  cacheWrite: number;
  inputTokens: number;
};

// In multi-pass mode every IDENTIFY call receives a single-card crop, but the
// generic "identify every card" prompt makes the model hallucinate ghost cards
// from edge bleed (10 crops → 28 entries on the May 19 eyeball test).
// SINGLE_CARD_USER_TEXT pins it to one entry max.
const MULTI_CARD_USER_TEXT =
  "Identify every Pokémon card visible in this photo and return the JSON described in your instructions.";
const SINGLE_CARD_USER_TEXT =
  "This image is a tight crop of exactly ONE Pokémon card from a larger photo. " +
  "Return AT MOST one entry in cards[]. If the card cannot be read at all, return cards: []. " +
  "Do NOT report neighboring cards, edge slivers, or background — there is only one card in this image.";

async function runIdentify(
  source: Source,
  opts?: { singleCardCrop?: boolean },
): Promise<IdentifyOutcome> {
  const singleCardCrop = opts?.singleCardCrop ?? false;
  const response = await anthropic().messages.create({
    model: VISION_MODEL,
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: VISION_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: { format: { type: "json_schema", schema: CARD_SCAN_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source },
          {
            type: "text",
            text: singleCardCrop ? SINGLE_CARD_USER_TEXT : MULTI_CARD_USER_TEXT,
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const payload = JSON.parse(text) as ScanPayload;

  // Defensive: even with the single-card prompt the model occasionally returns
  // multiple entries. Keep the first only — it's almost always the intended card.
  if (singleCardCrop && payload.cards.length > 1) {
    console.log(
      `[runIdentify] singleCardCrop returned ${payload.cards.length} cards; truncating to first`,
    );
    payload.cards = payload.cards.slice(0, 1);
  }

  return {
    payload,
    cacheRead: response.usage.cache_read_input_tokens ?? 0,
    cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
    inputTokens: response.usage.input_tokens,
  };
}

async function runDetect(source: Source): Promise<DetectPayload> {
  const response = await anthropic().messages.create({
    model: VISION_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: DETECT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: { format: { type: "json_schema", schema: DETECT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source },
          {
            type: "text",
            text: "Return one bounding box per visible Pokémon card. No identification — just locate the cards.",
          },
        ],
      },
    ],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(text) as DetectPayload;
}

export async function detectScan(formData: FormData): Promise<DetectResult> {
  const r = await readUploadedImage(formData);
  if (!r.ok) return { ok: false, error: r.error };

  const ent = await getEntitlements(r.supabase, r.userId);
  if (ent.rateLimited) {
    console.log(`[detectScan] user=${r.userId} blocked by rate limit (tier=free, scansToday=${ent.scansToday})`);
    return {
      ok: false,
      error: RATE_LIMIT_MESSAGE,
      rateLimited: true,
      remainingFreeScans: 0,
    };
  }

  const start = Date.now();
  try {
    const detected = await runDetect(r.source);
    const filtered = filterDetections(detected.cards);
    const detectMs = Date.now() - start;
    const s = filtered.stats;
    console.log(
      `[detect] raw=${s.raw} areaDrop=${s.areaDrop} confDrop=${s.confDrop} aspectDrop=${s.aspectDrop} iouMerge=${s.iouMerge} final=${s.final}`,
    );
    console.log(
      `[detectScan] user=${r.userId} tier=${ent.tier} count=${filtered.cards.length} detectMs=${detectMs}`,
    );
    return { ok: true, count: filtered.cards.length, cards: filtered.cards, detectMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[detectScan] error: ${message}`);
    return { ok: false, error: `Detection failed: ${message}` };
  }
}

function safeParseDetections(raw: FormDataEntryValue | null): DetectedCard[] | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter(
        (b): b is DetectedCard =>
          b !== null &&
          typeof b === "object" &&
          typeof (b as DetectedCard).x === "number" &&
          typeof (b as DetectedCard).y === "number" &&
          typeof (b as DetectedCard).width === "number" &&
          typeof (b as DetectedCard).height === "number",
      )
      .map((b) => ({
        x: Math.max(0, Math.min(1, b.x)),
        y: Math.max(0, Math.min(1, b.y)),
        width: Math.max(0, Math.min(1, b.width)),
        height: Math.max(0, Math.min(1, b.height)),
        detectionConfidence:
          typeof b.detectionConfidence === "number" && Number.isFinite(b.detectionConfidence)
            ? Math.max(0, Math.min(1, b.detectionConfidence))
            : 0.5,
      }));
  } catch {
    return null;
  }
}

function aggregatePayloads(payloads: ScanPayload[]): ScanPayload {
  const cards: IdentifiedCard[] = [];
  let unidentifiedCount = 0;
  let confSum = 0;
  let confN = 0;
  for (const p of payloads) {
    for (const c of p.cards) cards.push(c);
    unidentifiedCount += p.unidentifiedCount;
    if (typeof p.overallConfidence === "number" && p.cards.length > 0) {
      confSum += p.overallConfidence * p.cards.length;
      confN += p.cards.length;
    }
  }
  return {
    cards,
    overallConfidence: confN > 0 ? Math.round(confSum / confN) : 0,
    unidentifiedCount,
  };
}

export async function identifyScan(formData: FormData): Promise<ScanResult> {
  const r = await readUploadedImage(formData);
  if (!r.ok) return { ok: false, error: r.error };

  const ent = await getEntitlements(r.supabase, r.userId);
  if (ent.rateLimited) {
    console.log(`[identifyScan] user=${r.userId} blocked by rate limit (tier=free, scansToday=${ent.scansToday})`);
    return {
      ok: false,
      error: RATE_LIMIT_MESSAGE,
      rateLimited: true,
      remainingFreeScans: 0,
    };
  }

  const detections = safeParseDetections(formData.get("boxes"));
  const boxes: BoundingBox[] | null = detections
    ? detections.map((d) => ({ x: d.x, y: d.y, width: d.width, height: d.height }))
    : null;
  const rawDetected = formData.get("detectedCount");
  const detectedCount =
    typeof rawDetected === "string" ? parseInt(rawDetected, 10) || 0 : boxes?.length ?? 0;
  const useMulti = !!boxes && boxes.length > 1;

  console.log(
    `[identifyScan] user=${r.userId} tier=${ent.tier} name=${r.fileName} size=${r.sizeBytes}B type=${r.rawMime} mode=${useMulti ? "multi" : "single"} detectedCount=${detectedCount}`,
  );

  const visionStart = Date.now();
  let payload: ScanPayload;
  // Per-card crop source so we can re-feed the exact same image to the retry pass.
  // For single-pass mode there's one crop = the whole image.
  let cardSources: Source[] = [];
  // Per-card detection (bounding box + detectionConfidence) so the aggregation
  // pass can do IoU dedup. In single-pass mode every card maps to a synthetic
  // full-frame detection.
  let cardDetections: DetectedCard[] = [];
  let cacheRead = 0;
  let cacheWrite = 0;
  let inputTokens = 0;

  try {
    if (useMulti) {
      const crops = await Promise.all(
        boxes.map((box) => cropFromBuffer(r.buffer, box)),
      );
      const cropSources: Source[] = crops.map((crop) => ({
        type: "base64",
        media_type: crop.mediaType,
        data: crop.base64,
      }));
      const outcomes = await Promise.all(
        cropSources.map((s) => runIdentify(s, { singleCardCrop: true })),
      );
      payload = aggregatePayloads(outcomes.map((o) => o.payload));
      for (const o of outcomes) {
        cacheRead += o.cacheRead;
        cacheWrite += o.cacheWrite;
        inputTokens += o.inputTokens;
      }
      // Map every identified card back to the crop it came from.
      // Each crop's payload typically has 0 or 1 cards; we splay sources to match.
      cardSources = outcomes.flatMap((o, i) => o.payload.cards.map(() => cropSources[i]));
      cardDetections = outcomes.flatMap((o, i) =>
        o.payload.cards.map(() => detections![i]),
      );
    } else {
      const outcome = await runIdentify(r.source);
      payload = outcome.payload;
      cacheRead = outcome.cacheRead;
      cacheWrite = outcome.cacheWrite;
      inputTokens = outcome.inputTokens;
      cardSources = payload.cards.map(() => r.source);
      // Synthetic full-frame detection so the aggregation contract is the same
      // in both modes.
      cardDetections = payload.cards.map(() => ({
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        detectionConfidence: 1,
      }));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[identifyScan] vision error: ${message}`);
    return { ok: false, error: `Vision call failed: ${message}` };
  }
  const visionMs = Date.now() - visionStart;

  // Map each crop to a data URL up-front — the recovery + confirm passes both
  // need it to compare against PokeTrace/PriceCharting candidate images.
  const cardCropDataUrls: string[] = cardSources.map(
    (s) => `data:${s.media_type};base64,${s.data}`,
  );

  // -------- Partial-ID recovery pass --------
  // Vision sometimes reads NAME + SET CODE but misses the collector number
  // (typical on Mega ex cards where the bottom edge is cropped or holo-warped).
  // Recovery looks up name + setCode across PokeTrace + PriceCharting and
  // populates the missing collector number when a single candidate emerges —
  // or visually confirms one of several. Anything ambiguous stays as-is and
  // will route to review like before.
  const recovered = new Array<boolean>(payload.cards.length).fill(false);
  const recoveryStart = Date.now();
  const recoveryIndices = payload.cards
    .map((c, i) => (needsRecovery(c) ? i : -1))
    .filter((i) => i >= 0);
  if (recoveryIndices.length > 0) {
    await Promise.all(
      recoveryIndices.map(async (i) => {
        const c = payload.cards[i];
        if (!c.name || !c.setCode) return;
        try {
          const outcome = await recoverPartialIdentification(
            { name: c.name, setCode: c.setCode, cropDataUrl: cardCropDataUrls[i] },
            { searchPokeTrace: searchCandidates, searchPriceCharting, confirmMatch },
          );
          if (outcome.resolved) {
            payload.cards[i] = { ...c, collectorNumber: outcome.collectorNumber };
            recovered[i] = true;
            console.log(
              `[identifyScan] recovery card=${i} "${c.name}" ${c.setCode} → #${outcome.collectorNumber} via=${outcome.via}`,
            );
          }
        } catch (err) {
          console.error(
            `[identifyScan] recovery threw for card ${i}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }),
    );
  }
  const recoveryMs = Date.now() - recoveryStart;
  const recoveredCount = recovered.filter(Boolean).length;

  const pricingStart = Date.now();
  let pricings = await priceCards(
    payload.cards.map((c) => ({
      status: c.status,
      name: c.name,
      setCode: c.setCode,
      collectorNumber: c.collectorNumber,
      rarity: c.rarity,
      regulationMark: c.regulationMark,
    })),
  );

  // -------- Visual confirmation pass (Sonnet 4.6, multi-image) --------
  // For cards where text-only matching is ambiguous (low_score, no_score in a
  // tight band) but Vision DID read enough fields, ask the model to compare
  // the user's crop against the top PokeTrace candidate images.
  const CONFIRMABLE: ReadonlySet<string> = new Set(["low_score", "no_candidates", "regulation_mismatch"]);
  const visuallyConfirmed = new Array<boolean>(payload.cards.length).fill(false);
  let confirmMs = 0;

  const confirmIndices = pricings
    .map((p, i) => (p.matched ? -1 : i))
    .filter((i) => i >= 0)
    .filter((i) => {
      if (payload.cards[i].status !== "identified") return false;
      const f = (pricings[i] as { failure?: { code: string; topCandidates?: { image: string | null }[] } }).failure;
      if (!f || !CONFIRMABLE.has(f.code)) return false;
      const withImages = (f.topCandidates ?? []).filter((c) => c.image);
      return withImages.length >= 1;
    });

  if (confirmIndices.length > 0) {
    const confirmStart = Date.now();
    await Promise.all(
      confirmIndices.map(async (i) => {
        const failed = pricings[i];
        if (failed.matched) return;
        const candidates = (failed.failure.topCandidates ?? [])
          .filter((c) => c.image)
          .slice(0, 3);
        if (candidates.length === 0) return;
        try {
          const result = await confirmMatch(
            cardCropDataUrls[i],
            candidates.map((c) => ({
              image: c.image as string,
              name: c.name,
              set: c.set,
              collectorNumber: c.cardNumber,
            })),
          );
          if (result.chosenIndex == null || result.confidence === "low") return;
          const picked = candidates[result.chosenIndex];
          const repriced = await priceByCardId(picked);
          if (repriced) {
            pricings[i] = repriced;
            visuallyConfirmed[i] = true;
            console.log(
              `[identifyScan] visual-confirm card=${i} picked="${picked.name}" #${picked.cardNumber} confidence=${result.confidence}`,
            );
          }
        } catch (err) {
          console.error(`[identifyScan] confirmMatch failed for card ${i}: ${err instanceof Error ? err.message : err}`);
        }
      }),
    );
    confirmMs = Date.now() - confirmStart;
  }

  // -------- Low-confidence gate --------
  // PokeTrace returns lowConfidence=true when it had to fall back to name-only
  // fuzzy matching. Those matches frequently land on the wrong printing — e.g.
  // a Chimchar Vision misread as "MEW #041" fuzzied to POP Series 6. Run the
  // visual confirmation pass against the top candidates; demote to "needs
  // review" unless the model picks one with high confidence.
  if (pricings.some((p) => p.matched && p.lowConfidence)) {
    const gateStart = Date.now();
    const gated = await applyLowConfidenceGate(
      { pricings, cards: payload.cards, cardCropDataUrls },
      { confirmMatch, priceByCardId, searchCandidates },
    );
    pricings = gated.pricings;
    payload.cards = gated.cards;
    for (let i = 0; i < gated.visuallyConfirmed.length; i++) {
      if (gated.visuallyConfirmed[i]) visuallyConfirmed[i] = true;
    }
    confirmMs += Date.now() - gateStart;
  }

  // -------- Retry pass: re-identify failed cards with Opus 4.5 + failure context --------
  // Framework rule: only retry status === "identified" with codes that imply
  // Vision could be improved (no_candidates, low_score). Skip
  // "insufficient_information" (route to correction form) and "unreadable"
  // (no anchor for the retry).
  const RETRYABLE: ReadonlySet<string> = new Set(["no_candidates", "low_score", "regulation_mismatch"]);
  const failedIndices = pricings
    .map((p, i) => (p.matched ? -1 : i))
    .filter((i) => i >= 0)
    .filter((i) => {
      if (payload.cards[i].status !== "identified") return false;
      const f = (pricings[i] as { failure?: { code: string } }).failure;
      return !!f && RETRYABLE.has(f.code);
    });

  const retried = new Array<boolean>(payload.cards.length).fill(false);
  const previousAttempts: Array<PricedCard["previousAttempt"] | undefined> = new Array(payload.cards.length).fill(undefined);
  let retryMs = 0;

  if (failedIndices.length > 0) {
    const retryStart = Date.now();
    await Promise.all(
      failedIndices.map(async (i) => {
        const failed = pricings[i];
        if (failed.matched) return;
        const source = cardSources[i];
        if (!source) return;
        try {
          const outcome = await retryIdentify(source, payload.cards[i], failed.failure);
          cacheRead += outcome.cacheRead;
          cacheWrite += outcome.cacheWrite;
          inputTokens += outcome.inputTokens;
          if (!outcome.card) return;
          const repriced = await priceCard({
            status: outcome.card.status,
            name: outcome.card.name,
            setCode: outcome.card.setCode,
            collectorNumber: outcome.card.collectorNumber,
            rarity: outcome.card.rarity,
            regulationMark: outcome.card.regulationMark,
          });
          previousAttempts[i] = {
            name: payload.cards[i].name,
            setCode: payload.cards[i].setCode,
            collectorNumber: payload.cards[i].collectorNumber,
            rarity: payload.cards[i].rarity,
            confidence: payload.cards[i].confidence,
          };
          payload.cards[i] = outcome.card;
          pricings[i] = repriced;
          retried[i] = true;
        } catch (err) {
          console.error(`[identifyScan] retry failed for card ${i}: ${err instanceof Error ? err.message : err}`);
        }
      }),
    );
    retryMs = Date.now() - retryStart;
  }

  // For any card still unmatched after retry, surface the "Needs manual review" copy.
  // After-retry copy: cards that Vision identified but PokeTrace still couldn't
  // match get "Needs manual review". Cards Vision itself flagged as
  // insufficient_information keep their friendlier copy untouched.
  pricings = pricings.map((p) => {
    if (p.matched) return p;
    if (p.failure.code === "insufficient_information") return p;
    return { ...p, reason: PRICE_NEEDS_REVIEW };
  });

  // -------- PriceCharting fan-out (parallel, after PokeTrace settles) --------
  // PokeTrace remains authoritative for IDENTIFICATION + the ungraded
  // multi-source view (eBay / TCGplayer / Cardmarket NM). PriceCharting is
  // authoritative for the GRADED ladder (PSA 7/8/9/9.5/10, CGC 10, SGC 10,
  // BGS 10) and also serves as a 4th cross-reference for ungraded.
  // Each card's PriceCharting product ID is cached in Supabase after the
  // first scan, so subsequent scans pay one fewer API call per matched card.
  const pcStart = Date.now();
  const pcInputs = pricings.map((p) =>
    p.matched
      ? {
          poketraceId: p.candidate.id,
          name: p.candidate.name,
          setName: p.candidate.set,
          collectorNumber: p.candidate.cardNumber,
        }
      : null,
  );
  const pcInputsCompact = pcInputs.filter((i): i is NonNullable<typeof i> => i !== null);
  const pcResultsCompact = pcInputsCompact.length > 0 ? await lookupMany(pcInputsCompact) : [];
  const pcResults: Array<Awaited<ReturnType<typeof lookupMany>>[number] | null> = [];
  let resultIdx = 0;
  for (const input of pcInputs) {
    pcResults.push(input ? (pcResultsCompact[resultIdx++] ?? null) : null);
  }
  const pricechartingMs = Date.now() - pcStart;
  const pricechartingHits = pcResults.filter((r) => r !== null).length;

  // Merge per-card: each row carries quotes from PokeTrace + PriceCharting.
  const mergedQuotes: PriceQuote[][] = pricings.map((p, i) => {
    if (!p.matched) return [];
    const pcQuotes = pcResults[i]?.quotes ?? [];
    return [...p.quotes, ...pcQuotes];
  });

  const pricingMs = Date.now() - pricingStart;

  // -------- Aggregation: IoU dedup + quantity rollup --------
  // Cards with the same identity (setCode + collectorNumber + variant) collapse
  // into one row. Overlapping detections drop down to quantity=1 (the
  // detector boxed one card twice); non-overlapping detections roll into
  // quantity=N (binder page with multiples). Cards without a usable identity
  // key — insufficient_information rows, unmatched-no-number cards — are left
  // ungrouped and surface as individual review rows.
  const aggregateItems = payload.cards.map((card, i) => {
    const matched = pricings[i].matched ? pricings[i] : null;
    const setCode =
      matched && "candidate" in matched ? matched.candidate.setSlug : card.setCode;
    const collectorNumber =
      matched && "candidate" in matched
        ? matched.candidate.cardNumber
        : card.collectorNumber;
    const variant =
      matched && "candidate" in matched ? matched.candidate.variant : card.variant;
    return {
      key: identityKey({ setCode, collectorNumber, variant }),
      box: cardDetections[i],
      detectionConfidence: cardDetections[i].detectionConfidence,
    };
  });
  const decisions = aggregateByIdentity(aggregateItems);
  const aggregatedDrops = decisions.filter((d) => d.type === "merged").length;
  if (aggregatedDrops > 0) {
    console.log(
      `[identifyScan] aggregation collapsed ${aggregatedDrops} duplicate row(s) — ${payload.cards.length} → ${payload.cards.length - aggregatedDrops}`,
    );
  }

  const pricedCards: PricedCard[] = [];
  for (let i = 0; i < payload.cards.length; i++) {
    const d = decisions[i];
    if (d.type !== "kept") continue;
    pricedCards.push({
      ...payload.cards[i],
      pricing: pricings[i],
      quotes: mergedQuotes[i],
      quantity: d.quantity,
      recovered: recovered[i] || undefined,
      retried: retried[i] || undefined,
      visuallyConfirmed: visuallyConfirmed[i] || undefined,
      previousAttempt: previousAttempts[i],
    });
  }

  const totalValue = collectionUngradedTotal(pricedCards);
  const pricedCount = pricedCards.filter(
    (c) => c.pricing.matched && !c.pricing.lowConfidence,
  ).length;
  const unidentifiedCount = pricedCards.filter(
    (c) => c.status === "insufficient_information",
  ).length;

  // Record the scan AFTER it succeeds. Free users now have 0 remaining today.
  await recordScan(r.supabase, r.userId, {
    fileName: r.fileName,
    sizeBytes: r.sizeBytes,
    mimeType: r.rawMime,
    passes: useMulti ? "multi" : "single",
    detectedCount: detectedCount || payload.cards.length,
    identifiedCount: payload.cards.length,
    totalValue,
  });

  const retryCount = retried.filter(Boolean).length;
  const visualConfirmCount = visuallyConfirmed.filter(Boolean).length;
  console.log(
    `[identifyScan] user=${r.userId} tier=${ent.tier} mode=${useMulti ? "multi" : "single"} crops=${useMulti ? boxes.length : 1} identified=${payload.cards.length} aggregatedRows=${pricedCards.length} priced=${pricedCount} recovered=${recoveredCount} visualConfirmed=${visualConfirmCount} retried=${retryCount} total=$${totalValue} unidentified=${payload.unidentifiedCount} overallConfidence=${payload.overallConfidence} visionMs=${visionMs} recoveryMs=${recoveryMs} confirmMs=${confirmMs} retryMs=${retryMs} pricingMs=${pricingMs} pricechartingMs=${pricechartingMs} pricechartingHits=${pricechartingHits} cache_read=${cacheRead} cache_write=${cacheWrite}`,
  );

  return {
    ok: true,
    fileName: r.fileName,
    sizeBytes: r.sizeBytes,
    mimeType: r.rawMime,
    latencyMs: visionMs,
    pricingMs,
    passes: useMulti ? "multi" : "single",
    detectedCount: detectedCount || payload.cards.length,
    cache: { read: cacheRead, written: cacheWrite, input: inputTokens },
    data: {
      cards: pricedCards,
      overallConfidence: payload.overallConfidence,
      unidentifiedCount,
      totalValue,
      pricedCount,
    },
  };
}
