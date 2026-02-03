/**
 * Analytics API Module
 * Provides access to analytics endpoints for trends, distributions, and insights
 */
import client from "./client";

/**
 * Get score distribution data
 * @param {string} timeRange - Time range filter (24h, 7d, 30d, 90d)
 * @returns {Promise<{buckets: Array, total: number}>}
 */
export function getScoreDistribution(timeRange = "7d") {
  return client.get("/analytics/score-distribution", { timeRange });
}

/**
 * Get low-scoring traces
 * @param {Object} params - Query parameters
 * @param {string} params.timeRange - Time range filter
 * @param {number} params.threshold - Score threshold (default 50)
 * @param {number} params.limit - Max number of traces to return
 * @returns {Promise<{traces: Array, total: number}>}
 */
export function getLowScoringTraces({ timeRange = "7d", threshold = 50, limit = 10 } = {}) {
  return client.get("/analytics/low-scoring-traces", { timeRange, threshold, limit });
}

/**
 * Get time-series trends data
 * @param {string} timeRange - Time range filter (24h, 7d, 30d, 90d)
 * @returns {Promise<{score: TrendMetric, latency: TrendMetric, cost: TrendMetric, error_rate: TrendMetric, volume: TrendMetric}>}
 */
export function getTrends(timeRange = "7d") {
  return client.get("/analytics/trends", { timeRange });
}

/**
 * Get model comparison data
 * @param {string} timeRange - Time range filter
 * @returns {Promise<{models: Array}>}
 */
export function getModelComparison(timeRange = "7d") {
  return client.get("/analytics/models", { timeRange });
}

/**
 * Get tool/span analytics data
 * @param {Object} params - Query parameters
 * @param {string} params.timeRange - Time range filter
 * @param {string} params.spanType - Optional span type filter (llm, tool, agent)
 * @returns {Promise<{summary: Object, tools: Array}>}
 */
export function getToolAnalytics({ timeRange = "7d", spanType = null } = {}) {
  const params = { timeRange };
  if (spanType) params.spanType = spanType;
  return client.get("/analytics/tools", params);
}

export default {
  getScoreDistribution,
  getLowScoringTraces,
  getTrends,
  getModelComparison,
  getToolAnalytics,
};
