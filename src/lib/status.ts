/**
 * The single mapping from backend status/enum values to visual tones.
 * Status is always shown as icon + text + colour (never colour alone).
 */
export type Tone = "ok" | "warn" | "crit" | "stale" | "na" | "info" | "neutral" | "restricted";

const TONES: Record<string, Tone> = {
  // health / generic
  OK: "ok", ok: "ok", AVAILABLE: "ok", COMPLETED: "ok", FRESH: "ok", NORMAL: "ok", WITHIN_LIMIT: "ok",
  WITHIN_PEER_RANGE: "ok", APPROVED_FOR_EVALUATION: "ok", RECOMMENDATION_AVAILABLE: "ok", RECOMMENDATION: "ok",
  degraded: "warn", DEGRADED: "warn",
  // severities
  INFO: "info", WARNING: "warn", CRITICAL: "crit",
  // cooling estimator states
  HIGH_THERMAL_LOAD: "crit", RAPID_TEMPERATURE_RISE: "warn", APPROACHING_THERMAL_LIMIT: "warn",
  POTENTIAL_AIRFLOW_ISSUE: "warn", DATA_QUALITY_ISSUE: "warn", LIGHT_LOAD: "info", PARTIALLY_ASSESSED: "info",
  INSUFFICIENT_DATA: "na",
  // twin thermal status
  APPROACHING_LIMIT: "warn", ABOVE_LIMIT: "crit", UNKNOWN: "na",
  // freshness / twin status
  STALE: "stale", NO_DATA: "na", NO_TELEMETRY: "na", RESTRICTED: "restricted",
  // forecasts / optimizer / analyses
  UNAVAILABLE: "na", INCONCLUSIVE: "warn", NO_FEASIBLE_SETTING: "warn", CONSTRAINTS_ONLY: "info",
  COMPLETED_WITH_FALLBACK: "warn", FAILED: "crit",
  // recommendations / review
  REQUIRES_REVIEW: "warn", PENDING_REVIEW: "warn", REJECTED: "neutral", DEFERRED: "info",
  // fan peers
  ELEVATED: "warn", BELOW_PEERS: "info", INSUFFICIENT_PEERS: "na",
  // uncertainty levels
  LOW: "ok", MEDIUM: "warn", HIGH: "crit",
};

export function toneOf(status: string | null | undefined): Tone {
  if (!status) return "na";
  return TONES[status] ?? "neutral";
}

export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-ok", warn: "text-warn", crit: "text-crit", stale: "text-stale", na: "text-na", info: "text-info",
  neutral: "text-fg-2", restricted: "text-na",
};

export const TONE_BG: Record<Tone, string> = {
  ok: "bg-ok", warn: "bg-warn", crit: "bg-crit", stale: "bg-stale", na: "bg-na", info: "bg-info",
  neutral: "bg-fg-3", restricted: "bg-na",
};

export const TONE_BADGE: Record<Tone, string> = {
  ok: "border-ok/40 bg-ok/10 text-ok",
  warn: "border-warn/40 bg-warn/10 text-warn",
  crit: "border-crit/50 bg-crit/10 text-crit",
  stale: "border-stale/40 bg-stale/10 text-stale",
  na: "border-na/40 bg-na/10 text-na",
  info: "border-info/40 bg-info/10 text-info",
  neutral: "border-line-strong bg-raised text-fg-2",
  restricted: "border-na/40 bg-na/10 text-na",
};

/** Hex values for canvas/chart use (mirrors globals.css tokens). */
export const TONE_HEX: Record<Tone, string> = {
  ok: "#2ee59d", warn: "#ff9f1c", crit: "#ff4d5e", stale: "#a78bfa", na: "#8c95aa", info: "#4fd1ff",
  neutral: "#d9dc6a", restricted: "#8c95aa",
};

/** Severity rank for sorting (higher = worse). */
export function severityRank(status: string | null | undefined): number {
  const t = toneOf(status);
  return { crit: 5, warn: 4, stale: 3, info: 2, ok: 1, neutral: 1, na: 0, restricted: 0 }[t];
}
