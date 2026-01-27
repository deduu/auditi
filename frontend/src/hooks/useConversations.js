import { useState, useEffect, useCallback } from "react";
import api from "../api";

// Mock sessions data - represents user sessions with conversation summaries
const mockSessions = [
  {
    id: "session_001",
    userId: "user_001",
    startTime: "2024-01-15T14:30:00Z",
    endTime: "2024-01-15T14:45:00Z",
    totalTurns: 8,
    passCount: 6,
    failCount: 2,
    overallStatus: "review",
    objective: "Get help with billing inquiry",
    models: ["GPT-4", "Claude"],
    avgScore: 7.8,
    latency: "2.1s",
    cost: "$0.08",
  },
  {
    id: "session_002",
    userId: "user_002",
    startTime: "2024-01-15T13:15:00Z",
    endTime: "2024-01-15T13:25:00Z",
    totalTurns: 5,
    passCount: 5,
    failCount: 0,
    overallStatus: "pass",
    objective: "Product recommendation",
    models: ["GPT-4"],
    avgScore: 9.2,
    latency: "1.8s",
    cost: "$0.04",
  },
  {
    id: "session_003",
    userId: "user_003",
    startTime: "2024-01-15T11:45:00Z",
    endTime: "2024-01-15T12:00:00Z",
    totalTurns: 12,
    passCount: 8,
    failCount: 4,
    overallStatus: "fail",
    objective: "Technical troubleshooting",
    models: ["Claude", "GPT-4"],
    avgScore: 5.4,
    latency: "3.2s",
    cost: "$0.15",
  },
  {
    id: "session_004",
    userId: "user_004",
    startTime: "2024-01-14T16:20:00Z",
    endTime: "2024-01-14T16:35:00Z",
    totalTurns: 6,
    passCount: 6,
    failCount: 0,
    overallStatus: "pass",
    objective: "Account settings help",
    models: ["GPT-4"],
    avgScore: 8.9,
    latency: "1.5s",
    cost: "$0.03",
  },
  {
    id: "session_005",
    userId: "user_005",
    startTime: "2024-01-14T10:00:00Z",
    endTime: "2024-01-14T10:30:00Z",
    totalTurns: 15,
    passCount: 12,
    failCount: 3,
    overallStatus: "review",
    objective: "Complex order modification",
    models: ["GPT-4", "Claude"],
    avgScore: 7.2,
    latency: "2.8s",
    cost: "$0.22",
  },
];

export const useConversations = (initialFilters = {}) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const fetchConversations = useCallback(async (abortController) => {
    try {
      setLoading(true);
      // Pass signal to api call to actually cancel the request if component unmounts
      const data = await api.getConversations(filters, { signal: abortController.signal });
      
      if (!abortController.signal.aborted) {
        // Map backend fields to frontend display format
        const formattedData = data.map(session => ({
          ...session,
          latency: session.latency || (session.avgLatencyMs !== undefined ? `${(session.avgLatencyMs / 1000).toFixed(2)}s` : "0.00s"),
          cost: session.cost || (session.totalCost !== undefined ? `$${Number(session.totalCost).toFixed(5)}` : "$0.00"),
        }));
        
        setConversations(formattedData);
        setError(null);
      }
    } catch (err) {
      if (abortController.signal.aborted) return;
      
      console.error("Failed to fetch conversations:", err);
      
      // Apply local filtering to mock data for a better UX when API fails
      let filtered = [...mockSessions];
      
      if (filters.status) {
        filtered = filtered.filter(s => s.overallStatus === filters.status);
      }
      
      if (filters.model) {
        filtered = filtered.filter(s => s.models.includes(filters.model));
      }
      
      // Simple range check (mock data is static, so we just simulate)
      if (filters.range === '24h') {
          // In a real app we'd filter by timestamp. Here we just show a subset.
          filtered = filtered.slice(0, 2); 
      }

      setConversations(filtered);
      setError(null);
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchConversations(abortController);
    
    return () => {
      abortController.abort();
    };
  }, [fetchConversations]);

  const refetch = () => fetchConversations();

  return { conversations, loading, error, filters, setFilters, refetch };
};
