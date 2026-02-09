/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Filter,
  Download,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  Zap
} from "lucide-react";
import {
  BarChart,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import api from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { exportToCSV } from "../utils/exportUtils";

const COLORS = ["#f43f5e", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#ec4899", "#06b6d4"];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl">
        <p className="text-slate-300 text-sm mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const getInsightIcon = (type) => {
  switch (type) {
    case "danger":
      return <AlertCircle className="w-5 h-5 text-red-400" />;
    case "warning":
      return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    case "success":
      return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    default:
      return <Lightbulb className="w-5 h-5 text-blue-400" />;
  }
};

const getInsightBadge = (type) => {
  switch (type) {
    case "danger":
      return <Badge variant="error">Critical</Badge>;
    case "warning":
      return <Badge variant="warning">Warning</Badge>;
    case "success":
      return <Badge variant="success">Good</Badge>;
    default:
      return <Badge variant="info">Info</Badge>;
  }
};

export const FailureModesPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState("7d");
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await api.getFailureAnalytics(timeRange);
        setData(result);
      } catch (err) {
        console.error("Failed to fetch failure analytics:", err);
        setError("Failed to load failure analytics data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  const handleExport = () => {
    if (data?.modes) {
      exportToCSV(data.modes, "failure_modes_export");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return `${parts[1]}/${parts[2]}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading failure analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-rose-500">{error}</div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const modes = data?.modes || [];
  const trends = data?.trends || [];
  const byModel = data?.by_model || [];
  const insights = data?.insights || [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Failure Modes</h1>
          <p className="mt-1 text-slate-400">Analyze patterns and root causes of agent failures</p>
        </div>
        <div className="flex items-center space-x-3 relative">
          <Button
            variant="secondary"
            className={`bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 ${showFilter ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setShowFilter(!showFilter)}
          >
            <Filter className="w-4 h-4 mr-2" />
            {timeRange === '24h' ? 'Last 24h' : timeRange === '7d' ? 'Last 7d' : timeRange === '30d' ? 'Last 30d' : 'Last 90d'}
          </Button>

          {showFilter && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2">
              <div className="space-y-1">
                {[
                  { id: '24h', label: 'Last 24 Hours' },
                  { id: '7d', label: 'Last 7 Days' },
                  { id: '30d', label: 'Last 30 Days' },
                  { id: '90d', label: 'Last 90 Days' },
                ].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => {
                      setTimeRange(range.id);
                      setShowFilter(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${timeRange === range.id
                      ? 'bg-blue-600/10 text-blue-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button variant="primary" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Total Failures</p>
              <p className="text-3xl font-bold mt-1 text-rose-500">{summary.total_failures || 0}</p>
              <p className="text-sm text-slate-500 mt-1">out of {summary.total_traces || 0} traces</p>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Failure Rate</p>
              <p className="text-3xl font-bold mt-1 text-amber-500">{summary.failure_rate || 0}%</p>
              <div className="flex items-center mt-1">
                {summary.rate_change > 0 ? (
                  <TrendingUp className="w-4 h-4 text-rose-400 mr-1" />
                ) : summary.rate_change < 0 ? (
                  <TrendingDown className="w-4 h-4 text-emerald-400 mr-1" />
                ) : null}
                <span className={`text-sm ${summary.rate_change > 0 ? 'text-rose-400' : summary.rate_change < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {summary.rate_change > 0 ? '+' : ''}{summary.rate_change || 0}% from prev
                </span>
              </div>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <TrendingDown className="w-6 h-6 text-amber-500" />
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Top Failure Mode</p>
              <p className="text-xl font-bold mt-1 text-white truncate max-w-[150px]" title={summary.top_failure_mode || "None"}>
                {summary.top_failure_mode || "None"}
              </p>
              <p className="text-sm text-slate-500 mt-1">{modes[0]?.percentage || 0}% of failures</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Unique Failure Modes</p>
              <p className="text-3xl font-bold mt-1 text-blue-400">{summary.unique_failure_modes || 0}</p>
              <p className="text-sm text-slate-500 mt-1">distinct categories</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <AlertCircle className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Failure Modes Bar Chart */}
        <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
            <h2 className="text-lg font-semibold text-white">Top Failure Modes</h2>
            <p className="text-xs text-slate-500 mt-1">By occurrence count</p>
          </div>
          <div className="p-6">
            {modes.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modes.slice(0, 7)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={11}
                      width={120}
                      tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                    <Bar dataKey="count" name="Failures" fill="#f43f5e" radius={[0, 4, 4, 0]}>
                      {modes.slice(0, 7).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-slate-500">
                No failure data available
              </div>
            )}
          </div>
        </Card>

        {/* Failure Distribution Pie Chart */}
        <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
            <h2 className="text-lg font-semibold text-white">Failure Distribution</h2>
            <p className="text-xs text-slate-500 mt-1">Percentage breakdown</p>
          </div>
          <div className="p-6">
            {modes.length > 0 ? (
              <div className="h-72 flex items-center">
                <ResponsiveContainer width="50%" height="100%">
                  <PieChart>
                    <Pie
                      data={modes.slice(0, 5)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="percentage"
                      nameKey="name"
                    >
                      {modes.slice(0, 5).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {modes.slice(0, 5).map((mode, idx) => (
                    <div key={mode.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span className="text-sm text-slate-400 truncate max-w-[120px]" title={mode.name}>
                          {mode.name}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-slate-200">{mode.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-slate-500">
                No failure data available
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Failure Trends Chart */}
      <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-semibold text-white">Failure Trends Over Time</h2>
          <p className="text-xs text-slate-500 mt-1">Daily failure count and rate</p>
        </div>
        <div className="p-6">
          {trends.length > 0 ? (
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="failureGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="count"
                    name="Failures"
                    stroke="#f43f5e"
                    fill="url(#failureGradient)"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="failure_rate"
                    name="Failure Rate %"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-slate-500">
              No trend data available
            </div>
          )}
        </div>
      </Card>

      {/* Charts Row 2 - Model Comparison */}
      <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-semibold text-white">Failure Rate by Model</h2>
          <p className="text-xs text-slate-500 mt-1">Compare reliability across models</p>
        </div>
        <div className="p-6">
          {byModel.length > 0 ? (
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={byModel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="model"
                    stroke="#64748b"
                    fontSize={11}
                    angle={-30}
                    textAnchor="end"
                    height={80}
                    tickFormatter={(value) => value.length > 20 ? value.substring(0, 20) + '...' : value}
                  />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                  <Bar dataKey="failure_rate" name="Failure Rate %" fill="#f43f5e" radius={[4, 4, 0, 0]}>
                    {byModel.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.failure_rate > 10 ? '#f43f5e' : entry.failure_rate > 5 ? '#f59e0b' : '#10b981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-slate-500">
              No model data available
            </div>
          )}
        </div>
      </Card>

      {/* Insights Section */}
      <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center space-x-3">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Insights & Recommendations</h2>
        </div>
        <div className="p-6">
          {insights.length > 0 ? (
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${insight.type === 'danger'
                    ? 'bg-red-500/5 border-red-500/20'
                    : insight.type === 'warning'
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : insight.type === 'success'
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-blue-500/5 border-blue-500/20'
                    }`}
                >
                  <div className="flex items-start space-x-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-white">{insight.title}</h3>
                        {getInsightBadge(insight.type)}
                      </div>
                      <p className="text-sm text-slate-400">{insight.description}</p>
                      {insight.metric_value && (
                        <p className="text-sm font-medium text-slate-300 mt-2">
                          Metric: {insight.metric_value}
                        </p>
                      )}
                      {insight.recommendation && (
                        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                          <p className="text-sm text-blue-300">
                            <span className="font-medium">Recommendation:</span> {insight.recommendation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Lightbulb className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p>No insights available. Add more data to generate recommendations.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Detailed Failure Modes Table */}
      <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-semibold text-white">All Failure Modes</h2>
        </div>
        <div className="overflow-x-auto">
          {modes.length > 0 ? (
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Failure Mode
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Count
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Percentage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Impact
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {modes.map((mode, index) => (
                  <tr key={mode.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm text-white">{mode.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-slate-200">{mode.count}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm text-slate-400">{mode.percentage}%</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mode.percentage > 30 ? (
                        <Badge variant="error">High</Badge>
                      ) : mode.percentage > 15 ? (
                        <Badge variant="warning">Medium</Badge>
                      ) : (
                        <Badge variant="default">Low</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-slate-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p>No failure modes recorded for this time period.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
