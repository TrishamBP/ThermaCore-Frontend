---
name: build-dashboard
description: Build or extend ThermaCore dashboard views (overview, assets list/detail, telemetry charts, recommendations, alerts, energy) — map verified API fields to KPI cards, charts, tables and filters with freshness and simulation metadata, and no unsupported metrics. Use for dashboard and monitoring screens.
---

# Build a dashboard view

Read `.claude/rules/styling-and-design-system.md`, `.claude/rules/api-integration.md`,
`.claude/rules/state-management.md` and `docs/backend-contract.md`.

## 1. Inventory the data

Endpoints available for dashboards (verify each with `/integrate-api` before use):
`GET /dashboard/overview`, `GET /assets`, `GET /assets/{id}`, `GET /assets/{id}/telemetry`,
`GET /telemetry/cooling-state`, `POST /cooling/predict`, `GET /recommendations`, `GET /alerts`,
`GET /energy/fan-peer-comparison`, `GET /recommendations/agents/status`, `GET /health`.

## 2. Map fields → UI (write the mapping table in the PR/summary before building)

| UI element | Source field | Notes |
|---|---|---|
| KPI card per metric | `kpis.<metric>.{mean,min,max,unit,assets_reporting,max_asset_id,note,sum}` | coverage "n of `assets.known`"; `sum` only for power (IT power) |
| Thermal risk | `thermal_risk.overall_state/overall_severity/assets_by_state/findings_by_rule/rules_not_evaluated` | partially-assessed state visible |
| Trend chart | `trends.points[].bucket_start` + metrics; `trends.slopes` | slopes as "per minute" with units |
| Freshness | `latest_telemetry_timestamp`, `assets.fresh/stale/without_reading`, `data_quality.pipeline_stale`, `warnings` | event-time freshness vs wall-clock pipeline staleness, separately |
| Anomalies | `anomalies.injected_anomaly_labels`, `injected_label_note`, `persisted_alerts_in_window` | label: simulator-injected, not detections |
| Not measured | `unavailable_measurements` | explicit "Not measured" list |
| Run / scope | `simulation_run_id`, `scope`, `window` | always shown in the page header |

Do **not** show: cooling power, facility power, cooling efficiency, energy savings, kW savings, WUE, PUE as facility
PUE (the `pue` field is a per-asset simulated value — use its `note`), or any metric not in the response.

## 3. Build

- Page shell: Server Component; filters (run, time range bounded to ≤ 24 h, asset) in the URL; client components for
  charts and interactive filters.
- Reuse `KpiCard`, `StatusBadge`, `TimeSeriesChart`, `DataTable`, `TimeRangeSelector`, `FilterBar`, feedback
  components. Create missing ones in `src/components/` first (ui-engineer scope).
- Telemetry charts: `interval` chosen from the range (≤ 2 h → `1m`, ≤ 12 h → `5m`, else `15m`), `count: 0` as gaps,
  min–max band optional, `truncated`/`next_cursor` handled.
- Recommendations/alerts tables: cursor "load more", filters map 1:1 to backend query params and enums, review status
  column, links to detail.
- Refresh ≤ every 60 s while visible; show "as of <simulated event time>" and the last fetch time.
- Responsive grid: 4 KPI columns ≥ 1280 px, 2 on tablet, 1 on mobile.

## 4. Verify

- Component tests per state using captured fixtures (including `pipeline_stale: true`, empty alerts, null GPU KPI).
- `pnpm typecheck && pnpm lint && pnpm test`; manual check against the running backend if available. Report results.

## Done when

Every displayed number traces to a verified response field with its unit, freshness and simulation metadata are
visible, unsupported metrics are absent, and all states are tested.
