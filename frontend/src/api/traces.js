
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
  if (filters.name) params.name = filters.name;
  if (filters.search) params.search = filters.search;
  if (filters.standalone_only !== undefined) params.standalone_only = filters.standalone_only;
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;

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

/**
 * Export traces as CSV with full (non-truncated) content
 * @param {Object} filters - Optional filters (status, type, model, etc)
 */
export const exportTraces = async (filters = {}) => {
  const params = {};
  if (filters.status && filters.status !== 'all') params.status = filters.status;
  if (filters.trace_type && filters.trace_type !== 'all') params.trace_type = filters.trace_type;
  if (filters.model && filters.model !== 'all') params.model = filters.model;
  if (filters.standalone_only !== undefined) params.standalone_only = filters.standalone_only;
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;

  const blob = await client.getBlob('/traces/export', params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `traces_export_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Bulk delete traces
 * @param {Array<string>} ids - List of trace IDs to delete
 * @param {Object} options - Request options
 */
export const deleteTraces = async (ids, options = {}) => {
  return await client.delete("/traces", { ids }, options);
};
