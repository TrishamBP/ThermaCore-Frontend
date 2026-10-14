"use client";

import { KeyValueList } from "@/components/shared/KeyValueList";
import { MetricValue } from "@/components/shared/MetricValue";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { MetricValue as MetricValueT } from "@/lib/api/schemas/common";
import type { AssetDetail } from "@/lib/api/schemas/telemetry";
import { formatEventTime, humanize, metricLabel } from "@/lib/format";

const PRIMARY = [
  "inlet_temperature_c", "exhaust_temperature_c", "temperature_delta_c", "workload_intensity", "cpu_utilization",
  "gpu_utilization", "fan_speed_rpm", "airflow_cfm", "power_consumption_kw",
];

/** Latest reading as a value grid. `kind`/`note` are surfaced; null is "—" with its reason. */
export function LatestReadingGrid({
  values,
  compact,
  showAll,
}: {
  values: Record<string, MetricValueT>;
  compact?: boolean;
  showAll?: boolean;
}) {
  const keys = showAll ? [...PRIMARY, ...Object.keys(values).filter((k) => !PRIMARY.includes(k))] : PRIMARY;
  return (
    <div className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4"}>
      {keys.map((k) => {
        const v = values[k];
        if (!v && !showAll) return null;
        return (
          <div key={k} className={`rounded-sm border border-line px-2.5 py-2 ${v?.value === null ? "hatch-na" : "bg-bg"}`}>
            <div className="flex items-center justify-between gap-1 text-[11px] text-fg-3">
              <span className="truncate">{metricLabel(k)}</span>
              {v?.kind === "calculated" && <span className="text-[10px] text-fg-3">calc.</span>}
            </div>
            <MetricValue value={v?.value} unit={v?.unit} size={compact ? "sm" : "md"} reason={v?.note ?? "no data"} label={metricLabel(k)} />
            {v?.note && v.value !== null && <div className="mt-0.5 truncate text-[10px] text-fg-3" title={v.note}>{v.note}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function CoolingStateBlock({ state }: { state: AssetDetail["cooling_state"] }) {
  if (!state) return <p className="text-xs text-na">Cooling state not available (no readings in the window).</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={state.state} size="md" />
        <StatusBadge status={state.severity} />
        <span className="text-[11px] text-fg-3">
          {state.window_minutes}-min window to {formatEventTime(state.as_of)} · {state.rules_not_evaluated} rules not evaluated
        </span>
      </div>
      {state.findings.length === 0 ? (
        <p className="text-xs text-fg-3">No findings.</p>
      ) : (
        <ul className="space-y-1.5">
          {state.findings.map((f, i) => (
            <li key={`${f.rule_id}-${i}`} className="rounded-sm border border-line bg-bg px-2.5 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-fg">{f.rule_id}</span>
                <StatusBadge status={f.severity} />
              </div>
              {f.explanation && <p className="mt-1 leading-relaxed text-fg-2">{f.explanation}</p>}
              {f.kind && <div className="mt-0.5 text-[10px] text-fg-3">{humanize(f.kind)}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProvenanceBlock({ asset }: { asset: AssetDetail["asset"] }) {
  return (
    <KeyValueList
      items={[
        { key: "src", label: "Source", value: <StatusBadge status="INFO" label={asset.source_type ?? "unknown"} /> },
        { key: "gen", label: "Generator", value: `${asset.generator ?? "—"} ${asset.generator_version ?? ""}` },
        { key: "seed", label: "Seed", value: asset.seed ?? "—" },
        { key: "dc", label: "Data center", value: asset.data_center_id ?? "—" },
        { key: "u", label: "Rack U position", value: asset.rack_u_position ?? "—" },
        { key: "age", label: "Server age", value: asset.server_age_years === null || asset.server_age_years === undefined ? "—" : `${asset.server_age_years} y` },
        { key: "risk", label: "Dataset label: failure risk", value: asset.source_failure_risk_level ?? "—" },
        { key: "eff", label: "Dataset label: efficiency", value: asset.source_energy_efficiency_class ?? "—" },
        { key: "mnt", label: "Dataset label: maintenance", value: asset.source_maintenance_status ?? "—" },
      ]}
    />
  );
}
