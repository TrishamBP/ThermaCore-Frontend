---
paths:
  - "src/lib/**"
  - "src/features/**"
  - "src/app/api/**"
  - "src/test/**"
  - ".env.example"
---

# API integration

Contract reference: `docs/backend-contract.md`. **Do not write an endpoint function until you have inspected the
FastAPI route + Pydantic schema in `../data_engineering/src/app/<domain>/` and a real response from the running
backend.** If a contract differs from the doc, fix the doc in the same change.

## Topology (decided)

```
Browser ──same-origin──▶ Next.js /api/backend/v1/<path> (route handler, Node runtime)
                              │  adds Authorization (server-only token, optional), X-Request-ID
                              ▼
                         FastAPI http://127.0.0.1:8000/api/v1/<path>
Server Components ─────────▶ FastAPI directly (same server-only config)
```

Why: backend CORS is disabled, and when enabled it allows only `GET` and only `X-Request-ID`, so browser POSTs,
`Authorization` and `Last-Event-ID` would fail preflight. A proxy also keeps the bearer token off the browser.
No backend change is needed.

## Environment

| Variable | Scope | Default (`.env.example`) | Purpose |
|---|---|---|---|
| `API_ORIGIN` | server only | `http://127.0.0.1:8000` | FastAPI origin used by the proxy and Server Components |
| `API_AUTH_TOKEN` | server only, optional | *(empty)* | Bearer token when the backend sets `API_AUTH_TOKEN` |
| `NEXT_PUBLIC_API_BASE_URL` | browser | `/api/backend/v1` | Base for browser requests (same-origin proxy path) |
| `API_PROXY_TIMEOUT_MS` | server only | `120000` | Upper bound for slow POSTs (`/recommendations/generate`) |

- Parse env once in `lib/config/` with Zod (`server.ts` imports `server-only`; `public.ts` reads only
  `NEXT_PUBLIC_*`). Missing/invalid config fails at startup, not at first request.
- Never hardcode `localhost`/`127.0.0.1` outside `.env.example` and config defaults. Use `127.0.0.1`, not
  `localhost` (Node resolves `localhost` to `::1` first; uvicorn binds IPv4).

## Proxy route handler (`src/app/api/backend/[...path]/route.ts`)

- `export const runtime = "nodejs"; export const dynamic = "force-dynamic";`
- Allowlist: forward only to `${API_ORIGIN}/api/v1/` + validated path segments (`^[A-Za-z0-9._:-]+$`). No absolute
  URLs, no `..`, no other hosts. Reject `cooling-model/train` (admin, not part of the UI).
- Forward only: method, query string, body, `content-type`, `accept`, `x-request-id`, `last-event-id`. Drop cookies
  and every other incoming header. Add `Authorization: Bearer ${API_AUTH_TOKEN}` when configured.
- For manual SSE reconnects the browser may pass `?last_event_id=<n>`: the proxy moves it to the `Last-Event-ID`
  header and strips it from the query.
- Stream the upstream body back unchanged (`new Response(upstream.body, …)`) — required for SSE. Pass
  `request.signal` to the upstream `fetch` so a closed browser tab closes the backend subscription (the backend caps
  subscribers at 50).
- Return upstream status and body as-is (the error envelope is already correct) and copy `x-request-id`,
  `content-type`, `cache-control`. Upstream unreachable → 502 in the same envelope:
  `{error: {code: "backend_unreachable", message, details: null}, request_id}` (frontend-only code, documented here).

## Client (`src/lib/api/`)

- `client.ts`: `apiRequest<T>(path, { method, query, body, schema, signal, timeoutMs })`
  - builds the URL from config + `endpoints.ts` path builders (encode every path param);
  - serializes typed query params (skip `undefined`, never send `null` or unknown params: the backend returns 422
    for extras); dates via `toISOString()` (always UTC `Z`);
  - generates an `X-Request-ID` (`crypto.randomUUID()` without dashes) per request;
  - merges the caller's `AbortSignal` with a timeout (`AbortSignal.any` + `AbortSignal.timeout`); defaults:
    GET 15 s, copilot/analyze 90 s, generate 120 s;
  - parses JSON, validates with the Zod `schema`, returns typed data;
  - on non-2xx, parses the error envelope into `ApiError`.
