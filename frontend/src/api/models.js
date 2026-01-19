/**
 * Models API Module
 */
import client from "./client";

/**
 * Get list of all models with statistics
 */
export function getModels() {
  return client.get("/models");
}

/**
 * Get performance data for a specific model
 * @param {string} modelId - Model ID
 */
export function getModelPerformance(modelId) {
  return client.get(`/models/${modelId}/performance`);
}

export default {
  getModels,
  getModelPerformance,
};
