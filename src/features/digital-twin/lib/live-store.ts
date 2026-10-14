import type { StreamEvent, TwinAssetState, TwinState } from "@/lib/api/schemas/twin";
import { parseTime } from "@/lib/format";

export type LiveAsset = {
  objectId: string;
  assetId: string;
  status: string;
  thermalStatus: string | null;
  freshness: string | null;
  lastTelemetry: string | null;
  inlet: number | null;
  activeAlerts: number | null;
  openRecommendations: number | null;
  lastEventId: number;
};

export type LiveSnapshot = { version: number; assets: ReadonlyMap<string, LiveAsset>; referenceTime: string | null };

function fromState(a: TwinAssetState): LiveAsset {
  return {
    objectId: a.object_id,
    assetId: a.asset_id,
    status: a.status,
    thermalStatus: a.thermal_status ?? null,
    freshness: a.freshness ?? null,
    lastTelemetry: a.last_telemetry_timestamp,
    inlet: a.values?.inlet_temperature_c?.value ?? null,
    activeAlerts: a.active_alerts ?? null,
    openRecommendations: a.open_recommendations ?? null,
    lastEventId: 0,
  };
}

/** Replaces the whole state (initial load and every resync). */
export function seed(state: TwinState): Map<string, LiveAsset> {
  return new Map(state.assets.map((a) => [a.object_id, fromState(a)]));
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Applies one SSE event. Pure: returns the same map instance when nothing changed.
 * - telemetry_update: only if its last_telemetry_timestamp is newer than what is stored
 * - asset_status_change: only if the event id is newer than the entry's last applied event
 */
export function applyEvent(assets: ReadonlyMap<string, LiveAsset>, event: StreamEvent): ReadonlyMap<string, LiveAsset> {
  const objectId = str(event.data.object_id);
  if (!objectId) return assets;
  const cur = assets.get(objectId);
  if (event.event === "telemetry_update") {
    const ts = str(event.data.last_telemetry_timestamp);
    if (cur && (parseTime(ts) ?? 0) <= (parseTime(cur.lastTelemetry) ?? -1)) return assets;
    const next: LiveAsset = {
      objectId,
      assetId: str(event.data.asset_id) ?? cur?.assetId ?? event.asset_id ?? objectId,
      status: str(event.data.status) ?? cur?.status ?? "OK",
      thermalStatus: str(event.data.thermal_status) ?? cur?.thermalStatus ?? null,
      freshness: str(event.data.freshness) ?? cur?.freshness ?? null,
      lastTelemetry: ts,
      inlet: num(event.data.inlet_temperature_c),
      activeAlerts: num(event.data.active_alerts) ?? cur?.activeAlerts ?? null,
      openRecommendations: num(event.data.open_recommendations) ?? cur?.openRecommendations ?? null,
      lastEventId: event.id,
    };
    return new Map(assets).set(objectId, next);
  }
  if (event.event === "asset_status_change") {
    if (!cur || event.id <= cur.lastEventId) return assets;
    const to = (event.data.to ?? {}) as Record<string, unknown>;
    return new Map(assets).set(objectId, {
      ...cur,
      status: str(to.status) ?? cur.status,
      thermalStatus: str(to.thermal_status) ?? cur.thermalStatus,
      lastEventId: event.id,
    });
  }
  return assets;
}

/** Minimal external store (useSyncExternalStore-compatible). Updates never go through React context. */
export class LiveStore {
  private snapshot: LiveSnapshot = { version: 0, assets: new Map(), referenceTime: null };
  private listeners = new Set<() => void>();

  getSnapshot = (): LiveSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  reset(state: TwinState): void {
    this.set(seed(state), state.reference_time);
  }

  apply(event: StreamEvent): boolean {
    const next = applyEvent(this.snapshot.assets, event);
    if (next === this.snapshot.assets) return false;
    let ref = this.snapshot.referenceTime;
    const ts = str(event.data.last_telemetry_timestamp);
    if (ts && (parseTime(ts) ?? 0) > (parseTime(ref) ?? 0)) ref = ts;
    this.set(next, ref);
    return true;
  }

  private set(assets: ReadonlyMap<string, LiveAsset>, referenceTime: string | null) {
    this.snapshot = { version: this.snapshot.version + 1, assets, referenceTime };
    for (const l of this.listeners) l();
  }
}
