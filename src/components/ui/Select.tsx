import type { SelectHTMLAttributes } from "react";

import { cn } from "./cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; hideLabel?: boolean };

export function Select({ label, hideLabel, className, id, children, ...props }: SelectProps) {
  const selectId = id ?? `sel-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <label htmlFor={selectId} className="inline-flex items-center gap-2 text-xs text-fg-3">
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
      <select
        id={selectId}
        className={cn(
          "h-8 rounded-sm border border-line-strong bg-bg px-2 font-mono text-xs text-fg hover:border-fg-3",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
