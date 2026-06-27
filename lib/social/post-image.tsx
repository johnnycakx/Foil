// X portrait-image renderers (ADR-058). Composes branded 1080x1350 PNGs from
// the live deals data via next/og (Satori) — the codebase's proven serverless
// image path (app/opengraph-image.tsx) — rather than a headless-browser
// screenshot (Playwright doesn't run in a Vercel cron without a heavy chromium
// dep + function-size risk). Visually equivalent for an X post: date +
// foiltcg.com in-frame, the "below by %" most prominent.
//
// R-008: the deals image is built from the buy_signals cache (derived signal +
// PokeTrace sold reference, no eBay listing data) and the spotlight from the
// PokeTrace sold reference only. No eBay listing data is rendered or persisted.

import { ImageResponse } from "next/og";
import type { DealData, SpotlightData } from "./post-text.ts";

export const X_IMAGE_SIZE = { width: 1080, height: 1350 };
const NAVY = "#0f1e3a";
const CREAM = "#f8f5f0";
const GOLD = "#c9a24b";
const SLATE = "#8B97B5";

async function loadFredoka(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Fredoka:wght@700", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\((https:\/\/[^)]+\.(?:woff2?|ttf))\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

function usd(n: number): string {
  return `$${n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(2)}`;
}
function humanTier(t: string | null): string {
  if (!t) return "";
  const raw: Record<string, string> = { NEAR_MINT: "Near Mint", LIGHTLY_PLAYED: "Lightly Played", MODERATELY_PLAYED: "Moderately Played", HEAVILY_PLAYED: "Heavily Played", DAMAGED: "Damaged" };
  return raw[t] ?? t.replace(/_/g, " ");
}

async function render(node: React.ReactElement): Promise<Uint8Array> {
  const fredoka = await loadFredoka();
  const res = new ImageResponse(node, {
    ...X_IMAGE_SIZE,
    fonts: fredoka ? [{ name: "Fredoka", data: fredoka, weight: 700 as const, style: "normal" as const }] : [],
  });
  return new Uint8Array(await res.arrayBuffer());
}

function Frame({ date, children }: { date: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: NAVY, color: CREAM, padding: 72, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "Fredoka", fontWeight: 700, fontSize: 40 }}>
        <span style={{ color: CREAM }}>Foil</span><span style={{ color: GOLD }}>TCG</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: SLATE }}>
        <span style={{ color: GOLD }}>foiltcg.com</span>
        <span>{date}</span>
      </div>
    </div>
  );
}

/** "Today's best deals" board image — top BELOW deals, "below by" most prominent. */
export async function renderDealsImage(input: { deals: DealData[]; date: string }): Promise<Uint8Array> {
  const top = input.deals.slice(0, 5);
  return render(
    <Frame date={input.date}>
      <div style={{ display: "flex", fontFamily: "Fredoka", fontWeight: 700, fontSize: 64, lineHeight: 1.05, marginBottom: 36 }}>
        Today&apos;s best Pokemon deals
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {top.map((d) => (
          <div key={d.slug} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, borderBottom: `1px solid ${SLATE}33`, paddingBottom: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 620 }}>
              <span style={{ fontSize: 38, fontWeight: 700 }}>{d.cardName}</span>
              <span style={{ fontSize: 26, color: SLATE }}>{d.setName} · {humanTier(d.matchedTier)} 30-day avg {usd(d.soldReference)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 64, color: GOLD, lineHeight: 1 }}>{Math.round(Math.abs(d.deltaPct))}%</span>
              <span style={{ fontSize: 22, color: SLATE, textTransform: "uppercase", letterSpacing: 2 }}>below 30-day avg</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", fontSize: 26, color: SLATE, marginTop: 36 }}>Below each card&apos;s own 30-day sold average. As of today.</div>
    </Frame>,
  );
}

/** Single-card price spotlight image (PokeTrace recent sold, R-008-safe). */
export async function renderSpotlightImage(input: { spotlight: SpotlightData; date: string }): Promise<Uint8Array> {
  const s = input.spotlight;
  return render(
    <Frame date={input.date}>
      <div style={{ display: "flex", fontSize: 32, color: SLATE, marginBottom: 16 }}>What is it actually worth?</div>
      <div style={{ display: "flex", fontFamily: "Fredoka", fontWeight: 700, fontSize: 72, lineHeight: 1.05 }}>{s.cardName}</div>
      <div style={{ display: "flex", fontSize: 34, color: SLATE, marginTop: 8 }}>{s.setName}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 48 }}>
        <span style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 110, color: GOLD }}>{usd(s.soldReference)}</span>
        <span style={{ fontSize: 32, color: CREAM }}>recent sold</span>
      </div>
      <div style={{ display: "flex", fontSize: 28, color: SLATE, marginTop: 16 }}>across {s.sampleSize} sales, as of today</div>
    </Frame>,
  );
}
