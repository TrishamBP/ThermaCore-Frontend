// Dev helper: screenshots of console pages using the locally installed Chrome (no browser download).
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const pages = process.argv.slice(2);
const out = process.env.SHOT_DIR ?? ".";
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
for (const p of pages) {
  await page.goto(`${base}/${p}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(Number(process.env.WAIT_MS ?? 6000));
  const name = p.replace(/[^\w-]+/g, "_");
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: process.env.FULL === "1" });
  console.log("shot", name);
}
console.log(JSON.stringify(errors.slice(0, 20), null, 1));
await browser.close();
