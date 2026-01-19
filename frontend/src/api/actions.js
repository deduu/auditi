/**
 * Actions API Module
 */
import client from "./client";

/**
 * Get recommended actions
 * @param {Object} filters - Filter parameters
 */
export function getRecommendedActions(filters = {}) {
  return client.get("/actions", filters);
}

/**
 * Update action status
 * @param {string} actionId - Action ID
 * @param {string} status - New status
 */
export function updateActionStatus(actionId, status) {
  return client.patch(`/actions/${actionId}`, { status });
}

export default {
  getRecommendedActions,
  updateActionStatus,
};
