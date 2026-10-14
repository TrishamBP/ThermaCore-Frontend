import { z } from "zod";

import { bucketStatSchema, findingSchema, metricValuesSchema, unavailableMeasurementsSchema } from "./common";

export const assetSummarySchema = z.object({
  asset_id: z.string(),
  asset_type: z.string().nullable(),
  cooling_type: z.string().nullable(),
  data_center_id: z.string().nullable(),
  region_code: z.string().nullable(),
  first_event_timestamp: z.string().nullable(),
  last_event_timestamp: z.string().nullable(),
  latest_observed_timestamp: z.string().nullable(),
  fresh: z.boolean().nullable(),
  source_type: z.string().nullable(),
});
export type AssetSummary = z.infer<typeof assetSummarySchema>;

export const assetListSchema = z.object({
  simulation_run_id: z.string(),
  items: z.array(assetSummarySchema),
  count: z.number(),
  freshness_rule: z.string(),
});
export type AssetList = z.infer<typeof assetListSchema>;

export const coolingStateBriefSchema = z.object({
  state: z.string(),
  severity: z.string(),
  as_of: z.string().nullable(),
  window_minutes: z.number(),
  findings: z.array(findingSchema),
  rules_not_evaluated: z.number(),
});

export const assetDetailSchema = z.object({
  simulation_run_id: z.string(),
  asset: z.object({
    asset_id: z.string(),
    asset_type: z.string().nullable().optional(),
    cooling_type: z.string().nullable().optional(),
    data_center_id: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    server_age_years: z.number().nullable().optional(),
    rack_u_position: z.number().nullable().optional(),
    source_type: z.string().nullable().optional(),
    source_failure_risk_level: z.string().nullable().optional(),
    source_energy_efficiency_class: z.string().nullable().optional(),
    source_maintenance_status: z.string().nullable().optional(),
    generator: z.string().nullable().optional(),
    generator_version: z.string().nullable().optional(),
    seed: z.number().nullable().optional(),
    last_event_timestamp: z.string().nullable().optional(),
  }),
  latest_reading: z.object({ timestamp: z.string(), values: metricValuesSchema }).nullable(),
  cooling_state: coolingStateBriefSchema.nullable(),
  unavailable_measurements: unavailableMeasurementsSchema,
  warnings: z.array(z.string()),
});
export type AssetDetail = z.infer<typeof assetDetailSchema>;

export const telemetryPointSchema = z
  .object({ bucket_start: z.string().optional(), timestamp: z.string().optional() })
  .catchall(z.unknown());

export const assetSeriesSchema = z.object({
  asset_id: z.string(),
  asset_type: z.string().nullable(),
  interval: z.string(),
  points: z.array(telemetryPointSchema),
  truncated: z.boolean(),
  readings: z.number(),
  duplicates_collapsed: z.number(),
  missing_readings: z.number(),
  gaps_over_tolerance: z.number(),
  largest_gap_seconds: z.number().nullable(),
});
export type AssetSeries = z.infer<typeof assetSeriesSchema>;

export const telemetryResponseSchema = z.object({
  simulation_run_id: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  interval: z.string(),
  metrics: z.array(
    z.object({ name: z.string(), unit: z.string(), derived_from: z.string().nullable(), note: z.string().nullable() }),
  ),
  aggregation: z.string(),
  series: z.array(assetSeriesSchema),
  next_cursor: z.string().nullable(),
  unavailable_measurements: unavailableMeasurementsSchema,
  warnings: z.array(z.string()),
});
export type TelemetryResponse = z.infer<typeof telemetryResponseSchema>;

/** Reads one metric of one point: bucketed `{mean,min,max,count}` or a raw number. */
export function pointStat(point: Record<string, unknown>, metric: string): z.infer<typeof bucketStatSchema> | null {
  const v = point[metric];
  if (typeof v === "number") return { mean: v, min: v, max: v, count: 1 };
  const parsed = bucketStatSchema.safeParse(v);
  return parsed.success ? parsed.data : null;
}

export const TELEMETRY_INTERVALS = ["raw", "1m", "5m", "15m", "1h"] as const;
export type TelemetryInterval = (typeof TELEMETRY_INTERVALS)[number];
