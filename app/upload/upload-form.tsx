"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { detectScan, identifyScan, type PricedCard, type ScanResult } from "./actions";
import { CorrectionLink } from "./correction-form";
import { ConfirmRightButton } from "./confirm-right-button";
import {
  SOURCE_LABELS,
  TIER_LABELS,
  bestUngraded,
  gradedLadder,
  quotesAtTier,
  type PriceQuote,
  type PriceQuoteSource,
} from "@/lib/pricing";
import { runScanPipeline, type ScanMode } from "@/lib/scan-pipeline";

const ACCEPT = "image/jpeg,image/png,image/heic,image/heif";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type Phase =
  | { kind: "idle" }
  | { kind: "optimizing" }
  | { kind: "detecting" }
  | { kind: "identifying"; count: number }
  | { kind: "error"; message: string; rateLimited?: boolean }
  | { kind: "done"; result: Extract<ScanResult, { ok: true }> };

const MAX_LONG_EDGE_PX = 2400;
const RESIZE_QUALITY = 0.85;

/**
 * Browser-side canvas resize. Returns the original file if the long edge is
 * already <= MAX_LONG_EDGE_PX, otherwise a JPEG-encoded copy capped at
 * MAX_LONG_EDGE_PX on the long edge. This keeps Server Action body sizes
 * predictable so binder photos don't hit the 10MB cap and lets Vision crops
 * stay sharp without paying for redundant pixels.
 */
async function maybeResizeImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const long = Math.max(bitmap.width, bitmap.height);
  if (long <= MAX_LONG_EDGE_PX) {
    bitmap.close();
    return file;
  }
  const scale = MAX_LONG_EDGE_PX / long;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", RESIZE_QUALITY),
  );
  if (!blob) return file;

  const renamed = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  const resized = new File([blob], renamed, { type: "image/jpeg", lastModified: Date.now() });

  const mb = (n: number) => (n / 1024 / 1024).toFixed(2);
  console.log(
    `[upload] resized ${bitmap.width}x${bitmap.height} (${mb(file.size)}MB) -> ${w}x${h} (${mb(resized.size)}MB)`,
  );
  return resized;
}

function parseMode(value: string | null): ScanMode {
  return value === "binder" ? "binder" : "single";
}

export function UploadForm({ tier }: { tier?: "free" | "pro" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = parseMode(searchParams.get("mode"));
  const [mode, setModeState] = useState<ScanMode>(initialMode);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [fileName, setFileName] = useState<string | null>(null);

  // Mirror the mode to the URL so users can share a specific scan mode link
  // and refreshes preserve the chosen mode.
  const setMode = useCallback(
    (next: ScanMode) => {
      setModeState(next);
      const params = new URLSearchParams(searchParams);
      if (next === "single") params.delete("mode");
      else params.set("mode", next);
      const qs = params.toString();
      router.replace(qs ? `/upload?${qs}` : "/upload", { scroll: false });
    },
    [router, searchParams],
  );

  // If the URL param changes externally (back/forward navigation), sync state.
  useEffect(() => {
    const next = parseMode(searchParams.get("mode"));
    if (next !== mode) setModeState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openPicker() {
    inputRef.current?.click();
  }

  async function submit(file: File) {
    setFileName(file.name);
    setPhase({ kind: "optimizing" });
    const optimized = await maybeResizeImage(file).catch(() => file);

    const result = await runScanPipeline(
      optimized,
      mode,
      { detectScan, identifyScan },
      {
        onDetect: () => setPhase({ kind: "detecting" }),
        onIdentify: (count) => setPhase({ kind: "identifying", count }),
      },
    );

    if (!result.ok) {
      setPhase({ kind: "error", message: result.error, rateLimited: result.rateLimited });
      return;
    }
    setPhase({ kind: "done", result });
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) submit(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) submit(file);
  }

  const pending =
    phase.kind === "optimizing" || phase.kind === "detecting" || phase.kind === "identifying";

  const dropCopy =
    mode === "single"
      ? "Tap or drop a Pokémon card photo"
      : "Tap or drop a binder page photo";
  const dropHint =
    mode === "single"
      ? "One card per photo · JPG or PNG"
      : "Multiple cards per photo · up to 50 cards";

  return (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") openPicker();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
            : "border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        }`}
      >
        <p className="text-base font-medium">{pending ? "Scanning..." : dropCopy}</p>
        <p className="text-sm text-zinc-500">
          {dropHint}
          {tier === "pro" && " · Pro: unlimited"}
        </p>
        {fileName && !pending && (
          <p className="mt-2 truncate text-xs text-zinc-500">{fileName}</p>
        )}
        <input
          ref={inputRef}
          type="file"
          name="photo"
          accept={ACCEPT}
          capture="environment"
          className="hidden"
          onChange={onChange}
        />
      </div>

      <ModeToggle mode={mode} onChange={setMode} disabled={pending} />
      <PhaseBanner phase={phase} />

      {phase.kind === "done" && <ScanResultView result={phase.result} />}
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: ScanMode;
  onChange: (m: ScanMode) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
      {mode === "single" ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("binder")}
          className="underline decoration-zinc-300 underline-offset-4 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:decoration-zinc-700 dark:hover:text-zinc-300"
        >
          Advanced: scan a binder page (multiple cards)
        </button>
      ) : (
        <>
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Binder mode
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("single")}
            className="underline decoration-zinc-300 underline-offset-4 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:decoration-zinc-700 dark:hover:text-zinc-300"
          >
            Switch back to single-card
          </button>
        </>
      )}
    </div>
  );
}

