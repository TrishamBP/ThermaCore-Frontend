// Dev helper: navigate Overview -> Digital Twin via the sidebar (as a user does), hover + select a server,
// and report every console warning/error. Usage: node e2e/twin-console-check.mjs [shot.png]
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const messages = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") messages.push(`${m.type()}: ${m.text().slice(0, 160)}`);
});
page.on("pageerror", (e) => messages.push(`pageerror: ${String(e).slice(0, 160)}`));

await page.goto(`${base}/overview`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.getByRole("link", { name: /Digital Twin/ }).click();
await page.waitForTimeout(5000);
const canvas = page.locator("canvas").first();
const box = await canvas.boundingBox();
if (box) {
  for (let i = 0; i < 12; i++) await page.mouse.move(box.x + box.width * (0.3 + i * 0.04), box.y + box.height * 0.55);
}
await page.getByRole("tree", { name: "Equipment" }).getByRole("treeitem", { name: /SIM-NA-013/ }).click();
await page.waitForTimeout(3000);
await page.getByRole("link", { name: /Overview/ }).click();
await page.waitForTimeout(1500);
await page.getByRole("link", { name: /Digital Twin/ }).click();
await page.waitForTimeout(4000);
if (process.argv[2]) await page.screenshot({ path: process.argv[2] });
const labels = await page.locator("[data-anchor]").evaluateAll((els) => els.filter((e) => e.style.visibility === "visible").length);
console.log(JSON.stringify({ visibleLabels: labels, consoleMessages: messages }, null, 1));
await browser.close();
