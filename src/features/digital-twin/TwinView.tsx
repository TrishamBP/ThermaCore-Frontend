"use client";

import { useQuery } from "@tanstack/react-query";
import { Crosshair, Eye, LayoutGrid, MoveHorizontal, Radio, RotateCcw, Wind } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Notice } from "@/components/feedback/Notice";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/components/ui/cn";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDot } from "@/components/ui/StatusBadge";
import { useRunId, useSetSearchParams } from "@/hooks/useRun";
import { getTwinLayout, getTwinOverlay, getTwinState } from "@/lib/api/reads";
import { OVERLAY_TYPES, type OverlayType } from "@/lib/api/schemas/twin";
import { formatEventTime, formatLocalClock } from "@/lib/format";
import { qk } from "@/lib/query-keys";

import { EquipmentTree } from "./EquipmentTree";
import { OverlayLegend } from "./OverlayLegend";
import { HoverStore, LabelOverlay, sceneLabels } from "./SceneLabels";
import type { CameraCommand, CameraPreset } from "./TwinCanvas";
import { TwinInspector } from "./TwinInspector";
import { indexLayout } from "./lib/layout";
import { OVERLAY_META } from "./lib/overlay-scale";
import type { StreamStatus } from "./lib/stream";
import { useTwinLive } from "./useTwinLive";
import type { ServerFlow } from "./Airflow";

const TwinCanvas = dynamic(() => import("./TwinCanvas"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-xs text-fg-3">Loading 3D scene…</div>,
});

