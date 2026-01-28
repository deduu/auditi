/**
 * API module for evaluators and setup state.
 */

const API_BASE = "/api/v1/evaluators";

/**
 * Get all managed (built-in) evaluators.
 */
export const getManagedEvaluators = async () => {
  const response = await fetch(`${API_BASE}/managed`);
  if (!response.ok) throw new Error("Failed to fetch managed evaluators");
  return response.json();
};

/**
 * Get all custom evaluators.
 */
export const getCustomEvaluators = async () => {
  const response = await fetch(API_BASE);
  if (!response.ok) throw new Error("Failed to fetch custom evaluators");
  return response.json();
};

/**
 * Create a new custom evaluator.
 */
export const createEvaluator = async (evaluatorData) => {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(evaluatorData),
  });
  if (!response.ok) throw new Error("Failed to create evaluator");
  return response.json();
};

/**
 * Get a specific evaluator by ID.
 */
export const getEvaluator = async (evaluatorId) => {
  const response = await fetch(`${API_BASE}/${evaluatorId}`);
  if (!response.ok) throw new Error("Failed to fetch evaluator");
  return response.json();
};

/**
 * Update an evaluator.
 */
export const updateEvaluator = async (evaluatorId, updates) => {
  const response = await fetch(`${API_BASE}/${evaluatorId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error("Failed to update evaluator");
  return response.json();
};

/**
 * Delete an evaluator.
 */
export const deleteEvaluator = async (evaluatorId) => {
  const response = await fetch(`${API_BASE}/${evaluatorId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete evaluator");
  return response.json();
};

/**
 * Get the current setup wizard state.
 */
export const getSetupState = async () => {
  const response = await fetch(`${API_BASE}/setup/state`);
  if (!response.ok) throw new Error("Failed to fetch setup state");
  return response.json();
};

/**
 * Update the setup wizard state.
 */
export const updateSetupState = async (updates) => {
  const response = await fetch(`${API_BASE}/setup/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error("Failed to update setup state");
  return response.json();
};

/**
 * Get auto-evaluation configuration status.
 * Returns whether auto-eval is ready to run.
 */
export const getAutoEvalConfig = async () => {
  const response = await fetch(`${API_BASE}/setup/auto-eval-config`);
  if (!response.ok) throw new Error("Failed to fetch auto-eval config");
  return response.json();
};
