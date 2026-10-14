---
paths:
  - "src/**/*.test.{ts,tsx}"
  - "src/test/**"
  - "e2e/**"
  - "vitest.config.*"
  - "playwright.config.*"
---

# Testing

Tests are part of every change. Report exactly which commands ran and their result; never claim a pass that was not
executed. No test may call the real backend's LLM provider (Fireworks) or any external network.

## Gates (run before saying "done")

```bash
pnpm typecheck && pnpm lint && pnpm test      # always
pnpm test:e2e                                  # when a critical flow changed
pnpm build                                     # before handing off a milestone
```

## Layers

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest | formatters (units, null → "—", rounding at display), status mappings, query-param serialization, error normalization, layout tree building, overlay colour mapping, SSE reducer |
| Contract | Vitest + Zod | every Zod schema parses its **captured real fixture**; error envelope parsing for 401/403/404/422/503; unknown enum values degrade gracefully; extra fields tolerated |
| Component | Vitest + React Testing Library + MSW | each data view in loading, empty, error (shows code + request ID, retry), stale, unavailable, populated states |
| Twin logic | Vitest | `objectId ↔ assetId ↔ instanceIndex` mapping is deterministic; events update the right instance; duplicates/older events ignored; `resync_required` replaces state; restart detection (id regression); `layout_changed` with `unchanged: true` keeps the scene |
| SSE | Vitest with a fake EventSource / fake timers | reconnect backoff with jitter bounds, `last_event_id` sent, heartbeat timeout → reconnect, 503 capacity → polling fallback, cleanup on unmount (no leaked connections under Strict Mode) |
| Proxy | Vitest (route handler called directly, upstream fetch mocked) | path allowlist, header allowlist, token injection only when configured, `last_event_id` → header, 502 envelope, streaming pass-through |
| Accessibility | `@axe-core/playwright` in e2e (or `vitest-axe` on components, if approved) | no serious/critical violations on each page |
| E2E (implemented) | Playwright `e2e/*.spec.ts`, installed Chrome, against the **live** local stack (read-only) | every page renders with the simulated badge and no page errors; `/` redirects to `/overview`; twin list selection opens the inspector; no apply/execute controls. Mocked-backend E2E (Playwright `route`) is still to do |

## Fixtures

- Capture fixtures from the running backend with read-only GETs (e.g. `curl -s "http://127.0.0.1:8000/api/v1/..." >
  src/test/fixtures/<domain>/<case>.json`) and note the capture date + run ID in a sibling `README.md`.
- POST fixtures (`/recommendations/generate`, `/decisions`, `/copilot/chat`) are taken from the backend's documented
  examples or tests (`../data_engineering/tests/`), not by calling mutating endpoints against the shared store.
- Include edge fixtures: empty lists, `UNAVAILABLE` forecast, `INSUFFICIENT_DATA`, `pipeline_stale: true`,
  `gpu_utilization: null`, `count: 0` buckets, `RESTRICTED` twin asset, error envelopes.
- Do not edit a captured fixture to make a test pass; if the contract changed, recapture and update schemas + docs.

## Conventions

- Co-locate unit/component tests: `Thing.tsx` + `Thing.test.tsx`. E2E in `e2e/`.
- Query elements by role/label (`getByRole`), not by class or test IDs unless no accessible handle exists.
- Deterministic: fake timers for polling/backoff, fixed `Date` where time is displayed, seeded data only.
- WebGL is not available in jsdom: test twin logic as pure functions, mock the canvas component in page tests.
