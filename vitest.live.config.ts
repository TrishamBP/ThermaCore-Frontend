import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Live API check: calls every backend operation through the running frontend proxy
 * (http://127.0.0.1:3000/api/backend/v1) and validates responses with the frontend schemas.
 * Needs the full local stack. NOTE: it runs one /recommendations/generate (writes an analysis to the store)
 * and records one DEFERRED decision on the recommendation that run created.
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/live/**/*.live.ts"],
    testTimeout: 200_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    sequence: { concurrent: false },
    env: { NEXT_PUBLIC_API_BASE_URL: process.env.LIVE_API_BASE ?? "http://127.0.0.1:3000/api/backend/v1" },
  },
});
