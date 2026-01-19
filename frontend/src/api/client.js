/**
 * API Client Module
 * Centralized HTTP client with error handling and configuration
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

/**
 * Generic request handler with error handling
 * @param {string} endpoint - API endpoint
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>} Response data
 */
async function request(endpoint, options = {}) {
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
      const error = new Error(`HTTP error! status: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * HTTP method helpers
 */
export const client = {
  get: (endpoint, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return request(url);
  },

  post: (endpoint, data) => {
    return request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  put: (endpoint, data) => {
    return request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  patch: (endpoint, data) => {
    return request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  delete: (endpoint) => {
    return request(endpoint, { method: "DELETE" });
  },
};

export default client;
