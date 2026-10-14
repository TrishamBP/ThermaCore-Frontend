import { NO_DATA, formatValue, unitLabel } from "@/lib/format";

import { cn } from "@/components/ui/cn";

export type MetricValueProps = {
  value: number | null | undefined;
  unit?: string | null;
  decimals?: number;
  /** Why the value is missing (shown as tooltip and to screen readers). */
  reason?: string;
  label?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZES = { sm: "text-[13px]", md: "text-base", lg: "text-xl", xl: "text-[28px] leading-none" };

/** Number + unit. Null renders as "—" with a reason, never as 0. */
export function MetricValue({ value, unit, decimals, reason, label, size = "md", className }: MetricValueProps) {
  const text = formatValue(value, unit, decimals);
  if (text === NO_DATA) {
    const why = reason ?? "no data";
    return (
      <span className={cn("font-mono text-na", SIZES[size], className)} title={why} aria-label={label ? `${label}: ${why}` : why}>
        {NO_DATA}
      </span>
    );
  }
  const u = unitLabel(unit);
  return (
    <span className={cn("font-mono font-semibold text-fg tabular", SIZES[size], className)}>
      {text}
      {u && <span className="ml-1 align-baseline text-[0.6em] font-normal text-fg-3">{u}</span>}
    </span>
  );
}
