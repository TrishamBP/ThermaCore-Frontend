"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import { SERIES } from "@/components/charts/palette";
import { TimeSeriesChart, type ChartRow } from "@/components/charts/TimeSeriesChart";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Notice } from "@/components/feedback/Notice";
import { QueryView } from "@/components/feedback/QueryView";
import { KeyValueList } from "@/components/shared/KeyValueList";
import { PageHeader } from "@/components/shared/PageHeader";
import { table } from "@/components/shared/table";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useRunId, useSetSearchParams } from "@/hooks/useRun";
import { useAssets, useModelEvaluation } from "@/hooks/useShellQueries";
import { getAssetTelemetry, getTwinLayout, getTwinOverlay, predictInlet } from "@/lib/api/reads";
import type { CoolingPredict, ModelEvaluation } from "@/lib/api/schemas/cooling";
import { formatEventTime, formatPercentFraction, formatValue, formatWithUnit, humanize, parseTime } from "@/lib/format";
import { LIVE_REFRESH_MS, qk } from "@/lib/query-keys";

import { AssetPicker } from "@/features/telemetry/AssetPicker";
import { metricRows } from "@/features/telemetry/series";

import { ForecastBlock } from "./ForecastBlock";

export function PredictionsView() {
  const runId = useRunId();
  const params = useSearchParams();
  const setParams = useSetSearchParams();
  const assets = useAssets(runId);
  const assetParam = params.get("asset");
  const selected = assets.data?.items.find((a) => a.asset_id === assetParam) ?? assets.data?.items[0];
  useEffect(() => {
    if (!assetParam && assets.data?.items[0]) setParams({ asset: assets.data.items[0].asset_id });
  }, [assetParam, assets.data, setParams]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        section="Predictions"
        title="Inlet temperature forecasts"
        meta={<span>XGBoost forecaster labelled <span className="font-mono text-fg-2">forecasting_baseline</span>, trained and evaluated on simulated telemetry. Forecasts are shown beside persistence (“no change”).</span>}
      />
      <Notice tone="warn" title="Forecast limitations.">
        On the documented test split the model does not outperform persistence. It forecasts under observed conditions only and
        cannot predict the effect of changing a cooling setting.
      </Notice>
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <AssetPicker runId={runId} selected={selected?.asset_id} onSelect={(id) => setParams({ asset: id })} title="Asset" />
        <div className="flex min-w-0 flex-col gap-4">
          {selected ? (
            <AssetForecast runId={runId} assetId={selected.asset_id} lastEvent={selected.last_event_timestamp} />
          ) : (
            <Skeleton className="h-80" />
          )}
          <FleetForecast runId={runId} />
        </div>
      </div>
      <ModelCard />
    </div>
  );
}

function AssetForecast({ runId, assetId, lastEvent }: { runId: string | undefined; assetId: string; lastEvent: string | null }) {
  const forecast = useQuery({
    queryKey: qk.predict(runId, assetId),
    queryFn: ({ signal }) => predictInlet({ assetId, runId, signal }),
    refetchInterval: LIVE_REFRESH_MS,
  });
  const end = parseTime(lastEvent);
  const win = end === null ? {} : { start: new Date(end - 60 * 60_000).toISOString(), end: new Date(end).toISOString() };
  const history = useQuery({
    queryKey: qk.telemetry(runId, assetId, { ...win, interval: "1m", metrics: ["inlet_temperature_c"] }),
    queryFn: ({ signal }) => getAssetTelemetry({ assetId, runId, ...win, interval: "1m", metrics: ["inlet_temperature_c"], signal }),
    refetchInterval: LIVE_REFRESH_MS,
  });
  const rows = useMemo(() => observedVsForecast(history.data?.series[0], forecast.data), [history.data, forecast.data]);
  return (
    <div className="grid gap-4 min-[1800px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Panel eyebrow={`${assetId} · last 60 min observed + forecast`} title="Observed vs forecast inlet temperature">
        {history.isPending || forecast.isPending ? (
          <Skeleton className="h-72" />
        ) : rows.length === 0 ? (
          <EmptyState title="No inlet history for this asset" />
        ) : (
          <TimeSeriesChart
            data={rows}
            unit="degC"
            height={290}
            ariaLabel={`Observed and forecast inlet temperature for ${assetId}`}
            marker={forecast.data?.observed_at ? { t: parseTime(forecast.data.observed_at) ?? 0, label: "latest reading" } : undefined}
            series={[
              { key: "observed", label: "Observed (1-min mean)", color: SERIES.primary },
              { key: "predicted", label: "Model forecast", color: SERIES.predicted, style: "dashed", showDots: true },
              { key: "persistence", label: "Persistence baseline", color: SERIES.reference, style: "dotted", showDots: true },
            ]}
          />
        )}
      </Panel>
      <Panel eyebrow={assetId} title="Forecast by horizon">
        <QueryView query={forecast}>{(f) => <ForecastBlock forecast={f} />}</QueryView>
      </Panel>
    </div>
  );
}

