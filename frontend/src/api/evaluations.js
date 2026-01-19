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
export function getFailureTrends(timeRange = "30d") {
  return client.get("/failure-modes/trends", { timeRange });
}

export default {
  getEvaluations,
  getFailureModes,
  getFailureTrends,
};
