import React from "react";
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
        tooltip={(
          <div>
            <p className="font-medium text-slate-100 mb-2">Pass Rate</p>
            <p className="text-slate-300 mb-3">Percentage of AI responses that passed quality checks.</p>
            <div className="text-xs text-slate-400 border-t border-slate-700 pt-3">
              <p className="mb-2"><span className="text-slate-300">Example:</span> If 80 out of 100 responses passed evaluation, the pass rate is 80%.</p>
              <p>Higher is better — aim for 90%+ for production-ready AI.</p>
            </div>
          </div>
        )}
      />
      <ExpandableMetricCard
        title="Avg Evaluation Score"
        value={metrics.avgScore?.value || 0}
        unit=""
        trend={metrics.trends?.score}
        percentiles={metrics.avgScore}
        formatter={formatScore}
        tooltip={(
          <div>
            <p className="font-medium text-slate-100 mb-2">Evaluation Score</p>
            <p className="text-slate-300 mb-3">Quality score from AI judges or human reviewers (0 to 1 scale).</p>
            <div className="text-xs text-slate-400 border-t border-slate-700 pt-3 space-y-2">
              <p className="font-medium text-slate-300">Percentile breakdown:</p>
              <ul className="space-y-1 ml-2">
                <li><span className="text-blue-400">P50 (Median):</span> Half your scores are above this value</li>
                <li><span className="text-blue-400">P90:</span> 90% of scores are at or below this</li>
                <li><span className="text-blue-400">P95:</span> 95% of scores are at or below this</li>
                <li><span className="text-blue-400">P99:</span> 99% of scores are at or below this</li>
              </ul>
              <p className="pt-2"><span className="text-slate-300">Example:</span> A P50 of 0.8 means half your responses scored 0.8 or higher.</p>
            </div>
          </div>
        )}
      />
      <ExpandableMetricCard
        title="Avg Latency"
        value={metrics.avgLatencyMs?.value || 0}
        unit=""
        trend={metrics.trends?.latency}
        percentiles={metrics.avgLatencyMs}
        formatter={formatLatency}
        tooltip={(
          <div>
            <p className="font-medium text-slate-100 mb-2">Response Latency</p>
            <p className="text-slate-300 mb-3">Time taken for the AI to generate a response.</p>
            <div className="text-xs text-slate-400 border-t border-slate-700 pt-3 space-y-2">
              <p className="font-medium text-slate-300">Percentile breakdown:</p>
              <ul className="space-y-1 ml-2">
                <li><span className="text-blue-400">P50 (Median):</span> Typical response time — half are faster</li>
                <li><span className="text-blue-400">P90:</span> 90% of responses complete within this time</li>
                <li><span className="text-blue-400">P95:</span> 95% of responses complete within this time</li>
                <li><span className="text-blue-400">P99:</span> Worst-case for most users (only 1% slower)</li>
              </ul>
              <p className="pt-2"><span className="text-slate-300">Example:</span> P95 of 2.5s means 95% of users wait 2.5 seconds or less.</p>
            </div>
          </div>
        )}
      />
    </div>
  );
};
