// hero-chase-belt perf probe (I-011 device-honest pattern): fps with the belt
// + petals running, per device class, on a PROD build. Also reports LCP.
// Usage: node perf-belt.mjs <url>
import puppeteer from "puppeteer";

const url = process.argv[2] ?? "http://localhost:3000";
const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

async function probe(label, { width, height, dsf, cpu }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: dsf });
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await page.goto(url, { waitUntil: "load", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1200));
  const res = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let lcp = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) lcp = Math.max(lcp, e.startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
        let frames = 0;
        const t0 = performance.now();
        const loop = () => {
          frames++;
          if (performance.now() - t0 < 4000) requestAnimationFrame(loop);
          else resolve({ fps: (frames / (performance.now() - t0)) * 1000, lcp });
        };
        requestAnimationFrame(loop);
      }),
  );
  console.log(`${label}: ${res.fps.toFixed(1)}fps · LCP ${(res.lcp / 1000).toFixed(2)}s`);
  await page.close();
}

await probe("desktop 1440 @2x-cpu", { width: 1440, height: 940, dsf: 1, cpu: 2 });
await probe("desktop 1920 @2x-cpu", { width: 1920, height: 1080, dsf: 1, cpu: 2 });
await probe("mobile-layout 390 @4x-cpu", { width: 390, height: 844, dsf: 2, cpu: 4 });
await browser.close();
