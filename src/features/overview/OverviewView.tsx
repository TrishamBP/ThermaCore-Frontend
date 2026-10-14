"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, Cpu, Gauge, Server, Thermometer, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { SERIES } from "@/components/charts/palette";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Notice } from "@/components/feedback/Notice";
import { QueryView } from "@/components/feedback/QueryView";
import { KeyValueList } from "@/components/shared/KeyValueList";
import { KpiCard } from "@/components/shared/KpiCard";
import { MetricValue } from "@/components/shared/MetricValue";
import { PageHeader } from "@/components/shared/PageHeader";
import { table } from "@/components/shared/table";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useHref, useRunId } from "@/hooks/useRun";
import { useAlertCount, useModelEvaluation } from "@/hooks/useShellQueries";
import {
  evaluateOptimizer,
  getAgentStatus,
  getDashboardOverview,
  listRecommendations,
  predictInlet,
} from "@/lib/api/reads";
import type { Overview } from "@/lib/api/schemas/dashboard";
import { reasonText } from "@/lib/api/schemas/cooling";
import {
  formatDuration,
  formatEventTime,
  formatLocalClock,
  formatPercentFraction,
  formatWithUnit,
  humanize,
  metricLabel,
} from "@/lib/format";
import { LIVE_REFRESH_MS, qk } from "@/lib/query-keys";
import { severityRank } from "@/lib/status";

import { trendRows } from "./trend";

const TREND_TABS = {
  temperature: { label: "Temperatures", unit: "degC", keys: ["inlet_temperature_c", "exhaust_temperature_c"] },
  cpu: { label: "CPU", unit: "percent", keys: ["cpu_utilization"] },
  fan: { label: "Fan speed", unit: "rpm", keys: ["fan_speed_rpm"] },
  power: { label: "IT power", unit: "kW", keys: ["power_consumption_kw"] },
} as const;
type TrendTab = keyof typeof TREND_TABS;
const TREND_COLORS = [SERIES.primary, SERIES.secondary];

