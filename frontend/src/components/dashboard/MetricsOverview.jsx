import React from "react";
import {
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useMetrics } from "../../hooks/useMetrics";
import { Card } from "../ui/Card";

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

const MetricCard = ({ title, value, unit = "", trend, icon: Icon }) => {
  const getTrendColor = (trend) => {
    if (!trend) return "text-slate-500";
    return trend.direction === "up" ? "text-emerald-400" : "text-rose-400";
  };

  return (
    <Card className="p-6 bg-slate-900/50 border-slate-800 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-2 font-medium">{title}</p>
          <div className="flex items-baseline space-x-1">
            <h3 className="text-2xl font-bold text-white">
              {value}
            </h3>
            {unit && <span className="text-sm text-slate-500 font-medium">{unit}</span>}
          </div>
          {trend && (
            <p className={`text-sm mt-2 flex items-center font-medium ${getTrendColor(trend)}`}>
              <span className="mr-1">{trend.direction === "up" ? "↑" : "↓"}</span>
              {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-3 rounded-lg bg-slate-800/50">
            <Icon className="w-6 h-6 text-slate-400" />
          </div>
        )}
      </div>
    </Card>
  );
};

export const MetricsOverview = ({ timeRange = "7d" }) => {
  const { metrics, loading, error } = useMetrics(timeRange);

  if (loading) return <Spinner />;
  if (error)
    return <div className="text-red-400">Error loading metrics: {error}</div>;
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
