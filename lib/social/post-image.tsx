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
import sharp from "sharp";
import type { DealData, SpotlightData } from "./post-text.ts";
import { buildCardWorld, HERO_W, HERO_H } from "./card-bg.ts";
import { clampName } from "./hero-fields.ts";

export const X_IMAGE_SIZE = { width: 1080, height: 1350 };
const NAVY = "#0f1e3a";
const CREAM = "#f8f5f0";
const GOLD = "#c9a24b";
const GOLD_L = "#eace84"; // lighter gold for the "TCG" + small accents
const SLATE = "#8B97B5";
const RED = "#ee5054"; // the down ▼ + board percentages
const WHITE = "#fdfdfb"; // the giant number default (highest scroll-stop)

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

/**
 * Card-hero X image (ADR-072 follow-up) — the validated daily deal/spotlight
 * design (scored 8.35 vs the board's 7.75). Brand lockup + slogan once at top,
 * the REAL card art lifted over its OWN derived "world" background, a stacked red
 * ▼ above a giant drop-shadowed number, a support line, and one foiltcg.com CTA.
 * The background is pre-blurred by sharp (card-bg.ts) because Satori cannot blur;
 * the card's drop-shadow + dominant-color glow halo use Satori box-shadow. White
 * number by default; `goldNumber` toggles the gold alternate.
 */
export async function renderCardHeroImage(input: {
  /** The real card art (already fetched + validated by the caller — never null). */
  artBuffer: Buffer;
  bigNumber: string;
  subline: string;
  showArrow: boolean;
  supportLine: string;
  date: string;
  goldNumber?: boolean;
}): Promise<Uint8Array> {
  // Normalize the card to PNG (Satori reads the data URI) + read its real aspect.
  const cardPng = await sharp(input.artBuffer).png().toBuffer();
  const meta = await sharp(cardPng).metadata();
  const cardW = 636; // ~59% of the 1080 frame (validated design)
  const cardH = Math.round(cardW * ((meta.height ?? 1024) / (meta.width ?? 734)));
  const { background, dominant } = await buildCardWorld(input.artBuffer);
  const bgUri = `data:image/png;base64,${background.toString("base64")}`;
  const cardUri = `data:image/png;base64,${cardPng.toString("base64")}`;
  const cardLeft = Math.round((HERO_W - cardW) / 2);
  const numCol = input.goldNumber ? GOLD_L : WHITE;

  return render(
    <div style={{ position: "relative", width: HERO_W, height: HERO_H, display: "flex" }}>
      <img src={bgUri} width={HERO_W} height={HERO_H} style={{ position: "absolute", top: 0, left: 0 }} />

      {/* brand lockup + slogan, ONCE, top centered */}
      <div style={{ position: "absolute", top: 46, left: 0, width: HERO_W, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ position: "relative", width: 54, height: 54, borderRadius: 13, backgroundColor: GOLD, display: "flex", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 14, left: -6, width: 66, height: 6, backgroundColor: "#fff6dc", opacity: 0.85, transform: "rotate(-38deg)" }} />
          </div>
          <div style={{ display: "flex", marginLeft: 16, fontFamily: "Fredoka", fontWeight: 700, fontSize: 44, textShadow: "0 4px 9px rgba(0,0,0,0.45)" }}>
            <span style={{ color: CREAM }}>Foil</span>
            <span style={{ color: GOLD_L }}>&nbsp;TCG</span>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 12, fontFamily: "Fredoka", fontWeight: 600, fontSize: 20, letterSpacing: 7, color: GOLD_L }}>FIND.  TRACK.  SAVE.</div>
      </div>

      {/* the REAL card, lifted over its own world (drop-shadow + dominant glow) */}
      <img
        src={cardUri}
        width={cardW}
        height={cardH}
        style={{
          position: "absolute",
          top: 168,
          left: cardLeft,
          borderRadius: 20,
          boxShadow: `0 28px 64px rgba(0,0,0,0.55), 0 0 110px 12px rgba(${dominant.r}, ${dominant.g}, ${dominant.b}, 0.5)`,
        }}
      />

      {/* number block, bottom — ▼ stacked ABOVE the number (centering fix) */}
      <div style={{ position: "absolute", bottom: 40, left: 0, width: HERO_W, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {input.showArrow ? (
          <div style={{ width: 0, height: 0, marginBottom: 16, borderLeft: "27px solid transparent", borderRight: "27px solid transparent", borderTop: `38px solid ${RED}` }} />
        ) : null}
        <div style={{ display: "flex", fontFamily: "Fredoka", fontWeight: 700, fontSize: 140, lineHeight: 1, color: numCol, textShadow: "0 12px 26px rgba(0,0,0,0.82)" }}>{input.bigNumber}</div>
        <div style={{ display: "flex", marginTop: 14, fontFamily: "Fredoka", fontWeight: 500, fontSize: 34, color: CREAM, textShadow: "0 4px 10px rgba(0,0,0,0.6)" }}>{input.subline}</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 23, color: SLATE }}>{input.supportLine}</div>
        <div style={{ display: "flex", marginTop: 20, fontFamily: "Fredoka", fontWeight: 600, fontSize: 25, color: GOLD_L }}>foiltcg.com</div>
      </div>
    </div>,
  );
}

