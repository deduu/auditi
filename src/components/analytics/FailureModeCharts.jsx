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

export const FailureModeCharts = ({ timeRange = "7d" }) => {
  const { failureModes, trends, loading, error } = useFailureModes(timeRange);

  if (loading) return <Spinner size="lg" />;
  if (error)
    return <div className="text-rose-400">Error loading data: {error}</div>;

  const COLORS = ["#f43f5e", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981"];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 p-2 rounded shadow-lg">
          <p className="text-slate-200 font-medium">{label}</p>
          <p className="text-sm text-slate-400">
            {payload[0].name}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top Failure Modes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={failureModes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                stroke="#64748b"
              />
              <YAxis tick={{ fill: '#94a3b8' }} stroke="#64748b" />
              <Tooltip content={<CustomTooltip />} cursor={{fill: '#334155', opacity: 0.4}} />
              <Bar dataKey="count" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Failure Distribution</h3>
          <div className="space-y-4">
            {failureModes.map((mode, idx) => (
              <div key={mode.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  ></div>
                  <span className="text-sm text-slate-400">{mode.name}</span>
                </div>
                <span className="text-sm font-medium text-slate-200">
                  {mode.percentage}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Failure Trends Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trends || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8' }} stroke="#64748b" />
            <YAxis tick={{ fill: '#94a3b8' }} stroke="#64748b" />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#f43f5e"
              strokeWidth={2}
              dot={{ fill: '#f43f5e', strokeWidth: 2 }}
              activeDot={{ r: 8, fill: '#f43f5e' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};
