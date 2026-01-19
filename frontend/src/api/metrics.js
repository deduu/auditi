/**
 * Metrics API Module
 */
import client from "./client";

/**
 * Get dashboard metrics
 * @param {string} timeRange - Time range filter (e.g., "7d", "30d")
 */
export function getMetrics(timeRange = "7d") {
  return client.get("/metrics", { timeRange });
}

export default {
  getMetrics,
};
