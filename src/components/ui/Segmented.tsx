"use client";

import { cn } from "./cn";

export type SegmentedOption<T extends string> = { value: T; label: string; disabled?: boolean };

export type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
};

/** Accessible single-select button group (radiogroup). */
export function Segmented<T extends string>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-sm border border-line-strong bg-bg p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 rounded-[3px] px-2.5 text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-40",
              active ? "bg-accent text-on-accent" : "text-fg-2 hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
