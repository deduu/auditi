/*
 * Copyright (c) 2026 Auditi Contributors
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * API Client Module
 * Centralized HTTP client with error handling and configuration
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

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
    credentials: "include",
    ...options,
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      // Dispatch auth event on 401 (skip auth endpoints to avoid loops)
      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        window.dispatchEvent(new Event('auth:unauthorized'));
      }

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
    if (options.responseType === 'blob') {
      return await response.blob();
    }
    if (options.responseType === 'raw') {
      return response;
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

  getBlob: (endpoint, params = {}, options = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return request(url, { ...options, responseType: 'blob', method: 'GET' });
  },
};

export default client;
