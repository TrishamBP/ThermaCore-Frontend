# ThermaCore frontend

Operator console for the ThermaCore data center operations intelligence platform (AMD ACT III Hackathon).
Next.js App Router · React 19 · TypeScript strict · Tailwind CSS 4 · react-three-fiber · Recharts · TanStack Query · Zod.

**All telemetry is simulated and the digital-twin layout is a demonstration.** The console is
recommendation-only: there is no equipment-control API, and approving a recommendation only records a review.

## Run it

Backend (from `../data_engineering`):

```bash
docker compose up -d --wait kafka
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
uv run python -m data_engineering.streaming.consumer
# optional live data (new 20-asset run, 1 simulated minute per 5 s):
uv run python -m data_engineering.streaming.producer simulate --assets 20 --continuous --duration-minutes 1440 --speedup 12 --seed 2026
```

Frontend:

```bash
pnpm install
cp .env.example .env.local     # defaults work for the local stack
pnpm dev                       # http://127.0.0.1:3000  (redirects to /overview)
```

## Pages

| Route | What it answers |
|---|---|
| `/overview` | What is happening now, what might go wrong, what to review next (KPIs, trends, thermal risk, alerts, forecast, system status, recommendations, data quality) |
| `/telemetry` | Per-asset latest readings, cooling state, provenance and history charts |
| `/digital-twin` | 3D demonstration layout coloured by 9 backend overlays, live via SSE, equipment tree, inspector, ask-the-copilot |
| `/predictions` | Observed vs forecast inlet temperature, persistence baseline, fleet forecast, model card |
| `/optimization` | Optimizer status and reasons, multi-agent analysis, recommendation review queue with decisions, fan-vs-peer screening |
| `/copilot` | Read-only chat with interpretation, sections, evidence and linked recommendations |
| `/alerts` | Persisted estimator findings (not confirmed faults) |
| `/system` | API, pipeline, agents, model and layout status |

The top bar holds the global controls: the simulation-run selector (there is no run-list endpoint, so the options come
from model training runs and recommendations), the simulated-data badge, data freshness, API status and alerts.

## Architecture

- The browser only calls the same-origin proxy `src/app/api/backend/[...path]/route.ts`. It forwards to
  `API_ORIGIN/api/v1/...` through an allowlist and injects the optional server-only `API_AUTH_TOKEN`. Backend CORS is
  off, so no backend change was needed. The proxy also streams SSE.
- `src/lib/api`: the single HTTP layer (`client.ts`), Zod schemas built from captured real responses, and separate
  `reads.ts` / `mutations.ts`.
- Digital twin: geometry comes only from `GET /digital-twin/layout`; servers are rendered as `InstancedMesh`; picking
  resolves instance → object id → asset id; live updates go to an external store and are written straight to GPU
  buffers (no React re-render per event).
- The verified backend contract and its discrepancies are in [`docs/backend-contract.md`](docs/backend-contract.md).
  Engineering rules for Claude Code are in [`.claude/`](.claude/CLAUDE.md).

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test        # 74 unit / contract / component tests, no network
pnpm test:e2e    # 11 Playwright smoke tests against the live local stack (uses the installed Chrome)
pnpm build
```
