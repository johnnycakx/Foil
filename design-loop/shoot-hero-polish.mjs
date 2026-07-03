// hero-polish-followups verification shots: hero fold at 390/1440/2100 + the
// alert-mock section. Usage: node shoot-hero-polish.mjs <url> <outDir>
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [url, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

for (const { width, height } of [
  { width: 390, height: 900 },
  { width: 1440, height: 940 },
  { width: 2100, height: 1100 },
]) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "load", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1800));
  await page.screenshot({ path: join(outDir, `hero-${width}.png`) });
  console.log(`shot hero-${width}`);
}

// The alert section at 1440 — scroll the mock into view.
await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "load", timeout: 90000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => {
  const el = [...document.querySelectorAll("h2")].find((h) =>
    h.textContent?.includes("One email, when it matters"),
  );
  el?.scrollIntoView({ block: "center" });
});
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: join(outDir, "alert-section-1440.png") });
console.log("shot alert-section-1440");
await browser.close();
