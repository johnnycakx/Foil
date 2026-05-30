"use client";

// Sold-history line chart (Session 49c / ADR-044).
//
// A stock-chart-style inline SVG line (no JS charting library) for the selected
// variant + condition. DATA-REALITY NOTE: PokeTrace exposes no daily series —
// only trailing-average windows (30d / 7d / 24h) per tier (see by-uuid.ts). So
// the x-axis is labelled by WINDOW, not by fabricated dates, and the range pills
// past 30 days are disabled (no data exists). This is the honest visual the real
// data supports; it replaces Session 49's static "↑ 7d" arrow with the actual
// 30d→7d→24h trajectory. A true daily chart awaits a snapshot pipeline (ADR-044).
//
// Range is URL state (?r=) so it's linkable, matching the ?v / ?c pattern. The
// server passes the full (≤3-point) series; this client component slices it to
// the active range, so switching ranges never refetches.

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { PriceHistoryPoint } from "@/lib/poketrace/by-uuid";

type RangeKey = "7D" | "30D" | "90D" | "ALL";
const RANGES: { key: RangeKey; days: number; enabled: boolean }[] = [
  { key: "7D", days: 7, enabled: true },
  { key: "30D", days: 30, enabled: true },
  // PokeTrace holds no data past 30 days — these stay visible but disabled so
  // the UI never implies history we don't have.
  { key: "90D", days: 90, enabled: false },
  { key: "ALL", days: 36500, enabled: false },
];
const DEFAULT_RANGE: RangeKey = "30D";

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

function windowLabel(windowDays: number): string {
  if (windowDays >= 30) return "30d avg";
  if (windowDays >= 7) return "7d avg";
  return "24h avg";
}

// SVG geometry (viewBox units; scales responsively via width:100%).
const VB_W = 320;
const VB_H = 120;
const PAD = { top: 14, right: 44, bottom: 22, left: 12 };

export function SoldHistoryChart({ series }: { series: PriceHistoryPoint[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [hover, setHover] = useState<number | null>(null);

  const rRaw = params.get("r")?.toUpperCase();
  const active: RangeKey =
    rRaw && RANGES.some((r) => r.key === rRaw && r.enabled) ? (rRaw as RangeKey) : DEFAULT_RANGE;
  const activeDays = RANGES.find((r) => r.key === active)!.days;

  function selectRange(key: RangeKey) {
    const next = new URLSearchParams(params.toString());
    if (key === DEFAULT_RANGE) next.delete("r");
    else next.set("r", key);
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}#sold-history-heading`, { scroll: false });
  }

  // Oldest→newest, clamped to the active window.
  const pts = series.filter((p) => p.windowDays <= activeDays).sort((a, b) => b.windowDays - a.windowDays);

  const rangePills = (
    <div role="radiogroup" aria-label="Chart time range" className="flex gap-1.5">
      {RANGES.map((r) => {
        const isActive = r.key === active;
        return (
          <button
            key={r.key}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={!r.enabled}
            title={r.enabled ? undefined : "PokeTrace covers the last 30 days"}
            onClick={() => r.enabled && selectRange(r.key)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums transition ${
              isActive
                ? "border-foil-gold/60 bg-foil-gold/10 text-foil-navy"
                : r.enabled
                  ? "border-foil-navy/15 bg-foil-cream text-foil-slate hover:border-foil-gold/40 hover:text-foil-navy"
                  : "cursor-not-allowed border-foil-navy/10 bg-foil-cream text-foil-slate/40"
            }`}
          >
            {r.key}
          </button>
        );
      })}
    </div>
  );

  if (pts.length < 2) {
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-foil-slate">Recent trend</p>
          {rangePills}
        </div>
        <p className="mt-3 rounded-xl border border-foil-navy/10 bg-foil-cream/60 px-4 py-6 text-center text-sm text-foil-slate">
          Not enough recent sales to chart a trend.
        </p>
      </div>
    );
  }

  const avgs = pts.map((p) => p.avg);
  const min = Math.min(...avgs);
  const max = Math.max(...avgs);
  const span = max - min || max || 1; // avoid /0 when flat
  const innerW = VB_W - PAD.left - PAD.right;
  const innerH = VB_H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
  // Pad the y-range by 12% so a flat-ish line isn't glued to the edges.
  const yMin = min - span * 0.12;
  const yMax = max + span * 0.12;
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.avg).toFixed(1)}`).join(" ");
  const areaPath =
    `${linePath} L${x(pts.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} ` +
    `L${x(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

  const first = pts[0].avg;
  const last = pts[pts.length - 1].avg;
  const up = last >= first;
  const endColor = up ? "var(--color-foil-gold)" : "var(--color-foil-coral)";

  const hi = pts.reduce((m, p, i) => (p.avg > pts[m].avg ? i : m), 0);
  const lo = pts.reduce((m, p, i) => (p.avg < pts[m].avg ? i : m), 0);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-foil-slate">Recent trend · trailing averages</p>
        {rangePills}
      </div>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="mt-2 h-[140px] w-full sm:h-[180px]"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Sold price trend: ${pts.map((p) => `${windowLabel(p.windowDays)} ${usd(p.avg)}`).join(", ")}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="foil-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-foil-navy)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--color-foil-navy)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill="url(#foil-chart-fill)" />
        <path d={linePath} fill="none" stroke="var(--color-foil-navy)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Right-side floating y labels: max + min (+ current via the end dot). */}
        <text x={VB_W - PAD.right + 6} y={y(max) + 3} className="fill-foil-slate" fontSize="9">{usd(pts[hi].avg)}</text>
        {lo !== hi && (
          <text x={VB_W - PAD.right + 6} y={y(min) + 3} className="fill-foil-slate" fontSize="9">{usd(pts[lo].avg)}</text>
        )}

        {/* Endpoint dot — gold if up over the range, coral if down. */}
        <circle cx={x(pts.length - 1)} cy={y(last)} r={3.5} fill={endColor} />

        {/* Hover guide + per-point hit targets. */}
        {pts.map((p, i) => (
          <g key={i}>
            {hover === i && (
              <line x1={x(i)} y1={PAD.top} x2={x(i)} y2={PAD.top + innerH} stroke="var(--color-foil-gold)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            )}
            {hover === i && (
              <text x={x(i)} y={PAD.top - 4} textAnchor="middle" className="fill-foil-navy" fontSize="9" fontWeight="600">
                {usd(p.avg)}
              </text>
            )}
            <rect
              x={x(i) - innerW / (pts.length * 2)}
              y={0}
              width={innerW / pts.length}
              height={VB_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {/* x-axis window label */}
            <text x={x(i)} y={VB_H - 6} textAnchor="middle" className="fill-foil-slate" fontSize="8.5">
              {windowLabel(p.windowDays)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
