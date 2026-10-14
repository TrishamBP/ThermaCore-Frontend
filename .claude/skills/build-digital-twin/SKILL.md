---
name: build-digital-twin
description: Build or extend the ThermaCore 3D digital twin — verify the twin contract, build the scene from the backend layout with deterministic asset mapping, add selection, supported overlays and the inspection panel, integrate SSE with reconnection and resynchronization, and validate performance and the accessible alternative. Use for work under src/features/digital-twin.
---

# Build the digital twin

Read `.claude/rules/threejs-digital-twin.md`, `.claude/rules/state-management.md`, the Digital twin section of
`docs/backend-contract.md`, `../data_engineering/docs/frontend_integration.md` and `DIGITAL_TWIN.md`. The
`digital-twin-engineer` agent owns this area.

## 1. Verify the contract (read-only)

```bash
MSYS_NO_PATHCONV=1 curl -s "http://127.0.0.1:8000/api/v1/digital-twin/layout"
MSYS_NO_PATHCONV=1 curl -s "http://127.0.0.1:8000/api/v1/digital-twin/state"
MSYS_NO_PATHCONV=1 curl -s "http://127.0.0.1:8000/api/v1/digital-twin/overlays?type=temperature"
MSYS_NO_PATHCONV=1 curl -s "http://127.0.0.1:8000/api/v1/digital-twin/assets/srv-001"
curl -s -N --max-time 20 "http://127.0.0.1:8000/api/v1/digital-twin/stream?max_events=3"
```
Capture fixtures (layout, state, each overlay type you support, inspection for a server and a rack, SSE frames).
Check field names against `src/app/digital_twin/service.py` and `stream.py`. Update the contract doc on any change.

## 2. Pure logic first (with unit tests)

- `buildLayoutTree(objects)` → hierarchy by `parent_id`, validation (missing parent, cycles, unknown types logged).
- `buildIdentityMaps(objects)` → `objectId ↔ assetId`, `objectId → instanceIndex` per instanced type; deterministic
  (sorted by `id`).
- `overlayColour(status, objectStatus, isPredicted)` and the legend entries for each overlay type.
- `liveReducer(state, event)` → applies SSE events (dedupe, newer-only, resync, restart detection).

## 3. Scene

- Client-only canvas via `next/dynamic` + `ssr: false`; `frameloop="demand"`.
- Rooms/aisles/racks as simple meshes/edges; servers as `InstancedMesh`; cooling units distinct shape.
- Camera fitted to the facility bounding box from layout dimensions; orbit controls; reduced-motion respected.
- Selection: pointer pick → `instanceId` → `objectId` → URL `?object=`; highlight with accent outline. Keyboard
  selection via the accessible list.

## 4. Overlays and inspection

- Overlay selector limited to backend types; default `temperature`. Show `bands_note`, legend, predicted styling,
  and per-overlay caveats (energy = IT power, airflow = magnitude only, cooling_efficiency unavailable,
  fan_excess relative).
- Inspection panel from `GET /digital-twin/assets/{object_id}`: asset vs aggregated layouts, latest values with
  `kind`, cooling state findings, 5-minute history chart, forecast with persistence + skill + reasons when
  UNAVAILABLE, alerts, recommendations (links), provenance. "Ask about this" → `POST /digital-twin/analyze`
  (handle `clarification_needed`).

## 5. Live updates

- SSE through the proxy (`/api/backend/v1/digital-twin/stream`), one connection per tab, Strict Mode safe.
- Behaviour per `threejs-digital-twin.md` §Data flow: dedupe, resync, restart detection, `layout_changed`, heartbeat
  timeout, backoff with jitter + `last_event_id`, 503 capacity → polling `/state?since=` every 60 s.
- Connection status chip (connecting / live / reconnecting / polling) with `aria-live="polite"`.
- Updates write instance colours directly and call `invalidate()`; no React tree rerender per event.

## 6. Validate

- Unit tests for all pure logic and the SSE client (fake EventSource, fake timers).
- Page test with the canvas mocked: list + panel + states (layout 503, RESTRICTED asset, stream down).
- Performance: with React DevTools Profiler or a render counter, confirm a burst of `telemetry_update` events does
  not rerender the page tree; report numbers measured, not estimates.
- Accessibility: list alternative complete, keyboard selection, axe check.
- `pnpm typecheck && pnpm lint && pnpm test`; report actual results.

## Done when

The scene is driven entirely by backend layout data, picking is ID-based, overlays and legends are truthful, the
live stream survives disconnects/resyncs/restarts, the list alternative is complete, and the tests ran and pass.
