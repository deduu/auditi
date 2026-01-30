/**
 * Conversations API Module
 */
import client from "./client";

/**
 * Get paginated list of conversations
 * @param {Object} filters - Filter parameters
 */
export function getConversations(filters = {}, options = {}) {
  return client.get("/conversations", filters, options);
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
