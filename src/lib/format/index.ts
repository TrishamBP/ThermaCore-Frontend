/** Display formatting. Rounds only for display; null always renders as an explicit "no data". */

export const NO_DATA = "—";

const UNIT_LABELS: Record<string, string> = {
  degC: "°C",
  "°C": "°C",
  percent: "%",
  ratio_0_1: "",
  ratio: "",
  rpm: "rpm",
  cfm: "CFM",
  kW: "kW",
  iops: "IOPS",
  Gbps: "Gbps",
  ms: "ms",
  seconds: "s",
  fraction: "",
  "degC/min": "°C/min",
};

export function unitLabel(unit: string | null | undefined): string {
  if (!unit) return "";
  return UNIT_LABELS[unit] ?? unit;
}

const DECIMALS: Record<string, number> = {
  degC: 1, "°C": 1, percent: 1, ratio_0_1: 2, ratio: 3, rpm: 0, cfm: 0, kW: 1, iops: 0, Gbps: 1, ms: 1, seconds: 0,
  fraction: 2,
};

export function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Value without unit, precision chosen from the unit. */
export function formatValue(value: number | null | undefined, unit?: string | null, decimals?: number): string {
  return formatNumber(value, decimals ?? (unit ? DECIMALS[unit] : undefined) ?? 2);
}

/** Value with unit, e.g. "22.7 °C". */
export function formatWithUnit(value: number | null | undefined, unit?: string | null, decimals?: number): string {
  const v = formatValue(value, unit, decimals);
  if (v === NO_DATA) return v;
  const u = unitLabel(unit);
  return u ? `${v} ${u}` : v;
}

export function formatPercentFraction(fraction: number | null | undefined, decimals = 1, signed = false): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return NO_DATA;
  const s = (fraction * 100).toFixed(decimals);
  return `${signed && fraction > 0 ? "+" : ""}${s} %`;
}

const METRIC_LABELS: Record<string, string> = {
  inlet_temperature_c: "Inlet temperature",
  exhaust_temperature_c: "Exhaust temperature",
  temperature_delta_c: "Inlet → exhaust Δ",
  workload_intensity: "Workload intensity",
  cpu_utilization: "CPU utilization",
  gpu_utilization: "GPU utilization",
  memory_utilization: "Memory utilization",
  storage_utilization: "Storage utilization",
  fan_speed_rpm: "Fan speed",
  airflow_cfm: "Airflow",
  power_consumption_kw: "Server IT power",
  pue: "PUE (simulated per asset)",
  disk_io_iops: "Disk I/O",
  network_throughput_gbps: "Network throughput",
  network_latency_ms: "Network latency",
  ambient_temperature_c: "Ambient temperature",
  humidity_percentage: "Humidity",
  cooling_efficiency: "Cooling efficiency",
  cooling_power_kw: "Cooling power",
  facility_power_kw: "Facility power",
  cooling_setpoints: "Cooling setpoints",
};

export function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? humanize(metric);
}

/** "APPROACHING_LIMIT" → "Approaching limit". */
export function humanize(value: string | null | undefined): string {
  if (!value) return NO_DATA;
  const s = value.replaceAll("_", " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function parseTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Simulated event time, always UTC: "Jan 1, 23:59 UTC". */
export function formatEventTime(iso: string | null | undefined, withSeconds = false): string {
  const t = parseTime(iso);
  if (t === null) return NO_DATA;
  const d = new Date(t);
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${withSeconds ? `:${pad(d.getUTCSeconds())}` : ""}`;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${time} UTC`;
}

export function formatClockUtc(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Wall-clock time in the operator's locale (for "last fetched"). */
export function formatLocalClock(ms: number | null | undefined): string {
  if (!ms) return NO_DATA;
  return new Date(ms).toLocaleTimeString("en-GB", { hour12: false });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return NO_DATA;
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86400).toFixed(1)} d`;
}

export function shortId(id: string, keep = 10): string {
  return id.length > keep + 4 ? `${id.slice(0, keep)}…` : id;
}
