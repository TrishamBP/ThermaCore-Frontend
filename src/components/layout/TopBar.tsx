"use client";

import { Bell, Clock, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { StatusDot } from "@/components/ui/StatusBadge";
import { Select } from "@/components/ui/Select";
import { SimulatedBadge } from "@/components/shared/SimulatedBadge";
import { useHref, useRunId, useSetSearchParams } from "@/hooks/useRun";
import { useAlertCount, useAssets, useHealth, useKnownRuns } from "@/hooks/useShellQueries";
import { formatEventTime, formatLocalClock, parseTime } from "@/lib/format";

import { Brand, SidebarNav } from "./Sidebar";
import { sectionForPath } from "./nav";

function BackendStatus() {
  const health = useHealth();
  const state = health.isPending ? "connecting" : health.isError ? "unreachable" : health.data.status;
  const tone = state === "ok" ? "ok" : state === "degraded" ? "warn" : state === "connecting" ? "na" : "crit";
  const label = { ok: "API online", degraded: "API degraded", unreachable: "API unreachable", connecting: "Connecting" }[state];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-fg-2"
      title={health.data ? `database: ${health.data.database}, schema v${health.data.schema_version ?? "?"}` : undefined}
      aria-live="polite"
    >
      <StatusDot tone={tone} />
      {label}
    </span>
  );
}

function RunSelector() {
  const runId = useRunId();
  const setParams = useSetSearchParams();
  const known = useKnownRuns();
  const options = useMemo(() => {
    const list = [...known];
    if (runId && !list.some((r) => r.runId === runId)) list.unshift({ runId, label: runId });
    return list;
  }, [known, runId]);
  return (
    <Select
      label="Simulation run"
      hideLabel
      value={runId ?? ""}
      onChange={(e) => setParams({ run: e.target.value || null })}
      className="max-w-[260px]"
      title="Simulation run. There is no run-list endpoint: options come from model training runs and recommendations."
    >
      <option value="">Latest run (backend default)</option>
      {options.map((r) => (
        <option key={r.runId} value={r.runId}>{r.label}</option>
      ))}
    </Select>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const runId = useRunId();
  const href = useHref();
  const assets = useAssets(runId);
  const alerts = useAlertCount(runId);
  const [menuOpen, setMenuOpen] = useState(false);

  const latestEvent = useMemo(() => {
    const ts = (assets.data?.items ?? []).map((a) => a.latest_observed_timestamp).filter(Boolean) as string[];
    return ts.sort((a, b) => (parseTime(b) ?? 0) - (parseTime(a) ?? 0))[0] ?? null;
  }, [assets.data]);

  const alertCount = alerts.data?.count;
  const more = alerts.data?.next_cursor ? "+" : "";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur-sm">
        <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 lg:px-6">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-sm border border-line-strong lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-4" aria-hidden />
          </button>
          <nav aria-label="Breadcrumb" className="mr-auto text-[13px]">
            <span className="text-fg-3">ThermaCore</span>
            <span className="mx-2 text-fg-3">/</span>
            <span className="font-semibold text-fg">{sectionForPath(pathname)}</span>
          </nav>
          <SimulatedBadge runId={assets.data?.simulation_run_id} />
          <RunSelector />
          <span className="hidden items-center gap-1.5 text-xs text-fg-3 xl:inline-flex" title="Newest reading of the selected run (simulated event time)">
            <Clock className="size-3.5" aria-hidden />
            Data as of <span className="font-mono text-fg-2">{formatEventTime(latestEvent)}</span>
          </span>
          <span className="hidden text-xs text-fg-3 md:inline" title="Wall-clock time of the last successful refresh">
            Updated <span className="font-mono text-fg-2">{formatLocalClock(assets.dataUpdatedAt)}</span>
          </span>
          <BackendStatus />
          <Link
            href={href("/alerts")}
            className="relative inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong px-2.5 text-xs text-fg-2 hover:text-fg"
            aria-label={`Alerts: ${alertCount ?? "unknown"}`}
          >
            <Bell className="size-3.5" aria-hidden />
            <span className="font-mono">{alertCount === undefined ? "—" : `${alertCount}${more}`}</span>
          </Link>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 bg-bg/80" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 border-r border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <Brand />
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation" className="grid size-8 place-items-center">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
