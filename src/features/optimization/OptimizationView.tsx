"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Notice } from "@/components/feedback/Notice";
import { QueryView } from "@/components/feedback/QueryView";
import { KeyValueList } from "@/components/shared/KeyValueList";
import { PageHeader } from "@/components/shared/PageHeader";
import { table } from "@/components/shared/table";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useRunId, useSetSearchParams } from "@/hooks/useRun";
import { useAssets } from "@/hooks/useShellQueries";
import { evaluateOptimizer, getFanPeerComparison, listRecommendations } from "@/lib/api/reads";
import { generateRecommendations } from "@/lib/api/mutations";
import { RECOMMENDATION_STATUSES, RECOMMENDATION_TYPES, SEVERITIES } from "@/lib/api/schemas/recommendations";
import { formatEventTime, formatPercentFraction, formatWithUnit, humanize } from "@/lib/format";
import { LIVE_REFRESH_MS, qk } from "@/lib/query-keys";

import { EmptyQueue, RecommendationDetailPanel } from "./RecommendationReview";

export function OptimizationView() {
  const runId = useRunId();
  const params = useSearchParams();
  const setParams = useSetSearchParams();
  const assets = useAssets(runId);
  const assetParam = params.get("asset");
  const assetId = assets.data?.items.find((a) => a.asset_id === assetParam)?.asset_id ?? assets.data?.items[0]?.asset_id;
  const recId = params.get("rec");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        section="Optimization"
        title="Cooling optimization & recommendations"
        meta={<span>Optimizer results, fan-energy screening and the human review queue. Nothing on this page changes equipment.</span>}
        actions={
          <Select label="Asset" value={assetId ?? ""} onChange={(e) => setParams({ asset: e.target.value })}>
            {(assets.data?.items ?? []).map((a) => <option key={a.asset_id} value={a.asset_id}>{a.asset_id}</option>)}
          </Select>
        }
      />
      <Notice tone="safety" title="Recommendation-only system.">
        There is no equipment-control API. Setpoints are never applied; approvals record a review for a supervised, manual evaluation.
      </Notice>
      <div className="grid gap-4 xl:grid-cols-2">
        {assetId ? <OptimizerPanel runId={runId} assetId={assetId} /> : <Skeleton className="h-72" />}
        {assetId ? <GenerateAnalysis runId={runId ?? assets.data?.simulation_run_id} assetId={assetId} onOpen={(id) => setParams({ rec: id })} /> : <Skeleton className="h-72" />}
      </div>
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_520px]">
        <ReviewQueue selected={recId} onSelect={(id) => setParams({ rec: id })} />
        {recId ? <RecommendationDetailPanel id={recId} onClose={() => setParams({ rec: null })} /> : (
          <Panel title="Recommendation" eyebrow="Detail">
            <p className="text-xs text-fg-3">Select a recommendation from the queue to review its evidence and record a decision.</p>
          </Panel>
        )}
      </div>
      <FanPeerPanel runId={runId} />
    </div>
  );
}

