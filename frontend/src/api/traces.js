
import client from "./client";

/**
 * Get paginated list of traces
 * @param {Object} filters - Optional filters (status, type, model)
 * @param {Object} options - Fetch options (signal, etc)
 */
export const getTraces = async (filters = {}, options = {}) => {
  const params = {};
  
  if (filters.status && filters.status !== 'all') params.status = filters.status;
  if (filters.trace_type && filters.trace_type !== 'all') params.trace_type = filters.trace_type;
  if (filters.model && filters.model !== 'all') params.model = filters.model;
  if (filters.standalone_only !== undefined) params.standalone_only = filters.standalone_only;
  
  // Pagination
  if (filters.skip) params.skip = filters.skip;
  if (filters.limit) params.limit = filters.limit;

  return await client.get('/traces', params, options);
};

/**
 * Get details for a single trace
 * @param {string} traceId 
 * @param {Object} options 
 */
export const getTraceDetail = async (traceId, options = {}) => {
  return await client.get(`/traces/${traceId}`, {}, options);
};
