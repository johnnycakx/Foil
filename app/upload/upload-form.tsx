"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { detectScan, identifyScan, type PricedCard, type ScanResult } from "./actions";
import { CorrectionLink } from "./correction-form";

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
  const { data, latencyMs, pricingMs, passes, detectedCount } = result;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Estimated value</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {USD.format(data.totalValue)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {data.pricedCount} of {data.cards.length} priced
              {data.unidentifiedCount > 0 &&
                ` · ${data.unidentifiedCount} unidentified`}
              {passes === "multi" && ` · ${detectedCount} cards detected`}
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
              <CardRow key={idx} card={card} />
            ))}
          </ul>
        )}
      </div>

      <details className="rounded-xl bg-zinc-950 p-4 text-xs text-zinc-100">
        <summary className="cursor-pointer text-zinc-400">Raw JSON</summary>
        <pre className="mt-3 overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  );
}

function CardRow({ card }: { card: PricedCard }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{card.name}</p>
        <p className="truncate text-sm text-zinc-500">
          {card.set} · #{card.cardNumber} · {card.rarity}
        </p>
        <p className="text-xs text-zinc-400">
          {card.conditionEstimate}
          {card.retried && (
            <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              re-checked
            </span>
          )}
        </p>
        <PricingLine card={card} />
        <CorrectionLink
          originalName={card.name}
          originalSet={card.set}
          originalCardNumber={card.cardNumber}
        />
      </div>
      <ConfidenceBadge value={card.confidence} />
    </li>
  );
}

function PricingLine({ card }: { card: PricedCard }) {
  const p = card.pricing;
  if (!p.matched) {
    return (
      <p className="mt-1.5 text-xs italic text-zinc-400">{p.reason}</p>
    );
  }
  const top = p.topPrice;
  return (
    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      {top ? (
        <>
          <span className="text-sm font-semibold tabular-nums">
            {USD.format(top.amount)}
          </span>
          <span className="text-xs text-zinc-500">{top.sourceLabel}</span>
        </>
      ) : (
        <span className="text-xs italic text-zinc-400">No raw NM price available</span>
      )}
      {p.bestGraded && (
        <span className="text-xs text-zinc-400">
          · graded {p.bestGraded.tier.replace(/_/g, " ")}: {USD.format(p.bestGraded.avg)}
        </span>
      )}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
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
