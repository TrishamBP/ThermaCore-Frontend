import type { Overlay, OverlayType } from "@/lib/api/schemas/twin";

import { OVERLAY_META, legendFor } from "./lib/overlay-scale";

export function OverlayLegend({ type, overlay, airflow }: { type: OverlayType; overlay: Overlay | undefined; airflow?: boolean }) {
  const entries = legendFor(type, overlay);
  const predicted = overlay?.items.some((i) => i.is_predicted);
  return (
    <div className="max-w-[300px] rounded-sm border border-line-strong bg-bg/90 p-2.5 text-[11px] shadow-popover backdrop-blur-sm">
      <details>
        <summary className="cursor-pointer list-none">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-semibold text-fg">{OVERLAY_META[type].label}</span>
        <span className="flex items-center gap-1.5">
          {predicted && <span className="rounded-[3px] border border-dashed border-info px-1 text-[10px] text-info">Predicted</span>}
          <span className="text-[10px] text-fg-3">details ▾</span>
        </span>
      </div>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.key} className="flex items-center gap-2 text-fg-2">
            <span
              aria-hidden
              className={`inline-block size-2.5 shrink-0 rounded-[2px] ${e.pattern === "na" ? "hatch-na border border-na/60" : ""}`}
              style={{ background: e.pattern === "na" ? undefined : e.color }}
            />
            {e.label}
          </li>
        ))}
      </ul>
        </summary>
      <p className="mt-1.5 leading-snug text-fg-3">{OVERLAY_META[type].caveat}</p>
      {overlay?.bands_note && overlay.bands?.length ? <p className="mt-0.5 leading-snug text-fg-3">Bands: {overlay.bands_note}.</p> : null}
      {airflow && (
        <div className="mt-2 border-t border-line pt-1.5">
          <div className="flex items-center gap-2 text-fg-2">
            <span aria-hidden className="h-1.5 w-8 rounded-full" style={{ background: "linear-gradient(90deg,#38bdf8,#22d3ee,#2ee59d,#ff9f1c,#ff4d5e)" }} />
            Airflow particles (illustrative)
          </div>
          <p className="mt-0.5 leading-snug text-fg-3">
            Speed ∝ measured airflow (CFM) per server; colour = measured inlet → exhaust temperature. Direction is assumed
            front → back. Not a CFD or airflow simulation.
          </p>
        </div>
      )}
      </details>
    </div>
  );
}