/** Observed history plus forecast points anchored at the latest observation (so the dashed line starts there). */
function observedVsForecast(series: Parameters<typeof metricRows>[0], forecast: CoolingPredict | undefined): ChartRow[] {
  const rows: ChartRow[] = metricRows(series, "inlet_temperature_c").map((r) => ({ t: r.t, observed: r.mean ?? null, predicted: null, persistence: null }));
  if (forecast?.status === "AVAILABLE") {
    const t0 = parseTime(forecast.observed_at);
    const v0 = forecast.latest_inlet_temperature_c ?? null;
    if (t0 !== null && v0 !== null) {
      const anchor = rows.find((r) => r.t === t0);
      if (anchor) Object.assign(anchor, { predicted: v0, persistence: v0 });
      else rows.push({ t: t0, observed: v0, predicted: v0, persistence: v0 });
    }
    for (const p of forecast.forecasts) {
      const t = parseTime(p.forecast_timestamp);
      if (t !== null) rows.push({ t, observed: null, predicted: p.predicted_inlet_temperature_c, persistence: p.persistence_inlet_temperature_c });
    }
  }
  return rows.sort((a, b) => a.t - b.t);
}

function FleetForecast({ runId }: { runId: string | undefined }) {
  const predicted = useQuery({
    queryKey: qk.twinOverlay(runId, "predicted_temperature"),
    queryFn: ({ signal }) => getTwinOverlay({ runId, type: "predicted_temperature", signal }),
    refetchInterval: LIVE_REFRESH_MS,
  });
  const current = useQuery({
    queryKey: qk.twinOverlay(runId, "temperature"),
    queryFn: ({ signal }) => getTwinOverlay({ runId, type: "temperature", signal }),
    refetchInterval: LIVE_REFRESH_MS,
  });
  const layout = useQuery({ queryKey: qk.twinLayout(), queryFn: ({ signal }) => getTwinLayout({ signal }), staleTime: Infinity });
  const rows = useMemo(() => {
    if (!predicted.data) return [];
    const now = new Map((current.data?.items ?? []).map((i) => [i.object_id, i]));
    const byId = new Map((layout.data?.objects ?? []).map((o) => [o.id, o]));
    return predicted.data.items
      .map((p) => {
        const cur = now.get(p.object_id);
        const rack = byId.get(byId.get(p.object_id)?.parent_id ?? "")?.name ?? "—";
        const pv = typeof p.value === "number" ? p.value : null;
        const cv = typeof cur?.value === "number" ? cur.value : null;
        return { p, rack, pv, cv, delta: pv !== null && cv !== null ? pv - cv : null };
      })
      .sort((a, b) => (b.pv ?? -Infinity) - (a.pv ?? -Infinity));
  }, [predicted.data, current.data, layout.data]);
  return (
    <Panel
      eyebrow={predicted.data ? `${predicted.data.simulation_run_id} · reference ${formatEventTime(predicted.data.reference_time)}` : "All servers"}
      title="Fleet forecast (largest predicted inlet first)"
      bodyClassName="p-0"
      footer="Values from GET /digital-twin/overlays?type=predicted_temperature. Bands are visual thresholds, not equipment limits."
    >
      <QueryView query={predicted} skeleton={<div className="p-4"><Skeleton className="h-40" /></div>}>
        {() =>
          rows.length === 0 ? (
            <div className="p-4"><EmptyState title="No predictions available" /></div>
          ) : (
            <div className={`${table.wrap} max-h-[360px] overflow-y-auto`}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th className={table.th}>Asset</th>
                    <th className={table.th}>Rack (demo layout)</th>
                    <th className={table.thNum}>Current inlet</th>
                    <th className={table.thNum}>Predicted</th>
                    <th className={table.thNum}>Δ</th>
                    <th className={table.th}>Band</th>
                    <th className={table.th}>Model note</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, rack, pv, cv, delta }) => (
                    <tr key={p.object_id} className={table.tr}>
                      <td className={table.tdId}>{p.asset_id ?? p.object_id}</td>
                      <td className={table.td}>{rack}</td>
                      <td className={table.tdNum}>{formatWithUnit(cv, "degC", 2)}</td>
                      <td className={`${table.tdNum} text-info`}>{formatWithUnit(pv, p.unit, 2)}</td>
                      <td className={table.tdNum}>{delta === null ? "—" : `${delta >= 0 ? "+" : ""}${formatValue(delta, "degC", 2)}`}</td>
                      <td className={table.td}><StatusBadge status={p.status} label={humanize(p.status)} tone={p.value === null ? "na" : "neutral"} /></td>
                      <td className={`${table.td} max-w-[260px] truncate text-[11px] text-fg-3`} title={p.warnings.join(" · ")}>{p.warnings[0] ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </QueryView>
    </Panel>
  );
}

function ModelCard() {
  const evaluation = useModelEvaluation();
  return (
    <Panel eyebrow="GET /cooling-model/evaluate" title="Model card">
      <QueryView query={evaluation} errorTitle="Model evaluation unavailable">
        {(m) => <ModelCardBody m={m} />}
      </QueryView>
    </Panel>
  );
}

function ModelCardBody({ m }: { m: ModelEvaluation }) {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-3">
        <KeyValueList
          items={[
            { key: "v", label: "Version", value: m.model_version },
            { key: "l", label: "Label", value: <StatusBadge status="INCONCLUSIVE" label={m.model_label} /> },
            { key: "t", label: "Target", value: <span title={m.target}>{m.target}</span> },
            { key: "h", label: "Horizons", value: m.horizons_minutes.map((h) => `${h} min`).join(", ") },
            { key: "src", label: "Training data", value: m.training_data.source_type ?? "—" },
            { key: "rows", label: "Rows / series", value: `${m.training_data.rows?.toLocaleString() ?? "—"} / ${m.training_data.series ?? "—"}` },
          ]}
        />
        <div>
          <div className="mb-1 text-[11px] font-semibold tracking-wide text-fg-3 uppercase">Limitations</div>
          <ul className="list-disc space-y-1 pl-4 text-xs text-fg-2">{m.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
      </div>
      <div className="xl:col-span-2">
        <div className={table.wrap}>
          <table className={table.table}>
            <thead>
              <tr>
                <th className={table.th}>Horizon</th>
                <th className={table.th}>Split</th>
                <th className={table.thNum}>Model RMSE</th>
                <th className={table.thNum}>Persistence RMSE</th>
                <th className={table.thNum}>Model MAE</th>
                <th className={table.thNum}>Skill vs persistence</th>
                <th className={table.thNum}>Assets where model wins</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(m.evaluation).flatMap(([h, e]) =>
                (["validation", "test"] as const).map((split) => {
                  const b = e[split];
                  const skill = b?.rmse_skill_vs_persistence ?? null;
                  return (
                    <tr key={`${h}-${split}`} className={table.tr}>
                      <td className={table.td}>+{h} min</td>
                      <td className={table.td}>{split}</td>
                      <td className={table.tdNum}>{formatValue(b?.model?.rmse, null, 4)}</td>
                      <td className={table.tdNum}>{formatValue(b?.persistence?.rmse, null, 4)}</td>
                      <td className={table.tdNum}>{formatValue(b?.model?.mae, null, 4)}</td>
                      <td className={`${table.tdNum} ${skill !== null && skill <= 0 ? "text-warn" : ""}`}>{formatPercentFraction(skill, 2, true)}</td>
                      <td className={table.tdNum}>
                        {split === "test" && e.per_asset_mae ? `${e.per_asset_mae.model_better_than_persistence} / ${e.per_asset_mae.assets}` : ""}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-fg-3">
          RMSE in °C. Skill = 1 − RMSE(model) / RMSE(persistence); ≤ 0 means no improvement over “no change”. Trained on runs:{" "}
          <span className="font-mono">{m.training_data.runs_used.map((r) => r.run_id).join(", ")}</span>.
        </p>
      </div>
    </div>
  );
}
