import type { ReactNode } from "react";

export type PageHeaderProps = { section: string; title: string; meta?: ReactNode; actions?: ReactNode };

export function PageHeader({ section, title, meta, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-md border border-line bg-surface px-5 py-4">
      <div className="min-w-0">
        <div className="text-[11px] font-medium tracking-[0.1em] text-fg-3 uppercase">Page / {section}</div>
        <h1 className="mt-0.5 text-xl font-semibold text-fg">{title}</h1>
        {meta && <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-3">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
