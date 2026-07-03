// Hero-fan widescreen matrix (hero-fan-widescreen-fix). Shoots the homepage
// hero fold at the goal's 9 judged widths.
// Usage: node shoot-hero-widescreen.mjs <url> <outDir> [label]
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [url, outDir, label = "hero"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const WIDTHS = [390, 768, 1024, 1152, 1280, 1440, 1680, 1920, 2560];

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

for (const width of WIDTHS) {
  // Height scaled loosely to real device classes at each width; the shot is
  // the FOLD (viewport), not fullPage — that's what John's bug report is.
  const height = width <= 768 ? 900 : width <= 1440 ? 940 : width <= 1920 ? 1080 : 1200;
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  // "load" not "networkidle0": the dev server's HMR websocket is a persistent
  // connection, so networkidle0 never fires against localhost.
  await page.goto(url, { waitUntil: "load", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1800));
  await page.screenshot({ path: join(outDir, `${label}-${width}.png`) });
  console.log(`shot ${label}-${width} (${width}x${height})`);
}
await browser.close();
