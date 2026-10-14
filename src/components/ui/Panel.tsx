import type { ReactNode } from "react";

import { cn } from "./cn";

export type PanelProps = {
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  as?: "section" | "div" | "aside";
  "aria-label"?: string;
};

/** The base surface for every dashboard block. */
export function Panel({ title, eyebrow, actions, footer, className, bodyClassName, children, as = "section", ...rest }: PanelProps) {
  const Tag = as;
  return (
    <Tag className={cn("flex min-w-0 flex-col rounded-md border border-line bg-surface", className)} aria-label={rest["aria-label"]}>
      {(title || actions || eyebrow) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {eyebrow && <div className="text-[11px] font-medium tracking-[0.08em] text-fg-3 uppercase">{eyebrow}</div>}
            {title && <h2 className="truncate text-[15px] font-semibold text-fg">{title}</h2>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("min-w-0 flex-1 p-4", bodyClassName)}>{children}</div>
      {footer && <footer className="border-t border-line px-4 py-2.5 text-xs text-fg-3">{footer}</footer>}
    </Tag>
  );
}
