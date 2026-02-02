/**
 * Metrics API Module
 */
import client from "./client";

/**
 * Get dashboard metrics
 * @param {string} timeRange - Time range filter (e.g., "7d", "30d")
 */
export function getMetrics(timeRange = "7d", filters = {}) {
  // Pass timeRange and other filters as query params
  const params = { timeRange, ...filters };
  // The client likely handles object as query params if passed as second arg, 
  // but looking at previous code 'client.get("/metrics", { timeRange })' 
  // it might be passing it as config or params depending on client implementation. 
  // Assuming client.get(url, params) or client.get(url, { params: ... }) 
  // Let's assume the previous code `client.get("/metrics", { timeRange })` was incorrect or 
  // client is a wrapper that treats 2nd arg as params. 
  // To be safe and standard with axios/fetch wrappers usually:
  return client.get("/metrics", params);
}

export default {
  getMetrics,
};
