import { AlertTriangle, Clock, FlaskConical, Info, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui/cn";

const STYLES = {
  warn: { box: "border-warn/40 bg-warn/[0.07]", icon: AlertTriangle, iconCls: "text-warn" },
  stale: { box: "border-stale/40 bg-stale/[0.07]", icon: Clock, iconCls: "text-stale" },
  info: { box: "border-info/30 bg-info/[0.06]", icon: Info, iconCls: "text-info" },
  sim: { box: "border-line-strong bg-raised", icon: FlaskConical, iconCls: "text-fg" },
  safety: { box: "border-line-strong bg-raised", icon: ShieldCheck, iconCls: "text-ok" },
} as const;

export type NoticeProps = { tone: keyof typeof STYLES; title?: ReactNode; children?: ReactNode; className?: string };

/** Inline banner for stale data, demonstration/simulation notices and safety statements. */
export function Notice({ tone, title, children, className }: NoticeProps) {
  const s = STYLES[tone];
  const Icon = s.icon;
  return (
    <div className={cn("flex items-start gap-2.5 rounded-sm border px-3 py-2 text-xs leading-relaxed", s.box, className)}>
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", s.iconCls)} aria-hidden />
      <div className="min-w-0 text-fg-2">
        {title && <span className="mr-1 font-semibold text-fg">{title}</span>}
        {children}
      </div>
    </div>
  );
}
