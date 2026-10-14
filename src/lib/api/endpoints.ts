/** Path builders (relative to /api/v1). Every path parameter is encoded. */
const enc = encodeURIComponent;

export const endpoints = {
  health: () => "/health",
  dashboardOverview: () => "/dashboard/overview",
  coolingState: () => "/telemetry/cooling-state",
  assets: () => "/assets",
  asset: (assetId: string) => `/assets/${enc(assetId)}`,
  assetTelemetry: (assetId: string) => `/assets/${enc(assetId)}/telemetry`,
  coolingPredict: () => "/cooling/predict",
  modelEvaluation: () => "/cooling-model/evaluate",
  optimizerRecommend: () => "/cooling-optimizer/recommend",
  fanPeerComparison: () => "/energy/fan-peer-comparison",
  recommendations: () => "/recommendations",
  recommendation: (id: string) => `/recommendations/${enc(id)}`,
  recommendationDecisions: (id: string) => `/recommendations/${enc(id)}/decisions`,
  generateRecommendations: () => "/recommendations/generate",
  agentStatus: () => "/recommendations/agents/status",
  alerts: () => "/alerts",
  alert: (id: string) => `/alerts/${enc(id)}`,
  copilotChat: () => "/copilot/chat",
  twinLayout: () => "/digital-twin/layout",
  twinState: () => "/digital-twin/state",
  twinOverlays: () => "/digital-twin/overlays",
  twinInspect: (objectId: string) => `/digital-twin/assets/${enc(objectId)}`,
  twinAnalyze: () => "/digital-twin/analyze",
  twinStream: () => "/digital-twin/stream",
} as const;
