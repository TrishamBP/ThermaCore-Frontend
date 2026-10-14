import { defineConfig } from "@playwright/test";

/**
 * Live smoke tests: they run against the real local stack (FastAPI on 127.0.0.1:8000 + this app),
 * not a mocked backend. They only perform reads. Uses the locally installed Chrome (no browser download).
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3000",
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000/overview",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
