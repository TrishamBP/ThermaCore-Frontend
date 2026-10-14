---
paths:
  - "src/features/digital-twin/**"
  - "src/app/**/digital-twin/**"
---

# Three.js digital twin

Backend contract: `docs/backend-contract.md` → Digital twin, and `../data_engineering/docs/frontend_integration.md`.
Implementation: `../data_engineering/src/app/digital_twin/{router,service,stream}.py`.

## Truthfulness

- The layout is a **demonstration** (`demonstration: true`). Show the backend `notice` text in the twin view at all
  times. Never call it a real facility, a CFD simulation, or an airflow model. The `airflow` overlay is magnitude
  only (no direction).
- The optional airflow particle effect (user-requested, `Airflow.tsx`, toggle `?airflow=0`) is **illustrative**: particle
  speed scales with each server's measured `airflow_cfm`, colour goes from measured inlet to exhaust temperature, the
  direction is an assumption (front → back), and servers without data emit nothing. Keep the legend text that says so;
  never present it as a simulation or extend it with invented flow fields.
- Overlay bands are visual thresholds from the layout file, not equipment limits; the legend says so.
- `cooling_efficiency` is always UNAVAILABLE; `energy` is server IT power; `fan_excess` is relative to peers.
- Predicted values (`is_predicted: true`, `predicted_temperature`) are styled distinctly (info colour + dashed
  outline/label) and the legend shows "Predicted (baseline model)".

## Rendering

- The canvas is client-only: `"use client"` wrapper + `next/dynamic(() => import("./TwinCanvas"), { ssr: false })`.
  Never touch `window`, `document`, WebGL or `three` at module scope in server-importable files.
- Geometry comes from `GET /digital-twin/layout`: `position` (metres, object centre), `rotation`, `dimensions
  {width, height, depth}`. **Never invent coordinates.** Build the hierarchy from `parent_id`
  (facility → room → aisle → rack → server; `cooling_unit` under room). Unknown `type` → render as a neutral box and log.
- Identity: every pickable instance maps to `{ id: obj.id, assetId: obj.asset_id }`. Picking resolves through that
  map (`instanceId → objectId`), **never** through screen position, mesh name or array order.
- Servers (the many) use `InstancedMesh` (one per type/material), with per-instance colour via `setColorAt`;
  racks/rooms/aisles are simple meshes or edges. Keep a stable `objectId → instanceIndex` map built once per
  `layout_version`.
- Live updates write instance colours / attributes directly (`instanceColor.needsUpdate = true`) from the external
  live store, outside React render. A telemetry update must not rerender the React tree; only the inspection panel
  re-reads its own selector.
- `frameloop="demand"` and `invalidate()` after updates; no continuous render loop when nothing changes.
- Stable object references: geometries/materials created once (`useMemo`) and disposed on unmount / layout change.
- `drei` helpers allowed: `OrbitControls` / `CameraControls`, `Bvh` if picking gets slow, `Html` only for a few labels
  (selected object), `Edges`. Measure before adding LOD; the demo layout has 30 objects, so it is not needed now —
  design so it can be added (room-level LOD) without rewriting picking.
- Respect `prefers-reduced-motion` (no camera tweening). Handle WebGL context loss: show the accessible list and a
  "3D view unavailable" message.

## Colour semantics

- Colour = f(selected overlay `items[].status`) via one mapping in `features/digital-twin/lib/overlay-scale.ts`.
  Object status overrides overlay colour: `RESTRICTED`/`NO_TELEMETRY` → unavailable grey with no value;
  `STALE` → desaturated + stale outline. `null` value → unavailable grey (never the "cool" colour).
- The legend is always visible and lists every status the current overlay can emit, plus unavailable/stale/predicted.

## Data flow

1. `GET /layout` → build scene graph and identity maps; store `layout_version`.
2. `GET /state` → seed the live store (assets + aggregates); keep `state_cursor`.
3. `GET /overlays?type=<selected>` → colours; refetch on overlay change and (debounced, ≥ 10 s) after
   `telemetry_update`s.
4. SSE `GET /digital-twin/stream` via the proxy:
   - `telemetry_update` / `asset_status_change` → update the live store entry (ignore if not newer).
   - `alert_created` / `recommendation_created` → bump counts, invalidate the matching queries (debounced).
   - `layout_changed` → `GET /layout?layout_version=<current>`; rebuild only if `unchanged` is false, then re-seed state.
   - `resync_required` → re-fetch `/state` (and overlays); replace, don't merge.
   - `heartbeat` → mark connection live; no heartbeat for > 2 × 15 s → treat as disconnected.
   - Dedupe by event `id` (ignore ids ≤ last seen on the same connection). Ids have gaps by design.
   - On a new connection, if the first received id ≤ the last id seen before, the API restarted → resync.
   - Reconnect with exponential backoff + jitter (1 s → 30 s cap), sending the last id (`?last_event_id=` to the
     proxy). `503 stream_capacity_reached` → back off and fall back to polling `/state?since=<state_cursor>` every 60 s.
   - Close the connection on unmount and when the tab is hidden for > 60 s; resync on return.
5. Click → select `objectId` (URL `?object=`) → `GET /digital-twin/assets/{object_id}` → inspection panel
   (`kind: "asset"` vs `"aggregated"`). Ask about it via `POST /digital-twin/analyze`.

## Accessibility alternative

A keyboard-operable asset list/tree (room → rack → server) is always rendered next to (or instead of) the canvas,
with the same status labels and selection. Selecting in the list selects in the scene and vice versa. The canvas
has `role="img"` + `aria-label` summarizing what is shown; all information in the scene is available in the list
or the inspection panel.