export function OverviewView() {
  const runId = useRunId();
  const overview = useQuery({
    queryKey: qk.overview(runId),
    queryFn: ({ signal }) => getDashboardOverview({ runId, signal }),
    refetchInterval: LIVE_REFRESH_MS,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        section="Overview"
        title="Operations Center"
        meta={
          overview.data ? (
            <>
              <span>Run <span className="font-mono text-fg-2">{overview.data.simulation_run_id}</span></span>
              <span>
                Window <span className="font-mono text-fg-2">{formatEventTime(overview.data.window.start_time)}</span> →{" "}
                <span className="font-mono text-fg-2">{formatEventTime(overview.data.window.end_time)}</span> (simulated)
              </span>
              <span>Last updated <span className="font-mono text-fg-2">{formatLocalClock(overview.dataUpdatedAt)}</span></span>
            </>
          ) : (
            <span>Loading the current state of the selected run…</span>
          )
        }
      />
      <QueryView query={overview} errorTitle="Could not load the operations overview" skeleton={<OverviewSkeleton />}>
        {(data) => <OverviewBody data={data} />}
      </QueryView>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[118px]" />)}
      <Skeleton className="h-72 sm:col-span-2 xl:col-span-4" />
      <Skeleton className="h-72 sm:col-span-2 xl:col-span-2" />
    </div>
  );
}

function OverviewBody({ data }: { data: Overview }) {
  const runId = data.simulation_run_id;
  const hottest = data.kpis.inlet_temperature_c?.max_asset_id ?? null;
  return (
    <>
      {(data.data_quality.pipeline_stale || data.warnings.length > 0) && (
        <Notice tone="stale" title={data.data_quality.pipeline_stale ? "Pipeline not delivering:" : "Data warnings:"}>
          {data.warnings.join(" · ") || "No new readings stored recently."}
        </Notice>
      )}
      <KpiRow data={data} />
      <div className="grid gap-4 xl:grid-cols-3">
        <TrendPanel data={data} />
        <ThermalRiskPanel data={data} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <AlertsSummary runId={runId} />
        <ForecastSummary runId={runId} assetId={hottest} />
        <SystemStatusPanel data={data} hottest={hottest} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <RecommendedActions runId={runId} />
        <DataQualityPanel data={data} />
      </div>
      <InjectedLabels data={data} />
    </>
  );
}

function KpiRow({ data }: { data: Overview }) {
  const inlet = data.kpis.inlet_temperature_c;
  const power = data.kpis.power_consumption_kw;
  const cpu = data.kpis.cpu_utilization;
  const alerts = useAlertCount(data.simulation_run_id);
  const tr = data.thermal_risk;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <KpiCard
        icon={Thermometer}
        label="Max inlet temperature"
        value={<MetricValue value={inlet?.max} unit={inlet?.unit} size="xl" label="Max inlet temperature" />}
        sub={inlet ? <>{inlet.max_asset_id ?? "—"} · mean {formatWithUnit(inlet.mean, inlet.unit)}</> : "not reported"}
      />
      <KpiCard
        icon={Gauge}
        label="Thermal risk (estimator)"
        value={<StatusBadge status={tr.overall_state} size="md" />}
        sub={<>severity {humanize(tr.overall_severity)} · {tr.rules_not_evaluated} rules not evaluated</>}
      />
      <KpiCard
        icon={Bell}
        label="Active alerts"
        value={
          alerts.isPending ? <Skeleton className="h-7 w-12" /> : alerts.isError ? <span className="text-na">—</span> : (
            <span className="font-mono text-[28px] leading-none font-semibold tabular">
              {String(alerts.data.count).padStart(2, "0")}{alerts.data.next_cursor ? "+" : ""}
            </span>
          )
        }
        sub="persisted by analyses · not confirmed faults"
      />
      <KpiCard
        icon={Server}
        label="Assets reporting"
        value={
          <span className="font-mono text-[28px] leading-none font-semibold tabular">
            {data.assets.fresh}<span className="text-base text-fg-3"> / {data.assets.known}</span>
          </span>
        }
        sub={`${data.assets.stale.length} stale · ${data.assets.without_reading.length} without reading`}
      />
      <KpiCard
        icon={Zap}
        label="Server IT power (sum)"
        value={<MetricValue value={power?.sum} unit={power?.unit} size="xl" label="Server IT power" />}
        sub="IT load only · not facility or cooling power"
      />
      <KpiCard
        icon={Cpu}
        label="Mean CPU utilization"
        value={<MetricValue value={cpu?.mean} unit={cpu?.unit} size="xl" label="Mean CPU utilization" />}
        sub={cpu ? <>max {formatWithUnit(cpu.max, cpu.unit)} · {cpu.max_asset_id}</> : "not reported"}
      />
    </div>
  );
}

function TrendPanel({ data }: { data: Overview }) {
  const [tab, setTab] = useState<TrendTab>("temperature");
  const cfg = TREND_TABS[tab];
  const rows = useMemo(() => trendRows(data.trends.points, cfg.keys), [data.trends.points, cfg.keys]);
  return (
    <Panel
      className="xl:col-span-2"
      eyebrow={`Fleet mean · ${data.window.trend_interval_minutes}-minute buckets`}
      title="Telemetry trends"
      actions={
        <Segmented
          label="Trend metric"
          value={tab}
          onChange={setTab}
          options={(Object.keys(TREND_TABS) as TrendTab[]).map((k) => ({ value: k, label: TREND_TABS[k].label }))}
        />
      }
      footer={
        <span className="flex flex-wrap gap-x-4">
          {cfg.keys.map((k) => {
            const slope = data.trends.slopes[k];
            return (
              <span key={k}>
                {metricLabel(k)} trend: <span className="font-mono text-fg-2">{slope ? `${formatWithUnit(slope.per_minute, null, 4)} ${slope.unit}` : "—"}</span>
              </span>
            );
          })}
        </span>
      }
    >
      {rows.length === 0 ? (
        <EmptyState title="No trend data in this window" />
      ) : (
        <TimeSeriesChart
          data={rows}
          unit={cfg.unit}
          height={250}
          ariaLabel={`${cfg.label} trend over the overview window`}
          series={cfg.keys.map((k, i) => ({ key: k, label: metricLabel(k), color: TREND_COLORS[i] ?? SERIES.tertiary }))}
        />
      )}
    </Panel>
  );
}

