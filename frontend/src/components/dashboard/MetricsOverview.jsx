import React from "react";
import {
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useMetrics } from "../../hooks/useMetrics";
import { ExpandableMetricCard } from "./ExpandableMetricCard";
import { formatLatency, formatScore } from "../../utils/formatters";

const Spinner = ({ size = "md" }) => {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`animate-spin rounded-full border-b-2 border-blue-500 ${sizes[size]}`}
      />
    </div>
  );
};

export const MetricsOverview = ({ timeRange = "7d", filters = {} }) => {
  // Combine timeRange with other filters
  const { metrics, loading, error } = useMetrics({ range: timeRange, ...filters });

  if (loading) return <Spinner />;
  if (error)
    return <div className="text-red-400">Error loading metrics: {error}</div>;
  if (!metrics) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <ExpandableMetricCard
        title="Pass Rate"
        value={metrics.passRate}
        unit="%"
        trend={metrics.trends?.passRate}
        icon={CheckCircle}
        tooltip={(
          <div>
            <p className="mb-2">Percentage of evaluations that passed quality checks.</p>
            <div className="text-[10px] text-slate-400 border-t border-slate-700 pt-2">
              Calculated as: Passed Evaluations / Total Evaluations.
            </div>
          </div>
        )}
      />
      <ExpandableMetricCard
        title="Avg Evaluation Score"
        value={metrics.avgScore?.value || 0}
        unit=""
        trend={metrics.trends?.score}
        icon={AlertCircle}
        percentiles={metrics.avgScore}
        formatter={formatScore}
        tooltip={(
          <div>
            <p className="mb-2">Average quality score given by evaluation systems (LLM judge or human).</p>
            <div className="text-[10px] text-slate-400 border-t border-slate-700 pt-2">
              Scores range from 0 to 1.
            </div>
          </div>
        )}
      />
      <ExpandableMetricCard
        title="Avg Latency"
        value={metrics.avgLatencyMs?.value || 0}
        unit=""
        trend={metrics.trends?.latency}
        icon={Clock}
        percentiles={metrics.avgLatencyMs}
        formatter={formatLatency}
        tooltip={(
          <div>
            <p className="mb-2">Average time taken for the AI to produce a response.</p>
            <div className="text-[10px] text-slate-400 border-t border-slate-700 pt-2">
              Includes model processing and system overhead.
            </div>
          </div>
        )}
      />
    </div>
  );
};
