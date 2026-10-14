"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageSquareText, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Notice } from "@/components/feedback/Notice";
import { QueryView } from "@/components/feedback/QueryView";
import { KeyValueList } from "@/components/shared/KeyValueList";
import { Button } from "@/components/ui/Button";
import { PanelSkeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useHref } from "@/hooks/useRun";
import { inspectTwinObject } from "@/lib/api/reads";
import { analyzeTwinObject } from "@/lib/api/mutations";
import type { Inspection } from "@/lib/api/schemas/twin";
import { formatEventTime, formatWithUnit, humanize } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import { CoolingStateBlock, LatestReadingGrid, ProvenanceBlock } from "@/features/telemetry/AssetBlocks";
import { MetricChart } from "@/features/telemetry/MetricChart";
import { ForecastBlock } from "@/features/predictions/ForecastBlock";

export type TwinInspectorProps = {
  objectId: string | null;
  runId: string | undefined;
  onSelect: (id: string | null) => void;
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-line px-4 py-3">
    <h3 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-fg-3 uppercase">{title}</h3>
    {children}
  </section>
);

export function TwinInspector({ objectId, runId, onSelect }: TwinInspectorProps) {
  const inspect = useQuery({
    queryKey: qk.twinInspect(runId, objectId ?? ""),
    queryFn: ({ signal }) => inspectTwinObject({ objectId: objectId!, runId, signal }),
    enabled: objectId !== null,
  });

  if (!objectId) {
    return (
      <div className="p-4">
        <EmptyState title="Select equipment to inspect">
          Click a server, rack or cooling unit in the 3D view, or pick one from the equipment list. The inspector shows the
          backend&apos;s latest reading, cooling state, history and forecast for that object.
        </EmptyState>
      </div>
    );
  }
  return (
    <QueryView query={inspect} skeleton={<div className="p-4"><PanelSkeleton rows={10} /></div>} errorTitle={`Could not inspect ${objectId}`}>
      {(d) => <InspectionBody data={d} runId={runId} onSelect={onSelect} />}
    </QueryView>
  );
}

