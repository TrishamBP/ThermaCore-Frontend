import { z } from "zod";

export const RECOMMENDATION_TYPES = [
  "COOLING_EFFICIENCY",
  "PREEMPTIVE_COOLING",
  "AIRFLOW_INVESTIGATION",
  "ENERGY_WASTE",
  "MAINTENANCE_INSPECTION",
  "SENSOR_DATA_QUALITY",
] as const;
export const RECOMMENDATION_STATUSES = ["REQUIRES_REVIEW", "INCONCLUSIVE"] as const;
export const SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export const ALERT_SEVERITIES = ["WARNING", "CRITICAL"] as const;
/** Exact backend enum (DecisionRequest.decision). Recording a decision never actuates equipment. */
export const REVIEW_DECISIONS = ["APPROVED_FOR_EVALUATION", "REJECTED", "DEFERRED"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
export const REVIEWER_PATTERN = /^[\w .@-]+$/;

export const recommendationSummarySchema = z.object({
  recommendation_id: z.string(),
  analysis_id: z.string(),
  asset_id: z.string(),
  simulation_run_id: z.string(),
  type: z.string(),
  status: z.string(),
  severity: z.string(),
  title: z.string(),
  observation_window_end: z.string(),
  created_at: z.string(),
  review_status: z.string(),
});
export type RecommendationSummary = z.infer<typeof recommendationSummarySchema>;

export const recommendationListSchema = z.object({
  items: z.array(recommendationSummarySchema),
  count: z.number(),
  next_cursor: z.string().nullable(),
});
export type RecommendationList = z.infer<typeof recommendationListSchema>;

export const evidenceSchema = z.object({
  evidence_id: z.string(),
  agent: z.string(),
  kind: z.string(),
  metric: z.string(),
  observed_value: z.union([z.number(), z.string(), z.boolean()]).nullable(),
  unit: z.string().nullable(),
  observation_window: z.string().nullable().optional(),
  interpretation: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const recommendationSchema = z.object({
  recommendation_id: z.string(),
  analysis_id: z.string(),
  asset_id: z.string(),
  simulation_run_id: z.string(),
  type: z.string(),
  status: z.string(),
  severity: z.string(),
  title: z.string(),
  recommended_action: z.string(),
  observation_window_start: z.string().nullable().optional(),
  observation_window_end: z.string(),
  evidence: z.array(evidenceSchema),
  current_setting: z.number().nullable().optional(),
  candidate_setting: z.number().nullable().optional(),
  setting_name: z.string().nullable().optional(),
  predicted_temperature: z.number().nullable().optional(),
  temperature_horizon_minutes: z.number().nullable().optional(),
  estimated_energy_impact: z.number().nullable().optional(),
  energy_unit: z.string().nullable().optional(),
  energy_impact_status: z.string().optional(),
  relative_energy_indicator: z.unknown().optional(),
  uncertainty: z.object({ level: z.string(), basis: z.string(), limitations: z.array(z.string()) }),
  conditions_that_invalidate_recommendation: z.array(z.string()),
  constraints_checked: z.array(z.string()),
  validation_warnings: z.array(z.string()),
  missing_evidence: z.array(z.string()),
  hypotheses: z.array(z.unknown()),
  explanation: z
    .object({
      what_to_evaluate: z.string().optional(),
      why: z.string().optional(),
      measured_observations: z.array(z.string()).optional(),
      model_predictions: z.array(z.string()).optional(),
      energy_impact: z.string().optional(),
      uncertainty: z.string().optional(),
      why_human_review: z.string().optional(),
    })
    .nullable()
    .optional(),
  explanation_source: z.string().optional(),
  human_approval_required: z.literal(true),
  automatic_control_executed: z.literal(false),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const decisionSchema = z.object({
  decision_id: z.string(),
  decision: z.string(),
  reviewer: z.string(),
  note: z.string().nullable(),
  decided_at: z.string(),
});

export const recommendationDetailSchema = z.object({
  recommendation: recommendationSchema,
  review_status: z.string(),
  decisions: z.array(decisionSchema),
  created_at: z.string(),
});
export type RecommendationDetail = z.infer<typeof recommendationDetailSchema>;

export const decisionResponseSchema = decisionSchema.extend({
  recommendation_id: z.string(),
  automatic_control_executed: z.literal(false),
  message: z.string(),
});
export type DecisionResponse = z.infer<typeof decisionResponseSchema>;

export const analysisResponseSchema = z.object({
  analysis_id: z.string(),
  status: z.string(),
  asset_id: z.string(),
  simulation_run_id: z.string(),
  observation_window: z.record(z.string(), z.string().nullable()),
  recommendations: z.array(z.record(z.string(), z.unknown())),
  duplicates_of_existing: z.array(z.string()),
  execution: z.record(z.string(), z.unknown()),
  human_approval_required: z.literal(true),
  automatic_control_executed: z.literal(false),
});
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

export const alertSchema = z.object({
  alert_id: z.string(),
  asset_id: z.string(),
  simulation_run_id: z.string(),
  rule_id: z.string(),
  state: z.string().nullable().optional(),
  severity: z.string(),
  kind: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
  evidence: z.unknown().optional(),
  observation_window_start: z.string().nullable().optional(),
  observation_window_end: z.string().nullable().optional(),
  related_recommendations: z.array(z.string()).default([]),
  source: z.string().optional(),
  analysis_id: z.string().optional(),
  note: z.string().optional(),
  created_at: z.string(),
});
export type Alert = z.infer<typeof alertSchema>;

export const alertListSchema = z.object({
  items: z.array(alertSchema),
  count: z.number(),
  next_cursor: z.string().nullable(),
});
export type AlertList = z.infer<typeof alertListSchema>;

export const agentStatusSchema = z.object({
  mode: z.enum(["llm", "deterministic"]),
  llm_enabled: z.boolean(),
  api_key_configured: z.boolean(),
  main_model: z.string(),
  subagent_model: z.string(),
  reasoning_effort: z.string(),
  timeout_s: z.number(),
  cooling_model: z.object({ version: z.string(), label: z.string() }).nullable(),
  recommendation_only: z.literal(true),
});
export type AgentStatus = z.infer<typeof agentStatusSchema>;
