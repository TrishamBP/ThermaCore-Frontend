"use client";

import { useMemo } from "react";

import { SERIES } from "@/components/charts/palette";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { EmptyState } from "@/components/feedback/EmptyState";
import type { AssetSeries } from "@/lib/api/schemas/telemetry";
import { metricLabel, unitLabel } from "@/lib/format";

import { metricRows } from "./series";

export function MetricChart({ series, metric, unit, height = 180 }: { series: AssetSeries | undefined; metric: string; unit: string | null; height?: number }) {
  const rows = useMemo(() => metricRows(series, metric), [series, metric]);
  const hasData = rows.some((r) => r.mean !== null);
  const bucketed = series?.interval !== "raw";
  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-fg">{metricLabel(metric)}</h3>
        <span className="font-mono text-[11px] text-fg-3">{unitLabel(unit) || unit || ""}</span>
      </div>
      {!hasData ? (
        <EmptyState title="No data in this range">
          {metric === "gpu_utilization" ? "GPU utilization is not applicable (null) for non-GPU assets." : "The asset reported no value for this metric."}
        </EmptyState>
      ) : (
        <TimeSeriesChart
          data={rows}
          unit={unit}
          height={height}
          ariaLabel={`${metricLabel(metric)} over the selected range`}
          series={[{ key: "mean", label: bucketed ? `Mean per ${series?.interval}` : "Reading", color: SERIES.primary }]}
          band={bucketed ? { lowKey: "min", highKey: "max", color: SERIES.primary, label: "Min–max in bucket" } : undefined}
        />
      )}
    </div>
  );
}
