import { z } from "zod";

import { metricValuesSchema } from "./common";
import { coolingPredictSchema } from "./cooling";
import { assetDetailSchema, telemetryResponseSchema } from "./telemetry";

const vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });

const layoutMeta = {
  layout_version: z.string(),
  revision: z.string().optional(),
  demonstration: z.boolean(),
  units: z.string(),
  source: z.string().optional(),
  generated_at: z.string().optional(),
  notice: z.string(),
};

export const layoutObjectSchema = z.object({
  id: z.string(),
  asset_id: z.string().nullable(),
  parent_id: z.string().nullable(),
  name: z.string(),
  type: z.string(),
  position: vec3,
  rotation: vec3,
  dimensions: z.object({ width: z.number(), height: z.number(), depth: z.number() }),
  metadata: z.record(z.string(), z.unknown()).default({}),
  telemetry_available: z.boolean(),
});
export type LayoutObject = z.infer<typeof layoutObjectSchema>;

export const layoutSchema = z.object({
  ...layoutMeta,
  unchanged: z.boolean(),
  count: z.number().optional(),
  objects: z.array(layoutObjectSchema),
});
export type Layout = z.infer<typeof layoutSchema>;

export const TWIN_ASSET_STATUSES = ["OK", "STALE", "NO_DATA", "NO_TELEMETRY", "RESTRICTED"] as const;

export const twinAssetStateSchema = z.object({
  object_id: z.string(),
  asset_id: z.string(),
  asset_type: z.string().nullable().optional(),
  status: z.string(),
  last_telemetry_timestamp: z.string().nullable(),
  age_seconds: z.number().nullable().optional(),
  freshness: z.string().nullable().optional(),
  values: metricValuesSchema.optional(),
  thermal_status: z.string().nullable().optional(),
  active_alerts: z.number().nullable().optional(),
  open_recommendations: z.number().nullable().optional(),
});
export type TwinAssetState = z.infer<typeof twinAssetStateSchema>;

export const twinAggregateSchema = z.object({
  object_id: z.string(),
  type: z.string(),
  kind: z.string(),
  servers_reporting: z.number(),
  max_inlet_temperature_c: z.number().nullable(),
  mean_workload_intensity: z.number().nullable(),
  sum_server_power_kw: z.number().nullable(),
  worst_thermal_status: z.string().nullable(),
  method: z.string(),
});
export type TwinAggregate = z.infer<typeof twinAggregateSchema>;

export const twinStateSchema = z.object({
  ...layoutMeta,
  simulation_run_id: z.string(),
  reference_time: z.string().nullable(),
  state_cursor: z.string().nullable(),
  assets: z.array(twinAssetStateSchema),
  aggregates: z.array(twinAggregateSchema),
  thermal_status_rule: z.string().optional(),
  freshness_rule: z.string().optional(),
});
export type TwinState = z.infer<typeof twinStateSchema>;

export const OVERLAY_TYPES = [
  "temperature",
  "predicted_temperature",
  "workload",
  "thermal_risk",
  "energy",
  "fan_excess",
  "airflow",
  "data_quality",
  "cooling_efficiency",
] as const;
export type OverlayType = (typeof OVERLAY_TYPES)[number];

export const overlayItemSchema = z.object({
  object_id: z.string(),
  asset_id: z.string().nullable(),
  overlay_type: z.string(),
  value: z.union([z.number(), z.string()]).nullable(),
  unit: z.string().nullable(),
  status: z.string(),
  observed_at: z.string().nullable(),
  data_source: z.string(),
  is_predicted: z.boolean(),
  warnings: z.array(z.string()).default([]),
});
export type OverlayItem = z.infer<typeof overlayItemSchema>;

export const overlaySchema = z.object({
  ...layoutMeta,
  simulation_run_id: z.string(),
  overlay_type: z.string(),
  reference_time: z.string().nullable(),
  bands: z.array(z.object({ max: z.number().nullable(), status: z.string() })).nullable(),
  bands_note: z.string().optional(),
  items: z.array(overlayItemSchema),
  warnings: z.array(z.string()),
});
export type Overlay = z.infer<typeof overlaySchema>;

export const inspectionSchema = z.object({
  ...layoutMeta,
  object: layoutObjectSchema,
  parents: z.array(z.object({ id: z.string(), type: z.string(), name: z.string() })),
  kind: z.enum(["asset", "aggregated"]),
  asset_id: z.string().nullable().optional(),
  detail: assetDetailSchema.optional(),
  history: telemetryResponseSchema.nullable().optional(),
  forecast: coolingPredictSchema.nullable().optional(),
  alerts: z.array(z.record(z.string(), z.unknown())).optional(),
  recommendations: z.array(z.record(z.string(), z.unknown())).optional(),
  aggregate: twinAggregateSchema.nullable().optional(),
  children: z
    .array(
      z.object({
        object_id: z.string(),
        asset_id: z.string().nullable().optional(),
        freshness: z.string().nullable().optional(),
        thermal_status: z.string().nullable().optional(),
      }),
    )
    .optional(),
  warnings: z.array(z.string()).optional(),
});
export type Inspection = z.infer<typeof inspectionSchema>;

/** SSE frame payload `{id, event, asset_id, timestamp, data}`. */
export const streamEventSchema = z.object({
  id: z.number(),
  event: z.string(),
  asset_id: z.string().nullable(),
  timestamp: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type StreamEvent = z.infer<typeof streamEventSchema>;

export const STREAM_EVENT_TYPES = [
  "telemetry_update",
  "asset_status_change",
  "alert_created",
  "recommendation_created",
  "layout_changed",
  "heartbeat",
  "resync_required",
] as const;
