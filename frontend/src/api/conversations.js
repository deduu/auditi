/**
 * Conversations API Module
 */
import client from "./client";

/**
 * Get paginated list of conversations
 * @param {Object} filters - Filter parameters
 */
export function getConversations(filters = {}) {
  return client.get("/conversations", filters);
}

/**
 * Get detailed conversation with all turns and spans
 * @param {string} conversationId - Conversation ID
 */
export function getConversationDetail(conversationId) {
  return client.get(`/conversations/${conversationId}`);
}

export default {
  getConversations,
  getConversationDetail,
};
