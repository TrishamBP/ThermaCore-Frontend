import type { Overlay, OverlayItem, OverlayType } from "@/lib/api/schemas/twin";
import { formatValue, humanize, unitLabel } from "@/lib/format";
import { TONE_HEX, toneOf } from "@/lib/status";

/** Overlay colours: visual bands only, not equipment limits. One mapping for scene, tree and legend. */
export const BAND_COLORS: Record<string, string> = {
  cool: "#38bdf8",
  normal: "#2ee59d",
  warm: "#ff9f1c",
  hot: "#ff4d5e",
  low: "#4c6ef5",
  medium: "#22d3ee",
  high: "#f0fdfa",
};
export const NA_COLOR = TONE_HEX.na;

export const OVERLAY_META: Record<OverlayType, { label: string; caveat: string }> = {
  temperature: { label: "Inlet temperature", caveat: "Measured inlet temperature (simulated telemetry)." },
  predicted_temperature: { label: "Predicted inlet", caveat: "Baseline model forecast; does not beat persistence. Not a measurement." },
  workload: { label: "Workload", caveat: "Workload intensity 0–1 (simulated)." },
  thermal_risk: { label: "Thermal risk", caveat: "Rules-based estimator state per server." },
  energy: { label: "IT power", caveat: "Server IT power only — not cooling or facility power." },
  fan_excess: { label: "Fan vs peers", caveat: "Fan speed relative to comparable peers; relative indicator, no kW." },
  airflow: { label: "Airflow", caveat: "Airflow magnitude per server (CFM). No direction; not an airflow simulation." },
  data_quality: { label: "Data freshness", caveat: "Freshness of the latest reading relative to the run's newest reading." },
  cooling_efficiency: { label: "Cooling efficiency", caveat: "Not measured: there is no cooling-power telemetry." },
};

/** Status from numeric bands (`max` ascending, last `max: null` = open-ended). */
export function bandStatus(value: number | null, bands: Overlay["bands"]): string | null {
  if (value === null || !bands?.length) return null;
  for (const b of bands) if (b.max === null || value <= b.max) return b.status;
  return null;
}

export function overlayColor(type: OverlayType, item: Pick<OverlayItem, "status" | "value"> | undefined): string {
  if (!item || item.value === null || item.status === "UNAVAILABLE") return NA_COLOR;
  const band = BAND_COLORS[item.status];
  if (band) return band;
  if (type === "thermal_risk" && typeof item.value === "string") return TONE_HEX[toneOf(item.value)];
  return TONE_HEX[toneOf(item.status)];
}

/** Mix a hex colour toward grey (used to desaturate STALE objects). */
export function desaturate(hex: string, amount = 0.6): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const grey = 0x8c;
  const mix = (c: number) => Math.round(c + (grey - c) * amount);
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, "0")}`;
}

export type Appearance = {
  color: string;
  value: number | string | null;
  unit: string | null;
  status: string;
  stale: boolean;
  unavailable: boolean;
  predicted: boolean;
  /** True when the colour comes from a live SSE update newer than the overlay snapshot. */
  live: boolean;
};

type LiveLike = { status: string; freshness: string | null; inlet: number | null; lastTelemetry: string | null } | undefined;

const UNAVAILABLE_STATUSES = new Set(["RESTRICTED", "NO_TELEMETRY", "NO_DATA"]);

/** Colour + value of one server for the active overlay, combining the overlay snapshot and live state. */
export function serverAppearance(
  type: OverlayType,
  item: OverlayItem | undefined,
  live: LiveLike,
  bands: Overlay["bands"],
): Appearance {
  if (live && UNAVAILABLE_STATUSES.has(live.status)) {
    return { color: NA_COLOR, value: null, unit: null, status: live.status, stale: false, unavailable: true, predicted: false, live: false };
  }
  let value = item?.value ?? null;
  let status = item?.status ?? "NO_DATA";
  let fromLive = false;
  const liveNewer =
    live?.lastTelemetry && (!item?.observed_at || Date.parse(live.lastTelemetry) > Date.parse(item.observed_at));
  if (type === "temperature" && live && live.inlet !== null && liveNewer) {
    value = live.inlet;
    status = bandStatus(live.inlet, bands) ?? status;
    fromLive = true;
  }
  const base = overlayColor(type, value === null ? undefined : { status, value });
  const stale = live?.status === "STALE" || live?.freshness === "STALE";
  const unavailable = value === null || status === "UNAVAILABLE";
  return {
    color: stale && !unavailable ? desaturate(base) : base,
    value,
    unit: item?.unit ?? (type === "temperature" ? "degC" : null),
    status,
    stale,
    unavailable,
    predicted: item?.is_predicted ?? false,
    live: fromLive,
  };
}

export type LegendEntry ={ key: string; color: string; label: string; pattern?: "stale" | "na" };

export function legendFor(type: OverlayType, overlay: Overlay | undefined): LegendEntry[] {
  const unit = overlay?.items.find((i) => i.unit)?.unit ?? null;
  const entries: LegendEntry[] = [];
  if (overlay?.bands?.length) {
    let lo: number | null = null;
    for (const b of overlay.bands) {
      const range =
        b.max === null ? `> ${formatValue(lo, unit)}` : lo === null ? `≤ ${formatValue(b.max, unit)}` : `${formatValue(lo, unit)}–${formatValue(b.max, unit)}`;
      entries.push({ key: b.status, color: BAND_COLORS[b.status] ?? NA_COLOR, label: `${humanize(b.status)} ${range} ${unitLabel(unit)}`.trim() });
      lo = b.max;
    }
  } else if (overlay) {
    const seen = new Map<string, string>();
    for (const it of overlay.items) {
      const key = type === "thermal_risk" && typeof it.value === "string" ? it.value : it.status;
      if (it.value === null && it.status !== "INSUFFICIENT_PEERS") continue;
      if (!seen.has(key)) seen.set(key, overlayColor(type, it));
    }
    for (const [key, color] of seen) entries.push({ key, color, label: humanize(key) });
  }
  entries.push({ key: "__na", color: NA_COLOR, label: "No data / not measured / restricted", pattern: "na" });
  entries.push({ key: "__stale", color: desaturate("#2ee59d"), label: "Stale reading (desaturated)", pattern: "stale" });
  return entries;
}
