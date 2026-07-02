// Shoots the three banner variants + safe-area check at exactly 1500x500 and
// 3000x1000 (@2x) via viewport clips on the stacked blocks.
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";

mkdirSync("design-loop/gallery/banner", { recursive: true });
const BLOCKS = [
  { id: "a", y: 0 },
  { id: "b", y: 524 },
  { id: "c", y: 1048 },
  { id: "safe", y: 1572 },
];

const browser = await puppeteer.launch({ headless: "new" });
for (const scale of [1, 2]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 2200, deviceScaleFactor: scale });
  await page.goto("file:///C:/Users/John/dev/foil/design-loop/banner/banner.html", {
    waitUntil: "networkidle0",
    timeout: 60000,
  });
  await new Promise((r) => setTimeout(r, 2500));
  for (const b of BLOCKS) {
    if (b.id === "safe" && scale === 2) continue; // debug shot: 1x is enough
    const suffix = scale === 2 ? "@2x" : "";
    const out = `design-loop/gallery/banner/variant-${b.id}${suffix}.png`;
    await page.screenshot({ path: out, clip: { x: 0, y: b.y, width: 1500, height: 500 } });
    console.log("OK", out);
  }
  await page.close();
}
await browser.close();
