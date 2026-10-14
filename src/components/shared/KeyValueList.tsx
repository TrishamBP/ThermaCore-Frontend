import type { ReactNode } from "react";

import { cn } from "@/components/ui/cn";

export type KeyValueItem = { key: string; label: ReactNode; value: ReactNode };

export function KeyValueList({ items, className, columns = 1 }: { items: readonly KeyValueItem[]; className?: string; columns?: 1 | 2 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-1.5 text-xs", columns === 2 && "sm:grid-cols-2", className)}>
      {items.map((it) => (
        <div key={it.key} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-line/60 py-1 last:border-0">
          <dt className="shrink-0 text-fg-3">{it.label}</dt>
          <dd className="min-w-0 truncate text-right font-mono text-fg">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
