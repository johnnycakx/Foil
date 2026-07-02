"use client";

// Sold-history line chart (Session 49c / ADR-044).
//
// Robinhood/S&P-style inline SVG line (no charting library) over PokeTrace's
// REAL daily price history (lib/poketrace/price-history.ts → the tier-scoped
// /prices/{tier}/history endpoint). Plots median7d (PokeTrace's recommended,
// anomaly-filtered line), falling back to the raw daily avg when a day has no
// median. The server passes the full available series for the selected
// variant + condition; this client component slices it to the active range —
// so switching ranges never refetches — and keeps the range in ?r= URL state.
//
// Ranges 7D / 1M / 3M / 1Y / MAX map to PokeTrace's 7d/30d/90d/1y/all. A range
// with fewer than two points in its window is disabled ("Limited history").
// An empty/absent series shows a "Price history accumulating" placeholder.

import { useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { PriceHistoryRow } from "@/lib/poketrace/price-history";

type RangeKey = "7D" | "1M" | "3M" | "1Y" | "MAX";
const RANGES: { key: RangeKey; days: number }[] = [
  { key: "7D", days: 7 },
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "1Y", days: 365 },
  { key: "MAX", days: Infinity },
];
const DEFAULT_RANGE: RangeKey = "1M";

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** The plotted value for a row — median7d (smoother) or the raw daily avg. */
function plotValue(r: PriceHistoryRow): number {
  return r.median7d ?? r.avg;
}

function sliceForDays(series: PriceHistoryRow[], days: number): PriceHistoryRow[] {
  if (!Number.isFinite(days) || series.length === 0) return series;
  const latest = new Date(`${series[series.length - 1].date}T00:00:00Z`).getTime();
  const cutoff = latest - days * 24 * 60 * 60 * 1000;
  return series.filter((r) => new Date(`${r.date}T00:00:00Z`).getTime() >= cutoff);
}

// SVG geometry (viewBox units; scales responsively via width:100%).
const VB_W = 480;
const VB_H = 200;
const PAD = { top: 14, right: 50, bottom: 22, left: 12 };

