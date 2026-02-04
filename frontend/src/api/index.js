/**
 * API Module Index
 * Re-exports all API modules for convenient imports
 */

export { client } from "./client";
export * as metricsApi from "./metrics";
export * as conversationsApi from "./conversations";
export * as evaluationsApi from "./evaluations";
export * as modelsApi from "./models";
export * as actionsApi from "./actions";
export * as settingsApi from "./settings";
export * as tracesApi from "./traces";
export * as annotationsApi from "./annotations";
export * as analyticsApi from "./analytics";
export * as datasetsApi from "./datasets";

// Legacy default export for backward compatibility
import client from "./client";
import { getMetrics } from "./metrics";
import { getConversations, getConversationDetail } from "./conversations";
import { getEvaluations, getFailureModes, getFailureTrends, getFailuresByModel, getFailureAnalytics } from "./evaluations";
import { getModels, getModelPerformance } from "./models";
import { getRecommendedActions, updateActionStatus } from "./actions";
import * as tracesApi from "./traces";
import * as annotationsApi from "./annotations";
import * as analyticsApi from "./analytics";

const api = {
  // Client methods
  request: client.get,

  // Metrics
  getMetrics,

  // Conversations
  getConversations,
  getConversationDetail,

  // Evaluations
  getEvaluations,
  getFailureModes,
  getFailureTrends,
  getFailuresByModel,
  getFailureAnalytics,

  // Models
  getModels,
  getModelPerformance,

  // Actions
  getRecommendedActions,
  updateActionStatus,

  // Traces
  getTraces: tracesApi.getTraces,
  getTraceDetail: tracesApi.getTraceDetail,

  // Annotations (Human Annotation)
  ...annotationsApi,

  // Analytics
  getScoreDistribution: analyticsApi.getScoreDistribution,
  getLowScoringTraces: analyticsApi.getLowScoringTraces,
  getTrends: analyticsApi.getTrends,
  getModelComparison: analyticsApi.getModelComparison,
  getToolAnalytics: analyticsApi.getToolAnalytics,
  getCorrelations: analyticsApi.getCorrelations,
  getCostForecast: analyticsApi.getCostForecast,
  getInsights: analyticsApi.getInsights,
  getAnomalies: analyticsApi.getAnomalies,
  getDashboardKpis: analyticsApi.getDashboardKpis,
  getObservationsByLevel: analyticsApi.getObservationsByLevel,
};

export default api;
