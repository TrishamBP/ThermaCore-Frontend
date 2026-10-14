"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getHealth, getModelEvaluation, listAlerts, listAssets, listRecommendations } from "@/lib/api/reads";
import { publicConfig } from "@/lib/config/public";
import { LIVE_REFRESH_MS, qk } from "@/lib/query-keys";

export function useHealth() {
  return useQuery({ queryKey: qk.health(), queryFn: ({ signal }) => getHealth({ signal }), refetchInterval: 30_000, retry: 0 });
}

export function useAssets(runId: string | undefined) {
  return useQuery({
    queryKey: qk.assets(runId),
    queryFn: ({ signal }) => listAssets({ runId, signal }),
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export function useModelEvaluation() {
  return useQuery({ queryKey: qk.modelEvaluation(), queryFn: ({ signal }) => getModelEvaluation({ signal }), staleTime: 10 * 60_000 });
}

export function useAlertCount(runId: string | undefined) {
  return useQuery({
    queryKey: qk.alerts({ run: runId, limit: 200 }),
    queryFn: ({ signal }) => listAlerts({ runId, limit: 200, signal }),
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export type KnownRun = { runId: string; label: string };

/**
 * There is no endpoint that lists simulation runs. Known runs are collected from real responses only:
 * the model's training runs (with asset counts and durations) and runs referenced by recommendations.
 */
export function useKnownRuns(): KnownRun[] {
  const evaluation = useModelEvaluation();
  const recs = useQuery({
    queryKey: qk.recommendations({ limit: 200 }),
    queryFn: ({ signal }) => listRecommendations({ limit: 200, signal }),
    staleTime: 5 * 60_000,
  });
  return useMemo(() => {
    const runs = new Map<string, string>();
    if (publicConfig.demoRunId) runs.set(publicConfig.demoRunId, `★ Demo run (24 h) · ${publicConfig.demoRunId}`);
    for (const r of evaluation.data?.training_data.runs_used ?? []) {
      const hours = r.minutes / 60;
      runs.set(r.run_id, `${r.run_id} · ${r.assets} assets · ${hours >= 1 ? `${hours.toFixed(0)} h` : `${r.minutes} min`}`);
    }
    for (const r of recs.data?.items ?? []) {
      if (!runs.has(r.simulation_run_id)) runs.set(r.simulation_run_id, `${r.simulation_run_id} · has recommendations`);
    }
    return [...runs.entries()].map(([runId, label]) => ({ runId, label }));
  }, [evaluation.data, recs.data]);
}
