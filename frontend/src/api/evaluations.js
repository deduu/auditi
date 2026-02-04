/**
 * Evaluations API Module
 */
import client from "./client";

/**
 * Get evaluations with filters
 * @param {Object} filters - Filter parameters
 */
export function getEvaluations(filters = {}) {
  return client.get("/evaluations", filters);
}

/**
 * Get failure modes statistics
 * @param {string} timeRange - Time range filter
 */
export function getFailureModes(timeRange = "7d") {
  return client.get("/failure-modes", { timeRange });
}

/**
 * Get failure mode trends
 * @param {string} timeRange - Time range filter
 */
export function getFailureTrends(timeRange = "7d") {
  return client.get("/failure-modes/trends", { timeRange });
}

/**
 * Get failures grouped by model
 * @param {string} timeRange - Time range filter
 */
export function getFailuresByModel(timeRange = "7d") {
  return client.get("/failure-modes/by-model", { timeRange });
}

/**
 * Get comprehensive failure analytics
 * @param {string} timeRange - Time range filter
 * @returns {Promise<{modes: Array, trends: Array, by_model: Array, insights: Array, summary: Object}>}
 */
export function getFailureAnalytics(timeRange = "7d") {
  return client.get("/failure-modes/analytics", { timeRange });
}

export default {
  getEvaluations,
  getFailureModes,
  getFailureTrends,
  getFailuresByModel,
  getFailureAnalytics,
};
