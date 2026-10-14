/** Query-key factory: one place, so invalidations stay exact. */
type Run = string | undefined;

export const qk = {
  health: () => ["health"] as const,
  agentStatus: () => ["agents", "status"] as const,
  modelEvaluation: () => ["cooling-model", "evaluate"] as const,
  overview: (run: Run) => ["dashboard", "overview", { run }] as const,
  assets: (run: Run) => ["assets", "list", { run }] as const,
  asset: (run: Run, assetId: string) => ["assets", "detail", { run, assetId }] as const,
  telemetry: (run: Run, assetId: string, params: object) => ["assets", "telemetry", { run, assetId, ...params }] as const,
  predict: (run: Run, assetId: string) => ["cooling", "predict", { run, assetId }] as const,
  optimizer: (run: Run, assetId: string) => ["cooling", "optimizer", { run, assetId }] as const,
  fanPeers: (run: Run) => ["energy", "fan-peers", { run }] as const,
  recommendations: (filters: object) => ["recommendations", "list", filters] as const,
  recommendationsAll: () => ["recommendations"] as const,
  recommendation: (id: string) => ["recommendations", "detail", id] as const,
  alerts: (filters: object) => ["alerts", "list", filters] as const,
  alertsAll: () => ["alerts"] as const,
  twinLayout: () => ["twin", "layout"] as const,
  twinState: (run: Run) => ["twin", "state", { run }] as const,
  twinOverlay: (run: Run, type: string) => ["twin", "overlay", { run, type }] as const,
  twinOverlaysAll: () => ["twin", "overlay"] as const,
  twinInspect: (run: Run, objectId: string) => ["twin", "inspect", { run, objectId }] as const,
};

/** Telemetry is 1-minute data: views refresh at most once a minute while visible. */
export const LIVE_REFRESH_MS = 60_000;
