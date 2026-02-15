/**
 * Conversations API Module
 */
import client from "./client";

/**
 * Get paginated list of conversations
 * @param {Object} filters - Filter parameters
 */
export function getConversations(filters = {}, options = {}) {
  const params = {};
  if (filters.status && filters.status !== 'all') params.status = filters.status;
  if (filters.model && filters.model !== 'all') params.model = filters.model;
  if (filters.range) params.range = filters.range;
  if (filters.exclude_ask_auditi !== undefined) params.exclude_ask_auditi = filters.exclude_ask_auditi;
  if (filters.search) params.search = filters.search;
  if (filters.skip) params.skip = filters.skip;
  if (filters.limit) params.limit = filters.limit;
  return client.get("/conversations", params, options);
}

/**
 * Get detailed conversation with all turns and spans
 * @param {string} conversationId - Conversation ID
 * @param {Object} options - Request options (e.g. signal)
 */
export function getConversationDetail(conversationId, options = {}) {
  return client.get(`/conversations/${conversationId}`, {}, options);
}

/**
 * Bulk delete conversations
 * @param {Array<string>} ids - List of conversation IDs to delete
 * @param {Object} options - Request options
 */
export function deleteConversations(ids, options = {}) {
  return client.delete("/conversations", { ids }, options);
}

export default {
  getConversations,
  getConversationDetail,
  deleteConversations,
};
