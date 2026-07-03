// Shared OG identity block (brand-og-unification, 2026-07-02). EVERY
// ImageResponse surface imports its wordmark + palette + fonts from here, so a
// brand succession that misses a share surface fails loudly (og-image.test.ts
// pins the import + a retired-asset tripwire).
//
// The wordmark is "Foil" in Shrikhand — matching the live site header
// (design-loop-round2 §1). Both fonts are SELF-HOSTED TTFs under assets/og/
// (OFL, licenses alongside), because Satori cannot parse woff2 — the previous
// Google-css2 fetch with a modern UA returned woff2 and the OG wordmark font
// NEVER actually loaded (the Phase-1 diagnosis).
//
// Runtime split (both patterns are the documented ones): the edge runtime
// fetches the bundler-emitted asset via `new URL(..., import.meta.url)`; the
// nodejs runtime reads `join(process.cwd(), "assets/og/...")` (undici fetch
// rejects file: URLs — fetching there is exactly the bug that empty-rendered
// the lines OG). `process.env.NEXT_RUNTIME` is statically replaced at build,
// so each bundle only carries its own branch.
//
// Fallback rule (the goal's hard line): if a font can't load, the surface
// still renders styled TEXT — `fonts: undefined` lets next/og fall back to
// its own bundled Geist. NEVER pass an empty `fonts` array (ImageResponse
// does `options.fonts || defaultFonts`, so `[]` disables the fallback and
// satori throws "No fonts are loaded"), and NEVER the retired seal mark.

export const OG_COLORS = {
  charcoal: "#0d0d0e",
  charcoal2: "#17171a",
  cream: "#f8f5f0",
  sakura: "#d98aa0",
  sakuraDeep: "#a5546e",
  navy: "#0f1e3a",
  slate: "#8B97B5",
} as const;

/** Font families the OG surfaces reference. Wordmark = Shrikhand; everything
 *  else says `OG_BODY_FONT` explicitly so satori never falls back to the
 *  display face for body text. */
export const OG_BODY_FONT = "Geist";

type OgFontEntry = { name: string; data: ArrayBuffer; weight: 400; style: "normal" };

async function loadAsset(edgeUrl: () => URL, file: string): Promise<ArrayBuffer | null> {
  try {
    if (process.env.NEXT_RUNTIME === "edge") {
      const res = await fetch(edgeUrl());
      return res.ok ? await res.arrayBuffer() : null;
    }
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const buf = await readFile(join(process.cwd(), "assets", "og", file));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

/**
 * Load the shared OG font set: Shrikhand (wordmark) + Geist (body).
 * `fonts` goes straight into the ImageResponse options — it is undefined
 * (never `[]`) when nothing loaded, so next/og's bundled fallback applies.
 */
export async function loadOgFonts(): Promise<{
  fonts: OgFontEntry[] | undefined;
  wordmarkLoaded: boolean;
}> {
  const [shrikhand, geist] = await Promise.all([
    loadAsset(
      () => new URL("../../assets/og/Shrikhand-Regular.ttf", import.meta.url),
      "Shrikhand-Regular.ttf",
    ),
    loadAsset(
      () => new URL("../../assets/og/Geist-Regular.ttf", import.meta.url),
      "Geist-Regular.ttf",
    ),
  ]);
  const fonts: OgFontEntry[] = [];
  if (shrikhand) fonts.push({ name: "Shrikhand", data: shrikhand, weight: 400, style: "normal" });
  if (geist) fonts.push({ name: OG_BODY_FONT, data: geist, weight: 400, style: "normal" });
  return { fonts: fonts.length ? fonts : undefined, wordmarkLoaded: shrikhand != null };
}

/**
 * The wordmark block — "Foil" as pure lettering, exactly like the site
 * header (wordmark-first: the seal is retired from brand surfaces).
 * `tone="cream"` for dark grounds, `tone="navy"` for cream grounds.
 * On font failure it renders in the body face — never the retired mark.
 */
export function OgWordmark({
  size = 64,
  tone = "cream",
  fontLoaded,
}: {
  size?: number;
  tone?: "cream" | "navy";
  fontLoaded: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: fontLoaded ? "Shrikhand" : OG_BODY_FONT,
        fontWeight: 400,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: -1,
        color: tone === "cream" ? OG_COLORS.cream : OG_COLORS.navy,
      }}
    >
      Foil
    </div>
  );
}
