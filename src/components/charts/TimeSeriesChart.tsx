"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";

import { formatClockUtc, formatValue, unitLabel } from "@/lib/format";

export type ChartRow = { t: number } & Record<string, number | null>;

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  /** Predicted / model output: dashed. Persistence / reference: dotted. */
  style?: "solid" | "dashed" | "dotted";
  unit?: string | null;
  showDots?: boolean;
};

export type ChartBand = { lowKey: string; highKey: string; color: string; label: string };

export type TimeSeriesChartProps = {
  data: readonly ChartRow[];
  series: readonly ChartSeries[];
  band?: ChartBand;
  unit?: string | null;
  height?: number;
  /** Vertical marker, e.g. "now" (latest observation). */
  marker?: { t: number; label: string };
  ariaLabel: string;
  yDomain?: [number | "auto" | "dataMin" | "dataMax", number | "auto" | "dataMin" | "dataMax"];
};

const AXIS = { stroke: "#22325a", tick: { fill: "#a3a66a", fontSize: 11, fontFamily: "var(--font-mono)" } };

function summarize(data: readonly ChartRow[], key: string) {
  const values = data.map((d) => d[key]).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return { latest: values[values.length - 1]!, min: Math.min(...values), max: Math.max(...values), n: values.length };
}

/** Telemetry chart. Null values are gaps (never connected or zero-filled). */
export function TimeSeriesChart({ data, series, band, unit, height = 220, marker, ariaLabel, yDomain }: TimeSeriesChartProps) {
  const summaries = useMemo(() => series.map((s) => ({ s, sum: summarize(data, s.key) })), [data, series]);
  const tickDecimals = useMemo(() => {
    const vals = summaries.flatMap(({ sum }) => (sum ? [sum.min, sum.max] : []));
    if (vals.length === 0) return undefined;
    const span = Math.max(...vals) - Math.min(...vals);
    return span >= 50 ? 0 : span >= 5 ? 1 : span >= 0.5 ? 2 : 3;
  }, [summaries]);
  const u = unitLabel(unit);

  const renderTooltip = ({ active, payload, label }: TooltipContentProps<TooltipValueType, string | number>) => {
    if (!active || !payload?.length || typeof label !== "number") return null;
    return (
      <div className="rounded-sm border border-line-strong bg-bg/95 px-3 py-2 text-xs shadow-popover">
        <div className="mb-1 font-mono text-fg-3">{formatClockUtc(label)} UTC · simulated</div>
        {series.map((s) => {
          const row = payload[0]?.payload as ChartRow | undefined;
          const v = row?.[s.key] ?? null;
          return (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-fg-2">
                <span className="inline-block h-0.5 w-3" style={{ background: s.color }} aria-hidden />
                {s.label}
              </span>
              <span className="font-mono text-fg">
                {v === null ? "no data" : `${formatValue(v, s.unit ?? unit)} ${unitLabel(s.unit ?? unit)}`}
              </span>
            </div>
          );
        })}
        {band && (() => {
          const row = payload[0]?.payload as ChartRow | undefined;
          const lo = row?.[band.lowKey];
          const hi = row?.[band.highKey];
          return typeof lo === "number" && typeof hi === "number" ? (
            <div className="mt-1 text-fg-3">{band.label}: {formatValue(lo, unit)}–{formatValue(hi, unit)} {u}</div>
          ) : null;
        })()}
      </div>
    );
  };

  return (
    <figure className="m-0">
      <div style={{ height }} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data as ChartRow[]} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#16244a" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v: number) => formatClockUtc(v)}
              minTickGap={40}
              {...AXIS}
            />
            <YAxis
              width={52}
              domain={yDomain ?? ["auto", "auto"]}
              tickFormatter={(v: number) => formatValue(v, unit, tickDecimals)}
              {...AXIS}
            />
            <Tooltip content={renderTooltip} cursor={{ stroke: "#5a71aa", strokeDasharray: "3 3" }} />
            {band && (
              <Area
                dataKey={(d: ChartRow) => {
                  const lo = d[band.lowKey];
                  const hi = d[band.highKey];
                  return typeof lo === "number" && typeof hi === "number" ? [lo, hi] : null;
                }}
                stroke="none"
                fill={band.color}
                fillOpacity={0.12}
                isAnimationActive={false}
                connectNulls={false}
              />
            )}
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.style === "dotted" ? 1.5 : 2}
                strokeDasharray={s.style === "dashed" ? "6 4" : s.style === "dotted" ? "2 4" : undefined}
                dot={s.showDots ? { r: 3, fill: s.color, stroke: "#070d1f" } : false}
                activeDot={{ r: 3.5 }}
                connectNulls={false}
                isAnimationActive={false}
                type="monotone"
              />
            ))}
            {marker && (
              <ReferenceLine
                x={marker.t}
                stroke="#a3a66a"
                strokeDasharray="3 3"
                label={{ value: marker.label, position: "insideTopRight", fill: "#a3a66a", fontSize: 10 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-3">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden>
              <line x1="0" y1="2" x2="16" y2="2" stroke={s.color} strokeWidth="2"
                strokeDasharray={s.style === "dashed" ? "5 3" : s.style === "dotted" ? "2 3" : undefined} />
            </svg>
            {s.label}
          </span>
        ))}
        {band && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-[1px]" style={{ background: band.color, opacity: 0.3 }} aria-hidden />
            {band.label}
          </span>
        )}
      </figcaption>
      <div className="sr-only">
        {summaries.map(({ s, sum }) =>
          sum ? (
            <p key={s.key}>
              {s.label}: latest {formatValue(sum.latest, s.unit ?? unit)}, min {formatValue(sum.min, s.unit ?? unit)}, max{" "}
              {formatValue(sum.max, s.unit ?? unit)} {unitLabel(s.unit ?? unit)} over {sum.n} points.
            </p>
          ) : (
            <p key={s.key}>{s.label}: no data in range.</p>
          ),
        )}
      </div>
    </figure>
  );
}