function PhaseBanner({ phase }: { phase: Phase }) {
  if (phase.kind === "optimizing") {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-900 dark:bg-zinc-100" />
        Optimizing image…
      </div>
    );
  }
  if (phase.kind === "detecting") {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-900 dark:bg-zinc-100" />
        Detecting cards in your photo…
      </div>
    );
  }
  if (phase.kind === "identifying") {
    const label =
      phase.count <= 1
        ? "Reading your card and fetching live prices…"
        : `Detected ${phase.count} cards, analyzing each in parallel…`;
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-900 dark:bg-zinc-100" />
        {label}
      </div>
    );
  }
  if (phase.kind === "error") {
    if (phase.rateLimited) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">{phase.message}</p>
          <a
            href="/upload"
            className="mt-3 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            View upgrade options
          </a>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {phase.message}
      </div>
    );
  }
  return null;
}

function ScanResultView({ result }: { result: Extract<ScanResult, { ok: true }> }) {
  // The server's `passes` is authoritative for layout — even if the user
  // toggles mode after a scan, the result reflects what actually ran.
  if (result.passes === "single") {
    return <SingleCardResultView result={result} />;
  }
  return <BinderResultView result={result} />;
}

// ===== Single-card result =====

function SingleCardResultView({ result }: { result: Extract<ScanResult, { ok: true }> }) {
  const { data, latencyMs, pricingMs } = result;
  const [zoom, setZoom] = useState(false);

  if (data.cards.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        We couldn&apos;t read a Pokémon card in that photo. Try a closer shot under
        even lighting, or switch to{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">Binder mode</span>{" "}
        if the photo has more than one card.
      </div>
    );
  }

  // Single-card mode usually returns exactly one card. If the model saw more
  // (rare on a clean single-card photo), we focus on the highest-confidence
  // match and surface the others as a hint.
  const sorted = [...data.cards].sort(
    (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
  );
  const primary = sorted[0];
  const extras = sorted.slice(1);
  const totalMs = latencyMs + pricingMs;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <SingleCardView card={primary} onZoom={() => setZoom(true)} />
        <div className="border-t border-zinc-100 px-5 py-3 text-[11px] text-zinc-400 dark:border-zinc-800 tabular-nums">
          Scanned in {(totalMs / 1000).toFixed(1)}s · single-card mode
        </div>
      </div>

      {extras.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          We also picked up{" "}
          <span className="font-semibold">
            {extras.length} other card{extras.length === 1 ? "" : "s"}
          </span>{" "}
          in this photo:{" "}
          {extras
            .map((c) => c.pricing.matched ? c.pricing.candidate.name : c.name ?? "(unreadable)")
            .join(", ")}
          . Switch to Binder mode for full per-card pricing.
        </div>
      )}

      {zoom && primary.pricing.matched && primary.pricing.candidate.image && (
        <ZoomOverlay card={primary} onClose={() => setZoom(false)} />
      )}

      <details className="rounded-xl bg-zinc-950 p-4 text-xs text-zinc-100">
        <summary className="cursor-pointer text-zinc-400">Raw JSON</summary>
        <pre className="mt-3 overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  );
}