export function SoldHistoryChart({ series }: { series: PriceHistoryRow[] | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const full = series ?? [];

  // Which ranges have ≥2 points to draw.
  const enabledByRange = new Map<RangeKey, PriceHistoryRow[]>();
  for (const r of RANGES) {
    const s = sliceForDays(full, r.days);
    if (s.length >= 2) enabledByRange.set(r.key, s);
  }

  const rRaw = params.get("r")?.toUpperCase();
  const active: RangeKey =
    rRaw && enabledByRange.has(rRaw as RangeKey)
      ? (rRaw as RangeKey)
      : enabledByRange.has(DEFAULT_RANGE)
        ? DEFAULT_RANGE
        : ([...enabledByRange.keys()][0] ?? DEFAULT_RANGE);

  function selectRange(key: RangeKey) {
    const next = new URLSearchParams(params.toString());
    if (key === DEFAULT_RANGE) next.delete("r");
    else next.set("r", key);
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}#sold-history-heading`, { scroll: false });
  }

  const rangePills = (
    <div role="radiogroup" aria-label="Chart time range" className="flex gap-1.5">
      {RANGES.map((r) => {
        const enabled = enabledByRange.has(r.key);
        const isActive = r.key === active;
        return (
          <button
            key={r.key}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={!enabled}
            title={enabled ? undefined : "Limited history"}
            onClick={() => enabled && selectRange(r.key)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums transition ${
              isActive
                ? "border-foil-accent/60 bg-foil-accent/10 text-foil-cream"
                : enabled
                  ? "border-foil-cream/15 bg-foil-night text-foil-cream/60 hover:border-foil-accent/40 hover:text-foil-cream"
                  : "cursor-not-allowed border-foil-cream/10 bg-foil-night text-foil-cream/30"
            }`}
          >
            {r.key}
          </button>
        );
      })}
    </div>
  );

  const pts = enabledByRange.get(active) ?? [];

  if (pts.length < 2) {
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-foil-cream/60">Sold price history</p>
          {rangePills}
        </div>
        <p className="mt-3 rounded-xl border border-foil-cream/10 bg-foil-night/60 px-4 py-8 text-center text-sm text-foil-cream/60">
          Price history accumulating — not enough recorded sales to chart yet.
        </p>
      </div>
    );
  }

  const vals = pts.map(plotValue);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || max || 1;
  const innerW = VB_W - PAD.left - PAD.right;
  const innerH = VB_H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
  const yMin = min - span * 0.1;
  const yMax = max + span * 0.1;
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(plotValue(p)).toFixed(1)}`).join(" ");
  const areaPath =
    `${linePath} L${x(pts.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} ` +
    `L${x(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

  const first = plotValue(pts[0]);
  const last = plotValue(pts[pts.length - 1]);
  const up = last >= first;
  const endColor = up ? "var(--color-foil-accent)" : "var(--color-foil-coral)";

  const hiIdx = vals.reduce((m, v, i) => (v > vals[m] ? i : m), 0);
  const loIdx = vals.reduce((m, v, i) => (v < vals[m] ? i : m), 0);
  const midIdx = Math.floor((pts.length - 1) / 2);

  // Map a pointer event to the nearest point index (viewBox scales to client).
  function onMove(clientX: number) {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const vbX = ((clientX - rect.left) / rect.width) * VB_W;
    const frac = (vbX - PAD.left) / innerW;
    const idx = Math.round(frac * (pts.length - 1));
    setHover(Math.max(0, Math.min(pts.length - 1, idx)));
  }

  const hp = hover != null ? pts[hover] : null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-foil-cream/60">Sold price history</p>
        {rangePills}
      </div>

      <div className="relative mt-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-[160px] w-full sm:h-[220px]"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Sold price history, ${active}: ${usd(first)} on ${shortDate(pts[0].date)} to ${usd(last)} on ${shortDate(pts[pts.length - 1].date)}`}
          onMouseMove={(e) => onMove(e.clientX)}
          onMouseLeave={() => setHover(null)}
          onTouchMove={(e) => e.touches[0] && onMove(e.touches[0].clientX)}
          onTouchEnd={() => setHover(null)}
        >
          <defs>
            <linearGradient id="foil-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-foil-cream)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--color-foil-cream)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={areaPath} fill="url(#foil-chart-fill)" />
          <path d={linePath} fill="none" stroke="var(--color-foil-cream)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Right-side floating y labels: max + min. */}
          <text x={VB_W - PAD.right + 6} y={y(max) + 3} className="fill-foil-cream/60" fontSize="9">{usd(max)}</text>
          {loIdx !== hiIdx && (
            <text x={VB_W - PAD.right + 6} y={y(min) + 3} className="fill-foil-cream/60" fontSize="9">{usd(min)}</text>
          )}

          {/* Endpoint dot — gold if up over the range, coral if down. */}
          <circle cx={x(pts.length - 1)} cy={y(last)} r={3.5} fill={endColor} />

          {/* Hover guide. */}
          {hover != null && (
            <line x1={x(hover)} y1={PAD.top} x2={x(hover)} y2={PAD.top + innerH} stroke="var(--color-foil-accent)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
          )}

          {/* X-axis date labels at start / middle / end. */}
          <text x={x(0)} y={VB_H - 6} textAnchor="start" className="fill-foil-cream/60" fontSize="8.5">{shortDate(pts[0].date)}</text>
          {pts.length > 2 && (
            <text x={x(midIdx)} y={VB_H - 6} textAnchor="middle" className="fill-foil-cream/60" fontSize="8.5">{shortDate(pts[midIdx].date)}</text>
          )}
          <text x={x(pts.length - 1)} y={VB_H - 6} textAnchor="end" className="fill-foil-cream/60" fontSize="8.5">{shortDate(pts[pts.length - 1].date)}</text>
        </svg>

        {/* Hover tooltip (HTML overlay; Fraunces display for the price). */}
        {hp && (
          <div
            className="pointer-events-none absolute top-0 rounded-lg border border-foil-cream/15 bg-foil-night-2 px-2.5 py-1.5 text-center shadow-[0_8px_24px_-8px_rgba(4,9,18,0.6)]"
            style={{ left: `${(x(hover!) / VB_W) * 100}%`, transform: "translateX(-50%)" }}
          >
            <p className="font-display text-sm font-semibold tabular-nums text-foil-cream">{usd(plotValue(hp))}</p>
            <p className="text-[10px] text-foil-cream/60">
              {shortDate(hp.date)}
              {hp.saleCount != null ? ` · ${hp.saleCount} ${hp.saleCount === 1 ? "sale" : "sales"}` : ""}
            </p>
          </div>
        )}
      </div>

      <p className="mt-1 text-[10px] uppercase tracking-wider text-foil-cream/60">
        7-day median · PokeTrace daily sold history
      </p>
    </div>
  );
}
