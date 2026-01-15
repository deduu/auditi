import React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useFailureModes } from "../../hooks/useFailureModes";

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

const ChartCard = ({ title, children }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
    {children}
  </div>
);

export const FailureModeCharts = ({ timeRange = "7d" }) => {
  const { failureModes, trends, loading, error } = useFailureModes(timeRange);

  if (loading) return <Spinner size="lg" />;
  if (error)
    return <div className="text-red-600">Error loading data: {error}</div>;

  const COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Top Failure Modes">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={failureModes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Failure Distribution">
          <div className="space-y-4">
            {failureModes.map((mode, idx) => (
              <div key={mode.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  ></div>
                  <span className="text-sm text-gray-600">{mode.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {mode.percentage}%
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Failure Trends Over Time">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trends || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#ef4444"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};
