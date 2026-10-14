import { AlertOctagon, AlertTriangle, CheckCircle2, Circle, Clock, Info, Lock, MinusCircle } from "lucide-react";
import type { ComponentType } from "react";

import { humanize } from "@/lib/format";
import { TONE_BADGE, toneOf, type Tone } from "@/lib/status";

import { cn } from "./cn";

const ICONS: Record<Tone, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  crit: AlertOctagon,
  stale: Clock,
  na: MinusCircle,
  info: Info,
  neutral: Circle,
  restricted: Lock,
};

export type StatusBadgeProps = {
  status: string | null | undefined;
  label?: string;
  tone?: Tone;
  size?: "sm" | "md";
  className?: string;
  title?: string;
};

/** Icon + text + colour for any backend status value. */
export function StatusBadge({ status, label, tone, size = "sm", className, title }: StatusBadgeProps) {
  const t = tone ?? toneOf(status);
  const Icon = ICONS[t];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-sm border font-medium whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        TONE_BADGE[t],
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3 shrink-0" : "size-3.5 shrink-0"} aria-hidden />
      <span className="truncate">{label ?? humanize(status)}</span>
    </span>
  );
}

export function StatusDot({ status, tone, className }: { status?: string | null; tone?: Tone; className?: string }) {
  const t = tone ?? toneOf(status);
  const color = { ok: "bg-ok", warn: "bg-warn", crit: "bg-crit", stale: "bg-stale", na: "bg-na", info: "bg-info", neutral: "bg-fg-3", restricted: "bg-na" }[t];
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", color, className)} />;
}
