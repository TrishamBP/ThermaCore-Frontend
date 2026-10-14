"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Notice } from "@/components/feedback/Notice";
import { QueryView } from "@/components/feedback/QueryView";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/components/ui/cn";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useRunId, useSetSearchParams } from "@/hooks/useRun";
import { useAssets } from "@/hooks/useShellQueries";
import { getAsset, getAssetTelemetry } from "@/lib/api/reads";
import { formatEventTime, metricLabel } from "@/lib/format";
import { LIVE_REFRESH_MS, qk } from "@/lib/query-keys";
import { useSearchParams } from "next/navigation";

import { AssetPicker } from "./AssetPicker";
import { CoolingStateBlock, LatestReadingGrid, ProvenanceBlock } from "./AssetBlocks";
import { MetricChart } from "./MetricChart";
import { DEFAULT_CHART_METRICS, RANGES, TELEMETRY_METRICS, rangeWindow, type RangeKey } from "./series";

export function TelemetryView() {
  const runId = useRunId();
  const params = useSearchParams();
  const setParams = useSetSearchParams();
  const assets = useAssets(runId);
  const assetParam = params.get("asset") ?? undefined;
  const range = (params.get("range") as RangeKey | null) ?? "1h";
  const rangeKey: RangeKey = range in RANGES ? range : "1h";
  const metrics = useMemo(() => {
    const raw = params.get("metrics");
    const list = raw ? raw.split(",").filter((m) => (TELEMETRY_METRICS as readonly string[]).includes(m)) : [];
    return list.length ? list : DEFAULT_CHART_METRICS;
  }, [params]);

  // Default to the first asset of the run once the list is known.
  const items = assets.data?.items;
  const selected = items?.find((a) => a.asset_id === assetParam) ?? items?.[0];
  useEffect(() => {
    if (!assetParam && items?.[0]) setParams({ asset: items[0].asset_id });
  }, [assetParam, items, setParams]);

  const toggleMetric = (m: string) => {
    const next = metrics.includes(m) ? metrics.filter((x) => x !== m) : [...metrics, m];
    setParams({ metrics: next.length ? next.join(",") : null });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        section="Live Telemetry"
        title="Live Telemetry"
        meta={<span>Per-asset history and latest readings. Time ranges end at the asset&apos;s newest reading (simulated event time, UTC).</span>}
        actions={
          <Segmented
            label="Time range"
            value={rangeKey}
            onChange={(v) => setParams({ range: v })}
            options={(Object.keys(RANGES) as RangeKey[]).map((k) => ({ value: k, label: RANGES[k].label }))}
          />
        }
      />
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <AssetPicker runId={runId} selected={selected?.asset_id} onSelect={(id) => setParams({ asset: id })} />
        <div className="flex min-w-0 flex-col gap-4">
          {assets.isError ? (
            <ErrorBanner error={assets.error} onRetry={() => void assets.refetch()} />
          ) : !selected ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <AssetSummaryPanel runId={runId} assetId={selected.asset_id} />
              <Panel title="Metrics" eyebrow="Select which series to chart">
                <div className="flex flex-wrap gap-1.5">
                  {TELEMETRY_METRICS.map((m) => {
                    const on = metrics.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleMetric(m)}
                        className={cn(
                          "h-7 rounded-sm border px-2 text-[11px] font-medium",
                          on ? "border-accent bg-accent/10 text-fg" : "border-line-strong text-fg-3 hover:text-fg",
                        )}
                      >
                        {metricLabel(m)}
                      </button>
                    );
                  })}
                </div>
              </Panel>
              <TelemetryCharts
                runId={runId}
                assetId={selected.asset_id}
                lastEvent={selected.last_event_timestamp}
                range={rangeKey}
                metrics={metrics}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetSummaryPanel({ runId, assetId }: { runId: string | undefined; assetId: string }) {
  const detail = useQuery({
    queryKey: qk.asset(runId, assetId),
    queryFn: ({ signal }) => getAsset({ assetId, runId, signal }),
    refetchInterval: LIVE_REFRESH_MS,
  });
  return (
    <QueryView query={detail} skeleton={<Skeleton className="h-64" />} errorTitle={`Could not load ${assetId}`}>
      {(d) => (
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel
            eyebrow={`${d.asset.asset_type ?? "Asset"} · ${d.asset.cooling_type ?? "cooling n/a"} cooling`}
            title={<span className="font-mono">{assetId}</span>}
            actions={<span className="text-[11px] text-fg-3">reading {formatEventTime(d.latest_reading?.timestamp)}</span>}
          >
            {d.warnings.length > 0 && <Notice tone="stale" className="mb-3">{d.warnings.join(" · ")}</Notice>}
            {d.latest_reading ? (
              <LatestReadingGrid values={d.latest_reading.values} showAll />
            ) : (
              <p className="text-sm text-na">No observed reading for this asset.</p>
            )}
          </Panel>
          <div className="flex flex-col gap-4">
            <Panel title="Cooling state" eyebrow="Rules-based estimator">
              <CoolingStateBlock state={d.cooling_state} />
            </Panel>
            <Panel title="Provenance" eyebrow={<StatusBadge status="INFO" label="Synthetic data" />}>
              <ProvenanceBlock asset={d.asset} />
            </Panel>
          </div>
        </div>
      )}
    </QueryView>
  );
}

function TelemetryCharts({ runId, assetId, lastEvent, range, metrics }: {
  runId: string | undefined; assetId: string; lastEvent: string | null; range: RangeKey; metrics: readonly string[];
}) {
  const win = rangeWindow(lastEvent, range);
  const interval = RANGES[range].interval;
  const telemetry = useQuery({
    queryKey: qk.telemetry(runId, assetId, { ...win, interval, metrics }),
    queryFn: ({ signal }) => getAssetTelemetry({ assetId, runId, start: win.start, end: win.end, interval, metrics, limit: 2000, signal }),
    enabled: metrics.length > 0,
    refetchInterval: LIVE_REFRESH_MS,
  });
  if (metrics.length === 0) return <Notice tone="info">Select at least one metric to chart.</Notice>;
  return (
    <QueryView query={telemetry} skeleton={<Skeleton className="h-72" />} errorTitle="Could not load telemetry history">
      {(t) => {
        const series = t.series[0];
        const units = new Map(t.metrics.map((m) => [m.name, m.unit]));
        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-3">
              <span>{formatEventTime(t.start_time)} → {formatEventTime(t.end_time)} · {t.interval} buckets</span>
              {series && <span>{series.readings} readings · {series.missing_readings} missing · {series.gaps_over_tolerance} gaps</span>}
              {series?.truncated && <StatusBadge status="WARNING" label="Truncated: point limit reached" />}
            </div>
            {t.warnings.length > 0 && <Notice tone="warn">{t.warnings.join(" · ")}</Notice>}
            <div className="grid gap-3 xl:grid-cols-2">
              {metrics.map((m) => <MetricChart key={m} series={series} metric={m} unit={units.get(m) ?? null} />)}
            </div>
          </div>
        );
      }}
    </QueryView>
  );
}
