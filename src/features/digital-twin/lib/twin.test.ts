import { readFileSync } from "node:fs";
import { join } from "node:path";

import { layoutSchema, overlaySchema, twinStateSchema, type StreamEvent } from "@/lib/api/schemas/twin";

import { ancestors, indexLayout } from "./layout";
import { LiveStore, applyEvent, seed } from "./live-store";
import { NA_COLOR, bandStatus, legendFor, overlayColor, serverAppearance } from "./overlay-scale";

const fx = (n: string) => JSON.parse(readFileSync(join(__dirname, "../../../test/fixtures", n), "utf-8"));
const layout = layoutSchema.parse(fx("twin-layout.json"));
const state = twinStateSchema.parse(fx("twin-state.json"));
const overlay = overlaySchema.parse(fx("twin-overlay-temperature.json"));

const ev = (id: number, event: string, data: Record<string, unknown>): StreamEvent => ({
  id,
  event,
  asset_id: (data.asset_id as string | undefined) ?? null,
  timestamp: "2026-10-14T00:00:00Z",
  data,
});

describe("layout index", () => {
  const index = indexLayout(layout.objects);

  it("maps every server deterministically to an instance index and an asset id", () => {
    expect(index.servers).toHaveLength(20);
    expect(index.serverIndex.get("srv-001")).toBe(0);
    expect(index.serverIndex.get("srv-020")).toBe(19);
    expect(index.objectIdByAsset.get("SIM-NA-013")).toBe("srv-013");
    expect(indexLayout([...layout.objects].reverse()).serverIndex).toEqual(index.serverIndex);
  });

  it("builds the hierarchy from parent_id", () => {
    expect(index.roots.map((r) => r.object.type)).toEqual(["facility"]);
    expect(ancestors(index, "srv-013").map((o) => o.id)).toEqual(["rack-21", "aisle-2", "room-1", "dc-na-1"]);
    expect(index.coolingUnits.map((c) => c.id)).toEqual(["crah-1", "crah-2"]);
  });

  it("survives cycles and missing parents", () => {
    const base = layout.objects[0]!;
    const a = { ...base, id: "a", parent_id: "b", type: "rack" };
    const b = { ...base, id: "b", parent_id: "a", type: "rack" };
    const orphan = { ...base, id: "o", parent_id: "missing", type: "server" };
    const idx = indexLayout([a, b, orphan]);
    expect(idx.roots.map((r) => r.object.id)).toContain("o");
    expect(ancestors(idx, "a").length).toBeLessThanOrEqual(2);
  });
});

describe("overlay colours", () => {
  it("bands follow the backend thresholds (open-ended last band)", () => {
    expect(bandStatus(20, overlay.bands)).toBe("cool");
    expect(bandStatus(22, overlay.bands)).toBe("normal");
    expect(bandStatus(99, overlay.bands)).toBe("hot");
    expect(bandStatus(null, overlay.bands)).toBeNull();
  });

  it("null values are 'no data' grey, never a good colour", () => {
    expect(overlayColor("temperature", { status: "cool", value: null })).toBe(NA_COLOR);
    expect(overlayColor("cooling_efficiency", { status: "UNAVAILABLE", value: null })).toBe(NA_COLOR);
  });

  it("restricted assets render unavailable regardless of overlay", () => {
    const a = serverAppearance("temperature", overlay.items[0], { status: "RESTRICTED", freshness: null, inlet: 30, lastTelemetry: null }, overlay.bands);
    expect(a.unavailable).toBe(true);
    expect(a.color).toBe(NA_COLOR);
  });

  it("a newer live inlet reading overrides the overlay snapshot (temperature overlay)", () => {
    const item = overlay.items[0]!;
    const later = new Date(Date.parse(item.observed_at!) + 60_000).toISOString();
    const a = serverAppearance("temperature", item, { status: "OK", freshness: "FRESH", inlet: 30, lastTelemetry: later }, overlay.bands);
    expect(a.live).toBe(true);
    expect(a.status).toBe("hot");
  });

  it("legend lists every band plus unavailable and stale", () => {
    expect(legendFor("temperature", overlay).map((e) => e.key)).toEqual(["cool", "normal", "warm", "hot", "__na", "__stale"]);
  });
});

describe("live store", () => {
  const assets = seed(state);
  const srv = state.assets[0]!;

  it("applies a newer telemetry_update and ignores duplicate or older ones", () => {
    const newer = new Date(Date.parse(srv.last_telemetry_timestamp!) + 60_000).toISOString();
    const e = ev(10, "telemetry_update", {
      object_id: srv.object_id, asset_id: srv.asset_id, status: "OK", last_telemetry_timestamp: newer, inlet_temperature_c: 25.5,
    });
    const next = applyEvent(assets, e);
    expect(next.get(srv.object_id)?.inlet).toBe(25.5);
    expect(applyEvent(next, e)).toBe(next);
    const older = ev(11, "telemetry_update", { ...e.data, last_telemetry_timestamp: srv.last_telemetry_timestamp, inlet_temperature_c: 1 });
    expect(applyEvent(next, older)).toBe(next);
  });

  it("asset_status_change applies only for newer event ids", () => {
    const e = ev(5, "asset_status_change", { object_id: srv.object_id, to: { status: "STALE", thermal_status: "UNKNOWN" } });
    const next = applyEvent(assets, e);
    expect(next.get(srv.object_id)?.status).toBe("STALE");
    const replay = ev(4, "asset_status_change", { object_id: srv.object_id, to: { status: "OK", thermal_status: "WITHIN_LIMIT" } });
    expect(applyEvent(next, replay)).toBe(next);
  });

  it("reset replaces state and notifies subscribers", () => {
    const store = new LiveStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.reset(state);
    expect(store.getSnapshot().assets.size).toBe(state.assets.length);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
