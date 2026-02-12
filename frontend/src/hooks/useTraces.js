
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import api from "../api";

const POLL_INTERVAL_FAST = 5000;  // 5s when pending traces exist
const POLL_INTERVAL_SLOW = 15000; // 15s baseline for new trace discovery

export const useTraces = (initialFilters = {}) => {
  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const fetchTraces = useCallback(async (abortController, isPoll = false) => {
    try {
      if (!isPoll) setLoading(true);
      const data = await api.getTraces(filters, { signal: abortController.signal });

      if (!abortController.signal.aborted) {
        setTraces(data);
        setError(null);
      }
    } catch (err) {
      if (abortController.signal.aborted) return;
      if (!isPoll) {
        console.error("Failed to fetch traces:", err);
        setError("Failed to load traces");
      }
    } finally {
      if (!abortController.signal.aborted && !isPoll) {
        setLoading(false);
      }
    }
  }, [filters]);

  // Initial fetch and filter-change fetch
  useEffect(() => {
    const abortController = new AbortController();
    fetchTraces(abortController);
    return () => abortController.abort();
  }, [fetchTraces]);

  // Always poll: fast when pending traces, slow otherwise (for new trace discovery)
  const hasPendingTraces = useMemo(
    () => traces.some(t => !t.status || t.status === "pending"),
    [traces]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const controller = new AbortController();
      fetchTraces(controller, true);
    }, hasPendingTraces ? POLL_INTERVAL_FAST : POLL_INTERVAL_SLOW);

    return () => clearInterval(interval);
  }, [hasPendingTraces, fetchTraces]);

  const refetch = () => fetchTraces(new AbortController());

  return { traces, loading, error, filters, setFilters, refetch };
};

export const useTraceDetail = (traceId) => {
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const prevStatusRef = useRef(null);
  const prevEvalCountRef = useRef(null);

  useEffect(() => {
    if (!traceId) return;

    const fetchTrace = async () => {
      try {
        setLoading(true);
        const data = await api.getTraceDetail(traceId);
        setTrace(data);
        prevStatusRef.current = data?.status || null;
        prevEvalCountRef.current = data?.evalMetadata?.evaluations
          ? Object.keys(data.evalMetadata.evaluations).length : null;
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

  // Conditional polling when trace is pending
  const isPending = trace && (!trace.status || trace.status === "pending");

  useEffect(() => {
    if (!isPending || !traceId) return;

    const interval = setInterval(async () => {
      try {
        const data = await api.getTraceDetail(traceId);
        setTrace(data);

        const wasP = !prevStatusRef.current || prevStatusRef.current === "pending";
        const nowDone = data.status && data.status !== "pending";
        if (wasP && nowDone) {
          setJustEvaluated(true);
          setTimeout(() => setJustEvaluated(false), 5000);
        }

        // Detect multi-evaluator results appearing (re-evaluation)
        const newEvalCount = data?.evalMetadata?.evaluations
          ? Object.keys(data.evalMetadata.evaluations).length : null;
        if (newEvalCount && newEvalCount !== prevEvalCountRef.current) {
          setJustEvaluated(true);
          setTimeout(() => setJustEvaluated(false), 5000);
        }

        prevStatusRef.current = data?.status || null;
        prevEvalCountRef.current = newEvalCount;
      } catch {
        // Silently ignore poll errors
      }
    }, POLL_INTERVAL_FAST);

    return () => clearInterval(interval);
  }, [isPending, traceId]);

  return { trace, loading, error, justEvaluated };
};
