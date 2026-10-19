// Full-page screenshots of the design demo.
// Usage: start the dev server (e.g. `npx next dev -p 3101`), then
//   node scripts/screenshots.mjs [baseUrl]
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3101";
const url = `${base}/dev/design`;
const out = "bench-shots";

const shots = [
  { file: "desktop.png", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { file: "mobile.png", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const { file, ...options } of shots) {
    const context = await browser.newContext({ ...options, locale: "es-EC", reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${out}/${file}`, fullPage: true });
    console.log(`${out}/${file}${errors.length ? ` — console errors:\n  ${errors.join("\n  ")}` : ""}`);
    await context.close();
  }
} finally {
  await browser.close();
}
