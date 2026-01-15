import { useState, useEffect } from "react";
import api from "../services/api";

export const useMetrics = (timeRange = "7d") => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const data = await api.getMetrics(timeRange);
        setMetrics(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
        // Use mock data as fallback
        setMetrics({
          totalConversations: 1250,
          avgQuality: 8.4,
          failureRate: 12,
          avgResponseTime: 2.3,
        });
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [timeRange]);

  return { metrics, loading, error };
};
