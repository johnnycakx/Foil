// Long-task harness (quality-bar-fixes P0-2, 2026-07-13).
//
// The audit froze /start twice on a normal desktop walk, and neither
// Lighthouse (92 perf) nor the 390 mobile harness caught it — nothing drove
// MID-INTERACTION long tasks on a desktop profile. This harness does exactly
// that, headful-shaped but headless-run: install a PerformanceObserver
// buffer, drive the real interactions (sleeve tap → fan, type path), and
// FAIL if any long task crosses the budget.
//
// Budget (the goal's number): no long task > 200ms on interaction.
// First-paint tasks get a separate, looser bound (hydration on a cold
// desktop profile is allowed one chunk; the INTERACTION is the bar).
//
// Usage:
//   node design-loop/longtask-harness.mjs [--base http://localhost:3100] [--viewport 1440x900]
// Exits 1 on budget breach with the offending tasks printed.

import puppeteer from "puppeteer";

const argIdx = (name) => process.argv.indexOf(`--${name}`);
const BASE = argIdx("base") > -1 ? process.argv[argIdx("base") + 1] : "http://localhost:3100";
const VIEWPORT = argIdx("viewport") > -1 ? process.argv[argIdx("viewport") + 1] : "1440x900";
const [W, H] = VIEWPORT.split("x").map(Number);

const INTERACTION_BUDGET_MS = 200;
const LOAD_BUDGET_MS = 350; // one hydration chunk allowed on cold load

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
let failed = false;

try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });

  // Buffer long tasks from the very first script tick.
  await page.evaluateOnNewDocument(() => {
    window.__longtasks = [];
    window.__marks = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__longtasks.push({ start: e.startTime, duration: e.duration });
      }
    }).observe({ type: "longtask", buffered: true });
  });

  console.log(`[harness] ${BASE}/start @ ${W}x${H}`);
  await page.goto(`${BASE}/start`, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200)); // settle: reveal animations, hydration tail

  const markPhase = (name) =>
    page.evaluate((n) => window.__marks.push({ name, at: performance.now() }), name);

  // ---- interaction 1: tap an empty sleeve → the fan tray mounts ----
  await markPhase("sleeve-tap");
  const sleeve = await page.$(".sleeve-empty");
  if (!sleeve) throw new Error("no .sleeve-empty found — page shape changed");
  await sleeve.click();
  await page.waitForSelector(".fan-wrap", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1500)); // fan images + smooth scroll settle

  // ---- interaction 2: the typed path opens + a query runs ----
  await markPhase("type-path");
  const typedToggle = await page.$$eval("button", (els) => {
    const b = els.find((e) => /know the exact card\? type it/i.test(e.textContent ?? ""));
    if (b) b.click();
    return !!b;
  });
  if (typedToggle) {
    await page.waitForSelector("input[type=text]", { timeout: 10000 });
    await page.type("input[type=text]", "umbreon vmax", { delay: 40 });
    await new Promise((r) => setTimeout(r, 1800)); // debounce + render
  } else {
    console.log("[harness] typed-path toggle not found (fan may already show it) — skipped");
  }

  const { longtasks, marks } = await page.evaluate(() => ({
    longtasks: window.__longtasks,
    marks: window.__marks,
  }));

  const firstInteractionAt = marks.find((m) => m.name === "sleeve-tap")?.at ?? 0;
  const loadTasks = longtasks.filter((t) => t.start < firstInteractionAt);
  const interactionTasks = longtasks.filter((t) => t.start >= firstInteractionAt);

  console.log(`[harness] load-phase long tasks: ${loadTasks.length} (max ${Math.max(0, ...loadTasks.map((t) => t.duration)).toFixed(0)}ms)`);
  console.log(`[harness] interaction long tasks: ${interactionTasks.length} (max ${Math.max(0, ...interactionTasks.map((t) => t.duration)).toFixed(0)}ms)`);

  const loadBreaches = loadTasks.filter((t) => t.duration > LOAD_BUDGET_MS);
  const interactionBreaches = interactionTasks.filter((t) => t.duration > INTERACTION_BUDGET_MS);

  for (const t of [...loadBreaches, ...interactionBreaches]) {
    console.error(`[BREACH] long task ${t.duration.toFixed(0)}ms at t=${t.start.toFixed(0)}ms`);
  }
  if (loadBreaches.length > 0 || interactionBreaches.length > 0) {
    failed = true;
    console.error(`[harness] FAIL: budgets — load ${LOAD_BUDGET_MS}ms, interaction ${INTERACTION_BUDGET_MS}ms`);
  } else {
    console.log("[harness] PASS: no long task over budget");
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