function ThermalRiskPanel({ data }: { data: Overview }) {
  const tr = data.thermal_risk;
  const states = Object.entries(tr.assets_by_state).sort((a, b) => severityRank(b[0]) - severityRank(a[0]));
  const total = states.reduce((s, [, n]) => s + n, 0) || 1;
  const rules = Object.entries(tr.findings_by_rule);
  return (
    <Panel eyebrow={`Cooling State Estimator · ${tr.evaluated_window_minutes ?? "—"} min window`} title="Thermal risk by asset">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs text-fg-3">Overall</span>
        <StatusBadge status={tr.overall_state} size="md" />
      </div>
      <ul className="space-y-2">
        {states.map(([state, n]) => (
          <li key={state} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <StatusBadge status={state} />
              <span className="font-mono text-fg">{n}</span>
            </div>
            <div className="h-1.5 rounded-full bg-raised" aria-hidden>
              <div className="h-1.5 rounded-full bg-fg-3" style={{ width: `${(n / total) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 text-[11px] font-medium tracking-wide text-fg-3 uppercase">Findings by rule</div>
      {rules.length === 0 ? (
        <p className="mt-1 text-xs text-fg-3">No findings in this window.</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {rules.map(([rule, n]) => (
            <li key={rule} className="rounded-sm border border-line bg-bg px-1.5 py-0.5 font-mono text-[11px] text-fg-2">
              {rule} <span className="text-fg">×{n}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function AlertsSummary({ runId }: { runId: string }) {
  const href = useHref();
  const alerts = useAlertCount(runId);
  return (
    <Panel
      eyebrow="Alerts & events"
      title="Active alerts"
      actions={<Link href={href("/alerts")} className="text-xs text-fg-2 underline-offset-4 hover:underline">View all</Link>}
    >
      <QueryView query={alerts}>
        {(d) =>
          d.items.length === 0 ? (
            <EmptyState title="No alerts for this run">
              Alerts are estimator findings persisted when an analysis runs (Optimization → Run analysis). They are not
              confirmed equipment faults.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line/60">
              {d.items.slice(0, 5).map((a) => (
                <li key={a.alert_id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-fg">{a.asset_id} · {a.rule_id}</div>
                    <div className="truncate text-fg-3">{a.explanation ?? humanize(a.state)}</div>
                  </div>
                  <StatusBadge status={a.severity} />
                </li>
              ))}
            </ul>
          )
        }
      </QueryView>
    </Panel>
  );
}

function ForecastSummary({ runId, assetId }: { runId: string; assetId: string | null }) {
  const href = useHref();
  const forecast = useQuery({
    queryKey: qk.predict(runId, assetId ?? ""),
    queryFn: ({ signal }) => predictInlet({ assetId: assetId!, runId, signal }),
    enabled: assetId !== null,
    refetchInterval: LIVE_REFRESH_MS,
  });
  return (
    <Panel
      eyebrow={assetId ? `Hottest inlet · ${assetId}` : "Inlet forecast"}
      title="Cooling forecast"
      actions={<Link href={href("/predictions", assetId ? { asset: assetId } : undefined)} className="text-xs text-fg-2 underline-offset-4 hover:underline">Details</Link>}
    >
      {!assetId ? (
        <EmptyState title="No asset reporting inlet temperature" />
      ) : (
        <QueryView query={forecast}>
          {(f) =>
            f.status !== "AVAILABLE" ? (
              <div className="space-y-2">
                <StatusBadge status={f.status} size="md" />
                <ul className="space-y-1 text-xs text-fg-2">
                  {f.reasons.map((r) => {
                    const x = reasonText(r);
                    return <li key={x.code}><span className="font-mono text-fg">{x.code}</span>{x.detail ? ` — ${x.detail}` : ""}</li>;
                  })}
                </ul>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-fg-3">Latest observed</span>
                  <MetricValue value={f.latest_inlet_temperature_c} unit="degC" size="lg" />
                </div>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th className={table.th}>Horizon</th>
                      <th className={table.thNum}>Predicted</th>
                      <th className={table.thNum}>Persistence</th>
                      <th className={table.thNum}>Skill</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.forecasts.map((p) => (
                      <tr key={p.horizon_minutes} className={table.tr}>
                        <td className={table.td}>+{p.horizon_minutes} min</td>
                        <td className={`${table.tdNum} text-info`}>{formatWithUnit(p.predicted_inlet_temperature_c, "degC", 2)}</td>
                        <td className={table.tdNum}>{formatWithUnit(p.persistence_inlet_temperature_c, "degC", 2)}</td>
                        <td className={table.tdNum}>{formatPercentFraction(p.evaluation?.rmse_skill_vs_persistence, 1, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Notice tone="info">
                  Model <span className="font-mono">{f.model?.label}</span> does not beat the persistence baseline on the
                  test split (skill ≤ 0). Treat as indicative only.
                </Notice>
              </div>
            )
          }
        </QueryView>
      )}
    </Panel>
  );
}

function SystemStatusPanel({ data, hottest }: { data: Overview; hottest: string | null }) {
  const href = useHref();
  const runId = data.simulation_run_id;
  const evaluation = useModelEvaluation();
  const agents = useQuery({ queryKey: qk.agentStatus(), queryFn: ({ signal }) => getAgentStatus({ signal }), staleTime: 5 * 60_000 });
  const optimizer = useQuery({
    queryKey: qk.optimizer(runId, hottest ?? ""),
    queryFn: ({ signal }) => evaluateOptimizer({ assetId: hottest!, runId, signal }),
    enabled: hottest !== null,
    staleTime: 5 * 60_000,
  });
  const fresh = data.assets.fresh === data.assets.known && !data.data_quality.pipeline_stale;
  const rows = [
    {
      key: "telemetry", label: "Temperature telemetry", href: "/telemetry",
      status: fresh ? "FRESH" : "STALE", text: fresh ? "Fresh" : data.data_quality.pipeline_stale ? "Pipeline stale" : "Partially stale",
    },
    {
      key: "forecast", label: "Inlet forecast model", href: "/predictions",
      status: evaluation.data ? "INCONCLUSIVE" : evaluation.isError ? "UNAVAILABLE" : null,
      text: evaluation.data ? "Baseline · review" : evaluation.isError ? "Unavailable" : "…",
    },
    {
      key: "optimizer", label: "Cooling optimizer", href: "/optimization",
      status: optimizer.data?.status ?? (optimizer.isError ? "UNAVAILABLE" : null),
      text: optimizer.data ? humanize(optimizer.data.status) : optimizer.isError ? "Unavailable" : "…",
    },
    { key: "twin", label: "Digital twin", href: "/digital-twin", status: "INFO", text: "Demonstration layout" },
    {
      key: "agents", label: "Recommendation agents", href: "/system",
      status: agents.data ? "OK" : agents.isError ? "UNAVAILABLE" : null,
      text: agents.data ? (agents.data.mode === "llm" ? "LLM mode" : "Deterministic") : agents.isError ? "Unavailable" : "…",
    },
  ];
  return (
    <Panel eyebrow="Capabilities and data" title="System status" actions={<span className="rounded-sm border border-line-strong px-1.5 py-0.5 text-[11px] text-fg-2">Simulated</span>}>
      <ul className="divide-y divide-line/60 rounded-sm border border-line bg-bg">
        {rows.map((r) => (
          <li key={r.key}>
            <Link href={href(r.href)} className="flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] hover:bg-raised/60">
              <span className="text-fg-2">{r.label}</span>
              {r.status ? <StatusBadge status={r.status} label={r.text} /> : <Skeleton className="h-5 w-20" />}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function RecommendedActions({ runId }: { runId: string }) {
  const href = useHref();
  const recs = useQuery({
    queryKey: qk.recommendations({ run: runId, limit: 20 }),
    queryFn: ({ signal }) => listRecommendations({ runId, limit: 20, signal }),
    refetchInterval: LIVE_REFRESH_MS,
  });
  return (
    <Panel
      className="xl:col-span-2"
      eyebrow="Human review required · nothing is executed automatically"
      title="Recommended next steps"
      actions={<Link href={href("/optimization")} className="text-xs text-fg-2 underline-offset-4 hover:underline">Review queue</Link>}
      bodyClassName="p-0"
    >
      {recs.isPending ? (
        <div className="p-4"><Skeleton className="h-24" /></div>
      ) : recs.isError ? (
        <div className="p-4"><ErrorBanner error={recs.error} onRetry={() => void recs.refetch()} /></div>
      ) : recs.data.items.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No recommendations for this run yet">
            Run the multi-agent analysis for an asset in <Link className="underline" href={href("/optimization")}>Optimization</Link>.
            Results are recommendations for human review; they never change equipment settings.
          </EmptyState>
        </div>
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead>
              <tr>
                <th className={table.th}>Severity</th>
                <th className={table.th}>Asset</th>
                <th className={table.th}>Recommendation</th>
                <th className={table.th}>Status</th>
                <th className={table.th}>Review</th>
              </tr>
            </thead>
            <tbody>
              {[...recs.data.items]
                .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
                .slice(0, 6)
                .map((r) => (
                  <tr key={r.recommendation_id} className={table.tr}>
                    <td className={table.td}><StatusBadge status={r.severity} /></td>
                    <td className={table.tdId}>{r.asset_id}</td>
                    <td className={`${table.td} max-w-[320px] truncate`}>
                      <Link className="text-fg hover:underline" href={href("/optimization", { rec: r.recommendation_id })}>{r.title}</Link>
                      <div className="text-[11px] text-fg-3">{humanize(r.type)}</div>
                    </td>
                    <td className={table.td}><StatusBadge status={r.status} /></td>
                    <td className={table.td}><StatusBadge status={r.review_status} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function DataQualityPanel({ data }: { data: Overview }) {
  const dq = data.data_quality;
  return (
    <Panel eyebrow="Pipeline and coverage" title="Data quality">
      <KeyValueList
        items={[
          { key: "readings", label: "Readings in window", value: dq.readings_in_window.toLocaleString() },
          { key: "missing", label: "Missing readings", value: dq.missing_readings },
          { key: "dups", label: "Duplicates collapsed", value: dq.duplicates_collapsed },
          { key: "age", label: "Last stored (wall clock)", value: `${formatDuration(dq.ingest_age_seconds)} ago` },
          { key: "stale", label: "Pipeline", value: <StatusBadge status={dq.pipeline_stale ? "STALE" : "FRESH"} label={dq.pipeline_stale ? "Stale" : "Delivering"} /> },
        ]}
      />
      <div className="mt-4 text-[11px] font-medium tracking-wide text-fg-3 uppercase">Not measured in this telemetry</div>
      <ul className="mt-1.5 space-y-1">
        {Object.entries(data.unavailable_measurements).map(([k, why]) => (
          <li key={k} className="hatch-na flex items-start justify-between gap-3 rounded-sm border border-line px-2 py-1.5 text-xs">
            <span className="text-fg-2">{metricLabel(k)}</span>
            <span className="text-right text-na">{why}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function InjectedLabels({ data }: { data: Overview }) {
  const labels = data.anomalies.injected_anomaly_labels;
  if (labels.length === 0) return null;
  return (
    <Panel eyebrow={data.anomalies.injected_label_note} title="Simulator-injected anomaly labels (not detections)" bodyClassName="p-0">
      <div className={table.wrap}>
        <table className={table.table}>
          <thead>
            <tr>
              <th className={table.th}>Asset</th>
              <th className={table.th}>Injected type</th>
              <th className={table.thNum}>Readings</th>
              <th className={table.th}>From</th>
              <th className={table.th}>To</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((l) => (
              <tr key={`${l.asset_id}-${l.first_ts}-${l.anomaly_type}`} className={table.tr}>
                <td className={table.tdId}>{l.asset_id}</td>
                <td className={table.td}>{humanize(l.anomaly_type)}</td>
                <td className={table.tdNum}>{l.readings}</td>
                <td className={table.td}>{formatEventTime(l.first_ts)}</td>
                <td className={table.td}>{formatEventTime(l.last_ts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