function SingleCardView({ card, onZoom }: { card: PricedCard; onZoom: () => void }) {
  const insufficient = card.status === "insufficient_information";
  const lowConfidence = card.pricing.matched && card.pricing.lowConfidence;
  const matched = card.pricing.matched ? card.pricing : null;
  const refUrl = matched?.candidate.image ?? null;

  const displayName =
    matched?.candidate.name ?? card.name ?? (insufficient ? "Couldn't read this card" : "(no name)");
  const setLabel =
    matched?.candidate.set ?? card.setCode ?? card.setCodeRaw ?? card.setSymbolDescription ?? "?";
  const numberLabel = matched?.candidate.cardNumber ?? card.collectorNumber ?? "?";
  const rarityLabel = card.rarity ?? "—";

  const ungraded = bestUngraded(card.quotes);
  const ungradedBySource = quotesAtTier(card.quotes, "RAW_UNGRADED");
  const graded = gradedLadder(card.quotes);

  return (
    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
      {/* Reference image — large, click to zoom */}
      <div className="shrink-0 self-start">
        {refUrl ? (
          <button
            type="button"
            onClick={onZoom}
            className="block cursor-zoom-in rounded-xl border border-zinc-200 transition hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
            aria-label={`Zoom: ${matched!.candidate.name}`}
          >
            <Image
              src={refUrl}
              alt={`Reference: ${matched!.candidate.name}`}
              width={240}
              height={336}
              unoptimized
              className="block h-[336px] w-[240px] rounded-[10px] object-cover"
            />
          </button>
        ) : (
          <div className="flex h-[336px] w-[240px] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/30">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 text-2xl font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              ?
            </div>
          </div>
        )}
      </div>

      {/* Detail column */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {displayName}
            </h2>
            <p className="mt-0.5 truncate text-sm text-zinc-500">
              {setLabel} · #{numberLabel} · {rarityLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {insufficient && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Couldn&apos;t read — needs review
                </span>
              )}
              {!insufficient && lowConfidence && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Low confidence
                </span>
              )}
              {card.visuallyConfirmed && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Visual match
                </span>
              )}
              {card.recovered && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  Recovered
                </span>
              )}
              {card.language && card.language !== "EN" && card.language !== "unknown" && (
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {card.language}
                </span>
              )}
              {card.regulationMark && (
                <span className="inline-block rounded border border-zinc-300 px-1 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                  Reg {card.regulationMark}
                </span>
              )}
            </div>
          </div>
          <ConfidenceBadge value={card.confidence} status={card.status} />
        </div>

        {/* Headline price */}
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Estimated value (ungraded)
          </p>
          {ungraded ? (
            <p className="mt-1 text-4xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {lowConfidence && "~"}
              {USD.format(ungraded.amount)}
            </p>
          ) : (
            <p className="mt-1 text-xl italic text-zinc-400">No ungraded price available</p>
          )}

          {/* All ungraded sources inline */}
          {ungradedBySource.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sortedSources(ungradedBySource).map((q, i) => (
                <SourceChip key={`${q.source}-${i}`} source={q.source} amount={q.amount} />
              ))}
            </div>
          )}
        </div>

        {/* Graded ladder — expanded by default in single-card mode */}
        {graded.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              Graded comps ({graded.length} {graded.length === 1 ? "tier" : "tiers"})
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-3">
              {graded.map(({ tier, best }) => (
                <li key={tier} className="flex items-baseline justify-between gap-2">
                  <span className="text-zinc-500">{TIER_LABELS[tier]}</span>
                  <span className="tabular-nums font-medium text-zinc-700 dark:text-zinc-300">
                    {USD.format(best.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Failure reason for unmatched cards */}
        {!card.pricing.matched && !insufficient && (
          <p className="mt-5 text-xs italic text-zinc-400">{card.pricing.reason}</p>
        )}

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {matched && (
            <ConfirmRightButton
              cardId={matched.candidate.id}
              matchedImageUrl={matched.candidate.image}
              cardName={matched.candidate.name}
              cardSet={matched.candidate.set}
              cardNumber={matched.candidate.cardNumber}
            />
          )}
          <CorrectionLink
            originalName={card.name ?? ""}
            originalSet={card.setCode ?? card.setCodeRaw ?? ""}
            originalCardNumber={card.collectorNumber ?? ""}
            startOpen={insufficient || !!lowConfidence}
          />
        </div>
      </div>
    </div>
  );
}

function sortedSources(quotes: PriceQuote[]): PriceQuote[] {
  // Display order: highest amount first, but always show all four if present.
  return [...quotes].sort((a, b) => b.amount - a.amount);
}

function SourceChip({ source, amount }: { source: PriceQuoteSource; amount: number }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium dark:border-zinc-700 dark:bg-zinc-800">
      <span className="text-zinc-500">{SOURCE_LABELS[source]}</span>
      <span className="tabular-nums text-zinc-900 dark:text-zinc-100">
        {USD.format(amount)}
      </span>
    </span>
  );
}

// ===== Binder result (multi-card list, unchanged behavior) =====

function BinderResultView({ result }: { result: Extract<ScanResult, { ok: true }> }) {
  const { data, latencyMs, pricingMs, passes } = result;
  const [zoomedIdx, setZoomedIdx] = useState<number | null>(null);

  const priced = data.cards.filter(
    (c) => c.pricing.matched && !c.pricing.lowConfidence,
  ).length;
  const detected = result.detectedCount;
  const review = Math.max(0, data.cards.length - priced);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Estimated value (ungraded)</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {USD.format(data.totalValue)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {priced} priced · {review} need review · {detected} cards detected
            </p>
          </div>
          <div className="text-right">
            <ConfidenceBadge value={data.overallConfidence} />
            <p className="mt-1 text-xs text-zinc-400 tabular-nums">
              {(latencyMs / 1000).toFixed(1)}s vision · {(pricingMs / 1000).toFixed(1)}s prices
              {passes === "multi" && " · multi-pass"}
            </p>
          </div>
        </div>

        {data.cards.length === 0 ? (
          <p className="text-sm text-zinc-500">No cards were identified with sufficient confidence.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {data.cards.map((card, idx) => (
              <CardRow key={idx} card={card} onZoom={() => setZoomedIdx(idx)} />
            ))}
          </ul>
        )}
      </div>

      {zoomedIdx !== null && data.cards[zoomedIdx]?.pricing.matched && (
        <ZoomOverlay
          card={data.cards[zoomedIdx]}
          onClose={() => setZoomedIdx(null)}
        />
      )}

      <details className="rounded-xl bg-zinc-950 p-4 text-xs text-zinc-100">
        <summary className="cursor-pointer text-zinc-400">Raw JSON</summary>
        <pre className="mt-3 overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  );
}

function CardRow({ card, onZoom }: { card: PricedCard; onZoom: () => void }) {
  const insufficient = card.status === "insufficient_information";
  const lowConfidence = card.pricing.matched && card.pricing.lowConfidence;
  const matched = card.pricing.matched ? card.pricing : null;

  const displayName = matched?.candidate.name ?? card.name ?? (insufficient ? "Unreadable card" : "(no name)");
  const setLabel = matched?.candidate.set ?? card.setCode ?? card.setCodeRaw ?? card.setSymbolDescription ?? "?";
  const numberLabel = matched?.candidate.cardNumber ?? card.collectorNumber ?? "?";
  const rarityLabel = card.rarity ?? "?";

  return (
    <li className="flex items-start gap-4 py-3">
      <ReferenceThumb card={card} onZoom={onZoom} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {displayName}
          {card.quantity > 1 && (
            <span className="ml-2 inline-block rounded-md bg-zinc-900 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white dark:bg-zinc-100 dark:text-zinc-900">
              × {card.quantity}
            </span>
          )}
          {insufficient && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Couldn&apos;t read — needs review
            </span>
          )}
          {!insufficient && lowConfidence && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              low confidence
            </span>
          )}
          {card.visuallyConfirmed && (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              visual match
            </span>
          )}
          {card.language && card.language !== "EN" && card.language !== "unknown" && (
            <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {card.language}
            </span>
          )}
        </p>
        <p className="truncate text-sm text-zinc-500">
          {setLabel} · #{numberLabel} · {rarityLabel}
        </p>
        <p className="text-xs text-zinc-400">
          {card.conditionEstimate ?? "—"}
          {card.regulationMark && (
            <span className="ml-2 inline-block rounded border border-zinc-300 px-1 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              {card.regulationMark}
            </span>
          )}
          {card.retried && (
            <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              re-checked
            </span>
          )}
        </p>
        <PriceSummary card={card} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {matched && (
            <ConfirmRightButton
              cardId={matched.candidate.id}
              matchedImageUrl={matched.candidate.image}
              cardName={matched.candidate.name}
              cardSet={matched.candidate.set}
              cardNumber={matched.candidate.cardNumber}
            />
          )}
          <CorrectionLink
            originalName={card.name ?? ""}
            originalSet={card.setCode ?? card.setCodeRaw ?? ""}
            originalCardNumber={card.collectorNumber ?? ""}
            startOpen={insufficient || !!lowConfidence}
          />
        </div>
      </div>
      <ConfidenceBadge value={card.confidence} status={card.status} />
    </li>
  );
}

function ReferenceThumb({ card, onZoom }: { card: PricedCard; onZoom: () => void }) {
  const matched = card.pricing.matched ? card.pricing : null;
  const refUrl = matched?.candidate.image ?? null;

  if (card.status === "insufficient_information" || !refUrl) {
    return (
      <div className="flex h-[112px] w-[80px] shrink-0 items-center justify-center">
        <div
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
        >
          <span className="text-base font-semibold">?</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onZoom}
      className="shrink-0 cursor-zoom-in rounded-lg border border-zinc-200 transition hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
      aria-label={`Zoom: ${matched!.candidate.name}`}
    >
      <Image
        src={refUrl}
        alt={`Reference: ${matched!.candidate.name}`}
        width={80}
        height={112}
        unoptimized
        className="block h-[112px] w-[80px] rounded-lg object-cover"
      />
    </button>
  );
}

function ZoomOverlay({ card, onClose }: { card: PricedCard; onClose: () => void }) {
  const matched = card.pricing.matched ? card.pricing : null;
  if (!matched || !matched.candidate.image) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    >
      <div
        className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4 shadow-2xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Foil matched this card
        </p>
        <Image
          src={matched.candidate.image}
          alt={matched.candidate.name}
          width={240}
          height={336}
          unoptimized
          className="h-[336px] w-[240px] rounded-md border border-zinc-300 object-contain dark:border-zinc-700"
        />
        <p className="text-sm font-medium">
          {matched.candidate.name}
        </p>
        <p className="text-xs text-zinc-500">
          {matched.candidate.set} · #{matched.candidate.cardNumber}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function PriceSummary({ card }: { card: PricedCard }) {
  const p = card.pricing;
  if (!p.matched) {
    if (
      p.failure.code === "insufficient_information" ||
      p.failure.code === "low_confidence_unconfirmed"
    ) {
      return null;
    }
    return <p className="mt-1.5 text-xs italic text-zinc-400">{p.reason}</p>;
  }

  const lc = p.lowConfidence;
  const ungraded = bestUngraded(card.quotes);
  const allUngraded = quotesAtTier(card.quotes, "RAW_UNGRADED");
  const graded = gradedLadder(card.quotes);

  return (
    <div className="mt-1.5">
      {ungraded ? (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-semibold tabular-nums">
            {lc && "~"}
            {USD.format(ungraded.amount)}
          </span>
          <span className="text-xs text-zinc-500">
            ungraded · best of {allUngraded.length} {allUngraded.length === 1 ? "source" : "sources"}
            {lc && " · low confidence"}
          </span>
          {card.quantity > 1 && (
            <span className="text-xs font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
              · × {card.quantity} = {USD.format(Math.round(ungraded.amount * card.quantity * 100) / 100)}
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs italic text-zinc-400">No ungraded price available</p>
      )}

      {graded.length > 0 && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            Show graded prices ({graded.length} {graded.length === 1 ? "tier" : "tiers"})
          </summary>
          <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-zinc-600 dark:text-zinc-400 sm:grid-cols-3">
            {graded.map(({ tier, best }) => (
              <li key={tier} className="flex items-baseline justify-between gap-2">
                <span className="text-zinc-500">{TIER_LABELS[tier]}</span>
                <span className="tabular-nums font-medium text-zinc-700 dark:text-zinc-300">
                  {USD.format(best.amount)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {allUngraded.length > 1 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            Compare ungraded sources
          </summary>
          <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-zinc-600 dark:text-zinc-400 sm:grid-cols-4">
            {allUngraded
              .slice()
              .sort((a: PriceQuote, b: PriceQuote) => b.amount - a.amount)
              .map((q, i) => (
                <li key={`${q.source}-${i}`} className="flex items-baseline justify-between gap-2">
                  <span className="text-zinc-500">{SOURCE_LABELS[q.source]}</span>
                  <span className="tabular-nums">{USD.format(q.amount)}</span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ConfidenceBadge({
  value,
  status,
}: {
  value: number | null;
  status?: "identified" | "insufficient_information";
}) {
  if (status === "insufficient_information" || value == null) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        review
      </span>
    );
  }
  const tone =
    value >= 80
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : value >= 50
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {value}% confident
    </span>
  );
}
