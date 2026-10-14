# ThermaCore backend contract (frontend view)

Verified on 2026-10-14 against the **running** backend (`GET http://127.0.0.1:8000/openapi.json`, 30 operations),
the FastAPI source in `../data_engineering/src/app/`, and live read-only GET responses. Backend docs:
`../data_engineering/docs/API.md`, `frontend_integration.md`, `DIGITAL_TWIN.md`. Where they disagree with the
code, the code wins (see [Discrepancies](#discrepancies)).

Re-verify before integrating any endpoint (`/integrate-api` skill). This file is a map, not a guarantee.

## Connection

| Item | Value |
|---|---|
| Backend origin (local) | `http://127.0.0.1:8000` (uvicorn binds 127.0.0.1 only; do **not** use `localhost`, which resolves to `::1` first on Windows/Node) |
| API prefix | `/api/v1` (a deprecated `/api` alias exists; never use it) |
| Health | `GET /api/v1/health` → `{status: "ok"\|"degraded", database, schema_version}`; never requires auth |
| Auth | Off by default. If backend `API_AUTH_TOKEN` is set: `Authorization: Bearer <token>` on every route except `/health`; `401 unauthorized` otherwise. One shared token; no users/roles |
| Asset scope | Backend `API_ALLOWED_ASSETS`. Out-of-scope asset → `403 asset_not_authorized`; lists silently exclude; twin marks `status: RESTRICTED` |
| CORS | **Disabled** unless backend `API_CORS_ORIGINS` is set (preflight returns 405 today). Even when set it allows only `GET` and only the `X-Request-ID` header. → The frontend uses a same-origin proxy (see `.claude/rules/api-integration.md`) |
| Request ID | Send optional `X-Request-ID` (`^[A-Za-z0-9._-]{1,64}$`); always echoed in the response header and in error bodies |
| Caching | Backend sends `Cache-Control: no-store` on every API path |
| Unknown params | Rejected with 422 on most routes (`extra="forbid"`) — never send params that are not listed here |
| Times | ISO 8601 **with timezone**; naive → 422. Ranges: `start` exclusive, `end` inclusive, in **simulated event time** |
| Default run | Omitting `run_id` → the run whose assets were updated most recently. There is **no endpoint that lists runs**; learn run IDs from `simulation_run_id` in responses |

### Error envelope (every non-2xx, including 404 unknown route and 405)

```json
{"error": {"code": "invalid_parameter", "message": "...", "details": [{"loc": ["query","as_of"], "msg": "...", "type": "..."}] | null},
 "request_id": "ac220074c0ad4111a90925279aa3ffe1"}
```

| Status | Codes |
|---|---|
| 401 | `unauthorized` |
| 403 | `asset_not_authorized`, `training_disabled` |
| 404 | `not_found`, `unknown_asset`, `unknown_run`, `unknown_recommendation`, `unknown_analysis`, `unknown_alert`, `unknown_layout_object` |
| 405 | `method_not_allowed` |
| 409 | `training_in_progress` |
| 422 | `validation_error` (details = per-field), `invalid_parameter`, `insufficient_data` |
| 500 | `internal_error` (generic) |
| 503 | `database_unavailable`, `store_not_initialized`, `model_not_trained`, `model_artifact_invalid`, `layout_not_configured`, `layout_invalid`, `stream_capacity_reached` |

### ID patterns

`asset_id`, `run_id`, `object_id`: `^[A-Za-z0-9._:-]{1,64}$` · recommendation `^rec-[0-9a-f]{20}$` · analysis
`^ana-[0-9a-f]{20}$` · alert `^alr-[0-9a-f]{20}$` · conversation `^conv-[0-9a-f]{20}$` · layout objects
`srv-013`, `rack-21`, `aisle-2`, `room-1`, `crah-1`, `dc-na-1` · assets `SIM-NA-013`.

### Shared value conventions (observed)

- Metric value objects: `{value: number|null, unit: string|null, kind?: "measured"|"calculated"|"unavailable", note?: string}`.
  `value: null` means **no data / not applicable** — render "—" with the note, never 0.
- Telemetry bucket metric: `{mean, min, max, count}`; `count: 0` = no data in that bucket (gap, not zero).
- `gpu_utilization` is `null` for non-GPU assets (`note: "not applicable (null) for non-GPU assets"`).
- `power_consumption_kw` = per-server **IT** power. Never label it cooling or facility power.
- `unavailable_measurements: {cooling_power_kw, facility_power_kw, cooling_efficiency, cooling_setpoints}` → each
  value is the reason string. Show these as explicit "Not measured" items.
- Units seen: `degC`, `°C` (recommendation evidence), `percent`, `ratio_0_1`, `ratio`, `rpm`, `cfm`, `kW`, `iops`,
  `Gbps`, `ms`, `degC/min`… → one formatter maps unit strings; unknown units are shown verbatim.
- Timestamp strings vary (`...Z`, `...+00:00`, with/without microseconds). Parse, never string-compare.
- Floats arrive unrounded (`2.0619999999999976`). Round only at display time.
- Provenance: asset `source_type: "simulated"`, `generator`, `generator_version`, `seed`; layout `demonstration: true` + `notice`.

## Endpoint catalog

Legend — **UI states** every screen must handle: loading, error (with code + request ID + retry where safe),
plus the endpoint-specific states listed. **Refresh**: how the data becomes outdated.

### System

| Method & path | Params / body | Response | Errors | UI states | Refresh |
|---|---|---|---|---|---|
| `GET /health` | — | `HealthResponse {status, database, schema_version}` | 503 `database_unavailable` | Backend connection indicator: ok / degraded (schema ≠ 2) / unreachable | Poll ≤ 1/30 s, or on error recovery |

### Dashboard

| Method & path | Params / body | Response | Errors | UI states | Refresh |
|---|---|---|---|---|---|
| `GET /dashboard/overview` | `asset_id?`, `run_id?`, `start_time?`, `end_time?` (span ≤ `API_MAX_TELEMETRY_RANGE_HOURS`, default 24) | `simulation_run_id`, `scope {asset_id, assets}`, `window {start_time, end_time, trend_interval_minutes}`, `latest_telemetry_timestamp`, `assets {known, with_observed_reading, fresh, stale[], without_reading[]}`, `kpis.<metric> {unit, assets_reporting, mean, min, max, max_asset_id, sum? (power only), note?}`, `thermal_risk {overall_state, overall_severity, assets_by_state, assets_by_severity, findings_by_rule, approaching_limit_assets[], rules_not_evaluated, as_of, evaluated_window_minutes}`, `anomalies {injected_anomaly_labels[], injected_label_note, persisted_alerts_in_window, alerts_by_severity}`, `trends {points[{bucket_start, <metric>…, assets_reporting}], slopes.<metric>{per_minute, unit}}`, `data_quality {readings_in_window, missing_readings, duplicates_collapsed, pipeline_stale, ingest_age_seconds}`, `unavailable_measurements`, `semantics` (text), `warnings[]` | 403, 404 `unknown_run`/`unknown_asset`, 422, 503 | KPI with `assets_reporting: 0` or `mean: null` → "no data"; `pipeline_stale: true` → stale banner using `warnings`; `injected_anomaly_labels` are **simulator labels, not detections**; `rules_not_evaluated > 0` → "partially assessed" | Telemetry is 1-minute data: refetch ≤ 1/60 s while visible |

### Telemetry and assets

| Method & path | Params / body | Response | Errors | UI states | Refresh |
|---|---|---|---|---|---|
| `GET /telemetry/cooling-state` | `asset_id?`, `run_id?`, `window_minutes?` (1–1440, default 15), `as_of?` | `CoolingStateSnapshot`: `state` ∈ `INSUFFICIENT_DATA, HIGH_THERMAL_LOAD, RAPID_TEMPERATURE_RISE, APPROACHING_THERMAL_LIMIT, POTENTIAL_AIRFLOW_ISSUE, DATA_QUALITY_ISSUE, LIGHT_LOAD, PARTIALLY_ASSESSED, NORMAL`, `severity`, per-metric stats, `findings[]` with evidence, `rules_not_evaluated[]`, `data_quality`, per-asset states (DC scope). Typed in OpenAPI | 404, 422, 503 | Empty store → 200 `INSUFFICIENT_DATA` (not an error); `PARTIALLY_ASSESSED` + list of rules not evaluated | ≤ 1/60 s |
| `GET /assets` | `run_id?`, `limit?` (1–1000, default 200). **No cursor** | `AssetList {simulation_run_id, items[AssetSummary], count, freshness_rule}`; item: `asset_id, asset_type, cooling_type, data_center_id, region_code, first_event_timestamp, last_event_timestamp, latest_observed_timestamp, fresh: bool\|null, source_type` | 403, 404, 422, 503 | Empty list; `fresh: false` → stale badge; `fresh: null` → unknown | ≤ 1/60 s |
| `GET /assets/{asset_id}` | `run_id?` | `AssetDetail {simulation_run_id, asset (incl. provenance: generator, generator_version, seed, source_* labels), latest_reading {timestamp, values.<metric>{value, unit, note?}} \| null, cooling_state {state, severity, as_of, window_minutes, findings[{rule_id, severity, kind, explanation}], rules_not_evaluated} \| null, unavailable_measurements, warnings[]}` | 403, 404 `unknown_asset`, 422, 503 | `latest_reading: null` → "no reading"; `source_failure_risk_level` etc. are **dataset labels**, not live assessments | ≤ 1/60 s |
| `GET /assets/{asset_id}/telemetry` (and `GET /telemetry` with `asset_id?` query) | `run_id?`, `start_time?`, `end_time?` (default last 60 min), `interval` = `raw\|1m\|5m\|15m\|1h`, `metrics` (comma list, no dups), `limit` (1–50000, default 1000, capped by `API_MAX_TELEMETRY_POINTS`=5000), `cursor` (single asset only) | `TelemetryResponse {simulation_run_id, start_time, end_time, interval, metrics[{name, unit, derived_from, note}], aggregation, series[{asset_id, asset_type, interval, points[{bucket_start, readings, missing_readings, <metric>: {mean,min,max,count}}], truncated, readings, duplicates_collapsed, missing_readings, gaps_over_tolerance, largest_gap_seconds}], next_cursor, unavailable_measurements, warnings[]}` | 403, 404, 422 (bad metric, range too wide), 503 | `count: 0` → gap in chart line; `truncated: true` → "showing first N points" + load more via `next_cursor`; `warnings` (point cap) shown | Refetch per time-range change; live tail ≤ 1/60 s |

Supported metric names: the 16 telemetry metrics + `temperature_delta_c` (default set: `inlet_temperature_c,
exhaust_temperature_c, workload_intensity, cpu_utilization, gpu_utilization, fan_speed_rpm, airflow_cfm,
power_consumption_kw, pue`). Others seen in `latest_reading`: `memory_utilization, storage_utilization,
disk_io_iops, network_throughput_gbps, network_latency_ms, ambient_temperature_c, humidity_percentage`.

### Cooling model and optimizer (recommendation-only; nothing actuates)

| Method & path | Params / body | Response | Errors | UI states | Refresh |
|---|---|---|---|---|---|
| `POST /cooling/predict` (**preferred**) | `{asset_id, run_id?, as_of?, horizons_minutes?: int[1..10]}` (trained horizons 5, 10) | `status: AVAILABLE\|UNAVAILABLE`, `reasons[]` (`MODEL_NOT_TRAINED, MODEL_ARTIFACT_INVALID, FEATURE_SCHEMA_MISMATCH, MODEL_STALE, HORIZON_NOT_SUPPORTED, INSUFFICIENT_TELEMETRY`), `observed_at`, `latest_inlet_temperature_c`, `forecasts[{horizon_minutes, forecast_timestamp, predicted_inlet_temperature_c, persistence_inlet_temperature_c, kind, evaluation{offline_test_rmse_c, offline_test_mae_c, offline_persistence_rmse_c, rmse_skill_vs_persistence, test_rows}}]`, `unsupported_horizons[]`, `model{version, label: "forecasting_baseline", …}`, `uncertainty{method}`, `recommendation_only: true` | 403, 404, 422, 503 `database_unavailable` | Always 200 for known asset → render `UNAVAILABLE` + reasons; **always show persistence beside the prediction and the skill score** (it is ≤ 0: the model does not beat persistence) | Per asset selection; ≤ 1/60 s |
| `GET /cooling-model/predict` | `asset_id` (required), `run_id?`, `as_of?` | Older contract (`forecasts[]`, `model_label`, `data_quality`, …); 503/422 instead of status field | 503 `model_not_trained`, 422 `insufficient_data` | Do not use in new UI code | — |
| `GET /cooling-model/evaluate` | — | Active artifact metadata (version, label, horizons, runs used/skipped, split, per-horizon metrics, `limitations`) | 503 no model | Model card page / tooltip | Rarely |
| `POST /cooling-optimizer/recommend` | `{asset_id, run_id?, as_of?}` | `status ∈ RECOMMENDATION_AVAILABLE, NO_FEASIBLE_SETTING, CONSTRAINTS_ONLY, UNAVAILABLE`, `reasons[{code, detail}]`, `recommendation_only: true`, `actuation` (text), `controllable_setting`, `current_setting`, `recommended_setting: null`, `forecast_under_current_conditions[]`, `candidates[]`, `energy_objective{available, source}` | 404, 422, 503 no model | Today always `UNAVAILABLE` (reasons: `RESPONSE_MODEL_NOT_VALIDATED`, `ENERGY_OBJECTIVE_MISSING`, `T_SAFE_NOT_CONFIGURED`, `ACTUATOR_BOUNDS_NOT_CONFIGURED`) → show reasons, no setpoint UI | On demand |
| `POST /cooling/optimize` | `{asset_id, run_id?, as_of?, candidate_settings: {"fan_speed_rpm": number[1..50]}}` | As above + `conclusion: RECOMMENDATION\|INCONCLUSIVE` + note that candidates are not approved limits | 422 `invalid_parameter` | Not needed for MVP | — |
| `POST /cooling-model/train` | `{run_ids?}` | — | 403 `training_disabled` (default), 409 | **Do not build UI** (admin, CPU-heavy, disabled) | — |

### Recommendations and alerts

| Method & path | Params / body | Response | Errors | UI states | Refresh |
|---|---|---|---|---|---|
| `GET /recommendations` | `asset_id?`, `run_id?`, `type?` (`COOLING_EFFICIENCY, PREEMPTIVE_COOLING, AIRFLOW_INVESTIGATION, ENERGY_WASTE, MAINTENANCE_INSPECTION, SENSOR_DATA_QUALITY`), `status?` (`REQUIRES_REVIEW\|INCONCLUSIVE`), `severity?` (`INFO\|WARNING\|CRITICAL`), `start_time?`/`end_time?` (window end), `limit` (1–200, default 50), `cursor` | `RecommendationList {items[{recommendation_id, analysis_id, asset_id, simulation_run_id, type, status, severity, title, observation_window_end, created_at, review_status}], count, next_cursor}`; newest first | 404, 422, 503 | Empty list; `review_status` = latest decision or `PENDING_REVIEW`; infinite/“load more” via `next_cursor` | After generate / decision; on `recommendation_created` SSE |
| `GET /recommendations/{id}` | — | `RecommendationDetail {recommendation, review_status, decisions[{decision_id, decision, reviewer, note, decided_at}], created_at}`. `recommendation`: `type, status, severity, title, recommended_action, observation_window_start/end, evidence[{evidence_id, agent, kind (measured\|derived\|model_prediction\|configuration\|rule_finding\|unavailable), metric, observed_value, unit, observation_window, interpretation, source, details}], current_setting, candidate_setting, setting_name, predicted_temperature, temperature_horizon_minutes, estimated_energy_impact (null), energy_unit, energy_impact_status, relative_energy_indicator, uncertainty{level: LOW\|MEDIUM\|HIGH\|UNKNOWN, basis, limitations[]}, conditions_that_invalidate_recommendation[], constraints_checked[], validation_warnings[], missing_evidence[], hypotheses[], agent_assessment, explanation{what_to_evaluate, why, measured_observations[], model_predictions[], energy_impact, uncertainty, invalidation_conditions[], missing_evidence[], why_human_review}, explanation_source (llm\|deterministic_template\|none), human_approval_required: true, automatic_control_executed: false` | 404 `unknown_recommendation`, 422 | Evidence panel grouped by `kind`; `INCONCLUSIVE` and `missing_evidence` prominent; `explanation_source` label | After decision |
| `POST /recommendations/{id}/decisions` | `{decision: APPROVED_FOR_EVALUATION\|REJECTED\|DEFERRED, reviewer: ^[\w .@-]+$ (1–100), note?: ≤2000}` | `DecisionResponse {decision_id, decision, reviewer, note, decided_at, recommendation_id, automatic_control_executed: false, message}` | 404, 422 | **Mutation, not idempotent** (each call appends). Confirmation dialog; disable while pending; never auto-retry; show `message` verbatim | Invalidate detail + list |
| `POST /recommendations/generate` | `{asset_id, run_id?, as_of?}` | `AnalysisResponse {analysis_id, status: COMPLETED\|COMPLETED_WITH_FALLBACK\|FAILED, asset_id, simulation_run_id, observation_window, recommendations[], duplicates_of_existing[], execution, human_approval_required: true, automatic_control_executed: false}` | 403, 404, 422, 503 | **Mutation (writes store)**, synchronous, can take tens of seconds → progress state, cancel button, no auto-retry; `COMPLETED_WITH_FALLBACK` labelled | Invalidate recommendations + alerts |
| `GET /recommendations/analyses/{analysis_id}` | — | Untyped object: execution trace (plan, agents, node statuses, latency, tokens, models) | 404 `unknown_analysis` | Collapsible "how this was produced" | Static |
| `GET /recommendations/agents/status` | — | `AgentStatus {mode: llm\|deterministic, llm_enabled, api_key_configured, main_model, subagent_model, reasoning_effort, timeout_s, cooling_model{version,label}\|null, recommendation_only: true}` | 422 | Show agent mode badge (deterministic vs LLM) | Rarely |
| `GET /alerts` | `asset_id?`, `run_id?`, `rule_id?` (`^[A-Z_]{3,64}$`), `severity?` (`WARNING\|CRITICAL`), `start_time?`, `end_time?`, `limit` (1–200, default 50), `cursor` | `AlertList {items[untyped], count, next_cursor}` | 404, 422, 503 | **Empty is the normal state**: alerts exist only after `/recommendations/generate` ran. Each alert states "not a confirmed equipment fault" — show it | After generate; on `alert_created` SSE |
| `GET /alerts/{alert_id}` | — | Untyped object | 404 `unknown_alert` | — | — |

### Energy

| Method & path | Params / body | Response | Errors | UI states | Refresh |
|---|---|---|---|---|---|
| `GET /energy/fan-peer-comparison` | `run_id?`, `asset_id?`, `as_of?` | Untyped: `simulation_run_id, as_of, lookback_minutes, window_minutes, peer_group_by[], results[{asset_id, status (ELEVATED\|WITHIN_PEER_RANGE\|BELOW_PEERS\|INSUFFICIENT_PEERS), group{cooling_type, asset_type}, window{start,end}, asset_fan_rpm, asset_workload, asset_inlet_c, peer_median_fan_rpm, peer_p90_fan_rpm, excess_fraction, relative_fan_power, reference_windows, reference_assets[], persistence{windows_compared, windows_elevated, share_elevated}, reasons[]}], truncated, method, limitations[], summary{<status>: n}, energy_units, recommendation_only: true` | 403, 404, 422 (no assets in scope) | Relative indicator only ("+18 % vs peers"); never kW or "savings"; `INSUFFICIENT_PEERS` common | ≤ 1/60 s |

### Copilot

| Method & path | Params / body | Response | Errors | UI states | Refresh |
|---|---|---|---|---|---|
| `POST /copilot/chat` | `{message (1–2000), conversation_id? (conv-…), asset_id?, run_id?, time_range?{start?, end?} (start < end)}` | `ChatResponse {conversation_id, answer, clarification_needed, interpretation{intents, asset_ids, all_assets, start_time, end_time, time_basis, source, run}\|null, sections{measured, calculated, predictions, hypotheses, recommendations, limitations: string[]}, evidence[{E1…: kind, metric, value, unit, source}], metrics{tool tables}, predictions[], recommendations[{…, link}], optimizer\|null, warnings[], agent_execution_summary, read_only, automatic_control_executed, units_note, unavailable_measurements}` | 403, 422, 503 | Keep `conversation_id`; unknown/expired id silently starts a new conversation; show `interpretation.time_basis` + `asset_ids` above the answer; `clarification_needed` → render as question; may take seconds (LLM mode) | Per message; no polling |

Side effect: only bounded in-memory conversation memory (lost on API restart).

### Digital twin

All twin responses include layout meta: `layout_version, revision, demonstration: true, units: "m", source,
generated_at, notice` — show `notice` whenever the twin is visible. All are untyped in OpenAPI.

| Method & path | Params / body | Response | Errors | UI states | Refresh |
|---|---|---|---|---|---|
| `GET /digital-twin/layout` | `room_id?`, `include_servers?` (true), `include_cooling_equipment?` (true), `layout_version?` | meta + `unchanged: bool`, `count`, `objects[{id, asset_id\|null, parent_id\|null, name, type (facility\|room\|aisle\|rack\|server\|cooling_unit), position{x,y,z} (m, centre), rotation{x,y,z}, dimensions{width,height,depth}, metadata, telemetry_available, layout_version}]`. With matching `layout_version` → `{unchanged: true, objects: []}` | 503 `layout_not_configured`/`layout_invalid` | Hierarchy via `parent_id`; never invent coordinates | On `layout_changed` SSE only |
| `GET /digital-twin/layout/{object_id}` | — | layout meta + `object` (nested, same shape as `objects[]`) + `parents[]` + `children[]` | 404 `unknown_layout_object` | — | — |
| `GET /digital-twin/state` | `run_id?`, `room_id?`, `asset_type?` (`server`), `asset_ids?` (comma list ≤ 4000 chars; asset or object ids), `since?`, `include_derived_metrics?` | meta + `simulation_run_id, reference_time, state_cursor, assets[{object_id, asset_id, asset_type, status (OK\|STALE\|NO_DATA\|NO_TELEMETRY\|RESTRICTED), last_telemetry_timestamp, age_seconds, freshness (FRESH\|STALE\|NO_DATA), values.<metric>{value, unit, kind, note?}, thermal_status (WITHIN_LIMIT\|APPROACHING_LIMIT\|ABOVE_LIMIT\|UNKNOWN), active_alerts, open_recommendations}], aggregates[{object_id, type, kind: "aggregated", servers_reporting, max_inlet_temperature_c, mean_workload_intensity, sum_server_power_kw, worst_thermal_status, method}], thermal_status_rule, freshness_rule` | 403, 404, 422, 503 | `RESTRICTED` → greyed, no values; null value → "no data" | Initial + after `resync_required`; fallback poll `?since=<state_cursor>` every 60 s if SSE unavailable |
| `GET /digital-twin/overlays` | `type` = `temperature\|predicted_temperature\|workload\|thermal_risk\|energy\|fan_excess\|airflow\|cooling_efficiency\|data_quality` (9), `run_id?`, `room_id?`, `asset_type?`, `timestamp?` (historical) | meta + `simulation_run_id, overlay_type, reference_time, bands[{max\|null, status}], bands_note, items[{object_id, asset_id, overlay_type, value\|null, unit, status, observed_at, data_source, is_predicted, warnings[]}], warnings[]` | 422 `invalid_parameter` (unknown type) | Bands are **visual thresholds, not equipment limits**; `cooling_efficiency` always UNAVAILABLE; `is_predicted` → distinct style; `airflow` magnitude only; `energy` = IT power | On overlay change; on `telemetry_update` (debounced) |
| `GET /digital-twin/assets/{object_id}` (asset id also accepted) | `run_id?`, `start_time?`, `end_time?`, `metrics?`, `include_forecast?`, `include_recommendations?` | meta + `object`, `parents[{id,type,name}]`, `kind: "asset"\|"aggregated"`, `asset_id`, `detail` (= `AssetDetail`), `history` (= `TelemetryResponse`, 5 m), `forecast` (= `/cooling/predict` response), `alerts[]`, `recommendations[]`. Racks/rooms: `kind: "aggregated"` with child summaries | 404 `unknown_layout_object`, 403 | Inspection panel; forecast `UNAVAILABLE` → reasons | On selection; on `telemetry_update` for that asset |
| `POST /digital-twin/analyze` | `{object_id? \| asset_id?, question (1–2000), analysis_type? (thermal\|cooling_efficiency\|workload\|energy\|maintenance\|forecast\|recommendations), run_id?, time_range?}` | `summary, sections, evidence[], predictions[], recommendations[], warnings[], execution, conversation_id` | 422 (neither id), 404, 403 | Same as copilot; see known defect below | Per question |
| `GET /digital-twin/stream` (SSE) | header `Last-Event-ID?` (int ≥ 0), query `max_events?` (1–10000) | `text/event-stream`; frame `id: <n>\nevent: <type>\ndata: {id, event, asset_id\|null, timestamp (wall clock), data}`. First frame is always `heartbeat {subscribed: true, poll_interval_s}`; heartbeat every 15 s idle. Events: `telemetry_update` (data = compact asset state: object_id, asset_id, status, thermal_status, freshness, last_telemetry_timestamp, active_alerts, open_recommendations, inlet_temperature_c), `asset_status_change` (data `{object_id, from{status, thermal_status}, to{…}}`), `alert_created` (`{alert_id, asset_id, rule_id, severity}`), `recommendation_created` (`{recommendation_id, asset_id, type, status}`), `layout_changed` (`{layout_version}`), `resync_required` (`{reason}`) | 503 `stream_capacity_reached` (> 50 subscribers), 422 | Connection status chip: connecting / live / reconnecting / polling fallback | Server polls the store every 10 s; one shared poller |

SSE semantics verified in `src/app/digital_twin/stream.py`:
- Event ids are global and monotonically increasing **per API process**; heartbeats consume ids and events
  are scope-filtered, so ids received by one client have gaps. **Do not treat gaps as loss.**
- Replay buffer: last 500 events. Reconnect with `Last-Event-ID` → missed events replayed, or a single
  `resync_required` if they are gone. Slow client (queue > 100) → oldest dropped + `resync_required`.
- Store failure during a poll → `resync_required {reason: "telemetry store temporarily unavailable"}`.
- **API restart resets ids to 1.** A `Last-Event-ID` from before the restart is silently accepted with no
  resync. Client rule: if a received id ≤ the last id seen on a *new* connection, treat it as a restart and
  re-fetch `/state` (and `/layout?layout_version=`).
- The first poll after (re)subscription only establishes a baseline; changes are emitted from the second poll.

## Discrepancies

| # | Documentation says | Implementation does | Frontend decision |
|---|---|---|---|
| 1 | API.md: "29 operations" | OpenAPI has **30**: `GET /energy/fan-peer-comparison` is missing from API.md | Use it (verified live); flag to backend owner |
| 2 | API.md: overlays `type` "one of 8" | `OVERLAY_TYPES` has **9** (incl. `fan_excess`); frontend_integration.md lists 9 | Use the 9 from the 422 message / code |
| 3 | frontend_integration.md: "CORS currently allows GET only" | With `API_CORS_ORIGINS` unset (current `.env`) CORS is **off** (preflight 405). When set: GET only, `allow_headers=[X-Request-ID]` → `Authorization`, `Content-Type: application/json` and `Last-Event-ID` would all fail preflight | Same-origin Next.js proxy route; no backend change needed |
| 4 | Docs describe twin/alert/energy/analysis payloads in detail | OpenAPI types them as `object`; many typed models nest `dict[str, Any]` (dashboard `kpis`, asset `latest_reading`, recommendation payload) | Generated types are insufficient; hand-written Zod schemas from verified samples |
| 5 | — | OpenAPI lists a spurious `asset_id` **query** param on `GET /assets/{asset_id}/telemetry` (excluded field) | Never send it |
| 6 | API.md: `/recommendations/generate` status `COMPLETED \| COMPLETED_WITH_FALLBACK` | Schema also allows `FAILED` | Handle `FAILED` |
| 7 | — | Recommendation evidence uses unit `°C`; telemetry uses `degC` | Unit formatter accepts both |
| 8 | API.md known defect | `POST /digital-twin/analyze` on a rack with "rack"/"aisle"-type words → `clarification_needed: true` | Render clarification state; suggested prompts avoid topology words |
| 9 | Docs examples use run `sim-c9944cc35156` (20 assets, 24 h) | Default (latest) run currently `sim-07920cc116e9`: 5 assets, 24 minutes of event time, `pipeline_stale: true` | Always display `simulation_run_id`; never hardcode run IDs; there is no runs-list endpoint |
| 10 | — | Event time is simulated (Jan 2026) while wall clock is later; `fresh`/`freshness` are relative to the run's newest reading, `pipeline_stale` is wall-clock | Show both concepts separately; never compute freshness from `Date.now()` vs event time |
| 11 | DIGITAL_TWIN.md: rotation "in the same frame" | Rotation units are not documented (all values are 0) | Treated as degrees (`features/digital-twin/lib/layout.ts: rotationRadians`); confirm with the backend owner |
| 12 | — | `GET /alerts` items are the stored alert payload + `created_at` (`alert_id, asset_id, simulation_run_id, rule_id, state, severity, kind, explanation, evidence, observation_window_start/end, related_recommendations, source, analysis_id, note`), read from `recommendations/graph.py` because no alerts existed to capture | `alertSchema` is tolerant; recapture a fixture once alerts exist |
| 13 | — | `GET /digital-twin/stream` always follows the latest run (`resolve_run(None)`); there is no `run_id` parameter | Live updates only when no explicit run is selected; historical runs are static snapshots |
