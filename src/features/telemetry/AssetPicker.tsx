"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { QueryView } from "@/components/feedback/QueryView";
import { EmptyState } from "@/components/feedback/EmptyState";
import { table } from "@/components/shared/table";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAssets } from "@/hooks/useShellQueries";

export type AssetPickerProps = {
  runId: string | undefined;
  selected: string | undefined;
  onSelect: (assetId: string) => void;
  title?: string;
};

/** Searchable asset list for the selected run (keyboard: buttons in table rows). */
export function AssetPicker({ runId, selected, onSelect, title = "Assets" }: AssetPickerProps) {
  const assets = useAssets(runId);
  const [q, setQ] = useState("");
  return (
    <Panel title={title} eyebrow={assets.data ? `${assets.data.count} in ${assets.data.simulation_run_id}` : "Selected run"} bodyClassName="p-0">
      <div className="border-b border-line p-3">
        <label className="flex h-8 items-center gap-2 rounded-sm border border-line-strong bg-bg px-2 text-xs">
          <Search className="size-3.5 text-fg-3" aria-hidden />
          <span className="sr-only">Filter assets</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by ID, type, cooling…"
            className="w-full bg-transparent text-fg outline-none placeholder:text-fg-3"
          />
        </label>
      </div>
      <QueryView query={assets} skeleton={<div className="p-4 text-xs text-fg-3">Loading assets…</div>}>
        {(data) => <AssetRows items={data.items} q={q} selected={selected} onSelect={onSelect} />}
      </QueryView>
    </Panel>
  );
}

function AssetRows({ items, q, selected, onSelect }: { items: NonNullable<ReturnType<typeof useAssets>["data"]>["items"]; q: string; selected?: string | undefined; onSelect: (id: string) => void }) {
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((a) => `${a.asset_id} ${a.asset_type} ${a.cooling_type}`.toLowerCase().includes(s)) : items;
  }, [items, q]);
  if (items.length === 0) return <div className="p-4"><EmptyState title="No assets in this run" /></div>;
  return (
    <div className="max-h-[calc(100dvh-260px)] overflow-y-auto">
      <table className={table.table}>
        <thead>
          <tr>
            <th className={table.th}>Asset</th>
            <th className={table.th}>Type</th>
            <th className={table.th}>Freshness</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((a) => {
            const active = a.asset_id === selected;
            return (
              <tr key={a.asset_id} className={active ? table.trSelected : table.tr}>
                <td className="p-0">
                  <button
                    type="button"
                    onClick={() => onSelect(a.asset_id)}
                    aria-pressed={active}
                    className={`w-full px-3 py-2 text-left font-mono text-[13px] whitespace-nowrap ${active ? "text-fg shadow-[inset_2px_0_0_var(--color-accent)]" : "text-fg-2 hover:text-fg"}`}
                  >
                    {a.asset_id}
                  </button>
                </td>
                <td className={table.td}>
                  {a.asset_type ?? "—"}
                  <div className="text-[11px] text-fg-3">{a.cooling_type ?? ""}</div>
                </td>
                <td className={table.td}>
                  <StatusBadge status={a.fresh === null ? "UNKNOWN" : a.fresh ? "FRESH" : "STALE"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
