import { z } from "zod";

export const SECTION_KEYS = ["measured", "calculated", "predictions", "hypotheses", "recommendations", "limitations"] as const;

export const copilotEvidenceSchema = z
  .object({
    id: z.string().optional(),
    evidence_id: z.string().optional(),
    kind: z.string().optional(),
    metric: z.string().optional(),
    value: z.unknown().optional(),
    unit: z.string().nullable().optional(),
    source: z.string().nullable().optional(),
  })
  .catchall(z.unknown());

export const chatResponseSchema = z.object({
  conversation_id: z.string(),
  answer: z.string(),
  clarification_needed: z.boolean(),
  interpretation: z
    .object({
      intents: z.array(z.string()).optional(),
      asset_ids: z.array(z.string()).optional(),
      all_assets: z.boolean().optional(),
      start_time: z.string().nullable().optional(),
      end_time: z.string().nullable().optional(),
      time_basis: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      run: z.unknown().optional(),
    })
    .catchall(z.unknown())
    .nullable(),
  sections: z.record(z.string(), z.array(z.string())),
  evidence: z.array(copilotEvidenceSchema),
  metrics: z.record(z.string(), z.unknown()),
  predictions: z.array(z.record(z.string(), z.unknown())),
  recommendations: z.array(z.record(z.string(), z.unknown())),
  optimizer: z.record(z.string(), z.unknown()).nullable(),
  warnings: z.array(z.string()),
  agent_execution_summary: z.record(z.string(), z.unknown()),
  read_only: z.boolean(),
  automatic_control_executed: z.boolean(),
  units_note: z.string(),
  unavailable_measurements: z.record(z.string(), z.string()),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

export const twinAnalysisSchema = z
  .object({
    summary: z.string().optional(),
    answer: z.string().optional(),
    clarification_needed: z.boolean().optional(),
    sections: z.record(z.string(), z.array(z.string())).optional(),
    evidence: z.array(copilotEvidenceSchema).optional(),
    predictions: z.array(z.record(z.string(), z.unknown())).optional(),
    recommendations: z.array(z.record(z.string(), z.unknown())).optional(),
    warnings: z.array(z.string()).optional(),
    conversation_id: z.string().nullable().optional(),
  })
  .catchall(z.unknown());
export type TwinAnalysis = z.infer<typeof twinAnalysisSchema>;
