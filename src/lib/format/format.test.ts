import { readFileSync } from "node:fs";
import { join } from "node:path";

import { telemetryResponseSchema } from "@/lib/api/schemas/telemetry";
import { metricRows, rangeWindow } from "@/features/telemetry/series";
import { severityRank, toneOf } from "@/lib/status";

import { NO_DATA, formatEventTime, formatPercentFraction, formatWithUnit, humanize, unitLabel } from "./index";

describe("formatting", () => {
  it("never renders missing values as zero", () => {
    expect(formatWithUnit(null, "degC")).toBe(NO_DATA);
    expect(formatWithUnit(undefined, "kW")).toBe(NO_DATA);
    expect(formatWithUnit(Number.NaN, "kW")).toBe(NO_DATA);
    expect(formatWithUnit(0, "kW")).toBe("0.0 kW");
  });

  it("rounds only for display and maps both backend temperature units", () => {
    expect(formatWithUnit(2.0619999999999976, "degC")).toBe("2.1 °C");
    expect(unitLabel("°C")).toBe("°C");
    expect(unitLabel("degC")).toBe("°C");
    expect(unitLabel("weird_unit")).toBe("weird_unit");
  });

  it("formats simulated event time in UTC regardless of offset notation", () => {
    expect(formatEventTime("2026-01-01T14:00:00+00:00")).toBe("Jan 1, 14:00 UTC");
    expect(formatEventTime("2026-01-01T14:00:00.000000Z")).toBe("Jan 1, 14:00 UTC");
    expect(formatEventTime(null)).toBe(NO_DATA);
  });

  it("formats skill fractions as signed percentages", () => {
    expect(formatPercentFraction(-0.04005638533791145, 1, true)).toBe("-4.0 %");
    expect(formatPercentFraction(0.18, 0, true)).toBe("+18 %");
  });

  it("humanizes enums", () => {
    expect(humanize("APPROVED_FOR_EVALUATION")).toBe("Approved for evaluation");
  });
});

describe("status tones", () => {
  it("maps backend states to semantic tones; unknown values degrade to neutral", () => {
    expect(toneOf("ABOVE_LIMIT")).toBe("crit");
    expect(toneOf("STALE")).toBe("stale");
    expect(toneOf("UNAVAILABLE")).toBe("na");
    expect(toneOf("RESTRICTED")).toBe("restricted");
    expect(toneOf("SOMETHING_NEW")).toBe("neutral");
    expect(severityRank("CRITICAL")).toBeGreaterThan(severityRank("WARNING"));
  });
});

describe("telemetry series", () => {
  const t = telemetryResponseSchema.parse(
    JSON.parse(readFileSync(join(__dirname, "../../test/fixtures/asset-telemetry.json"), "utf-8")),
  );

  it("turns buckets into chart rows and keeps non-applicable metrics as gaps", () => {
    const inlet = metricRows(t.series[0], "inlet_temperature_c");
    expect(inlet.length).toBeGreaterThan(0);
    expect(inlet.every((r) => typeof r.mean === "number")).toBe(true);
    const gpu = metricRows(t.series[0], "gpu_utilization");
    expect(gpu.every((r) => r.mean === null)).toBe(true);
  });

  it("anchors time ranges at the newest reading, not wall-clock now", () => {
    expect(rangeWindow("2026-01-01T12:00:00Z", "1h")).toEqual({ start: "2026-01-01T11:00:00.000Z", end: "2026-01-01T12:00:00.000Z" });
    expect(rangeWindow(null, "1h")).toEqual({});
  });
});
