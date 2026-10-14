import { z } from "zod";

/** `{value, unit, kind?, note?}` — value null means no data / not applicable (never 0). */
export const metricValueSchema = z.object({
  value: z.number().nullable(),
  unit: z.string().nullable(),
  kind: z.string().optional(),
  note: z.string().optional(),
});
export type MetricValue = z.infer<typeof metricValueSchema>;

export const metricValuesSchema = z.record(z.string(), metricValueSchema);

/** Telemetry bucket statistics; count 0 = no data in the bucket. */
export const bucketStatSchema = z.object({
  mean: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  count: z.number(),
});
export type BucketStat = z.infer<typeof bucketStatSchema>;

export const unavailableMeasurementsSchema = z.record(z.string(), z.string());

export const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.string(),
  schema_version: z.number().nullable(),
});
export type Health = z.infer<typeof healthSchema>;

export const findingSchema = z.object({
  rule_id: z.string(),
  severity: z.string(),
  kind: z.string().optional(),
  state: z.string().optional(),
  explanation: z.string().optional(),
  evidence: z.unknown().optional(),
});
export type Finding = z.infer<typeof findingSchema>;
