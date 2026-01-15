import { useState, useEffect } from "react";
import api from "../services/api";

export const useFailureModes = (timeRange = "7d") => {
  const [failureModes, setFailureModes] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [modesData, trendsData] = await Promise.all([
          api.getFailureModes(timeRange),
          api.getFailureTrends(timeRange),
        ]);
        setFailureModes(modesData);
        setTrends(trendsData);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch failure modes:", err);
        // Use mock data as fallback
        setFailureModes([
          { id: 1, name: "Timeout Error", count: 45, percentage: 35 },
          { id: 2, name: "Invalid Input", count: 32, percentage: 25 },
          { id: 3, name: "Rate Limit", count: 28, percentage: 22 },
        ]);
        setTrends([]);
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  return { failureModes, trends, loading, error };
};