const STREAM_LABEL: Record<StreamStatus, { text: string; tone: "ok" | "warn" | "na" | "stale" | "info" }> = {
  connecting: { text: "Connecting to live stream", tone: "na" },
  live: { text: "Live (SSE)", tone: "ok" },
  reconnecting: { text: "Reconnecting…", tone: "warn" },
  polling: { text: "Stream unavailable · polling every 60 s", tone: "stale" },
  stopped: { text: "Paused (tab hidden)", tone: "na" },
};

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function TwinView() {
  const runId = useRunId();
  const params = useSearchParams();
  const setParams = useSetSearchParams();
  const selectedId = params.get("object");
  const overlayParam = params.get("overlay") as OverlayType | null;
  const overlayType: OverlayType = overlayParam && (OVERLAY_TYPES as readonly string[]).includes(overlayParam) ? overlayParam : "temperature";
  const reducedMotion = useReducedMotion();
  const airflow = params.get("airflow") !== "0";
  const [camera, setCamera] = useState<CameraCommand>({ preset: "overview", nonce: 0 });
  const [contextLost, setContextLost] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);
  const [hover] = useState(() => new HoverStore());

  const layout = useQuery({ queryKey: qk.twinLayout(), queryFn: ({ signal }) => getTwinLayout({ signal }), staleTime: Infinity });
  const index = useMemo(() => (layout.data ? indexLayout(layout.data.objects) : null), [layout.data]);
  const labels = useMemo(() => (index ? sceneLabels(index) : []), [index]);

  const state = useQuery({
    queryKey: qk.twinState(runId),
    queryFn: ({ signal }) => getTwinState({ runId, signal }),
    // SSE only carries status + inlet; airflow/exhaust for the particles come from this snapshot.
    refetchInterval: 60_000,
  });
  const overlay = useQuery({
    queryKey: qk.twinOverlay(runId, overlayType),
    queryFn: ({ signal }) => getTwinOverlay({ runId, type: overlayType, signal }),
    placeholderData: (prev) => (prev?.overlay_type === overlayType ? prev : undefined),
  });
  const live = useTwinLive(runId, state.data, selectedId);

  const select = useCallback((id: string | null) => setParams({ object: id }), [setParams]);
  const go = (preset: CameraPreset) => setCamera((c) => ({ preset, nonce: c.nonce + 1 }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedId) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, select]);

  const status = !live.liveEnabled ? { text: "Static snapshot · historical run", tone: "info" as const } : STREAM_LABEL[live.status];
  const flows = useMemo(() => {
    const m = new Map<string, ServerFlow>();
    for (const a of state.data?.assets ?? []) {
      const usable = a.status !== "RESTRICTED" && a.status !== "NO_TELEMETRY" && a.status !== "NO_DATA";
      m.set(a.object_id, {
        cfm: usable ? (a.values?.airflow_cfm?.value ?? null) : null,
        inlet: a.values?.inlet_temperature_c?.value ?? null,
        exhaust: a.values?.exhaust_temperature_c?.value ?? null,
      });
    }
    return m;
  }, [state.data]);
  const notice = layout.data?.notice;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        section="Digital Twin"
        title="Digital Twin"
        meta={
          <>
            <span>Layout <span className="font-mono text-fg-2">{layout.data?.layout_version ?? "…"}</span></span>
            <span>Run <span className="font-mono text-fg-2">{state.data?.simulation_run_id ?? "…"}</span></span>
            <span>Reference time <span className="font-mono text-fg-2">{formatEventTime(live.store.getSnapshot().referenceTime ?? state.data?.reference_time)}</span> (simulated)</span>
          </>
        }
        actions={
          <Select
            label="Overlay"
            value={overlayType}
            onChange={(e) => setParams({ overlay: e.target.value === "temperature" ? null : e.target.value })}
          >
            {OVERLAY_TYPES.map((t) => <option key={t} value={t}>{OVERLAY_META[t].label}</option>)}
          </Select>
        }
      />
      {notice && <Notice tone="sim" title="Demonstration layout.">{notice} Not a CFD or airflow simulation.</Notice>}
      {!live.liveEnabled && (
        <Notice tone="info" title="Historical run selected.">
          The live stream follows the latest run only, so this view is a static snapshot of {runId}. Choose “Latest run” for live updates.
        </Notice>
      )}

      {layout.isError ? (
        <ErrorBanner error={layout.error} title="Could not load the twin layout" onRetry={() => void layout.refetch()} />
      ) : !index ? (
        <Skeleton className="h-[640px]" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 min-[1800px]:grid-cols-[290px_minmax(0,1fr)_380px]">
          <section aria-label="Equipment list" className="order-2 flex max-h-[620px] min-h-0 flex-col rounded-md border border-line bg-surface min-[1800px]:order-1 min-[1800px]:max-h-[760px]">
            <header className="border-b border-line px-4 py-3">
              <div className="text-[11px] font-medium tracking-[0.08em] text-fg-3 uppercase">{index.servers.length} servers · {index.racks.length} racks</div>
              <h2 className="text-[15px] font-semibold">Equipment</h2>
            </header>
            <EquipmentTree index={index} live={live.store} overlay={overlay.data} overlayType={overlayType} selectedId={selectedId} onSelect={select} />
          </section>

          <section aria-label="3D view" className="relative order-1 h-[min(74dvh,760px)] min-h-[480px] overflow-hidden rounded-md border border-line bg-[#050a18] lg:col-span-2 min-[1800px]:order-2 min-[1800px]:col-span-1">
            {contextLost ? (
              <div className="grid h-full place-items-center p-6 text-center text-sm text-fg-2">
                3D view unavailable (WebGL context lost). Use the equipment list and inspector.
              </div>
            ) : (
              <div className="relative h-full" role="img" aria-label={`3D demonstration layout with ${index.servers.length} servers coloured by ${OVERLAY_META[overlayType].label}. Use the equipment list for keyboard access.`}>
                <TwinCanvas
                  index={index}
                  overlayType={overlayType}
                  overlay={overlay.data}
                  live={live.store}
                  selectedId={selectedId}
                  onSelect={select}
                  camera={camera}
                  reducedMotion={reducedMotion}
                  onContextLost={() => setContextLost(true)}
                  labelContainer={labelRef}
                  hover={hover}
                  airflow={airflow}
                  flows={flows}
                />
                <LabelOverlay
                  containerRef={labelRef}
                  labels={labels}
                  selectedId={selectedId}
                  hover={hover}
                  index={index}
                  overlay={overlay.data}
                  overlayType={overlayType}
                  live={live.store}
                />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
              <span className="rounded-sm border border-line-strong bg-bg/90 px-2 py-1 text-[10px] font-semibold tracking-[0.1em] text-fg uppercase">
                Demonstration layout · simulated data
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-line-strong bg-bg/90 px-2 py-1 text-[11px] text-fg-2" aria-live="polite">
                <Radio className="size-3.5" aria-hidden />
                <StatusDot tone={status.tone} />
                {status.text}
                {live.lastEventAt && <span className="font-mono text-fg-3">· {formatLocalClock(live.lastEventAt)}</span>}
              </span>
            </div>
            <div className="absolute bottom-3 left-3">
              <OverlayLegend type={overlayType} overlay={overlay.data} airflow={airflow} />
            </div>
            <div role="toolbar" aria-label="Camera and effects" className="absolute right-3 bottom-3 flex flex-col gap-1">
              <CamButton label="Overview" onClick={() => go("overview")} icon={RotateCcw} />
              <CamButton label="Top view" onClick={() => go("top")} icon={LayoutGrid} />
              {index.aisles.map((a) => (
                <CamButton key={a.id} label={`Walk ${a.name}`} onClick={() => go(`aisle:${a.id}`)} icon={MoveHorizontal} />
              ))}
              <CamButton label="Focus selection" onClick={() => go("focus")} icon={Crosshair} disabled={!selectedId} />
              <CamButton
                label={airflow ? "Airflow: on" : "Airflow: off"}
                onClick={() => setParams({ airflow: airflow ? "0" : null })}
                icon={Wind}
                pressed={airflow}
              />
            </div>
            {(overlay.isFetching || state.isFetching) && (
              <div className="absolute top-12 right-3 inline-flex items-center gap-1 rounded-sm bg-bg/80 px-2 py-0.5 text-[10px] text-fg-3">
                <Eye className="size-3" aria-hidden /> refreshing
              </div>
            )}
          </section>

          <aside aria-label="Inspector" className="order-3 max-h-[620px] min-h-0 overflow-y-auto rounded-md border border-line bg-surface min-[1800px]:max-h-[760px]">
            {overlay.isError && <div className="p-3"><ErrorBanner error={overlay.error} compact title="Overlay unavailable" /></div>}
            {state.isError && <div className="p-3"><ErrorBanner error={state.error} compact title="Twin state unavailable" onRetry={() => void state.refetch()} /></div>}
            <TwinInspector objectId={selectedId} runId={runId} onSelect={select} />
          </aside>
        </div>
      )}
    </div>
  );
}

function CamButton({ label, onClick, icon: Icon, disabled, pressed }: { label: string; onClick: () => void; icon: typeof Eye; disabled?: boolean; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={cn(
        "group relative grid size-9 place-items-center rounded-sm border bg-bg/90 backdrop-blur-sm transition-colors disabled:opacity-40",
        pressed ? "border-accent text-fg shadow-[0_0_12px_rgb(251_255_18/0.25)]" : "border-line-strong text-fg-2 hover:border-fg-3 hover:text-fg",
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span className="pointer-events-none absolute right-11 rounded-sm border border-line-strong bg-bg px-2 py-1 text-[11px] whitespace-nowrap text-fg opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
      </span>
    </button>
  );
}
