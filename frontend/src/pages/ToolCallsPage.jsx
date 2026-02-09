/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState, useEffect } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from "recharts";
import {
    Wrench,
    Cpu,
    Bot,
    CheckCircle,
    XCircle,
    Clock,
    DollarSign,
    Zap,
    AlertTriangle,
    Layers
} from "lucide-react";
import api from "../api";
import { Card } from "../components/ui/Card";
import { TimeRangeFilter } from "../components/common/TimeRangeFilter";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const SPAN_TYPE_ICONS = {
    tool: Wrench,
    llm: Cpu,
    agent: Bot,
};

const SPAN_TYPE_COLORS = {
    tool: '#f59e0b',
    llm: '#3b82f6',
    agent: '#8b5cf6',
};

const getSuccessColor = (rate) => {
    if (rate >= 95) return "text-emerald-400";
    if (rate >= 80) return "text-amber-400";
    return "text-rose-400";
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                <p className="text-slate-300 text-sm font-medium mb-2">{label}</p>
                {payload.map((entry, index) => (
                    <p key={index} className="text-xs" style={{ color: entry.color }}>
                        {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                <p className="text-white font-medium">{payload[0].name}</p>
                <p className="text-xs text-slate-400">{payload[0].value} calls ({payload[0].payload.percentage}%)</p>
            </div>
        );
    }
    return null;
};

export const ToolCallsPage = () => {
    const [toolData, setToolData] = useState({ summary: null, tools: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState("7d");
    const [spanTypeFilter, setSpanTypeFilter] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await api.getToolAnalytics({ timeRange, spanType: spanTypeFilter });
                setToolData(data);
            } catch (err) {
                console.error("Failed to fetch tool analytics:", err);
                setError("Failed to load tool analytics data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [timeRange, spanTypeFilter]);

    // Prepare data for pie chart (calls by span type)
    const typeBreakdown = toolData.tools.reduce((acc, tool) => {
        const type = tool.span_type || 'unknown';
        if (!acc[type]) {
            acc[type] = { name: type, value: 0 };
        }
        acc[type].value += tool.total_calls;
        return acc;
    }, {});

    const pieData = Object.values(typeBreakdown).map(item => ({
        ...item,
        percentage: toolData.summary?.total_calls
            ? ((item.value / toolData.summary.total_calls) * 100).toFixed(1)
            : 0
    }));

    // Top tools by call volume
    const topTools = [...toolData.tools].slice(0, 10);

    // Tools with errors
    const toolsWithErrors = toolData.tools
        .filter(t => t.error_count > 0)
        .sort((a, b) => b.error_count - a.error_count)
        .slice(0, 5);

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-rose-500">{error}</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Tool Calls</h1>
                    <p className="mt-1 text-slate-400">Analyze tool, LLM, and agent span performance</p>
                </div>
                <div className="flex items-center space-x-3">
                    {/* Span Type Filter */}
                    <div className="flex gap-1 bg-slate-900/80 border border-slate-800 rounded-lg p-1">
                        {[
                            { value: null, label: 'All', icon: Layers },
                            { value: 'tool', label: 'Tools', icon: Wrench },
                            { value: 'llm', label: 'LLM', icon: Cpu },
                            { value: 'agent', label: 'Agent', icon: Bot }
                        ].map((filter) => (
                            <button
                                key={filter.label}
                                onClick={() => setSpanTypeFilter(filter.value)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center space-x-1.5 ${spanTypeFilter === filter.value
                                    ? "bg-purple-600 text-white shadow-lg"
                                    : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                <filter.icon className="w-3.5 h-3.5" />
                                <span>{filter.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Time Range Filter */}
                    <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-500">Loading tool analytics...</div>
                </div>
            ) : toolData.tools.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-slate-900/30 border border-dashed border-slate-800 rounded-xl">
                    <Wrench className="w-12 h-12 text-slate-600 mb-4" />
                    <h3 className="text-xl font-semibold text-white">No Tool Data</h3>
                    <p className="text-slate-500 mt-2">No tool/span data found for this period.</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <Card className="bg-slate-900/50 border-slate-800 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Total Calls</p>
                                    <p className="text-2xl font-bold mt-1 text-white">
                                        {toolData.summary?.total_calls?.toLocaleString() || 0}
                                    </p>
                                </div>
                                <div className="p-2.5 bg-blue-500/10 rounded-lg">
                                    <Zap className="w-5 h-5 text-blue-400" />
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-slate-900/50 border-slate-800 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Unique Tools</p>
                                    <p className="text-2xl font-bold mt-1 text-purple-400">
                                        {toolData.summary?.total_tools || 0}
                                    </p>
                                </div>
                                <div className="p-2.5 bg-purple-500/10 rounded-lg">
                                    <Wrench className="w-5 h-5 text-purple-400" />
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-slate-900/50 border-slate-800 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Success Rate</p>
                                    <p className={`text-2xl font-bold mt-1 ${getSuccessColor(toolData.summary?.overall_success_rate || 0)}`}>
                                        {toolData.summary?.overall_success_rate?.toFixed(1) || 0}%
                                    </p>
                                </div>
                                <div className="p-2.5 bg-emerald-500/10 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-slate-900/50 border-slate-800 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Avg Latency</p>
                                    <p className="text-2xl font-bold mt-1 text-amber-400">
                                        {toolData.summary?.avg_latency?.toFixed(2) || 0}s
                                    </p>
                                </div>
                                <div className="p-2.5 bg-amber-500/10 rounded-lg">
                                    <Clock className="w-5 h-5 text-amber-400" />
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-slate-900/50 border-slate-800 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Total Cost</p>
                                    <p className="text-2xl font-bold mt-1 text-emerald-400">
                                        ${toolData.summary?.total_cost?.toFixed(4) || 0}
                                    </p>
                                </div>
                                <div className="p-2.5 bg-emerald-500/10 rounded-lg">
                                    <DollarSign className="w-5 h-5 text-emerald-400" />
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Calls by Type Pie Chart */}
                        <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                                <h2 className="text-lg font-semibold text-white">Calls by Type</h2>
                                <p className="text-xs text-slate-500 mt-1">Distribution of span types</p>
                            </div>
                            <div className="p-6">
                                <div className="h-64 min-w-0">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={2}
                                                dataKey="value"
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={SPAN_TYPE_COLORS[entry.name] || COLORS[index % COLORS.length]}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<PieTooltip />} />
                                            <Legend
                                                formatter={(value) => <span className="text-slate-300 text-sm capitalize">{value}</span>}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </Card>

                        {/* Top Tools by Volume */}
                        <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                                <h2 className="text-lg font-semibold text-white">Top Tools by Volume</h2>
                                <p className="text-xs text-slate-500 mt-1">Most frequently called tools</p>
                            </div>
                            <div className="p-6">
                                <div className="h-64 min-w-0">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                        <BarChart data={topTools} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                            <XAxis type="number" stroke="#64748b" fontSize={12} />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                stroke="#64748b"
                                                fontSize={11}
                                                width={100}
                                                tickFormatter={(v) => v.length > 15 ? v.slice(0, 15) + '...' : v}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                                            <Bar dataKey="total_calls" name="Calls" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Latency Comparison */}
                    <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                            <h2 className="text-lg font-semibold text-white">Latency by Tool (P50 vs P90)</h2>
                            <p className="text-xs text-slate-500 mt-1">Response time percentiles</p>
                        </div>
                        <div className="p-6">
                            <div className="h-64 min-w-0">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <BarChart data={topTools}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis
                                            dataKey="name"
                                            stroke="#64748b"
                                            fontSize={11}
                                            tickFormatter={(v) => v.length > 10 ? v.slice(0, 10) + '...' : v}
                                        />
                                        <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}s`} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                                        <Legend />
                                        <Bar dataKey="p50_latency" name="P50" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="p90_latency" name="P90" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </Card>

                    {/* Tools with Errors */}
                    {toolsWithErrors.length > 0 && (
                        <Card className="bg-rose-500/5 border-rose-500/20 p-0 overflow-hidden">
                            <div className="px-6 py-4 border-b border-rose-500/20 bg-rose-500/5 flex items-center">
                                <AlertTriangle className="w-5 h-5 text-rose-400 mr-2" />
                                <h2 className="text-lg font-semibold text-white">Tools with Errors</h2>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {toolsWithErrors.map((tool, index) => (
                                        <div key={index} className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                    {React.createElement(SPAN_TYPE_ICONS[tool.span_type] || Wrench, {
                                                        className: "w-4 h-4 mr-2",
                                                        style: { color: SPAN_TYPE_COLORS[tool.span_type] || '#64748b' }
                                                    })}
                                                    <span className="text-sm font-medium text-white truncate max-w-[120px]" title={tool.name}>
                                                        {tool.name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center">
                                                    <XCircle className="w-4 h-4 text-rose-400 mr-1" />
                                                    <span className="text-sm font-medium text-rose-400">{tool.error_count}</span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {tool.success_rate.toFixed(1)}% success rate • {tool.total_calls} total calls
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Full Table */}
                    <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                            <h2 className="text-lg font-semibold text-white">All Tools Performance</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-slate-900/50 border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tool</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Calls</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Success Rate</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">P50 Latency</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">P90 Latency</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tokens</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-transparent divide-y divide-slate-800">
                                    {toolData.tools.map((tool, index) => {
                                        const Icon = SPAN_TYPE_ICONS[tool.span_type] || Wrench;
                                        return (
                                            <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <Icon
                                                            className="w-4 h-4 mr-2"
                                                            style={{ color: SPAN_TYPE_COLORS[tool.span_type] || '#64748b' }}
                                                        />
                                                        <span className="text-sm font-medium text-white">{tool.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span
                                                        className="text-xs px-2 py-1 rounded-full capitalize"
                                                        style={{
                                                            backgroundColor: `${SPAN_TYPE_COLORS[tool.span_type] || '#64748b'}20`,
                                                            color: SPAN_TYPE_COLORS[tool.span_type] || '#64748b'
                                                        }}
                                                    >
                                                        {tool.span_type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                    {tool.total_calls.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <span className={`text-sm font-medium ${getSuccessColor(tool.success_rate)}`}>
                                                            {tool.success_rate.toFixed(1)}%
                                                        </span>
                                                        {tool.error_count > 0 && (
                                                            <span className="ml-2 text-xs text-rose-400">
                                                                ({tool.error_count} errors)
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                    {tool.p50_latency.toFixed(3)}s
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                    {tool.p90_latency.toFixed(3)}s
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                    ${tool.total_cost.toFixed(4)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                    {tool.total_tokens.toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};
