import { z } from "zod";

import { unavailableMeasurementsSchema } from "./common";

export const kpiSchema = z.object({
  unit: z.string(),
  assets_reporting: z.number(),
  mean: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  max_asset_id: z.string().nullable().optional(),
  sum: z.number().nullable().optional(),
  note: z.string().optional(),
});
export type Kpi = z.infer<typeof kpiSchema>;

export const overviewSchema = z.object({
  simulation_run_id: z.string(),
  scope: z.object({ asset_id: z.string().nullable(), assets: z.number() }),
  window: z.object({ start_time: z.string(), end_time: z.string(), trend_interval_minutes: z.number() }),
  latest_telemetry_timestamp: z.string().nullable(),
  assets: z.object({
    known: z.number(),
    with_observed_reading: z.number(),
    fresh: z.number(),
    stale: z.array(z.string()),
    without_reading: z.array(z.string()),
  }),
  kpis: z.record(z.string(), kpiSchema),
  thermal_risk: z.object({
    evaluated_window_minutes: z.number().optional(),
    as_of: z.string().nullable().optional(),
    overall_state: z.string(),
    overall_severity: z.string(),
    assets_by_state: z.record(z.string(), z.number()),
    assets_by_severity: z.record(z.string(), z.number()),
    findings_by_rule: z.record(z.string(), z.number()),
    approaching_limit_assets: z.array(z.unknown()),
    rules_not_evaluated: z.number(),
  }),
  anomalies: z.object({
    injected_anomaly_labels: z.array(
      z.object({
        asset_id: z.string(),
        anomaly_type: z.string(),
        readings: z.number(),
        first_ts: z.string(),
        last_ts: z.string(),
      }),
    ),
    injected_label_note: z.string(),
    persisted_alerts_in_window: z.number(),
    alerts_by_severity: z.record(z.string(), z.number()),
  }),
  trends: z.object({
    points: z.array(z.object({ bucket_start: z.string() }).catchall(z.number().nullable())),
    slopes: z.record(z.string(), z.object({ per_minute: z.number().nullable(), unit: z.string() })),
  }),
  data_quality: z.object({
    readings_in_window: z.number(),
    missing_readings: z.number(),
    duplicates_collapsed: z.number(),
    pipeline_stale: z.boolean(),
    ingest_age_seconds: z.number().nullable(),
  }),
  unavailable_measurements: unavailableMeasurementsSchema,
  semantics: z.string(),
  warnings: z.array(z.string()),
});
export type Overview = z.infer<typeof overviewSchema>;
