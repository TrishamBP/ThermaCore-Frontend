import { z } from "zod";

export const forecastPointSchema = z.object({
  horizon_minutes: z.number(),
  forecast_timestamp: z.string(),
  predicted_inlet_temperature_c: z.number().nullable(),
  persistence_inlet_temperature_c: z.number().nullable(),
  kind: z.string().optional(),
  evaluation: z
    .object({
      offline_test_rmse_c: z.number().nullable(),
      offline_test_mae_c: z.number().nullable().optional(),
      offline_persistence_rmse_c: z.number().nullable(),
      rmse_skill_vs_persistence: z.number().nullable(),
      test_rows: z.number().optional(),
    })
    .optional(),
});
export type ForecastPoint = z.infer<typeof forecastPointSchema>;

export const PREDICT_STATUSES = ["AVAILABLE", "UNAVAILABLE"] as const;

export const coolingPredictSchema = z.object({
  status: z.string(),
  reasons: z.array(z.union([z.string(), z.object({ code: z.string(), detail: z.string().optional() })])),
  asset_id: z.string().optional(),
  simulation_run_id: z.string().optional(),
  observed_at: z.string().nullable().optional(),
  latest_inlet_temperature_c: z.number().nullable().optional(),
  forecasts: z.array(forecastPointSchema).default([]),
  unsupported_horizons: z.array(z.number()).optional(),
  model: z
    .object({
      version: z.string(),
      label: z.string(),
      created_at: z.string().optional(),
      trained_horizons_minutes: z.array(z.number()).optional(),
      training_source: z.string().optional(),
    })
    .nullable()
    .optional(),
  input_data_quality: z
    .object({
      status: z.string(),
      notes: z.array(z.string()),
      ingest_age_seconds: z.number().nullable().optional(),
      readings_in_lookback: z.number().optional(),
    })
    .nullable()
    .optional(),
  uncertainty: z.object({ method: z.string() }).nullable().optional(),
  warnings: z.array(z.string()).optional(),
  recommendation_only: z.boolean().optional(),
});
export type CoolingPredict = z.infer<typeof coolingPredictSchema>;

export function reasonText(reason: CoolingPredict["reasons"][number]): { code: string; detail?: string } {
  return typeof reason === "string" ? { code: reason } : reason;
}

const metricBlock = z.object({
  n: z.number().optional(),
  mae: z.number().nullable().optional(),
  rmse: z.number().nullable().optional(),
});
const evalBlock = z.object({
  model: metricBlock.optional(),
  persistence: metricBlock.optional(),
  rmse_skill_vs_persistence: z.number().nullable().optional(),
  n: z.number().optional(),
  note: z.string().optional(),
});

export const modelEvaluationSchema = z.object({
  model_version: z.string(),
  model_label: z.string(),
  created_at: z.string(),
  target: z.string(),
  horizons_minutes: z.array(z.number()),
  training_data: z.object({
    runs_used: z.array(z.object({ run_id: z.string(), seed: z.number().nullable().optional(), assets: z.number(), minutes: z.number() })),
    runs_skipped: z.array(z.object({ run_id: z.string(), reason: z.string().optional() }).catchall(z.unknown())),
    series: z.number().optional(),
    rows: z.number().optional(),
    source_type: z.string().optional(),
  }),
  evaluation: z.record(
    z.string(),
    z.object({
      validation: evalBlock.optional(),
      test: evalBlock.optional(),
      test_segments: z.record(z.string(), z.record(z.string(), evalBlock)).optional(),
      per_asset_mae: z
        .object({
          assets: z.number(),
          model_better_than_persistence: z.number(),
          model_median: z.number().nullable(),
          persistence_median: z.number().nullable(),
        })
        .optional(),
    }),
  ),
  validity: z.unknown().optional(),
  limitations: z.array(z.string()).default([]),
});
export type ModelEvaluation = z.infer<typeof modelEvaluationSchema>;

export const optimizerSchema = z.object({
  status: z.string(),
  reasons: z.array(z.object({ code: z.string(), detail: z.string().optional() })),
  recommendation_only: z.boolean(),
  actuation: z.string().optional(),
  asset_id: z.string().optional(),
  simulation_run_id: z.string().optional(),
  controllable_setting: z.string().nullable().optional(),
  current_setting: z.number().nullable().optional(),
  recommended_setting: z.number().nullable().optional(),
  selection_reason: z.string().nullable().optional(),
  forecast_under_current_conditions: z
    .array(
      z.object({
        horizon_minutes: z.number(),
        forecast_timestamp: z.string(),
        predicted_inlet_temperature_c: z.number().nullable(),
        persistence_inlet_temperature_c: z.number().nullable(),
        offline_test_rmse_c: z.number().nullable().optional(),
        offline_persistence_rmse_c: z.number().nullable().optional(),
      }),
    )
    .default([]),
  candidates: z.array(z.record(z.string(), z.unknown())).default([]),
  energy_objective: z.object({ available: z.boolean(), source: z.string().nullable() }).optional(),
  model_version: z.string().nullable().optional(),
  model_label: z.string().nullable().optional(),
  warnings: z.array(z.string()).default([]),
});
export type OptimizerResult = z.infer<typeof optimizerSchema>;

export const fanPeerSchema = z.object({
  simulation_run_id: z.string(),
  as_of: z.string().nullable(),
  lookback_minutes: z.number(),
  window_minutes: z.number(),
  peer_group_by: z.array(z.string()),
  results: z.array(
    z.object({
      asset_id: z.string(),
      status: z.string(),
      group: z.record(z.string(), z.string().nullable()),
      asset_fan_rpm: z.number().nullable(),
      asset_workload: z.number().nullable(),
      asset_inlet_c: z.number().nullable(),
      peer_median_fan_rpm: z.number().nullable(),
      peer_p90_fan_rpm: z.number().nullable(),
      excess_fraction: z.number().nullable(),
      relative_fan_power: z.number().nullable(),
      reference_windows: z.number(),
      reference_assets: z.array(z.string()),
      persistence: z.object({
        windows_compared: z.number(),
        windows_elevated: z.number(),
        share_elevated: z.number().nullable(),
      }),
      reasons: z.array(z.string()),
    }),
  ),
  truncated: z.boolean(),
  method: z.string(),
  limitations: z.array(z.string()),
  summary: z.record(z.string(), z.number()),
  energy_units: z.string(),
  recommendation_only: z.boolean(),
});
export type FanPeerComparison = z.infer<typeof fanPeerSchema>;
