// Round-2 reference shots: John's fontspace taste refs (VIEW ONLY — the fonts
// are personal-use-only and are never downloaded, embedded, or committed) +
// the round-2 wordmark comparison sheet.
import puppeteer from "puppeteer";

const targets = [
  { name: "ref-super-joyful", url: "https://www.fontspace.com/super-joyful-font-f153768", full: false },
  { name: "ref-super-feel", url: "https://www.fontspace.com/super-feel-font-f123539", full: false },
  { name: "ref-skylens-italic", url: "https://www.fontspace.com/skylens-italic-font-f82191", full: false },
  { name: "ref-blueberry-pie", url: "https://www.fontspace.com/blueberry-pie-font-f91268", full: false },
  { name: "wordmark-compare-2", url: "file:///C:/Users/John/dev/foil/design-loop/wordmark-compare-2.html", full: true },
];

const browser = await puppeteer.launch({ headless: "new" });
for (const t of targets) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  try {
    await page.goto(t.url, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: `design-loop/reference/${t.name}.png`, fullPage: t.full });
    console.log(`OK  ${t.name}`);
  } catch (e) {
    console.error(`FAIL ${t.name}: ${e.message}`);
  } finally {
    await page.close();
  }
}
await browser.close();
