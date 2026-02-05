/**
 * Datasets API Module
 * API functions for Dataset management feature
 */
import client from "./client";



// =============================================================================
// Dataset CRUD API
// =============================================================================

/**
 * List all datasets with pagination
 * @param {Object} params - Query params
 * @param {boolean} params.includeArchived - Include archived datasets
 * @param {number} params.page - Page number
 * @param {number} params.pageSize - Items per page
 * @param {string} params.search - Search by name
 */
export function getDatasets(params = {}) {
  const queryParams = {
    include_archived: params.includeArchived || false,
    page: params.page || 1,
    page_size: params.pageSize || 20,
  };
  if (params.search) {
    queryParams.search = params.search;
  }
  return client.get("/datasets", queryParams);
}

/**
 * Create a new empty dataset
 * @param {Object} dataset - Dataset data
 * @param {string} dataset.name - Unique dataset name
 * @param {string} dataset.description - Dataset description
 * @param {Object} dataset.metadata - Additional metadata
 * @param {Object} dataset.inputSchema - JSON Schema for input validation
 * @param {Object} dataset.expectedOutputSchema - JSON Schema for expected_output validation
 */
export function createDataset(dataset) {
  return client.post("/datasets", {
    name: dataset.name,
    description: dataset.description,
    metadata: dataset.metadata,
    input_schema: dataset.inputSchema,
    expected_output_schema: dataset.expectedOutputSchema,
  });
}

/**
 * Get a specific dataset
 * @param {string} datasetId - Dataset ID
 */
export function getDataset(datasetId) {
  return client.get(`/datasets/${datasetId}`);
}

/**
 * Update a dataset
 * @param {string} datasetId - Dataset ID
 * @param {Object} updates - Update data
 */
export function updateDataset(datasetId, updates) {
  const payload = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.metadata !== undefined) payload.metadata = updates.metadata;
  if (updates.inputSchema !== undefined) payload.input_schema = updates.inputSchema;
  if (updates.expectedOutputSchema !== undefined) payload.expected_output_schema = updates.expectedOutputSchema;
  if (updates.isArchived !== undefined) payload.is_archived = updates.isArchived;
  return client.put(`/datasets/${datasetId}`, payload);
}

/**
 * Archive a dataset (soft delete)
 * @param {string} datasetId - Dataset ID
 */
export function deleteDataset(datasetId) {
  return client.delete(`/datasets/${datasetId}`);
}

/**
 * Get statistics for a dataset
 * @param {string} datasetId - Dataset ID
 */
export function getDatasetStats(datasetId) {
  return client.get(`/datasets/${datasetId}/stats`);
}

// =============================================================================
// Dataset Item API
// =============================================================================

/**
 * List items in a dataset with pagination
 * @param {string} datasetId - Dataset ID
 * @param {Object} params - Query params
 * @param {boolean} params.includeArchived - Include archived items
 * @param {number} params.page - Page number
 * @param {number} params.pageSize - Items per page
 */
export function getDatasetItems(datasetId, params = {}) {
  return client.get(`/datasets/${datasetId}/items`, {
    include_archived: params.includeArchived || false,
    page: params.page || 1,
    page_size: params.pageSize || 50,
  });
}

/**
 * Add a new item to a dataset
 * @param {string} datasetId - Dataset ID
 * @param {Object} item - Item data
 * @param {Object} item.input - The test input data
 * @param {Object} item.expectedOutput - Expected/ideal output (ground truth)
 * @param {Object} item.metadata - Additional item metadata
 * @param {string} item.sourceTraceId - Source trace ID if linked
 * @param {string} item.sourceSpanId - Source span ID if linked
 */
export function createDatasetItem(datasetId, item) {
  return client.post(`/datasets/${datasetId}/items`, {
    input: item.input,
    expected_output: item.expectedOutput,
    metadata: item.metadata,
    source_trace_id: item.sourceTraceId,
    source_span_id: item.sourceSpanId,
  });
}

