/** Browser-visible configuration. Only NEXT_PUBLIC_* values may be read here. */
const DEMO_RUN = process.env.NEXT_PUBLIC_DEMO_RUN_ID?.trim();

export const publicConfig = {
  /** Same-origin proxy path; the backend itself is never called directly from the browser. */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend/v1",
  /** Optional simulation run pinned at the top of the run selector (e.g. a complete 24 h demo run). */
  demoRunId: DEMO_RUN && /^[A-Za-z0-9._:-]{1,64}$/.test(DEMO_RUN) ? DEMO_RUN : undefined,
} as const;
