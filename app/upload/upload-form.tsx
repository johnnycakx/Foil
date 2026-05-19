"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
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
} from "@/lib/pricing";

const ACCEPT = "image/jpeg,image/png,image/heic,image/heif";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type Phase =
  | { kind: "idle" }
  | { kind: "detecting" }
  | { kind: "identifying"; count: number }
  | { kind: "error"; message: string; rateLimited?: boolean }
  | { kind: "done"; result: Extract<ScanResult, { ok: true }> };

export function UploadForm({ tier }: { tier?: "free" | "pro" }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [fileName, setFileName] = useState<string | null>(null);

  function openPicker() {
    inputRef.current?.click();
  }

  async function submit(file: File) {
    setFileName(file.name);
    setPhase({ kind: "detecting" });

    const fdDetect = new FormData();
    fdDetect.append("photo", file);
    const detection = await detectScan(fdDetect);
    if (!detection.ok) {
      setPhase({ kind: "error", message: detection.error, rateLimited: detection.rateLimited });
      return;
    }

    setPhase({ kind: "identifying", count: detection.count });

    const fdIdentify = new FormData();
    fdIdentify.append("photo", file);
    fdIdentify.append("detectedCount", String(detection.count));
    fdIdentify.append("boxes", JSON.stringify(detection.cards));
    const result = await identifyScan(fdIdentify);
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

  const pending = phase.kind === "detecting" || phase.kind === "identifying";

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
        <p className="text-base font-medium">
          {pending ? "Scanning..." : "Tap or drop a card photo"}
        </p>
        <p className="text-sm text-zinc-500">
          JPG or PNG — one image, up to 50 cards
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

      <PhaseBanner phase={phase} />

      {phase.kind === "done" && <ScanResultView result={phase.result} />}
    </div>
  );
}

function PhaseBanner({ phase }: { phase: Phase }) {
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
        ? "Analyzing card and fetching live prices…"
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
            startOpen={insufficient || lowConfidence}
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
          <p className="mt-1 text-[10px] text-zinc-400">
            Best of {SOURCE_LABELS[graded[0].best.source]}
            {graded.length > 1 && graded.some((g) => g.best.source !== graded[0].best.source) && " + others"}
          </p>
        </details>
      )}

      {/* Per-source ungraded breakdown for transparency when >1 source agrees. */}
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
