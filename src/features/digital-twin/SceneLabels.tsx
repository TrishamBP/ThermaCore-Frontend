"use client";

/**
 * Scene labels as one plain-DOM overlay instead of drei <Html> (which creates a React root per label and
 * unmounts it synchronously during R3F renders → "Attempted to synchronously unmount a root" warnings).
 * <LabelProjector> runs inside the Canvas and writes screen positions straight to the DOM on every rendered frame.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useSyncExternalStore, type RefObject } from "react";
import * as THREE from "three";

import { cn } from "@/components/ui/cn";
import type { Overlay, OverlayType } from "@/lib/api/schemas/twin";
import { formatWithUnit, humanize } from "@/lib/format";

import type { LayoutIndex } from "./lib/layout";
import type { LiveStore } from "./lib/live-store";
import { serverAppearance } from "./lib/overlay-scale";

export type SceneLabel = {
  key: string;
  objectId: string;
  text: string;
  anchor: [number, number, number];
  kind: "chip" | "floor";
};

/** Labels derived from the backend layout only (racks, cooling units, rooms, aisles). */
export function sceneLabels(index: LayoutIndex): SceneLabel[] {
  const out: SceneLabel[] = [];
  for (const r of index.racks) {
    out.push({ key: r.id, objectId: r.id, text: r.name, kind: "chip", anchor: [r.position.x, r.position.y + r.dimensions.height / 2 + 0.12, r.position.z] });
  }
  for (const c of index.coolingUnits) {
    out.push({ key: c.id, objectId: c.id, text: c.name, kind: "chip", anchor: [c.position.x, c.position.y + c.dimensions.height / 2 + 0.12, c.position.z] });
  }
  for (const a of index.aisles) {
    out.push({ key: a.id, objectId: a.id, text: a.name, kind: "floor", anchor: [a.position.x + a.dimensions.width / 2 + 0.6, a.position.y, a.position.z] });
  }
  for (const r of index.rooms) {
    const floorY = r.position.y - r.dimensions.height / 2;
    out.push({ key: r.id, objectId: r.id, text: r.name, kind: "floor", anchor: [r.position.x - r.dimensions.width / 2 + 0.4, floorY, r.position.z - r.dimensions.depth / 2 + 0.4] });
  }
  return out;
}

/** Tiny external store for the hovered server, so hovering re-renders only the tooltip. */
export class HoverStore {
  private id: string | null = null;
  private listeners = new Set<() => void>();
  /** Set by the Canvas: schedules a render so the label projector runs. */
  private frameRequester: (() => void) | null = null;
  setFrameRequester(fn: (() => void) | null) {
    this.frameRequester = fn;
  }
  requestFrame() {
    this.frameRequester?.();
  }
  get = () => this.id;
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  set(id: string | null) {
    if (id === this.id) return;
    this.id = id;
    for (const l of this.listeners) l();
  }
}

const v = new THREE.Vector3();

/** Inside the Canvas: projects every `[data-anchor]` element of the overlay container to screen space. */
export function LabelProjector({ container }: { container: RefObject<HTMLDivElement | null> }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useFrame(() => {
    const root = container.current;
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>("[data-anchor]")) {
      const [x, y, z] = (el.dataset.anchor ?? "").split(",").map(Number);
      if (x === undefined || y === undefined || z === undefined || [x, y, z].some(Number.isNaN)) continue;
      v.set(x, y, z).project(camera);
      const visible = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      el.style.visibility = visible ? "visible" : "hidden";
      if (!visible) continue;
      const sx = ((v.x + 1) / 2) * size.width;
      const sy = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
  });
  return null;
}

export type LabelOverlayProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  labels: readonly SceneLabel[];
  selectedId: string | null;
  hover: HoverStore;
  index: LayoutIndex;
  overlay: Overlay | undefined;
  overlayType: OverlayType;
  live: LiveStore;
};

/** Outside the Canvas: the DOM nodes the projector positions. Decorative (the equipment list is the accessible view). */
export function LabelOverlay({ containerRef, labels, selectedId, hover, index, overlay, overlayType, live }: LabelOverlayProps) {
  return (
    <div ref={containerRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {labels.map((l) => (
        <div key={l.key} data-anchor={l.anchor.join(",")} className="absolute top-0 left-0 whitespace-nowrap" style={{ visibility: "hidden" }}>
          {l.kind === "chip" ? (
            <div
              className={cn(
                "rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px]",
                selectedId === l.objectId ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-bg/90 text-fg-2",
              )}
            >
              {l.text}
            </div>
          ) : (
            <div className="font-mono text-[10px] text-fg-3">{l.text}</div>
          )}
        </div>
      ))}
      <HoverTooltip hover={hover} index={index} overlay={overlay} overlayType={overlayType} live={live} selectedId={selectedId} />
    </div>
  );
}

function HoverTooltip({ hover, index, overlay, overlayType, live, selectedId }: Omit<LabelOverlayProps, "containerRef" | "labels">) {
  const id = useSyncExternalStore(hover.subscribe, hover.get, () => null);
  const info = useMemo(() => {
    const obj = id ? index.byId.get(id) : undefined;
    if (!obj || id === selectedId) return null;
    const item = overlay?.items.find((i) => i.object_id === obj.id);
    const a = serverAppearance(overlayType, item, live.getSnapshot().assets.get(obj.id), overlay?.bands ?? null);
    const text = a.unavailable ? humanize(a.status) : typeof a.value === "number" ? formatWithUnit(a.value, a.unit) : humanize(String(a.value));
    return { obj, text: `${text}${a.predicted ? " (predicted)" : ""}` };
  }, [id, index, overlay, overlayType, live, selectedId]);
  useLayoutEffect(() => {
    hover.requestFrame();
  }, [info, hover]);
  if (!info) return null;
  const { obj } = info;
  return (
    <div
      data-anchor={[obj.position.x, obj.position.y + obj.dimensions.height / 2 + 0.05, obj.position.z - obj.dimensions.depth / 2].join(",")}
      className="absolute top-0 left-0 whitespace-nowrap"
      style={{ visibility: "hidden" }}
    >
      <div className="rounded-sm border border-line-strong bg-bg/95 px-2 py-1 font-mono text-[11px] text-fg shadow-popover">
        {obj.asset_id ?? obj.id}
        <span className="ml-2 text-fg-2">{info.text}</span>
      </div>
    </div>
  );
}