- `errors.ts`: `class ApiError extends Error { status; code; message; details; requestId; retryable }`.
  - `requestId` from body `request_id`, else response header `X-Request-ID`.
  - `retryable` = network error, timeout, 502, 503 (except `stream_capacity_reached` → retry with backoff only for SSE),
    and only for GETs.
  - Non-envelope bodies → `code: "unexpected_response"`; schema mismatch → `code: "contract_mismatch"` (log the Zod
    issues to the console in dev, show a generic message to the user with the request ID).
- `endpoints.ts`: path builders only (`assetTelemetry(assetId) => \`/assets/${encodeURIComponent(assetId)}/telemetry\``).
- `<domain>.ts` (dashboard, assets, telemetry, cooling, recommendations, alerts, copilot, digitalTwin, energy,
  system): one exported function per operation. Reads (`get…`, `list…`) are separate from mutations
  (`recordDecision`, `generateRecommendations`, `sendCopilotMessage`, `analyzeTwinObject`).
- `schemas/<domain>.ts`: Zod schemas + inferred types.

## Zod at the boundary

- Validate every response used for rendering decisions. Schemas are **strict about what the UI uses** and
  **tolerant of additions**: `z.object({...}).passthrough()` or default (strip), never `.strict()` on responses.
- Nullable stays nullable (`z.number().nullable()`); do not `.default(0)`.
- Enums: `z.enum([...])` copied from backend `Literal`s, wrapped so an unknown value parses as `{ known: false, raw }`
  instead of failing the whole page (`z.union([z.enum(VALUES), z.string()])` + a mapper).
- `dict[str, Any]` fields (dashboard `kpis`, `latest_reading.values`, twin `values`) → `z.record(z.string(), metricValueSchema)`.
- Fixtures for tests are **captured real responses** (see `testing.md`), not hand-written guesses.

## Data fetching (TanStack Query)

- One `QueryClient` per browser session (provider in `app/layout.tsx` client wrapper). Defaults: `staleTime` 30 s,
  `gcTime` 5 min, `retry` up to 2 for retryable GET errors only, `refetchOnWindowFocus: true`.
- Query keys from a factory per domain: `["dashboard", "overview", { runId, assetId, start, end }]`.
- Polling only where the contract says so, ≥ 60 s for telemetry-backed views (1-minute data), paused when the tab is
  hidden (`refetchIntervalInBackground: false`). Never poll while an SSE connection covers the same data.
- Query functions pass TanStack's `signal` to `apiRequest`. React Strict Mode double-mounts must not create duplicate
  in-flight requests (TanStack dedupes by key; do not fetch in `useEffect`).
- Mutations: `useMutation`, `retry: 0`. On success invalidate exactly the affected keys (decision → that
  recommendation + recommendation lists; generate → recommendations + alerts + dashboard). No optimistic updates
  for review decisions.

## State the UI must represent (never paper over)

| Backend signal | UI |
|---|---|
| `value: null`, `count: 0`, `kind: "unavailable"` | "—" + reason; chart gap |
| `fresh: false`, `freshness: STALE`, `status: STALE` | stale badge with age |
| `data_quality.pipeline_stale: true`, `warnings[]` | stale banner with the warning text |
| `status: UNAVAILABLE` (+ `reasons[]`) | unavailable panel listing reason codes/details |
| `state: PARTIALLY_ASSESSED`, `rules_not_evaluated` | "partially assessed" + rules not evaluated |
| `status: INCONCLUSIVE`, `missing_evidence[]` | inconclusive badge + missing evidence |
| `truncated: true`, `next_cursor` | "showing N of more" + load more |
| `clarification_needed: true` | render answer as a question to the operator |
| `status: RESTRICTED` / 403 `asset_not_authorized` | lock state, no values |
| `injected_anomaly_labels` | labelled "simulator-injected labels (not detections)" |
| 503 `model_not_trained`, `layout_not_configured`, … | feature-level unavailable state, not a crash |

## Never

- Raw `fetch` in components or hooks outside `lib/api/`.
- Fabricated fallbacks (`?? 0`, last-known value without a stale label, interpolated gaps).
- Calling the deprecated `/api/*` (non-v1) paths or `GET /cooling-model/predict` in new code.
- Auto-retrying POSTs (`/decisions` is not idempotent; `/generate` writes to the store).
- Sending `reviewer` from anything other than explicit user input (it is not tied to auth).