function OptimizerPanel({ runId, assetId }: { runId: string | undefined; assetId: string }) {
  const opt = useQuery({
    queryKey: qk.optimizer(runId, assetId),
    queryFn: ({ signal }) => evaluateOptimizer({ assetId, runId, signal }),
    refetchInterval: LIVE_REFRESH_MS,
  });
  return (
    <Panel eyebrow={`POST /cooling-optimizer/recommend · ${assetId}`} title="Cooling setpoint optimizer">
      <QueryView query={opt} errorTitle="Optimizer evaluation failed">
        {(o) => (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={o.status} size="md" />
              {o.status === "UNAVAILABLE" && <span className="text-xs text-fg-3">No valid optimization result — reasons below.</span>}
            </div>
            <KeyValueList
              items={[
                { key: "set", label: "Controllable setting", value: o.controllable_setting ?? "—" },
                { key: "cur", label: "Current value", value: formatWithUnit(o.current_setting ?? null, "rpm") },
                { key: "rec", label: "Recommended value", value: o.recommended_setting === null || o.recommended_setting === undefined ? <span className="text-na">none</span> : formatWithUnit(o.recommended_setting, "rpm") },
                { key: "energy", label: "Energy objective", value: o.energy_objective?.available ? (o.energy_objective.source ?? "available") : <span className="text-na">not measured</span> },
                { key: "model", label: "Model", value: o.model_label ?? "—" },
              ]}
            />
            {o.reasons.length > 0 && (
              <ul className="space-y-1.5">
                {o.reasons.map((r) => (
                  <li key={r.code} className="rounded-sm border border-line bg-bg px-2.5 py-2 text-xs">
                    <div className="font-mono text-fg">{r.code}</div>
                    {r.detail && <div className="mt-0.5 leading-relaxed text-fg-2">{r.detail}</div>}
                  </li>
                ))}
              </ul>
            )}
            {o.candidates.length > 0 && (
              <div className={table.wrap}>
                <table className={table.table}>
                  <thead><tr>{Object.keys(o.candidates[0]!).map((k) => <th key={k} className={table.th}>{humanize(k)}</th>)}</tr></thead>
                  <tbody>
                    {o.candidates.map((c, i) => (
                      <tr key={i} className={table.tr}>{Object.values(c).map((v, j) => <td key={j} className={table.td}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {o.forecast_under_current_conditions.length > 0 && (
              <p className="text-[11px] text-fg-3">
                Forecast under current conditions:{" "}
                {o.forecast_under_current_conditions.map((f) => `+${f.horizon_minutes} min ${formatWithUnit(f.predicted_inlet_temperature_c, "degC", 2)} (persistence ${formatWithUnit(f.persistence_inlet_temperature_c, "degC", 2)})`).join(" · ")}
              </p>
            )}
            {o.actuation && <p className="text-[11px] text-fg-3">Actuation: {o.actuation}</p>}
          </div>
        )}
      </QueryView>
    </Panel>
  );
}

function GenerateAnalysis({ runId, assetId, onOpen }: { runId: string | undefined; assetId: string; onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const controller = useRef<AbortController | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const gen = useMutation({
    mutationFn: () => {
      controller.current = new AbortController();
      return generateRecommendations({ assetId, runId, signal: controller.current.signal });
    },
    onMutate: () => setStartedAt(Date.now()),
    onSettled: () => setStartedAt(null),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.recommendationsAll() });
      void qc.invalidateQueries({ queryKey: qk.alertsAll() });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  return (
    <Panel eyebrow="POST /recommendations/generate" title="Run multi-agent analysis">
      <div className="space-y-3 text-xs text-fg-2">
        <p>
          Runs the thermal, energy and anomaly specialists on <span className="font-mono text-fg">{assetId}</span>
          {runId ? <> in <span className="font-mono text-fg">{runId}</span></> : null} and stores the resulting recommendations and alerts
          for review. With LLM agents this can take tens of seconds.
        </p>
        <div className="flex items-center gap-2">
          {gen.isPending ? (
            <>
              <Button variant="secondary" onClick={() => controller.current?.abort()}><Square className="size-3.5" aria-hidden /> Cancel</Button>
              <span role="status" className="text-fg-3">Analysing… {elapsed}s</span>
            </>
          ) : (
            <Button variant="primary" onClick={() => gen.mutate()}><Play className="size-3.5" aria-hidden /> Run analysis</Button>
          )}
        </div>
        {gen.isError && <ErrorBanner error={gen.error} title="Analysis failed" />}
        {gen.data && (
          <div className="space-y-2 rounded-sm border border-line bg-bg p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={gen.data.status} />
              <span className="font-mono text-[11px] text-fg-3">{gen.data.analysis_id}</span>
            </div>
            <p>
              {gen.data.recommendations.length} recommendation(s), {gen.data.duplicates_of_existing.length} duplicate(s) of existing. Human
              approval required; no control executed.
            </p>
            <ul className="space-y-1">
              {gen.data.recommendations.map((r) => {
                const id = String(r.recommendation_id ?? "");
                return (
                  <li key={id}>
                    <button type="button" className="text-left text-fg underline-offset-4 hover:underline" onClick={() => onOpen(id)}>
                      {String(r.title ?? id)}
                    </button>{" "}
                    <StatusBadge status={String(r.status ?? "")} />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

function ReviewQueue({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const runId = useRunId();
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [type, setType] = useState("");
  const [scope, setScope] = useState<"all" | "run">("all");
  const filters = { status: status || undefined, severity: severity || undefined, type: type || undefined, runId: scope === "run" ? runId : undefined };
  const recs = useQuery({
    queryKey: qk.recommendations({ ...filters, limit: 100 }),
    queryFn: ({ signal }) => listRecommendations({ ...filters, limit: 100, signal }),
    refetchInterval: LIVE_REFRESH_MS,
  });
  return (
    <Panel
      eyebrow="Human review queue"
      title="Recommendations"
      bodyClassName="p-0"
      actions={
        <div className="flex flex-wrap gap-2">
          <Select label="Scope" hideLabel value={scope} onChange={(e) => setScope(e.target.value as "all" | "run")}>
            <option value="all">All runs</option>
            <option value="run" disabled={!runId}>Selected run only</option>
          </Select>
          <Select label="Status" hideLabel value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            {RECOMMENDATION_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </Select>
          <Select label="Severity" hideLabel value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">Any severity</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </Select>
          <Select label="Type" hideLabel value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Any type</option>
            {RECOMMENDATION_TYPES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </Select>
        </div>
      }
    >
      <QueryView query={recs} skeleton={<div className="p-4"><Skeleton className="h-40" /></div>}>
        {(d) =>
          d.items.length === 0 ? (
            <div className="p-4"><EmptyQueue /></div>
          ) : (
            <div className={`${table.wrap} max-h-[560px] overflow-y-auto`}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th className={table.th}>Severity</th>
                    <th className={table.th}>Recommendation</th>
                    <th className={table.th}>Asset · run</th>
                    <th className={table.th}>Window end</th>
                    <th className={table.th}>Status</th>
                    <th className={table.th}>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {d.items.map((r) => (
                    <tr key={r.recommendation_id} className={selected === r.recommendation_id ? table.trSelected : table.tr}>
                      <td className={table.td}><StatusBadge status={r.severity} /></td>
                      <td className={`${table.td} max-w-[320px]`}>
                        <button type="button" onClick={() => onSelect(r.recommendation_id)} className="block max-w-full truncate text-left text-fg hover:underline">
                          {r.title}
                        </button>
                        <div className="text-[11px] text-fg-3">{humanize(r.type)}</div>
                      </td>
                      <td className={table.tdId}>
                        {r.asset_id}
                        <div className="text-[10px] text-fg-3">{r.simulation_run_id}</div>
                      </td>
                      <td className={table.td}>{formatEventTime(r.observation_window_end)}</td>
                      <td className={table.td}><StatusBadge status={r.status} /></td>
                      <td className={table.td}><StatusBadge status={r.review_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {d.next_cursor && <p className="px-3 py-2 text-[11px] text-fg-3">Showing the newest {d.count}. Narrow the filters to see older ones.</p>}
            </div>
          )
        }
      </QueryView>
    </Panel>
  );
}

function FanPeerPanel({ runId }: { runId: string | undefined }) {
  const peers = useQuery({
    queryKey: qk.fanPeers(runId),
    queryFn: ({ signal }) => getFanPeerComparison({ runId, signal }),
    refetchInterval: LIVE_REFRESH_MS,
  });
  return (
    <Panel eyebrow="GET /energy/fan-peer-comparison · relative indicator, no kW" title="Fan energy screening (vs comparable peers)" bodyClassName="p-0">
      <QueryView query={peers} skeleton={<div className="p-4"><Skeleton className="h-40" /></div>}>
        {(p) => (
          <>
            <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
              {Object.entries(p.summary).map(([s, n]) => <StatusBadge key={s} status={s} label={`${humanize(s)} · ${n}`} />)}
              <span className="text-[11px] text-fg-3">
                Peers grouped by {p.peer_group_by.join(", ")} · {p.window_minutes}-min windows over {p.lookback_minutes} min to {formatEventTime(p.as_of)}
              </span>
            </div>
            <div className={`${table.wrap} max-h-[420px] overflow-y-auto`}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th className={table.th}>Asset</th>
                    <th className={table.th}>Status</th>
                    <th className={table.th}>Group</th>
                    <th className={table.thNum}>Fan</th>
                    <th className={table.thNum}>Peer median</th>
                    <th className={table.thNum}>Excess vs peers</th>
                    <th className={table.thNum}>Persistence</th>
                    <th className={table.th}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {p.results.map((r) => (
                    <tr key={r.asset_id} className={table.tr}>
                      <td className={table.tdId}>{r.asset_id}</td>
                      <td className={table.td}><StatusBadge status={r.status} /></td>
                      <td className={table.td}>{Object.values(r.group).filter(Boolean).join(" · ")}</td>
                      <td className={table.tdNum}>{formatWithUnit(r.asset_fan_rpm, "rpm")}</td>
                      <td className={table.tdNum}>{formatWithUnit(r.peer_median_fan_rpm, "rpm")}</td>
                      <td className={table.tdNum}>{formatPercentFraction(r.excess_fraction, 0, true)}</td>
                      <td className={table.tdNum}>{r.persistence.share_elevated === null ? "—" : `${r.persistence.windows_elevated}/${r.persistence.windows_compared}`}</td>
                      <td className={`${table.td} max-w-[300px] truncate text-[11px]`} title={r.reasons.join(" · ")}>{r.reasons[0] ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1 border-t border-line px-4 py-3 text-[11px] text-fg-3">
              <p>{p.method}</p>
              <ul className="list-disc pl-4">{p.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
              <p>Action is always “investigate”: never lower a fan based on this indicator.</p>
            </div>
          </>
        )}
      </QueryView>
    </Panel>
  );
}
