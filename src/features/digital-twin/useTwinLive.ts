"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { TwinState } from "@/lib/api/schemas/twin";
import { publicConfig } from "@/lib/config/public";
import { qk } from "@/lib/query-keys";

import { LiveStore } from "./lib/live-store";
import { TwinStream, type StreamStatus } from "./lib/stream";

const DEBOUNCE_MS = 10_000;
const HIDDEN_STOP_MS = 60_000;

/**
 * Live twin state: seeded from GET /digital-twin/state, then updated by SSE.
 * The backend stream always follows the latest run, so it is only enabled when no explicit run is selected.
 */
export function useTwinLive(runId: string | undefined, state: TwinState | undefined, selectedObjectId: string | null) {
  const qc = useQueryClient();
  const [store] = useState(() => new LiveStore());
  const [status, setStatus] = useState<StreamStatus>("stopped");
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const selectedRef = useRef(selectedObjectId);
  useEffect(() => {
    selectedRef.current = selectedObjectId;
  }, [selectedObjectId]);
  const liveEnabled = runId === undefined;

  useEffect(() => {
    if (state) store.reset(state);
  }, [state, store]);

  useEffect(() => {
    if (!liveEnabled) return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const debounce = (key: string, fn: () => void) => {
      if (timers.has(key)) return;
      timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, DEBOUNCE_MS));
    };

    const stream = new TwinStream({
      url: `${publicConfig.apiBaseUrl}/digital-twin/stream`,
      onStatus: setStatus,
      onResync: () => void qc.invalidateQueries({ queryKey: qk.twinState(undefined) }),
      onEvent: (e) => {
        setLastEventAt(Date.now());
        switch (e.event) {
          case "telemetry_update":
          case "asset_status_change": {
            store.apply(e);
            debounce("overlay", () => void qc.invalidateQueries({ queryKey: qk.twinOverlaysAll() }));
            const objectId = typeof e.data.object_id === "string" ? e.data.object_id : null;
            if (objectId && objectId === selectedRef.current) {
              debounce("inspect", () => void qc.invalidateQueries({ queryKey: ["twin", "inspect"] }));
            }
            break;
          }
          case "alert_created":
            debounce("alerts", () => {
              void qc.invalidateQueries({ queryKey: qk.alertsAll() });
              void qc.invalidateQueries({ queryKey: qk.twinState(undefined) });
            });
            break;
          case "recommendation_created":
            debounce("recs", () => {
              void qc.invalidateQueries({ queryKey: qk.recommendationsAll() });
              void qc.invalidateQueries({ queryKey: qk.twinState(undefined) });
            });
            break;
          case "layout_changed":
            void qc.invalidateQueries({ queryKey: qk.twinLayout() });
            break;
        }
      },
    });
    stream.start();

    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenTimer = setTimeout(() => stream.stop(), HIDDEN_STOP_MS);
      } else {
        if (hiddenTimer) clearTimeout(hiddenTimer);
        hiddenTimer = null;
        stream.start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (hiddenTimer) clearTimeout(hiddenTimer);
      for (const t of timers.values()) clearTimeout(t);
      stream.stop();
    };
  }, [liveEnabled, qc, store]);

  const effectiveStatus: StreamStatus = liveEnabled ? status : "stopped";

  // Fallback while the stream is down: poll /state once a minute (telemetry is 1-minute data).
  useEffect(() => {
    if (effectiveStatus !== "polling" && effectiveStatus !== "reconnecting") return;
    const t = setInterval(() => void qc.invalidateQueries({ queryKey: qk.twinState(undefined) }), 60_000);
    return () => clearInterval(t);
  }, [effectiveStatus, qc]);

  return { store, status: effectiveStatus, liveEnabled, lastEventAt };
}
