"use client";

import { useQuery } from "@tanstack/react-query";

import { Notice } from "@/components/feedback/Notice";
import { QueryView } from "@/components/feedback/QueryView";
import { KeyValueList } from "@/components/shared/KeyValueList";
import { PageHeader } from "@/components/shared/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useRunId } from "@/hooks/useRun";
import { useHealth, useModelEvaluation } from "@/hooks/useShellQueries";
import { getAgentStatus, getDashboardOverview, getTwinLayout } from "@/lib/api/reads";
import { publicConfig } from "@/lib/config/public";
import { formatDuration, formatEventTime, formatLocalClock } from "@/lib/format";
import { LIVE_REFRESH_MS, qk } from "@/lib/query-keys";

export function SystemView() {
  const runId = useRunId();
  const health = useHealth();
  const agents = useQuery({ queryKey: qk.agentStatus(), queryFn: ({ signal }) => getAgentStatus({ signal }) });
  const model = useModelEvaluation();
  const layout = useQuery({ queryKey: qk.twinLayout(), queryFn: ({ signal }) => getTwinLayout({ signal }), staleTime: Infinity });
  const overview = useQuery({ queryKey: qk.overview(runId), queryFn: ({ signal }) => getDashboardOverview({ runId, signal }), refetchInterval: LIVE_REFRESH_MS });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader section="System & Data" title="System & data" meta={<span>Backend, data pipeline, model and agent status as exposed by the API.</span>} />
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Panel title="API" eyebrow="GET /health">
          <QueryView query={health}>
            {(h) => (
              <KeyValueList
                items={[
                  { key: "s", label: "Status", value: <StatusBadge status={h.status} /> },
                  { key: "db", label: "Database backend", value: h.database },
                  { key: "v", label: "Schema version", value: h.schema_version ?? "—" },
                  { key: "base", label: "Browser API base (proxy)", value: publicConfig.apiBaseUrl },
                  { key: "t", label: "Checked", value: formatLocalClock(health.dataUpdatedAt) },
                ]}
              />
            )}
          </QueryView>
        </Panel>

        <Panel title="Telemetry pipeline" eyebrow="Kafka → consumer → store (from the dashboard data-quality block)">
          <QueryView query={overview}>
            {(o) => (
              <>
                <KeyValueList
                  items={[
                    { key: "run", label: "Run", value: o.simulation_run_id },
                    { key: "latest", label: "Newest reading (event time)", value: formatEventTime(o.latest_telemetry_timestamp) },
                    { key: "age", label: "Last stored (wall clock)", value: `${formatDuration(o.data_quality.ingest_age_seconds)} ago` },
                    { key: "p", label: "Pipeline", value: <StatusBadge status={o.data_quality.pipeline_stale ? "STALE" : "FRESH"} label={o.data_quality.pipeline_stale ? "Stale" : "Delivering"} /> },
                    { key: "r", label: "Readings in window", value: o.data_quality.readings_in_window },
                    { key: "m", label: "Missing / duplicates", value: `${o.data_quality.missing_readings} / ${o.data_quality.duplicates_collapsed}` },
                  ]}
                />
                <Notice tone="info" className="mt-3">Kafka broker and consumer-group health (lag, DLQ) are not exposed over the API.</Notice>
              </>
            )}
          </QueryView>
        </Panel>

        <Panel title="Recommendation agents" eyebrow="GET /recommendations/agents/status">
          <QueryView query={agents}>
            {(a) => (
              <KeyValueList
                items={[
                  { key: "mode", label: "Mode", value: <StatusBadge status="INFO" label={a.mode} /> },
                  { key: "llm", label: "LLM enabled", value: a.llm_enabled ? "yes" : "no" },
                  { key: "key", label: "API key configured", value: a.api_key_configured ? "yes" : "no" },
                  { key: "main", label: "Main model", value: a.main_model },
                  { key: "sub", label: "Subagent model", value: a.subagent_model },
                  { key: "re", label: "Reasoning effort", value: a.reasoning_effort },
                  { key: "to", label: "Timeout", value: `${a.timeout_s} s` },
                  { key: "ro", label: "Recommendation-only", value: a.recommendation_only ? "yes" : "no" },
                ]}
              />
            )}
          </QueryView>
        </Panel>

        <Panel title="Forecast model" eyebrow="GET /cooling-model/evaluate">
          <QueryView query={model}>
            {(m) => (
              <KeyValueList
                items={[
                  { key: "v", label: "Version", value: m.model_version },
                  { key: "l", label: "Label", value: m.model_label },
                  { key: "c", label: "Created", value: new Date(m.created_at).toLocaleString("en-GB") },
                  { key: "h", label: "Horizons", value: m.horizons_minutes.join(", ") + " min" },
                  { key: "runs", label: "Training runs", value: m.training_data.runs_used.length },
                ]}
              />
            )}
          </QueryView>
        </Panel>

        <Panel title="Digital twin layout" eyebrow="GET /digital-twin/layout">
          <QueryView query={layout}>
            {(l) => (
              <>
                <KeyValueList
                  items={[
                    { key: "v", label: "Layout version", value: l.layout_version },
                    { key: "d", label: "Demonstration", value: l.demonstration ? "yes" : "no" },
                    { key: "n", label: "Objects", value: l.objects.length },
                    { key: "u", label: "Units", value: l.units },
                    { key: "s", label: "Source", value: l.source ?? "—" },
                  ]}
                />
                <p className="mt-2 text-[11px] text-fg-3">{l.notice}</p>
              </>
            )}
          </QueryView>
        </Panel>

        <Panel title="Not available in this deployment" eyebrow="Known limits">
          <ul className="list-disc space-y-1 pl-4 text-xs text-fg-2">
            <li>No authentication / user accounts (single optional shared token)</li>
            <li>No equipment control or setpoint writes (deliberately not built)</li>
            <li>No cooling-power, facility-power or cooling-efficiency measurements</li>
            <li>No alert acknowledgement or resolution workflow</li>
            <li>No simulation controls or run-list endpoint</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
