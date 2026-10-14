"use client";

import { Notice } from "@/components/feedback/Notice";
import { MetricValue } from "@/components/shared/MetricValue";
import { table } from "@/components/shared/table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { reasonText, type CoolingPredict } from "@/lib/api/schemas/cooling";
import { formatEventTime, formatPercentFraction, formatValue, formatWithUnit } from "@/lib/format";

/** Forecast vs persistence for one asset. UNAVAILABLE shows its reasons; skill is always shown. */
export function ForecastBlock({ forecast, compact }: { forecast: CoolingPredict; compact?: boolean }) {
  if (forecast.status !== "AVAILABLE") {
    return (
      <div className="space-y-2">
        <StatusBadge status={forecast.status} size="md" label="Forecast unavailable" />
        <ul className="space-y-1 text-xs text-fg-2">
          {forecast.reasons.map((r) => {
            const x = reasonText(r);
            return (
              <li key={x.code}>
                <span className="font-mono text-fg">{x.code}</span>
                {x.detail ? ` — ${x.detail}` : ""}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs text-fg-3">Observed {formatEventTime(forecast.observed_at)}</span>
        <MetricValue value={forecast.latest_inlet_temperature_c} unit="degC" size="lg" label="Latest inlet temperature" />
      </div>
      <div className={table.wrap}>
        <table className={table.table}>
          <thead>
            <tr>
              <th className={table.th}>Horizon</th>
              <th className={table.thNum}>Predicted</th>
              <th className={table.thNum}>Persistence</th>
              {!compact && <th className={table.thNum}>Δ vs persist.</th>}
              {!compact && <th className={table.thNum}>Test RMSE</th>}
              <th className={table.thNum}>Skill</th>
            </tr>
          </thead>
          <tbody>
            {forecast.forecasts.map((p) => {
              const delta =
                p.predicted_inlet_temperature_c !== null && p.persistence_inlet_temperature_c !== null
                  ? p.predicted_inlet_temperature_c - p.persistence_inlet_temperature_c
                  : null;
              return (
                <tr key={p.horizon_minutes} className={table.tr}>
                  <td className={table.td}>
                    +{p.horizon_minutes} min
                    {!compact && <div className="text-[10px] text-fg-3">{formatEventTime(p.forecast_timestamp)}</div>}
                  </td>
                  <td className={`${table.tdNum} text-info`}>{formatWithUnit(p.predicted_inlet_temperature_c, "degC", 2)}</td>
                  <td className={table.tdNum}>{formatWithUnit(p.persistence_inlet_temperature_c, "degC", 2)}</td>
                  {!compact && <td className={table.tdNum}>{delta === null ? "—" : `${delta >= 0 ? "+" : ""}${formatValue(delta, "degC", 3)} °C`}</td>}
                  {!compact && <td className={table.tdNum}>{formatWithUnit(p.evaluation?.offline_test_rmse_c, "degC", 3)}</td>}
                  <td className={table.tdNum}>{formatPercentFraction(p.evaluation?.rmse_skill_vs_persistence, 1, true)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {forecast.input_data_quality?.status && forecast.input_data_quality.status !== "OK" && (
        <Notice tone="stale" title={`Input data ${forecast.input_data_quality.status.toLowerCase()}:`}>
          {forecast.input_data_quality.notes.join(" · ")}
        </Notice>
      )}
      <Notice tone="info" title={`${forecast.model?.label ?? "Model"}:`}>
        {forecast.uncertainty?.method ?? "Offline error metrics only."} Skill vs persistence ≤ 0 means the model does not
        beat &quot;no change&quot;.
      </Notice>
    </div>
  );
}
