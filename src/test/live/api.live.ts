/**
 * Live check of all 30 backend operations through the frontend proxy, using the frontend's own API layer.
 * Run: pnpm test:live  (see vitest.live.config.ts for side effects)
 */
import { z } from "zod";

import { apiRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { analyzeTwinObject, generateRecommendations, recordDecision, sendCopilotMessage } from "@/lib/api/mutations";
import * as read from "@/lib/api/reads";
import { coolingPredictSchema } from "@/lib/api/schemas/cooling";
import { alertSchema } from "@/lib/api/schemas/recommendations";
import { telemetryResponseSchema } from "@/lib/api/schemas/telemetry";
import { OVERLAY_TYPES, inspectionSchema, layoutObjectSchema, streamEventSchema } from "@/lib/api/schemas/twin";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;
const ctx: { runId?: string; assetId?: string; recId?: string; analysisId?: string; alertId?: string } = {};

async function expectError(p: Promise<unknown>, status: number, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status, code });
  expect((err as ApiError).requestId).toBeTruthy();
}

describe("system", () => {
  it("GET /health", async () => {
    const h = await read.getHealth();
    expect(h).toMatchObject({ status: "ok", schema_version: 2 });
  });
});

describe("dashboard, telemetry and assets", () => {
  it("GET /assets", async () => {
    const a = await read.listAssets({});
    expect(a.items.length).toBeGreaterThan(0);
    ctx.runId = a.simulation_run_id;
    ctx.assetId = a.items[0]!.asset_id;
  });
  it("GET /dashboard/overview", async () => {
    const o = await read.getDashboardOverview({ runId: ctx.runId });
    expect(o.simulation_run_id).toBe(ctx.runId);
    expect(o.kpis.inlet_temperature_c?.unit).toBe("degC");
  });
  it("GET /telemetry/cooling-state", async () => {
    const s = await apiRequest("/telemetry/cooling-state", { query: { run_id: ctx.runId }, schema: z.object({ state: z.string(), severity: z.string() }).loose() });
    expect(s.state).toBeTruthy();
  });
  it("GET /telemetry (all assets)", async () => {
    const t = await apiRequest("/telemetry", { query: { run_id: ctx.runId, interval: "5m", metrics: "inlet_temperature_c" }, schema: telemetryResponseSchema });
    expect(t.series.length).toBeGreaterThan(1);
  });
  it("GET /assets/{asset_id}", async () => {
    const d = await read.getAsset({ assetId: ctx.assetId!, runId: ctx.runId });
    expect(d.asset.asset_id).toBe(ctx.assetId);
  });
  it("GET /assets/{asset_id}/telemetry", async () => {
    const t = await read.getAssetTelemetry({ assetId: ctx.assetId!, runId: ctx.runId, interval: "1m", metrics: ["inlet_temperature_c", "fan_speed_rpm"] });
    expect(t.series[0]?.points.length).toBeGreaterThan(0);
  });
  it("error path: unknown asset → 404 unknown_asset", async () => {
    await expectError(read.getAsset({ assetId: "NOPE-1", runId: ctx.runId }), 404, "unknown_asset");
  });
});

describe("cooling model and optimizer", () => {
  it("GET /cooling-model/evaluate", async () => {
    const m = await read.getModelEvaluation();
    expect(m.model_label).toBe("forecasting_baseline");
  });
  it("GET /cooling-model/predict (legacy)", async () => {
    const p = await apiRequest("/cooling-model/predict", { query: { asset_id: ctx.assetId, run_id: ctx.runId }, schema: z.object({ forecasts: z.array(z.unknown()) }).loose() });
    expect(Array.isArray(p.forecasts)).toBe(true);
  });
  it("POST /cooling/predict", async () => {
    const p = await read.predictInlet({ assetId: ctx.assetId!, runId: ctx.runId });
    expect(["AVAILABLE", "UNAVAILABLE"]).toContain(p.status);
  });
  it("POST /cooling-optimizer/recommend", async () => {
    const o = await read.evaluateOptimizer({ assetId: ctx.assetId!, runId: ctx.runId });
    expect(o.recommendation_only).toBe(true);
  });
  it("POST /cooling/optimize", async () => {
    const o = await apiRequest("/cooling/optimize", {
      method: "POST",
      body: { asset_id: ctx.assetId, run_id: ctx.runId, candidate_settings: { fan_speed_rpm: [2000, 3000] } },
      schema: coolingPredictSchema.pick({ status: true }).extend({ conclusion: z.string().optional() }).loose(),
    });
    expect(o.status).toBeTruthy();
  });
  it("POST /cooling-model/train → blocked by the proxy (admin, disabled)", async () => {
    await expectError(apiRequest("/cooling-model/train", { method: "POST", body: {}, schema: z.unknown() }), 403, "forbidden");
  });
});

describe("energy", () => {
  it("GET /energy/fan-peer-comparison", async () => {
    const f = await read.getFanPeerComparison({ runId: ctx.runId });
    expect(f.results.length).toBeGreaterThan(0);
    expect(f.recommendation_only).toBe(true);
  });
});

