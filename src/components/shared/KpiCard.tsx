import type { ComponentType, ReactNode } from "react";

import { cn } from "@/components/ui/cn";

export type KpiCardProps = {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  status?: ReactNode;
  className?: string;
};

/** Compact KPI: icon, label, primary value, one line of context. */
export function KpiCard({ icon: Icon, label, value, sub, status, className }: KpiCardProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 rounded-md border border-line bg-surface p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <Icon className="size-4 text-fg" aria-hidden />
        {status}
      </div>
      <div className="text-xs text-fg-3">{label}</div>
      <div className="min-h-7 truncate">{value}</div>
      {sub && <div className="truncate text-[11px] text-fg-3">{sub}</div>}
    </div>
  );
}
