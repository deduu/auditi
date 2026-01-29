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

// Legacy default export for backward compatibility
import client from "./client";
import { getMetrics } from "./metrics";
import { getConversations, getConversationDetail } from "./conversations";
import { getEvaluations, getFailureModes, getFailureTrends } from "./evaluations";
import { getModels, getModelPerformance } from "./models";
import { getRecommendedActions, updateActionStatus } from "./actions";
import * as tracesApi from "./traces";

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
  
  // Models
  getModels,
  getModelPerformance,
  
  // Actions
  getRecommendedActions,
  updateActionStatus,
  
  // Traces
  getTraces: tracesApi.getTraces,
  getTraceDetail: tracesApi.getTraceDetail
};

export default api;
