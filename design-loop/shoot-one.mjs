// One-off screenshot pass for eve-vault (pre-claim / post-claim / fork states).
// Usage: node shoot-eve-vault.mjs <url> <name> <outDir>
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [url, name, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

for (const vp of [
  { label: "1440", width: 1440, height: 900 },
  { label: "390", width: 390, height: 844 },
]) {
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: join(outDir, `${name}-${vp.label}.png`), fullPage: true });
  console.log(`shot ${name}-${vp.label}`);
}
await browser.close();
