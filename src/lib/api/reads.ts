/**
 * Read operations (GET, plus POSTs that do not write to the store: forecast and optimizer evaluation).
 * Contracts: docs/backend-contract.md.
 */
import { apiRequest } from "./client";
import { endpoints } from "./endpoints";
import { healthSchema } from "./schemas/common";
import { coolingPredictSchema, fanPeerSchema, modelEvaluationSchema, optimizerSchema } from "./schemas/cooling";
import { overviewSchema } from "./schemas/dashboard";
import {
  agentStatusSchema,
  alertListSchema,
  recommendationDetailSchema,
  recommendationListSchema,
} from "./schemas/recommendations";
import { assetDetailSchema, assetListSchema, telemetryResponseSchema, type TelemetryInterval } from "./schemas/telemetry";
import { inspectionSchema, layoutSchema, overlaySchema, twinStateSchema, type OverlayType } from "./schemas/twin";

type Signal = { signal?: AbortSignal };
export type RunScope = { runId?: string | undefined };

export const getHealth = ({ signal }: Signal = {}) =>
  apiRequest(endpoints.health(), { schema: healthSchema, signal, timeoutMs: 5000 });

export const getDashboardOverview = ({ runId, signal }: RunScope & Signal) =>
  apiRequest(endpoints.dashboardOverview(), { schema: overviewSchema, query: { run_id: runId }, signal });

export const listAssets = ({ runId, signal }: RunScope & Signal) =>
  apiRequest(endpoints.assets(), { schema: assetListSchema, query: { run_id: runId, limit: 1000 }, signal });

export const getAsset = ({ assetId, runId, signal }: RunScope & Signal & { assetId: string }) =>
  apiRequest(endpoints.asset(assetId), { schema: assetDetailSchema, query: { run_id: runId }, signal });

export interface TelemetryQuery extends RunScope {
  assetId: string;
  start?: string | undefined;
  end?: string | undefined;
  interval: TelemetryInterval;
  metrics: readonly string[];
  limit?: number;
}
export const getAssetTelemetry = ({ assetId, runId, start, end, interval, metrics, limit, signal }: TelemetryQuery & Signal) =>
  apiRequest(endpoints.assetTelemetry(assetId), {
    schema: telemetryResponseSchema,
    query: { run_id: runId, start_time: start, end_time: end, interval, metrics, limit: limit ?? 1000 },
    signal,
  });

export const predictInlet = ({ assetId, runId, signal }: RunScope & Signal & { assetId: string }) =>
  apiRequest(endpoints.coolingPredict(), {
    method: "POST",
    schema: coolingPredictSchema,
    body: { asset_id: assetId, ...(runId ? { run_id: runId } : {}) },
    signal,
    timeoutMs: 20_000,
  });

export const getModelEvaluation = ({ signal }: Signal = {}) =>
  apiRequest(endpoints.modelEvaluation(), { schema: modelEvaluationSchema, signal });

export const evaluateOptimizer = ({ assetId, runId, signal }: RunScope & Signal & { assetId: string }) =>
  apiRequest(endpoints.optimizerRecommend(), {
    method: "POST",
    schema: optimizerSchema,
    body: { asset_id: assetId, ...(runId ? { run_id: runId } : {}) },
    signal,
    timeoutMs: 30_000,
  });

export const getFanPeerComparison = ({ runId, signal }: RunScope & Signal) =>
  apiRequest(endpoints.fanPeerComparison(), { schema: fanPeerSchema, query: { run_id: runId }, signal });

export interface RecommendationFilters extends RunScope {
  status?: string | undefined;
  severity?: string | undefined;
  type?: string | undefined;
  assetId?: string | undefined;
  cursor?: string | undefined;
  limit?: number;
}
export const listRecommendations = ({ runId, status, severity, type, assetId, cursor, limit, signal }: RecommendationFilters & Signal) =>
  apiRequest(endpoints.recommendations(), {
    schema: recommendationListSchema,
    query: { run_id: runId, status, severity, type, asset_id: assetId, cursor, limit: limit ?? 50 },
    signal,
  });

export const getRecommendation = ({ id, signal }: Signal & { id: string }) =>
  apiRequest(endpoints.recommendation(id), { schema: recommendationDetailSchema, signal });

export const getAgentStatus = ({ signal }: Signal = {}) =>
  apiRequest(endpoints.agentStatus(), { schema: agentStatusSchema, signal });

export const listAlerts = ({ runId, severity, cursor, limit, signal }: RunScope & Signal & { severity?: string | undefined; cursor?: string | undefined; limit?: number }) =>
  apiRequest(endpoints.alerts(), {
    schema: alertListSchema,
    query: { run_id: runId, severity, cursor, limit: limit ?? 50 },
    signal,
  });

export const getTwinLayout = ({ layoutVersion, signal }: Signal & { layoutVersion?: string | undefined } = {}) =>
  apiRequest(endpoints.twinLayout(), { schema: layoutSchema, query: { layout_version: layoutVersion }, signal });

export const getTwinState = ({ runId, signal }: RunScope & Signal) =>
  apiRequest(endpoints.twinState(), { schema: twinStateSchema, query: { run_id: runId }, signal });

export const getTwinOverlay = ({ runId, type, signal }: RunScope & Signal & { type: OverlayType }) =>
  apiRequest(endpoints.twinOverlays(), { schema: overlaySchema, query: { run_id: runId, type }, signal });

export const inspectTwinObject = ({ objectId, runId, signal }: RunScope & Signal & { objectId: string }) =>
  apiRequest(endpoints.twinInspect(objectId), { schema: inspectionSchema, query: { run_id: runId }, signal });
