const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  async getMetrics(timeRange = "7d") {
    return this.request(`/metrics?timeRange=${timeRange}`);
  }

  async getConversations(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/conversations?${params}`);
  }

  async getConversationDetail(conversationId) {
    return this.request(`/conversations/${conversationId}`);
  }

  async getEvaluations(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/evaluations?${params}`);
  }

  async getFailureModes(timeRange = "7d") {
    return this.request(`/failure-modes?timeRange=${timeRange}`);
  }

  async getFailureTrends(timeRange = "30d") {
    return this.request(`/failure-modes/trends?timeRange=${timeRange}`);
  }

  async getModels() {
    return this.request("/models");
  }

  async getModelPerformance(modelId) {
    return this.request(`/models/${modelId}/performance`);
  }

  async getRecommendedActions(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/actions?${params}`);
  }

  async updateActionStatus(actionId, status) {
    return this.request(`/actions/${actionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }
}

const api = new ApiService();
export default api;
