import React, { useState, useEffect } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    ZAxis,
    Cell,
    Legend
} from "recharts";
import { Cpu, Zap, Clock, CheckCircle, ArrowUpRight, TrendingDown, DollarSign, AlertTriangle } from "lucide-react";
import api from "../api";
import { Card } from "../components/ui/Card";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const getScoreColor = (score) => {
    if (score >= 75) return "#10b981";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                <p className="text-slate-300 text-sm font-medium mb-2">{label || payload[0]?.payload?.model}</p>
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

const ScatterTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                <p className="text-white font-medium mb-2">{data.model}</p>
                <p className="text-xs text-emerald-400">Score: {data.score.toFixed(1)}%</p>
                <p className="text-xs text-amber-400">Cost: ${data.cost.toFixed(4)}</p>
                <p className="text-xs text-purple-400">Latency: {data.latency_p50.toFixed(2)}s</p>
                <p className="text-xs text-slate-400">Volume: {data.volume} requests</p>
            </div>
        );
    }
    return null;
};

export const ModelsPage = () => {
    const [modelComparison, setModelComparison] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState("7d");

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await api.getModelComparison(timeRange);
                setModelComparison(data.models || []);
            } catch (err) {
                console.error("Failed to fetch model comparison:", err);
                setError("Failed to load model data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [timeRange]);

    // Calculate summary stats
    const stats = {
        totalModels: modelComparison.length,
        avgScore: modelComparison.length > 0
            ? modelComparison.reduce((acc, m) => acc + m.score, 0) / modelComparison.length
            : 0,
        avgLatency: modelComparison.length > 0
            ? modelComparison.reduce((acc, m) => acc + m.latency_p50, 0) / modelComparison.length
            : 0,
        totalCost: modelComparison.reduce((acc, m) => acc + m.cost, 0),
        totalVolume: modelComparison.reduce((acc, m) => acc + m.volume, 0)
    };

    // Find best and worst performers
    const sortedByScore = [...modelComparison].sort((a, b) => b.score - a.score);
    const bestModel = sortedByScore[0];
    const worstModel = sortedByScore[sortedByScore.length - 1];

    // Cost efficiency (score per dollar)
    const costEfficiency = modelComparison.map(m => ({
        ...m,
        efficiency: m.cost > 0 ? m.score / (m.cost * 1000) : 0
    })).sort((a, b) => b.efficiency - a.efficiency);

    // Prepare scatter data (Cost vs Score)
    const scatterData = modelComparison.map(m => ({
        ...m,
        x: m.cost,
        y: m.score,
        z: m.volume
    }));

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
                    <h1 className="text-3xl font-bold text-white">Models</h1>
                    <p className="mt-1 text-slate-400">Compare AI model performance and cost efficiency</p>
                </div>
                <div className="flex bg-slate-900/80 border border-slate-800 rounded-lg p-1">
                    {["24h", "7d", "30d"].map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeRange === range
                                ? "bg-blue-600 text-white shadow-lg"
                                : "text-slate-400 hover:text-white"
                                }`}
                        >
                            {range.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-500">Loading model data...</div>
                </div>
            ) : modelComparison.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-slate-900/30 border border-dashed border-slate-800 rounded-xl">
                    <Cpu className="w-12 h-12 text-slate-600 mb-4" />
                    <h3 className="text-xl font-semibold text-white">No Model Data</h3>
                    <p className="text-slate-500 mt-2">No model usage data found for this period.</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <Card className="bg-slate-900/50 border-slate-800 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Models Used</p>
                                    <p className="text-2xl font-bold mt-1 text-white">{stats.totalModels}</p>
                                </div>
                                <div className="p-2.5 bg-blue-500/10 rounded-lg">
                                    <Cpu className="w-5 h-5 text-blue-400" />
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-slate-900/50 border-slate-800 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Avg Score</p>
                                    <p className="text-2xl font-bold mt-1 text-emerald-400">{stats.avgScore.toFixed(1)}%</p>
                                </div>
                                <div className="p-2.5 bg-emerald-500/10 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-slate-900/50 border-slate-800 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Avg Latency (P50)</p>
                                    <p className="text-2xl font-bold mt-1 text-purple-400">{stats.avgLatency.toFixed(2)}s</p>
                                </div>
                                <div className="p-2.5 bg-purple-500/10 rounded-lg">
                                    <Clock className="w-5 h-5 text-purple-400" />
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-slate-900/50 border-slate-800 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Total Cost</p>
                                    <p className="text-2xl font-bold mt-1 text-amber-400">${stats.totalCost.toFixed(4)}</p>
                                </div>
                                <div className="p-2.5 bg-amber-500/10 rounded-lg">
                                    <DollarSign className="w-5 h-5 text-amber-400" />
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-slate-900/50 border-slate-800 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Total Requests</p>
                                    <p className="text-2xl font-bold mt-1 text-white">{stats.totalVolume.toLocaleString()}</p>
                                </div>
                                <div className="p-2.5 bg-slate-700/50 rounded-lg">
                                    <Zap className="w-5 h-5 text-slate-400" />
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Insights Row */}
                    {bestModel && worstModel && bestModel.model !== worstModel.model && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="bg-emerald-500/5 border-emerald-500/20 p-5">
                                <div className="flex items-start space-x-3">
                                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                                        <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-emerald-400">Top Performer</p>
                                        <p className="text-white font-semibold mt-1">{bestModel.model}</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Score: {bestModel.score.toFixed(1)}% | Latency: {bestModel.latency_p50.toFixed(2)}s | {bestModel.volume} requests
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="bg-rose-500/5 border-rose-500/20 p-5">
                                <div className="flex items-start space-x-3">
                                    <div className="p-2 bg-rose-500/20 rounded-lg">
                                        <TrendingDown className="w-5 h-5 text-rose-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-rose-400">Needs Attention</p>
                                        <p className="text-white font-semibold mt-1">{worstModel.model}</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Score: {worstModel.score.toFixed(1)}% | Error Rate: {worstModel.error_rate.toFixed(1)}% | {worstModel.volume} requests
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Score by Model */}
                        <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                                <h2 className="text-lg font-semibold text-white">Score by Model</h2>
                                <p className="text-xs text-slate-500 mt-1">Average evaluation score per model</p>
                            </div>
                            <div className="p-6">
                                <div className="h-64 min-w-0">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                        <BarChart data={modelComparison} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                            <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={12} />
                                            <YAxis
                                                type="category"
                                                dataKey="model"
                                                stroke="#64748b"
                                                fontSize={11}
                                                width={100}
                                                tickFormatter={(v) => v.length > 15 ? v.slice(0, 15) + '...' : v}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                                            <Bar dataKey="score" name="Score" radius={[0, 4, 4, 0]}>
                                                {modelComparison.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </Card>

                        {/* Cost vs Score Scatter */}
                        <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                                <h2 className="text-lg font-semibold text-white">Cost vs Quality</h2>
                                <p className="text-xs text-slate-500 mt-1">Bubble size = request volume</p>
                            </div>
                            <div className="p-6">
                                <div className="h-64 min-w-0">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                        <ScatterChart>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis
                                                type="number"
                                                dataKey="x"
                                                name="Cost"
                                                stroke="#64748b"
                                                fontSize={12}
                                                tickFormatter={(v) => `$${v.toFixed(3)}`}
                                            />
                                            <YAxis
                                                type="number"
                                                dataKey="y"
                                                name="Score"
                                                stroke="#64748b"
                                                fontSize={12}
                                                domain={[0, 100]}
                                                tickFormatter={(v) => `${v}%`}
                                            />
                                            <ZAxis type="number" dataKey="z" range={[50, 400]} name="Volume" />
                                            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                                            <Scatter data={scatterData} name="Models">
                                                {scatterData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Scatter>
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Latency Comparison */}
                    <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                            <h2 className="text-lg font-semibold text-white">Latency Comparison (P50 vs P90 vs P95 vs P99)</h2>
                            <p className="text-xs text-slate-500 mt-1">Response time percentiles by model</p>
                        </div>
                        <div className="p-6">
                            <div className="h-64 min-w-0">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <BarChart data={modelComparison}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis
                                            dataKey="model"
                                            stroke="#64748b"
                                            fontSize={11}
                                            tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '...' : v}
                                        />
                                        <YAxis
                                            stroke="#64748b"
                                            fontSize={12}
                                            tickFormatter={(v) => `${v}s`}
                                        />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                                        <Legend />
                                        <Bar dataKey="latency_p50" name="P50 Latency" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="latency_p90" name="P90 Latency" fill="#c084fc" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="latency_p95" name="P95 Latency" fill="#d8b4fe" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="latency_p99" name="P99 Latency" fill="#e9d5ff" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </Card>

                    {/* Model Comparison Table */}
                    <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                            <h2 className="text-lg font-semibold text-white">Model Performance Details</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-slate-900/50 border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Model</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">P50 Latency</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">P90 Latency</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">P95 Latency</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">P99 Latency</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Error Rate</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Requests</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-transparent divide-y divide-slate-800">
                                    {modelComparison.map((model, index) => (
                                        <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div
                                                        className="w-3 h-3 rounded-full mr-3"
                                                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                                    />
                                                    <span className="text-sm font-medium text-white">{model.model}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <span className="text-sm font-medium" style={{ color: getScoreColor(model.score) }}>
                                                        {model.score.toFixed(1)}%
                                                    </span>
                                                    <div className="ml-2 w-16 bg-slate-700 rounded-full h-1.5">
                                                        <div
                                                            className="h-1.5 rounded-full"
                                                            style={{
                                                                width: `${model.score}%`,
                                                                backgroundColor: getScoreColor(model.score)
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                {model.latency_p50.toFixed(3)}s
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                {model.latency_p90.toFixed(3)}s
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                {model.latency_p95?.toFixed(3) || '-'}s
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                {model.latency_p99?.toFixed(3) || '-'}s
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`text-sm font-medium ${model.error_rate > 10 ? 'text-rose-400' : model.error_rate > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                    {model.error_rate.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                ${model.cost.toFixed(4)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                {model.volume.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};
