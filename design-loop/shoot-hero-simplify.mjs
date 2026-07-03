// homepage-hero-simplify shots: hero at 390/768/1440/2560 + widget close-up.
// Usage: node shoot-hero-simplify.mjs <url> <outDir> <label>
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [url, outDir, label] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();

for (const width of [390, 768, 1440, 2560]) {
  const height = width <= 768 ? 950 : width <= 1440 ? 980 : 1200;
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "load", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2000));
  // Scroll so headline -> CTA -> widget rhythm is in frame.
  await page.evaluate(() => document.querySelector("h1")?.scrollIntoView({ block: "start" }));
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: join(outDir, `${label}-${width}.png`) });
  console.log(`shot ${label}-${width}`);
}
await browser.close();
