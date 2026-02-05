import client from "./client";

/**
 * Get all managed (built-in) evaluators.
 */
export const getManagedEvaluators = () => {
  return client.get("/evaluators/managed");
};

/**
 * Get all custom evaluators.
 */
export const getCustomEvaluators = () => {
  return client.get("/evaluators");
};

/**
 * Create a new custom evaluator.
 */
export const createEvaluator = (evaluatorData) => {
  return client.post("/evaluators", evaluatorData);
};

/**
 * Get a specific evaluator by ID.
 */
export const getEvaluator = (evaluatorId) => {
  return client.get(`/evaluators/${evaluatorId}`);
};

/**
 * Update an evaluator.
 */
export const updateEvaluator = (evaluatorId, updates) => {
  return client.put(`/evaluators/${evaluatorId}`, updates);
};

/**
 * Delete an evaluator.
 */
export const deleteEvaluator = (evaluatorId) => {
  return client.delete(`/evaluators/${evaluatorId}`);
};

/**
 * Get the current setup wizard state.
 */
export const getSetupState = () => {
  return client.get("/evaluators/setup/state");
};

/**
 * Update the setup wizard state.
 */
export const updateSetupState = (updates) => {
  return client.put("/evaluators/setup/state", updates);
};

/**
 * Get auto-evaluation configuration status.
 * Returns whether auto-eval is ready to run.
 */
export const getAutoEvalConfig = () => {
  return client.get("/evaluators/setup/auto-eval-config");
};
