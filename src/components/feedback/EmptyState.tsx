import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-line-strong px-4 py-8 text-center">
      <div className="text-fg-3">{icon ?? <Inbox className="size-6" aria-hidden />}</div>
      <div className="text-sm font-medium text-fg">{title}</div>
      {children && <div className="max-w-md text-xs leading-relaxed text-fg-3">{children}</div>}
    </div>
  );
}
