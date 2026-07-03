// hero-chase-belt shots: belt (motion ON) at the 6 judged widths + the
// reduced-motion fan fallback + the request widget.
// Usage: node shoot-hero-belt.mjs <url> <outDir>
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [url, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();

for (const width of [390, 768, 1152, 1440, 1920, 2560]) {
  const height = width <= 768 ? 900 : width <= 1440 ? 940 : 1150;
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "load", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2500)); // let the belt drift a beat
  await page.screenshot({ path: join(outDir, `belt-${width}.png`) });
  console.log(`shot belt-${width}`);
}

// The request widget at 1440.
await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "load", timeout: 90000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => {
  const el = [...document.querySelectorAll("h2")].find((h) => h.textContent?.includes("data on yet"));
  el?.scrollIntoView({ block: "center" });
});
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: join(outDir, "request-widget-1440.png") });
console.log("shot request-widget-1440");

// Reduced-motion: the fan fallback must render instead of the belt.
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page.goto(url, { waitUntil: "load", timeout: 90000 });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: join(outDir, "reduced-motion-fan-1440.png") });
console.log("shot reduced-motion-fan-1440");
await browser.close();
