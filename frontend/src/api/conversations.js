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

export default {
  getConversations,
  getConversationDetail,
};