describe("recommendations and alerts", () => {
  it("GET /recommendations/agents/status", async () => {
    const s = await read.getAgentStatus();
    expect(s.recommendation_only).toBe(true);
  });
  it("POST /recommendations/generate (writes one analysis)", async () => {
    const r = await generateRecommendations({ assetId: ctx.assetId!, runId: ctx.runId });
    expect(r.human_approval_required).toBe(true);
    expect(r.automatic_control_executed).toBe(false);
    ctx.analysisId = r.analysis_id;
    const first = r.recommendations[0]?.recommendation_id;
    if (typeof first === "string") ctx.recId = first;
  });
  it("GET /recommendations/analyses/{analysis_id}", async () => {
    const a = await apiRequest(`/recommendations/analyses/${ctx.analysisId}`, { schema: z.record(z.string(), z.unknown()) });
    expect(Object.keys(a).length).toBeGreaterThan(0);
  });
  it("GET /recommendations", async () => {
    const l = await read.listRecommendations({ runId: ctx.runId, limit: 20 });
    if (!ctx.recId) ctx.recId = l.items[0]?.recommendation_id;
    expect(ctx.recId).toBeTruthy();
  });
  it("GET /recommendations/{id}", async () => {
    const d = await read.getRecommendation({ id: ctx.recId! });
    expect(d.recommendation.recommendation_id).toBe(ctx.recId);
  });
  it("POST /recommendations/{id}/decisions (DEFERRED on the generated recommendation)", async () => {
    const d = await recordDecision({ recommendationId: ctx.recId!, decision: "DEFERRED", reviewer: "api-check", note: "automated API check" });
    expect(d.automatic_control_executed).toBe(false);
    expect(d.decision).toBe("DEFERRED");
  });
  it("GET /alerts", async () => {
    const a = await read.listAlerts({ limit: 50 });
    ctx.alertId = a.items[0]?.alert_id;
    expect(Array.isArray(a.items)).toBe(true);
  });
  it("GET /alerts/{alert_id} (or 404 for an unknown id when none exist)", async () => {
    if (ctx.alertId) {
      const a = await apiRequest(`/alerts/${ctx.alertId}`, { schema: alertSchema });
      expect(a.alert_id).toBe(ctx.alertId);
    } else {
      await expectError(apiRequest("/alerts/alr-00000000000000000000", { schema: alertSchema }), 404, "unknown_alert");
    }
  });
});

describe("copilot", () => {
  it("POST /copilot/chat", async () => {
    const c = await sendCopilotMessage({ message: `What is the current inlet temperature of ${ctx.assetId}?`, runId: ctx.runId });
    expect(c.conversation_id).toMatch(/^conv-/);
    expect(c.read_only).toBe(true);
  });
});

describe("digital twin", () => {
  it("GET /digital-twin/layout", async () => {
    const l = await read.getTwinLayout();
    expect(l.demonstration).toBe(true);
    const again = await read.getTwinLayout({ layoutVersion: l.layout_version });
    expect(again.unchanged).toBe(true);
  });
  it("GET /digital-twin/layout/{object_id}", async () => {
    const o = await apiRequest("/digital-twin/layout/rack-21", {
      schema: z.object({ object: layoutObjectSchema, parents: z.array(z.unknown()), children: z.array(z.unknown()) }).loose(),
    });
    expect(o.object.id).toBe("rack-21");
    expect(o.children.length).toBe(5);
  });
  it("GET /digital-twin/state", async () => {
    const s = await read.getTwinState({ runId: ctx.runId });
    expect(s.assets.length).toBeGreaterThan(0);
  });
  it.each(OVERLAY_TYPES)("GET /digital-twin/overlays?type=%s", async (type) => {
    const o = await read.getTwinOverlay({ runId: ctx.runId, type });
    expect(o.overlay_type).toBe(type);
  });
  it("error path: unknown overlay → 422 invalid_parameter", async () => {
    await expectError(apiRequest("/digital-twin/overlays", { query: { type: "nope" }, schema: z.unknown() }), 422, "invalid_parameter");
  });
  it("GET /digital-twin/assets/{object_id} (server, rack, cooling unit)", async () => {
    for (const id of ["srv-013", "rack-21", "crah-1"]) {
      const i = await read.inspectTwinObject({ objectId: id, runId: ctx.runId });
      expect(inspectionSchema.safeParse(i).success).toBe(true);
    }
  });
  it("POST /digital-twin/analyze", async () => {
    const a = await analyzeTwinObject({ objectId: "srv-013", question: "Why is it warm?", runId: ctx.runId });
    expect(a.summary ?? a.answer).toBeTruthy();
  });
  it("GET /digital-twin/stream (SSE first frame through the proxy)", async () => {
    const res = await fetch(`${BASE}/digital-twin/stream?max_events=1`, { headers: { Accept: "text/event-stream" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    const data = text.split("\n").find((l) => l.startsWith("data: "))!.slice(6);
    const ev = streamEventSchema.parse(JSON.parse(data));
    expect(ev.event).toBe("heartbeat");
  });
});