function InspectionBody({ data, runId, onSelect }: { data: Inspection; runId: string | undefined; onSelect: (id: string | null) => void }) {
  const o = data.object;
  const href = useHref();
  return (
    <div className="flex flex-col">
      <header className="flex items-start justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] text-fg-3">
            {[...data.parents].reverse().map((p) => p.name).join(" / ")}
          </div>
          <h2 className="truncate text-base font-semibold text-fg">{o.name}</h2>
          <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[11px] text-fg-3">
            <span>object {o.id}</span>
            {o.asset_id && <span>asset {o.asset_id}</span>}
            <span>{humanize(o.type)}</span>
          </div>
        </div>
        <button type="button" onClick={() => onSelect(null)} aria-label="Close inspector" className="grid size-7 place-items-center rounded-sm hover:bg-raised">
          <X className="size-4" aria-hidden />
        </button>
      </header>

      {(data.warnings ?? []).length > 0 && (
        <div className="px-4 pb-3"><Notice tone="info">{data.warnings!.join(" · ")}</Notice></div>
      )}
      {typeof o.metadata.note === "string" && <div className="px-4 pb-3"><Notice tone="info">{o.metadata.note}</Notice></div>}

      {data.kind === "asset" && data.detail ? (
        <>
          <Section title={`Latest reading · ${formatEventTime(data.detail.latest_reading?.timestamp)}`}>
            {data.detail.warnings.length > 0 && <Notice tone="stale" className="mb-2">{data.detail.warnings.join(" · ")}</Notice>}
            {data.detail.latest_reading ? (
              <LatestReadingGrid values={data.detail.latest_reading.values} compact />
            ) : (
              <p className="text-xs text-na">No observed reading.</p>
            )}
          </Section>
          <Section title="Cooling state">
            <CoolingStateBlock state={data.detail.cooling_state} />
          </Section>
          {data.history?.series[0] && (
            <Section title="Inlet temperature · last hour (5-min)">
              <MetricChart series={data.history.series[0]} metric="inlet_temperature_c" unit="degC" height={150} />
            </Section>
          )}
          <Section title="Inlet forecast">
            {data.forecast ? <ForecastBlock forecast={data.forecast} compact /> : <p className="text-xs text-na">Forecast not requested.</p>}
          </Section>
          <Section title={`Alerts (${data.alerts?.length ?? 0}) · Recommendations (${data.recommendations?.length ?? 0})`}>
            {(data.alerts?.length ?? 0) + (data.recommendations?.length ?? 0) === 0 ? (
              <p className="text-xs text-fg-3">None for this asset in the selected run.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {(data.alerts ?? []).map((a, i) => (
                  <li key={String(a.alert_id ?? i)} className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-fg-2">{String(a.rule_id ?? "alert")}</span>
                    <StatusBadge status={String(a.severity ?? "")} />
                  </li>
                ))}
                {(data.recommendations ?? []).map((r, i) => (
                  <li key={String(r.recommendation_id ?? i)} className="flex items-center justify-between gap-2">
                    <Link className="truncate text-fg hover:underline" href={href("/optimization", { rec: String(r.recommendation_id ?? "") })}>
                      {String(r.title ?? r.recommendation_id ?? "recommendation")}
                    </Link>
                    <StatusBadge status={String(r.status ?? "")} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Provenance">
            <ProvenanceBlock asset={data.detail.asset} />
          </Section>
        </>
      ) : (
        <>
          <Section title="Aggregate of child servers">
            {data.aggregate ? (
              <>
                <KeyValueList
                  items={[
                    { key: "n", label: "Servers reporting", value: data.aggregate.servers_reporting },
                    { key: "inlet", label: "Max inlet", value: formatWithUnit(data.aggregate.max_inlet_temperature_c, "degC") },
                    { key: "wl", label: "Mean workload", value: formatWithUnit(data.aggregate.mean_workload_intensity, "ratio_0_1") },
                    { key: "pw", label: "Sum of server IT power", value: formatWithUnit(data.aggregate.sum_server_power_kw, "kW") },
                    { key: "th", label: "Worst thermal status", value: <StatusBadge status={data.aggregate.worst_thermal_status} /> },
                  ]}
                />
                <p className="mt-2 text-[11px] leading-relaxed text-fg-3">{data.aggregate.method}</p>
              </>
            ) : (
              <p className="text-xs text-na">No telemetry and no child servers with telemetry.</p>
            )}
          </Section>
          {(data.children?.length ?? 0) > 0 && (
            <Section title="Children">
              <ul className="space-y-1">
                {data.children!.map((c) => (
                  <li key={c.object_id}>
                    <button type="button" onClick={() => onSelect(c.object_id)} className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-raised">
                      <span className="font-mono text-fg">{c.asset_id ?? c.object_id}</span>
                      <span className="flex gap-1">
                        {c.freshness && <StatusBadge status={c.freshness} />}
                        {c.thermal_status && <StatusBadge status={c.thermal_status} />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
      <AskAboutObject objectId={o.id} runId={runId} />
    </div>
  );
}

function AskAboutObject({ objectId, runId }: { objectId: string; runId: string | undefined }) {
  const [question, setQuestion] = useState("Why is it warm, and what should we check first?");
  const ask = useMutation({
    mutationFn: ({ signal }: { signal?: AbortSignal }) => analyzeTwinObject({ objectId, question, runId, signal }),
  });
  const [controller, setController] = useState<AbortController | null>(null);
  const answer = ask.data;
  return (
    <Section title="Ask the copilot about this object">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const c = new AbortController();
          setController(c);
          ask.mutate({ signal: c.signal });
        }}
        className="space-y-2"
      >
        <label className="sr-only" htmlFor="twin-question">Question</label>
        <textarea
          id="twin-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={2000}
          rows={2}
          className="w-full resize-none rounded-sm border border-line-strong bg-bg px-2.5 py-2 text-xs text-fg placeholder:text-fg-3"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-fg-3">Read-only · never changes equipment</span>
          {ask.isPending ? (
            <Button size="sm" variant="ghost" onClick={() => controller?.abort()}>Cancel</Button>
          ) : (
            <Button size="sm" variant="primary" type="submit" disabled={!question.trim()}>
              <MessageSquareText className="size-3.5" aria-hidden /> Ask
            </Button>
          )}
        </div>
      </form>
      {ask.isPending && <p className="mt-2 text-xs text-fg-3" role="status">Analysing… agent runs can take several seconds.</p>}
      {ask.isError && <div className="mt-2"><ErrorBanner error={ask.error} compact /></div>}
      {answer && (
        <div className="mt-3 space-y-2 text-xs">
          {answer.clarification_needed && <Notice tone="warn" title="Clarification needed:">The copilot asks a question back (questions with words like “rack” can trigger this — known backend issue).</Notice>}
          <p className="leading-relaxed whitespace-pre-wrap text-fg">{answer.summary ?? answer.answer ?? "No summary returned."}</p>
          {Object.entries(answer.sections ?? {}).filter(([, v]) => v.length > 0).map(([k, v]) => (
            <div key={k}>
              <div className="text-[10px] font-semibold tracking-wide text-fg-3 uppercase">{humanize(k)}</div>
              <ul className="list-disc space-y-0.5 pl-4 text-fg-2">{v.map((line, i) => <li key={i}>{line}</li>)}</ul>
            </div>
          ))}
          {(answer.warnings ?? []).length > 0 && <Notice tone="stale">{answer.warnings!.join(" · ")}</Notice>}
        </div>
      )}
    </Section>
  );
}