/**
 * Add multiple items to a dataset at once
 * @param {string} datasetId - Dataset ID
 * @param {Array} items - Array of item data
 */
export function createBulkDatasetItems(datasetId, items) {
  return client.post(`/datasets/${datasetId}/items/bulk`, {
    items: items.map(item => ({
      input: item.input,
      expected_output: item.expectedOutput,
      metadata: item.metadata,
      source_trace_id: item.sourceTraceId,
      source_span_id: item.sourceSpanId,
    })),
  });
}

/**
 * Get a specific dataset item
 * @param {string} datasetId - Dataset ID
 * @param {string} itemId - Item ID
 */
export function getDatasetItem(datasetId, itemId) {
  return client.get(`/datasets/${datasetId}/items/${itemId}`);
}

/**
 * Update a dataset item
 * @param {string} datasetId - Dataset ID
 * @param {string} itemId - Item ID
 * @param {Object} updates - Update data
 */
export function updateDatasetItem(datasetId, itemId, updates) {
  const payload = {};
  if (updates.input !== undefined) payload.input = updates.input;
  if (updates.expectedOutput !== undefined) payload.expected_output = updates.expectedOutput;
  if (updates.metadata !== undefined) payload.metadata = updates.metadata;
  if (updates.status !== undefined) payload.status = updates.status;
  return client.put(`/datasets/${datasetId}/items/${itemId}`, payload);
}

/**
 * Archive a dataset item (soft delete)
 * @param {string} datasetId - Dataset ID
 * @param {string} itemId - Item ID
 */
export function deleteDatasetItem(datasetId, itemId) {
  return client.delete(`/datasets/${datasetId}/items/${itemId}`);
}

// =============================================================================
// Publish from Annotation Queue API
// =============================================================================

/**
 * Publish completed annotations from a queue to a new dataset
 * @param {string} queueId - Annotation queue ID
 * @param {Object} options - Publish options
 * @param {string} options.datasetName - Name for the new dataset
 * @param {string} options.description - Dataset description
 * @param {boolean} options.includeExecutionPath - Include spans/execution path in metadata
 * @param {boolean} options.includeLLMEvaluation - Include LLM evaluation data
 * @param {boolean} options.onlyCompleted - Only include completed items (not skipped)
 */
export function publishFromQueue(queueId, options) {
  return client.post(`/datasets/publish-from-queue/${queueId}`, {
    dataset_name: options.datasetName,
    description: options.description,
    include_execution_path: options.includeExecutionPath || false,
    include_llm_evaluation: options.includeLLMEvaluation || false,
    only_completed: options.onlyCompleted !== false, // default true
  });
}

// =============================================================================
// Export API
// =============================================================================

/**
 * Export dataset items
 * @param {string} datasetId - Dataset ID
 * @param {Object} options - Export options
 * @param {string} options.format - Export format: 'csv', 'jsonl', or 'parquet'
 * @param {boolean} options.includeArchived - Include archived items
 */
export async function exportDataset(datasetId, options = {}) {
  const { format = "jsonl", includeArchived = false } = options;

  const response = await client.get(`/datasets/${datasetId}/export`, {
    format,
    include_archived: includeArchived,
  }, { responseType: 'raw' });

  // Get filename from Content-Disposition header
  const contentDisposition = response.headers.get("Content-Disposition");
  const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch?.[1] || `dataset.${format}`;

  // Download file
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);

  return { success: true, filename };
}

export default {
  // Datasets
  getDatasets,
  createDataset,
  getDataset,
  updateDataset,
  deleteDataset,
  getDatasetStats,
  // Dataset Items
  getDatasetItems,
  createDatasetItem,
  createBulkDatasetItems,
  getDatasetItem,
  updateDatasetItem,
  deleteDatasetItem,
  // Publish
  publishFromQueue,
  // Export
  exportDataset,
};
