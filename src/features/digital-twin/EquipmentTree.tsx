"use client";

import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import { cn } from "@/components/ui/cn";
import type { Overlay, OverlayType } from "@/lib/api/schemas/twin";
import { formatWithUnit, humanize } from "@/lib/format";

import type { LayoutIndex, TreeNode } from "./lib/layout";
import type { LiveStore } from "./lib/live-store";
import { serverAppearance } from "./lib/overlay-scale";

export type EquipmentTreeProps = {
  index: LayoutIndex;
  live: LiveStore;
  overlay: Overlay | undefined;
  overlayType: OverlayType;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const SKIP = new Set(["facility"]);

/** Keyboard-accessible alternative to the 3D scene: same hierarchy, statuses and selection. */
export function EquipmentTree({ index, live, overlay, overlayType, selectedId, onSelect }: EquipmentTreeProps) {
  const snap = useSyncExternalStore(live.subscribe, live.getSnapshot, live.getSnapshot);
  const [q, setQ] = useState("");
  const items = useMemo(() => new Map((overlay?.items ?? []).map((i) => [i.object_id, i])), [overlay]);
  const roots = useMemo(() => index.roots.flatMap((r) => (SKIP.has(r.object.type) ? r.children : [r])), [index]);
  const query = q.trim().toLowerCase();

  const matches = (n: TreeNode): boolean =>
    !query ||
    `${n.object.id} ${n.object.name} ${n.object.asset_id ?? ""}`.toLowerCase().includes(query) ||
    n.children.some(matches);

  const renderNode = (n: TreeNode, depth: number) => {
    if (!matches(n)) return null;
    const o = n.object;
    const isServer = o.type === "server";
    const liveAsset = snap.assets.get(o.id);
    const look = isServer ? serverAppearance(overlayType, items.get(o.id), liveAsset, overlay?.bands ?? null) : null;
    const selected = selectedId === o.id;
    const valueText = look
      ? look.unavailable
        ? humanize(look.status)
        : typeof look.value === "number"
          ? formatWithUnit(look.value, look.unit)
          : humanize(String(look.value))
      : null;
    return (
      <li key={o.id} role="none">
        <button
          type="button"
          role="treeitem"
          aria-selected={selected}
          aria-level={depth + 1}
          onClick={() => onSelect(o.id)}
          className={cn(
            "flex w-full items-center gap-2 rounded-sm py-1.5 pr-2 text-left text-[12px] transition-colors",
            selected ? "bg-raised text-fg shadow-[inset_2px_0_0_var(--color-accent)]" : "text-fg-2 hover:bg-raised/60 hover:text-fg",
          )}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          {n.children.length > 0 ? <ChevronRight className="size-3 shrink-0 rotate-90 text-fg-3" aria-hidden /> : <span className="w-3 shrink-0" />}
          {isServer ? (
            <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-[2px]" style={{ background: look?.color }} />
          ) : (
            <span className="w-2.5 shrink-0" aria-hidden />
          )}
          <span className={cn("min-w-0 flex-1 truncate", isServer && "font-mono")}>{isServer ? (o.asset_id ?? o.id) : o.name}</span>
          {valueText && (
            <span className={cn("shrink-0 font-mono text-[11px]", look?.unavailable ? "text-na" : "text-fg-3")}>
              {valueText}
              {look?.stale ? " · stale" : ""}
            </span>
          )}
          {isServer && liveAsset?.thermalStatus && (
            <span className="sr-only">thermal status {humanize(liveAsset.thermalStatus)}</span>
          )}
        </button>
        {n.children.length > 0 && <ul role="group">{n.children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-3">
        <label className="flex h-8 items-center gap-2 rounded-sm border border-line-strong bg-bg px-2 text-xs">
          <Search className="size-3.5 text-fg-3" aria-hidden />
          <span className="sr-only">Filter equipment</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find rack, server, asset…"
            className="w-full bg-transparent text-fg outline-none placeholder:text-fg-3"
          />
        </label>
      </div>
      <ul role="tree" aria-label="Equipment" className="min-h-0 flex-1 overflow-y-auto p-2">
        {roots.map((r) => renderNode(r, 0))}
      </ul>
    </div>
  );
}
