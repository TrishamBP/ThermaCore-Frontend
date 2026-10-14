import { expect, test } from "@playwright/test";

const PAGES = [
  ["/overview", "Operations Center"],
  ["/telemetry", "Live Telemetry"],
  ["/digital-twin", "Digital Twin"],
  ["/predictions", "Inlet temperature forecasts"],
  ["/optimization", "Cooling optimization & recommendations"],
  ["/copilot", "Operations copilot"],
  ["/alerts", "Alerts & events"],
  ["/system", "System & data"],
] as const;

for (const [path, title] of PAGES) {
  test(`${path} renders with the simulated-data indicator and no page errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Demo / Simulated").first()).toBeVisible();
    await expect(page.getByText("API online")).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
}

test("/ redirects to the operations overview", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/overview$/);
});

test("digital twin: selecting equipment in the accessible list opens the inspector", async ({ page }) => {
  await page.goto("/digital-twin");
  const tree = page.getByRole("tree", { name: "Equipment" });
  await tree.getByRole("treeitem", { name: /SIM-NA-013/ }).click();
  await expect(page).toHaveURL(/object=srv-013/);
  await expect(page.getByRole("heading", { level: 2, name: "Server SIM-NA-013" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Inlet forecast")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Select equipment to inspect")).toBeVisible();
});

test("optimization never offers apply/execute controls", async ({ page }) => {
  await page.goto("/optimization");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /apply|execute|set fan/i })).toHaveCount(0);
});
