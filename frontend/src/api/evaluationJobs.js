/**
 * Evaluation Jobs API Module
 */
import client from "./client";

export const getTraceModels = () => {
  return client.get("/evaluation-jobs/traces/models");
};

export const getTraceTags = () => {
  return client.get("/evaluation-jobs/traces/tags");
};

export const getTracesPreview = (params = {}) => {
  return client.get("/evaluation-jobs/traces/preview", params);
};

export const createEvaluationJob = (jobData) => {
  return client.post("/evaluation-jobs", jobData);
};

export const getEvaluationJob = (jobId) => {
  return client.get(`/evaluation-jobs/${jobId}`);
};
