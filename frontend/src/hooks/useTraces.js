
import { useState, useEffect, useCallback } from "react";
import api from "../api";

export const useTraces = (initialFilters = {}) => {
  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const fetchTraces = useCallback(async (abortController) => {
    try {
      setLoading(true);
      const data = await api.getTraces(filters, { signal: abortController.signal });
      
      if (!abortController.signal.aborted) {
        setTraces(data);
        setError(null);
      }
    } catch (err) {
      if (abortController.signal.aborted) return;
      console.error("Failed to fetch traces:", err);
      setError("Failed to load traces");
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchTraces(abortController);
    return () => abortController.abort();
  }, [fetchTraces]);

  const refetch = () => fetchTraces(new AbortController());

  return { traces, loading, error, filters, setFilters, refetch };
};

export const useTraceDetail = (traceId) => {
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!traceId) return;

    const fetchTrace = async () => {
      try {
        setLoading(true);
        const data = await api.getTraceDetail(traceId);
        setTrace(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch trace detail:", err);
        setError("Failed to load trace details");
      } finally {
        setLoading(false);
      }
    };

    fetchTrace();
  }, [traceId]);

  return { trace, loading, error };
};
