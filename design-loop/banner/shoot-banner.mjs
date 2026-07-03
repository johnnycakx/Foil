// Shoots the three banner variants + safe-area check at exactly 1500x500 and
// NATIVE @2x (3000x1000) / @3x (4500x1500) via deviceScaleFactor — the frame
// is rendered at target resolution directly, never CSS-upscaled
// (petal-fidelity-pass §3). Output: design-loop/gallery/banner-v2/.
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";

const OUT = "design-loop/gallery/banner-v2";
mkdirSync(OUT, { recursive: true });
const BLOCKS = [
  { id: "a", y: 0 },
  { id: "b", y: 524 },
  { id: "c", y: 1048 },
  { id: "safe", y: 1572 },
];

const browser = await puppeteer.launch({ headless: "new" });
for (const scale of [1, 2, 3]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 2200, deviceScaleFactor: scale });
  await page.goto("file:///C:/Users/John/dev/foil/design-loop/banner/banner.html", {
    waitUntil: "networkidle0",
    timeout: 60000,
  });
  await new Promise((r) => setTimeout(r, 2500));
  for (const b of BLOCKS) {
    if (b.id === "safe" && scale !== 1) continue; // debug shot: 1x is enough
    const suffix = scale === 1 ? "" : `@${scale}x`;
    const out = `${OUT}/variant-${b.id}${suffix}.png`;
    await page.screenshot({ path: out, clip: { x: 0, y: b.y, width: 1500, height: 500 } });
    console.log("OK", out);
  }
  await page.close();
}
await browser.close();
