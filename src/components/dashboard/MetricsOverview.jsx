import React from "react";
import {
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
} from "lucide-react";
import { useMetrics } from "../../hooks/useMetrics";

const Spinner = ({ size = "md" }) => {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizes[size]}`}
      />
    </div>
  );
};

const MetricCard = ({ title, value, unit = "", trend, icon: Icon }) => {
  const getTrendColor = (trend) => {
    if (!trend) return "text-gray-500";
    return trend.direction === "up" ? "text-green-600" : "text-red-600";
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-2">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {value} {unit}
          </p>
          {trend && (
            <p className={`text-sm mt-2 ${getTrendColor(trend)}`}>
              {trend.direction === "up" ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {Icon && <Icon className="w-8 h-8 text-gray-400" />}
      </div>
    </div>
  );
};

export const MetricsOverview = ({ timeRange = "7d" }) => {
  const { metrics, loading, error } = useMetrics(timeRange);

  if (loading) return <Spinner />;
  if (error)
    return <div className="text-red-600">Error loading metrics: {error}</div>;
  if (!metrics) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Total Conversations"
        value={metrics.totalConversations?.toLocaleString()}
        trend={metrics.trends?.conversations}
        icon={MessageSquare}
      />
      <MetricCard
        title="Pass Rate"
        value={metrics.passRate || 88}
        unit="%"
        trend={metrics.trends?.passRate}
        icon={CheckCircle}
      />
      <MetricCard
        title="Avg Evaluation Score"
        value={metrics.avgScore || 8.4}
        unit="/10"
        trend={metrics.trends?.score}
        icon={AlertCircle}
      />
      <MetricCard
        title="Avg Latency"
        value={metrics.avgLatency || 2.3}
        unit="s"
        trend={metrics.trends?.latency}
        icon={Clock}
      />
    </div>
  );
};
