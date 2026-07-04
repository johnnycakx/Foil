#!/usr/bin/env python3
"""Regenerate the self-hosted Fraunces display subset (mobile-lcp-font-js-floor goal).

WHY: Fraunces is the mobile-LCP element (the homepage H1). Loaded via
next/font/google it ships as a 120,724-byte "latin" woff2 whose weight is
dominated by VARIABLE-AXIS delta data, not glyph count. This script produces a
brand-IDENTICAL subset (~57KB, 53% smaller) that we self-host via
next/font/local and preload.

WHAT IT DOES (Option B — the smallest brand-lossless spec; see the goal doc):
  - Pins SOFT=30   -> the ONLY SOFT value the site ever renders
                      (app/globals.css). Baking it removes the whole SOFT axis
                      of deltas while the warm terminals (ADR-036) stay pixel-
                      identical. This is optimization, NOT a brand change.
  - Keeps opsz as a variable axis, trimmed to [9,72] -> every heading that
                      renders `font-display` uses font-optical-sizing:auto and
                      nothing on the site exceeds 72px (text-7xl). Optical
                      warmth preserved.
  - Keeps wght as a variable axis, trimmed to [400,700] -> the only weights
                      paired with font-display (default 400 / font-semibold 600
                      / font-bold 700). Bold stays bold.
  - Keeps ALL glyphs present in the source latin subset + ALL layout features
                      (kern, liga, calt, and crucially `tnum` for the
                      tabular-nums price displays). Zero glyph regression.

SOURCE: the "latin" Fraunces woff2 that next/font/google downloads at build
time (OFL, redistributable). Run `npm run build` first, then this script; it
auto-discovers the file under .next/static/media, or pass --src <path>.

USAGE:
    python scripts/subset-fraunces.py                 # auto-discover from .next
    python scripts/subset-fraunces.py --src FILE.woff2
Requires: pip install fonttools brotli
"""
from __future__ import annotations
import argparse, glob, io, os, sys
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib.instancer import instantiateVariableFont

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "app", "fonts", "fraunces-display.woff2")

# Option B — smallest brand-LOSSLESS spec (measured; see the goal doc).
AXIS_LIMITS = {"SOFT": 30, "opsz": (9, 72), "wght": (400, 700)}


def discover_source() -> str | None:
    """Find the Google 'latin' Fraunces woff2 in the last build output."""
    best = None
    for f in glob.glob(os.path.join(REPO, ".next", "static", "media", "*.woff2")):
        try:
            tt = TTFont(f, lazy=True)
            fam = tt["name"].getDebugName(1)
            has_soft = "fvar" in tt and any(a.axisTag == "SOFT" for a in tt["fvar"].axes)
        except Exception:
            continue
        if fam == "Fraunces" and has_soft:
            sz = os.path.getsize(f)
            # the latin subset is the largest of the Fraunces unicode-range files
            if best is None or sz > best[1]:
                best = (f, sz)
    return best[0] if best else None


def build_subset(src: str) -> bytes:
    f = TTFont(src, recalcBBoxes=False, recalcTimestamp=False)
    instantiateVariableFont(f, AXIS_LIMITS, inplace=True, updateFontNames=False)
    ss = subset.Subsetter(options=subset.Options(
        layout_features="*",      # keep tnum (tabular-nums), kern, liga, calt...
        name_IDs="*",
        recalc_bounds=False,
        recalc_timestamp=False,
        drop_tables=[],
    ))
    ss.populate(unicodes=list(f.getBestCmap().keys()))
    ss.subset(f)
    buf = io.BytesIO()
    f.flavor = "woff2"
    f.save(buf)
    return buf.getvalue()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", help="source Fraunces latin woff2 (default: auto-discover from .next)")
    args = ap.parse_args()

    src = args.src or discover_source()
    if not src or not os.path.exists(src):
        print("ERROR: no source Fraunces woff2. Run `npm run build` first, or pass --src.", file=sys.stderr)
        return 1

    data = build_subset(src)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as fh:
        fh.write(data)
    src_sz = os.path.getsize(src)
    print(f"source: {src} ({src_sz:,} bytes)")
    print(f"wrote:  {OUT} ({len(data):,} bytes, {100 - len(data) * 100 // src_sz}% smaller)")
    print(f"spec:   SOFT=30 baked | opsz 9-72 | wght 400-700 | all latin glyphs + layout features")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
