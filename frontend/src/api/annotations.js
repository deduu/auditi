/**
 * Annotations API Module
 * API functions for Human Annotation feature
 */
import client from "./client";

// =============================================================================
// Score Configuration API
// =============================================================================

/**
 * List all score configurations
 * @param {boolean} includeArchived - Include archived configs
 */
export function getScoreConfigs(includeArchived = false) {
  return client.get("/annotations/score-configs", { include_archived: includeArchived });
}

/**
 * Create a new score configuration
 * @param {Object} config - Score config data
 */
export function createScoreConfig(config) {
  return client.post("/annotations/score-configs", config);
}

/**
 * Get a specific score configuration
 * @param {string} configId - Score config ID
 */
export function getScoreConfig(configId) {
  return client.get(`/annotations/score-configs/${configId}`);
}

/**
 * Update a score configuration
 * @param {string} configId - Score config ID
 * @param {Object} updates - Update data
 */
export function updateScoreConfig(configId, updates) {
  return client.put(`/annotations/score-configs/${configId}`, updates);
}

/**
 * Archive a score configuration (soft delete)
 * @param {string} configId - Score config ID
 */
export function deleteScoreConfig(configId) {
  return client.delete(`/annotations/score-configs/${configId}`);
}

// =============================================================================
// Annotation Queue API
// =============================================================================

/**
 * List all annotation queues with statistics
 * @param {boolean} includeInactive - Include inactive queues
 */
export function getAnnotationQueues(includeInactive = false) {
  return client.get("/annotations/queues", { include_inactive: includeInactive });
}

/**
 * Create a new annotation queue
 * @param {Object} queue - Queue data
 */
export function createAnnotationQueue(queue) {
  return client.post("/annotations/queues", queue);
}

/**
 * Get a specific annotation queue with stats
 * @param {string} queueId - Queue ID
 */
export function getAnnotationQueue(queueId) {
  return client.get(`/annotations/queues/${queueId}`);
}

/**
 * Update an annotation queue
 * @param {string} queueId - Queue ID
 * @param {Object} updates - Update data
 */
export function updateAnnotationQueue(queueId, updates) {
  return client.put(`/annotations/queues/${queueId}`, updates);
}

/**
 * Deactivate an annotation queue (soft delete)
 * @param {string} queueId - Queue ID
 */
export function deleteAnnotationQueue(queueId) {
  return client.delete(`/annotations/queues/${queueId}`);
}

// =============================================================================
// Queue Item API
// =============================================================================

/**
 * Add items to an annotation queue
 * @param {string} queueId - Queue ID
 * @param {Array} items - Items to add [{object_type, object_id}, ...]
 */
export function addItemsToQueue(queueId, items) {
  return client.post(`/annotations/queues/${queueId}/items`, { items });
}

/**
 * List items in a queue
 * @param {string} queueId - Queue ID
 * @param {Object} params - Query params (status, limit, offset)
 */
export function getQueueItems(queueId, params = {}) {
  return client.get(`/annotations/queues/${queueId}/items`, params);
}

/**
 * Get next item in queue for annotation
 * @param {string} queueId - Queue ID
 * @param {string} userId - Current user ID (for locking)
 */
export function getNextQueueItem(queueId, userId = null) {
  const params = userId ? { user_id: userId } : {};
  return client.get(`/annotations/queues/${queueId}/next`, params);
}

/**
 * Complete a queue item with annotations
 * @param {string} queueId - Queue ID
 * @param {string} itemId - Item ID
 * @param {Object} data - {annotations: [], skip: boolean}
 * @param {string} userId - Current user ID
 */
export function completeQueueItem(queueId, itemId, data, userId = null) {
  const params = userId ? { user_id: userId } : {};
  return client.post(`/annotations/queues/${queueId}/items/${itemId}/complete`, data, params);
}

/**
 * Remove an item from queue
 * @param {string} queueId - Queue ID
 * @param {string} itemId - Item ID
 */
export function removeQueueItem(queueId, itemId) {
  return client.delete(`/annotations/queues/${queueId}/items/${itemId}`);
}

// =============================================================================
// Direct Annotation API
// =============================================================================

/**
 * Create a new annotation directly (not through queue)
 * @param {Object} annotation - Annotation data
 * @param {string} userId - Current user ID
 */
export function createAnnotation(annotation, userId = null) {
  const params = userId ? { user_id: userId } : {};
  return client.post("/annotations/", annotation, params);
}

/**
 * Get all annotations for a specific object
 * @param {string} objectType - "trace" or "span"
 * @param {string} objectId - Object ID
 */
export function getObjectAnnotations(objectType, objectId) {
  return client.get(`/annotations/object/${objectType}/${objectId}`);
}

/**
 * Update an annotation
 * @param {string} annotationId - Annotation ID
 * @param {Object} updates - Update data
 */
export function updateAnnotation(annotationId, updates) {
  return client.put(`/annotations/${annotationId}`, updates);
}

/**
 * Delete an annotation
 * @param {string} annotationId - Annotation ID
 */
export function deleteAnnotation(annotationId) {
  return client.delete(`/annotations/${annotationId}`);
}

/**
 * Create multiple annotations at once
 * @param {Array} annotations - Array of annotation data
 * @param {string} userId - Current user ID
 */
export function createBulkAnnotations(annotations, userId = null) {
  const params = userId ? { user_id: userId } : {};
  return client.post("/annotations/bulk", { annotations }, params);
}

// =============================================================================
// Export API
// =============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

/**
 * Export annotations from a queue for model training
 * @param {string} queueId - Queue ID
 * @param {string} format - Export format: 'csv', 'jsonl', or 'parquet'
 */
export async function exportQueueAnnotations(queueId, format = "csv") {
  const response = await fetch(
    `${API_BASE_URL}/annotations/queues/${queueId}/export?format=${format}`,
    { method: "GET" }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Export failed" }));
    throw new Error(error.detail || "Export failed");
  }

  // Get filename from Content-Disposition header
  const contentDisposition = response.headers.get("Content-Disposition");
  const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch?.[1] || `export.${format}`;

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
  // Score Configs
  getScoreConfigs,
  createScoreConfig,
  getScoreConfig,
  updateScoreConfig,
  deleteScoreConfig,
  // Queues
  getAnnotationQueues,
  createAnnotationQueue,
  getAnnotationQueue,
  updateAnnotationQueue,
  deleteAnnotationQueue,
  // Queue Items
  addItemsToQueue,
  getQueueItems,
  getNextQueueItem,
  completeQueueItem,
  removeQueueItem,
  // Direct Annotations
  createAnnotation,
  getObjectAnnotations,
  updateAnnotation,
  deleteAnnotation,
  createBulkAnnotations,
  // Export
  exportQueueAnnotations,
};
