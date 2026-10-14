/**
 * Operations with side effects or long-running agent work. Never auto-retried.
 * None of them sends a command to equipment.
 */
import { apiRequest } from "./client";
import { endpoints } from "./endpoints";
import { chatResponseSchema, twinAnalysisSchema } from "./schemas/copilot";
import { analysisResponseSchema, decisionResponseSchema, type ReviewDecision } from "./schemas/recommendations";

type Signal = { signal?: AbortSignal };

/** Appends one review decision (not idempotent). Records a review only. */
export const recordDecision = ({
  recommendationId,
  decision,
  reviewer,
  note,
  signal,
}: Signal & { recommendationId: string; decision: ReviewDecision; reviewer: string; note?: string }) =>
  apiRequest(endpoints.recommendationDecisions(recommendationId), {
    method: "POST",
    schema: decisionResponseSchema,
    body: { decision, reviewer, ...(note ? { note } : {}) },
    signal,
    timeoutMs: 20_000,
  });

/** Runs the multi-agent analysis synchronously and persists recommendations + alerts (writes to the store). */
export const generateRecommendations = ({ assetId, runId, signal }: Signal & { assetId: string; runId?: string | undefined }) =>
  apiRequest(endpoints.generateRecommendations(), {
    method: "POST",
    schema: analysisResponseSchema,
    body: { asset_id: assetId, ...(runId ? { run_id: runId } : {}) },
    signal,
    timeoutMs: 180_000,
  });

/** Read-only copilot question (in-memory conversation only). */
export const sendCopilotMessage = ({
  message,
  conversationId,
  assetId,
  runId,
  signal,
}: Signal & { message: string; conversationId?: string | null; assetId?: string | undefined; runId?: string | undefined }) =>
  apiRequest(endpoints.copilotChat(), {
    method: "POST",
    schema: chatResponseSchema,
    body: {
      message,
      ...(conversationId ? { conversation_id: conversationId } : {}),
      ...(assetId ? { asset_id: assetId } : {}),
      ...(runId ? { run_id: runId } : {}),
    },
    signal,
    timeoutMs: 120_000,
  });

/** Copilot analysis scoped to a twin object (read-only). */
export const analyzeTwinObject = ({
  objectId,
  question,
  runId,
  signal,
}: Signal & { objectId: string; question: string; runId?: string | undefined }) =>
  apiRequest(endpoints.twinAnalyze(), {
    method: "POST",
    schema: twinAnalysisSchema,
    body: { object_id: objectId, question, ...(runId ? { run_id: runId } : {}) },
    signal,
    timeoutMs: 120_000,
  });
