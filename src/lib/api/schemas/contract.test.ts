import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { z } from "zod";

import { errorFromResponse } from "../errors";
import { healthSchema } from "./common";
import { coolingPredictSchema, fanPeerSchema, modelEvaluationSchema, optimizerSchema } from "./cooling";
import { overviewSchema } from "./dashboard";
import { agentStatusSchema, alertListSchema, recommendationDetailSchema, recommendationListSchema } from "./recommendations";
import { assetDetailSchema, assetListSchema, telemetryResponseSchema } from "./telemetry";
import { inspectionSchema, layoutSchema, overlaySchema, twinStateSchema } from "./twin";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, "../../../test/fixtures", name), "utf-8"));

const cases: [string, z.ZodType][] = [
  ["dashboard-overview.json", overviewSchema],
  ["assets.json", assetListSchema],
  ["asset-detail.json", assetDetailSchema],
  ["asset-telemetry.json", telemetryResponseSchema],
  ["cooling-predict.json", coolingPredictSchema],
  ["optimizer-unavailable.json", optimizerSchema],
  ["model-evaluation.json", modelEvaluationSchema],
  ["fan-peers.json", fanPeerSchema],
  ["recommendations.json", recommendationListSchema],
  ["recommendation-detail.json", recommendationDetailSchema],
  ["alerts-empty.json", alertListSchema],
  ["agent-status.json", agentStatusSchema],
  ["twin-layout.json", layoutSchema],
  ["twin-state.json", twinStateSchema],
  ["twin-overlay-temperature.json", overlaySchema],
  ["twin-overlay-fan-excess.json", overlaySchema],
  ["twin-inspect-server.json", inspectionSchema],
  ["twin-inspect-crah.json", inspectionSchema],
];

describe("captured backend responses parse with the frontend schemas", () => {
  it.each(cases)("%s", (name, schema) => {
    const result = schema.safeParse(fixture(name));
    if (!result.success) throw new Error(JSON.stringify(result.error.issues.slice(0, 5), null, 2));
  });

  it("health schema rejects an unknown status", () => {
    expect(healthSchema.safeParse({ status: "great", database: "sqlite", schema_version: 2 }).success).toBe(false);
  });

  it("preserves nulls: GPU utilization of a non-GPU asset stays null", () => {
    const detail = assetDetailSchema.parse(fixture("asset-detail.json"));
    expect(detail.asset.asset_type).not.toBe("GPU");
    expect(detail.latest_reading?.values.gpu_utilization?.value).toBeNull();
  });

  it("recommendations never claim automatic control", () => {
    const d = recommendationDetailSchema.parse(fixture("recommendation-detail.json"));
    expect(d.recommendation.automatic_control_executed).toBe(false);
    expect(d.recommendation.human_approval_required).toBe(true);
  });

  it("optimizer fixture is UNAVAILABLE with reasons and no recommended setting", () => {
    const o = optimizerSchema.parse(fixture("optimizer-unavailable.json"));
    expect(o.status).toBe("UNAVAILABLE");
    expect(o.reasons.length).toBeGreaterThan(0);
    expect(o.recommended_setting).toBeNull();
  });
});

describe("error envelopes", () => {
  it.each([
    ["error-unknown-asset.json", 404, "unknown_asset"],
    ["error-invalid-overlay.json", 422, "invalid_parameter"],
  ] as const)("%s keeps code and request id", (name, status, code) => {
    const err = errorFromResponse(status, fixture(name), null, "GET");
    expect(err.code).toBe(code);
    expect(err.requestId).toMatch(/^[0-9a-f]{32}$/);
    expect(err.retryable).toBe(false);
  });
});
