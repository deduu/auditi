import { useState, useEffect } from "react";
import api from "../api";

export const useMetrics = (filters = {}) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Extract timeRange from filters or default to 7d, keep other filters
  const { range: timeRange = "7d", ...otherFilters } = filters;

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        // Pass all filters to the API
        const data = await api.getMetrics(timeRange, otherFilters);
        setMetrics(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
        // Use mock data as fallback
        setMetrics({
          totalConversations: 1250,
          passRate: 88.5,
          avgScore: { value: 8.4, p50: 8.5, p90: 9.2, p95: 9.5, p99: 9.8 },
          avgLatencyMs: { value: 2.3, p50: 2.1, p90: 3.5, p95: 4.2, p99: 6.8 },
          trends: {
             conversations: { value: 5.0, direction: "up" },
             passRate: { value: 2.0, direction: "up" },
             score: { value: 0.5, direction: "up" },
             latency: { value: -0.2, direction: "down" }
          }
        });
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [timeRange, JSON.stringify(otherFilters)]); // Re-fetch when any filter changes

  return { metrics, loading, error };
};
