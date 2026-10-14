"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/feedback/EmptyState";
import { Notice } from "@/components/feedback/Notice";
import { QueryView } from "@/components/feedback/QueryView";
import { PageHeader } from "@/components/shared/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useHref, useRunId } from "@/hooks/useRun";
import { listAlerts } from "@/lib/api/reads";
import type { Alert } from "@/lib/api/schemas/recommendations";
import { formatEventTime, humanize } from "@/lib/format";
import { LIVE_REFRESH_MS, qk } from "@/lib/query-keys";

type Sev = "" | "WARNING" | "CRITICAL";

export function AlertsView() {
  const runId = useRunId();
  const [severity, setSeverity] = useState<Sev>("");
  const [scope, setScope] = useState<"all" | "run">("all");
  const effectiveRun = scope === "run" ? runId : undefined;
  const alerts = useQuery({
    queryKey: qk.alerts({ run: effectiveRun, severity, limit: 200 }),
    queryFn: ({ signal }) => listAlerts({ runId: effectiveRun, severity: severity || undefined, limit: 200, signal }),
    refetchInterval: LIVE_REFRESH_MS,
  });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        section="Alerts & Events"
        title="Alerts & events"
        meta={<span>WARNING/CRITICAL estimator findings persisted by analysis runs. Acknowledge/resolve workflows are not supported by the backend.</span>}
        actions={
          <>
            <Segmented label="Scope" value={scope} onChange={setScope} options={[{ value: "all", label: "All runs" }, { value: "run", label: "Selected run", disabled: !runId }]} />
            <Segmented<Sev> label="Severity" value={severity} onChange={setSeverity} options={[{ value: "", label: "All" }, { value: "WARNING", label: "Warning" }, { value: "CRITICAL", label: "Critical" }]} />
          </>
        }
      />
      <Notice tone="info" title="Not confirmed faults.">
        Each alert is an observed pattern or rule-based inference over simulated telemetry. Nothing creates alerts continuously:
        they appear when an analysis runs.
      </Notice>
      <QueryView query={alerts} skeleton={<Skeleton className="h-64" />} errorTitle="Could not load alerts">
        {(d) =>
          d.items.length === 0 ? (
            <Panel title="No alerts">
              <EmptyState title="No alerts match these filters">
                Run an analysis in Optimization to evaluate an asset; WARNING or CRITICAL findings are stored here as alerts.
              </EmptyState>
            </Panel>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.items.map((a) => <AlertRow key={a.alert_id} a={a} />)}
              {d.next_cursor && <li className="text-[11px] text-fg-3">Showing the newest {d.count} alerts.</li>}
            </ul>
          )
        }
      </QueryView>
    </div>
  );
}

function AlertRow({ a }: { a: Alert }) {
  const href = useHref();
  return (
    <li>
      <details className="group rounded-md border border-line bg-surface open:border-line-strong">
        <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <StatusBadge status={a.severity} size="md" />
          <span className="font-mono text-fg">{a.asset_id}</span>
          <span className="font-mono text-xs text-fg-2">{a.rule_id}</span>
          {a.state && <StatusBadge status={a.state} />}
          <span className="ml-auto text-[11px] text-fg-3">window end {formatEventTime(a.observation_window_end)} · {a.simulation_run_id}</span>
        </summary>
        <div className="space-y-2 border-t border-line px-4 py-3 text-xs text-fg-2">
          {a.explanation && <p className="leading-relaxed text-fg">{a.explanation}</p>}
          <p>Window {formatEventTime(a.observation_window_start)} → {formatEventTime(a.observation_window_end)} · source {a.source ?? "—"} · kind {humanize(a.kind)}</p>
          {a.note && <p className="text-fg-3">{a.note}</p>}
          {a.evidence !== undefined && a.evidence !== null && (
            <pre className="max-h-48 overflow-auto rounded-sm border border-line bg-bg p-2 font-mono text-[11px] text-fg-2">{JSON.stringify(a.evidence, null, 2)}</pre>
          )}
          {a.related_recommendations.length > 0 && (
            <p>
              Related:{" "}
              {a.related_recommendations.map((id) => (
                <Link key={id} className="mr-2 font-mono text-fg underline-offset-4 hover:underline" href={href("/optimization", { rec: id })}>{id}</Link>
              ))}
            </p>
          )}
        </div>
      </details>
    </li>
  );
}
