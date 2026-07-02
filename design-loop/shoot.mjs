// Screenshot harness for the overnight design loop (goal: overnight-design-loop).
// Usage:
//   node design-loop/shoot.mjs --out design-loop/gallery/iter-01 [--refs]
// Default shoots the five local surfaces at 1440x900 + 390x844 (full page).
// --refs shoots the external reference sites instead (research phase only).
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args[outIdx + 1] : "design-loop/gallery/scratch";
const refs = args.includes("--refs");

const LOCAL = [
  { name: "home", url: "http://localhost:3000/" },
  { name: "start", url: "http://localhost:3000/start" },
  { name: "lines-umbreon", url: "http://localhost:3000/lines/umbreon" },
  { name: "deals", url: "http://localhost:3000/deals" },
  { name: "card", url: "http://localhost:3000/cards/swsh7-215-umbreon-vmax-alt-art" },
];

const REFS = [
  { name: "basement", url: "https://basement.studio/" },
  { name: "linear", url: "https://linear.app/" },
  { name: "stripe", url: "https://stripe.com/" },
  { name: "vercel", url: "https://vercel.com/home" },
  { name: "courtyard", url: "https://courtyard.io/" },
];

const VIEWPORTS = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "mobile", width: 390, height: 844 },
];

const targets = refs ? REFS : LOCAL;
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ headless: "new" });
try {
  for (const t of targets) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
      // Full-page screenshots evaluate scroll-driven (animation-timeline: view())
      // reveals at their "not entered" state → blank sections. Emulate
      // reduced-motion so the capture is the static-truth render (which the CSS
      // must support anyway — it's the reduced-motion fallback being judged).
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      try {
        await page.goto(t.url, { waitUntil: "networkidle2", timeout: 60000 });
        // Let lazy images + fonts + entrance animations settle.
        await new Promise((r) => setTimeout(r, 2500));
        // Scroll through the page so lazy/scroll-triggered content mounts, then back.
        await page.evaluate(async () => {
          const step = window.innerHeight;
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 120));
          }
          window.scrollTo(0, 0);
        });
        await new Promise((r) => setTimeout(r, 800));
        const file = join(outDir, `${t.name}-${vp.tag}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`OK  ${file}`);
        // Also a viewport-only shot of the hero (the 3-second test frame).
        const heroFile = join(outDir, `${t.name}-${vp.tag}-fold.png`);
        await page.screenshot({ path: heroFile, fullPage: false });
        console.log(`OK  ${heroFile}`);
      } catch (err) {
        console.error(`FAIL ${t.name}-${vp.tag}: ${err.message}`);
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
