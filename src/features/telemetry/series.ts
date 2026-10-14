import type { ChartRow } from "@/components/charts/TimeSeriesChart";
import { pointStat, type AssetSeries, type TelemetryInterval } from "@/lib/api/schemas/telemetry";
import { parseTime } from "@/lib/format";

/** The 16 telemetry metrics plus the derived inlet→exhaust delta (backend SUPPORTED_METRICS). */
export const TELEMETRY_METRICS = [
  "inlet_temperature_c", "exhaust_temperature_c", "temperature_delta_c", "workload_intensity", "cpu_utilization",
  "gpu_utilization", "memory_utilization", "storage_utilization", "fan_speed_rpm", "airflow_cfm",
  "power_consumption_kw", "pue", "ambient_temperature_c", "humidity_percentage", "disk_io_iops",
  "network_throughput_gbps", "network_latency_ms",
] as const;

export const DEFAULT_CHART_METRICS = ["inlet_temperature_c", "exhaust_temperature_c", "workload_intensity", "fan_speed_rpm", "power_consumption_kw"];

export const RANGES = {
  "15m": { label: "15 min", minutes: 15, interval: "1m" },
  "1h": { label: "1 h", minutes: 60, interval: "1m" },
  "6h": { label: "6 h", minutes: 360, interval: "5m" },
  "24h": { label: "24 h", minutes: 1440, interval: "15m" },
} as const satisfies Record<string, { label: string; minutes: number; interval: TelemetryInterval }>;
export type RangeKey = keyof typeof RANGES;

/** Window ending at the asset's newest reading (simulated event time), never at wall-clock now. */
export function rangeWindow(lastEventIso: string | null | undefined, range: RangeKey): { start?: string; end?: string } {
  const end = parseTime(lastEventIso);
  if (end === null) return {};
  return { start: new Date(end - RANGES[range].minutes * 60_000).toISOString(), end: new Date(end).toISOString() };
}

/** One metric of one series → rows with mean/min/max. Buckets with count 0 stay null (gap). */
export function metricRows(series: AssetSeries | undefined, metric: string): ChartRow[] {
  if (!series) return [];
  const rows: ChartRow[] = [];
  for (const p of series.points) {
    const t = parseTime(p.bucket_start ?? p.timestamp);
    if (t === null) continue;
    const stat = pointStat(p, metric);
    const has = stat !== null && stat.count > 0 && stat.mean !== null;
    rows.push({ t, mean: has ? stat.mean : null, min: has ? stat.min : null, max: has ? stat.max : null });
  }
  return rows;
}
