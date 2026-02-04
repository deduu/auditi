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
      // Try to parse error response body for detailed message
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Ignore JSON parse errors, use default message
      }
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } catch (error) {
    // Don't log aborted requests as errors
    if (error.name !== 'AbortError') {
      console.error(`API request failed: ${endpoint}`, error);
    }
    throw error;
  }
}

/**
 * HTTP method helpers
 */
export const client = {
  get: (endpoint, params = {}, options = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return request(url, options);
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

  delete: (endpoint, params = {}, options = {}) => {
    const queryString = new URLSearchParams();
    
    // Handle array params correctly (e.g., ids=['1', '2'] -> ids=1&ids=2)
    Object.keys(params).forEach(key => {
        const value = params[key];
        if (Array.isArray(value)) {
            value.forEach(v => queryString.append(key, v));
        } else if (value !== undefined && value !== null) {
            queryString.append(key, value);
        }
    });
    
    const url = queryString.toString() ? `${endpoint}?${queryString.toString()}` : endpoint;
    return request(url, { ...options, method: "DELETE" });
  },
};

export default client;
