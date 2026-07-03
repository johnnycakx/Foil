// Petal-field scroll perf probe: 4x CPU throttle (mid-tier device stand-in),
// motion ON (no reduced-motion emulation), rAF-counted FPS while smooth-
// scrolling the page, plus an idle (no-scroll) sample for the ambient cost.
import puppeteer from "puppeteer";

const url = process.argv[2] ?? "http://localhost:3000/lines/umbreon";
const b = await puppeteer.launch({ headless: "new" });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const cdp = await p.createCDPSession();
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await p.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

const measure = (scroll) =>
  p.evaluate(async (doScroll) => {
    const DURATION = 5000;
    let frames = 0;
    const start = performance.now();
    let raf;
    const tick = () => {
      frames++;
      if (performance.now() - start < DURATION) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    if (doScroll) {
      const total = document.body.scrollHeight - innerHeight;
      const t0 = performance.now();
      await new Promise((done) => {
        const step = () => {
          const t = (performance.now() - t0) / DURATION;
          scrollTo(0, total * Math.min(t, 1));
          if (t < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
    } else {
      await new Promise((r) => setTimeout(r, DURATION));
    }
    cancelAnimationFrame(raf);
    const elapsed = performance.now() - start;
    return { fps: Math.round((frames / elapsed) * 10000) / 10, elapsedMs: Math.round(elapsed) };
  }, scroll);

const idle = await measure(false);
await p.evaluate(() => scrollTo(0, 0));
await new Promise((r) => setTimeout(r, 500));
const scrolling = await measure(true);
console.log(JSON.stringify({ url, cpuThrottle: "4x", idle, scrolling }, null, 2));
await b.close();