/**
 * Weekly "best deals" board (per docs/social/ref/board-ref.png). Dark navy frame,
 * 5 rows each = real card thumbnail + DARK navy name on a light row (the ref's
 * fix for the prototype's light-name bug) + set·condition + red ▼ + gold % +
 * "below 30-day avg" + $avg. Long names are clamped so they can't collide with
 * the % column.
 */
export async function renderDealsImage(input: { deals: DealData[]; date: string }): Promise<Uint8Array> {
  const top = input.deals.slice(0, 5);
  const rowName = "#13213f"; // dark navy name on the light row
  const rowSub = "#5b667c";
  return render(
    <Frame date={input.date}>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: 30 }}>
        <div style={{ display: "flex", fontFamily: "Fredoka", fontWeight: 700, fontSize: 58, lineHeight: 1.04 }}>
          Today&apos;s best Pokémon deals
        </div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 26, color: SLATE }}>
          Cards trading below their own 30-day sold average · {input.date}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {top.map((d) => (
          <div key={d.slug} style={{ display: "flex", alignItems: "center", gap: 20, backgroundColor: "rgba(248,245,240,0.96)", borderRadius: 18, padding: "16px 24px" }}>
            {d.imageUrl ? (
              <img src={d.imageUrl} width={58} height={81} style={{ borderRadius: 7 }} />
            ) : (
              <div style={{ width: 58, height: 81, borderRadius: 7, backgroundColor: NAVY, display: "flex" }} />
            )}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, maxWidth: 540 }}>
              <div style={{ display: "flex", fontFamily: "Fredoka", fontWeight: 700, fontSize: 34, color: rowName }}>{clampName(d.cardName)}</div>
              <div style={{ display: "flex", marginTop: 2, fontSize: 22, color: rowSub }}>{d.setName} · {humanTier(d.matchedTier)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 0, height: 0, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderTop: `19px solid ${RED}` }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ display: "flex", fontFamily: "Fredoka", fontWeight: 700, fontSize: 40, lineHeight: 1, color: GOLD }}>{Math.round(Math.abs(d.deltaPct))}%</div>
                <div style={{ display: "flex", marginTop: 2, fontSize: 16, color: rowSub }}>below 30-day avg</div>
              </div>
              <div style={{ display: "flex", marginLeft: 6, fontFamily: "Fredoka", fontWeight: 700, fontSize: 32, color: rowName, width: 92, justifyContent: "flex-end" }}>{usd(d.soldReference)}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 24, color: SLATE }}>Each below its own 30-day sold average. As of today.</div>
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
