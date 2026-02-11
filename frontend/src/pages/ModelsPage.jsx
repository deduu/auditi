/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState, useEffect, useMemo } from "react";
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
    Legend,
    ReferenceLine,
} from "recharts";
import {
    Cpu,
    Clock,
    CheckCircle,
    DollarSign,
    AlertTriangle,
    ArrowUpRight,
    TrendingDown,
    Zap,
    ChevronUp,
    ChevronDown,
    Download,
    Search,
    ExternalLink,
} from "lucide-react";
import api from "../api";
import { Card } from "../components/ui/Card";
import { TimeRangeFilter } from "../components/common/TimeRangeFilter";
import { SlidePanel } from "../components/ui/SlidePanel";
import { exportToCSV } from "../utils/exportUtils";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];
const FAILURE_COLORS = ["#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];

const getScoreColor = (score) => {
    if (score >= 75) return "#10b981";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
};

const fmt = (v, decimals = 2) => (typeof v === "number" && isFinite(v) ? v.toFixed(decimals) : "0");

// ============== Tooltip Components ==============

const ScatterTooltipContent = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload;
        return (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                <p className="text-white font-medium mb-2">{d.model}</p>
                <p className="text-xs text-emerald-400">Score: {fmt(d.score, 1)}%</p>
                <p className="text-xs text-amber-400">Cost/Req: ${fmt(d.cost_per_request, 4)}</p>
                <p className="text-xs text-purple-400">P50 Latency: {fmt(d.latency_p50, 3)}s</p>
                <p className="text-xs text-slate-400">Volume: {d.volume?.toLocaleString()} requests</p>
            </div>
        );
    }
    return null;
};

const LatencyTooltipContent = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                <p className="text-slate-300 text-sm font-medium mb-2">{label}</p>
                {payload.map((entry, i) => (
                    <p key={i} className="text-xs" style={{ color: entry.color }}>
                        {entry.name}: {typeof entry.value === "number" ? entry.value.toFixed(3) : entry.value}s
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const FailureTooltipContent = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                <p className="text-slate-300 text-sm font-medium mb-2">{label}</p>
                {payload.map((entry, i) => (
                    <p key={i} className="text-xs" style={{ color: entry.color || FAILURE_COLORS[i] }}>
                        {entry.name}: {entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// ============== Main Component ==============

export const ModelsPage = ({ onNavigate }) => {
    const [modelComparison, setModelComparison] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState("7d");
    const [sortConfig, setSortConfig] = useState({ key: "volume", dir: "desc" });
    const [selectedModel, setSelectedModel] = useState(null);
    const [latencyTab, setLatencyTab] = useState("percentiles");

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

    // ============== Computed Values ==============

    const stats = useMemo(() => {
        const models = modelComparison;
        if (!models.length) return null;

        const totalVolume = models.reduce((a, m) => a + m.volume, 0);
        const totalCost = models.reduce((a, m) => a + m.cost, 0);

        const weightedScore = totalVolume > 0
            ? models.reduce((a, m) => a + m.score * m.volume, 0) / totalVolume
            : 0;
        const weightedLatency = totalVolume > 0
            ? models.reduce((a, m) => a + m.latency_p50 * m.volume, 0) / totalVolume
            : 0;
        const avgCostPerRequest = totalVolume > 0 ? totalCost / totalVolume : 0;

        return { weightedScore, weightedLatency, totalCost, avgCostPerRequest, totalVolume, totalModels: models.length };
    }, [modelComparison]);

    // Best value: lowest cost_per_request among models with score >= 50
    const bestValue = useMemo(() => {
        const eligible = modelComparison.filter((m) => m.score >= 50 && m.cost_per_request > 0);
        if (!eligible.length) return null;
        return eligible.reduce((best, m) => (m.cost_per_request < best.cost_per_request ? m : best));
    }, [modelComparison]);

    // Needs investigation: highest error_rate
    const needsInvestigation = useMemo(() => {
        const withErrors = modelComparison.filter((m) => m.error_rate > 0);
        if (!withErrors.length) return null;
        return withErrors.reduce((worst, m) => (m.error_rate > worst.error_rate ? m : worst));
    }, [modelComparison]);

    // Token efficiency alert: most vs least expensive per 1k tokens
    const tokenAlert = useMemo(() => {
        const withTokens = modelComparison.filter((m) => m.total_tokens > 0 && m.cost_per_1k_tokens > 0);
        if (withTokens.length < 2) return null;
        const sorted = [...withTokens].sort((a, b) => b.cost_per_1k_tokens - a.cost_per_1k_tokens);
        const most = sorted[0];
        const least = sorted[sorted.length - 1];
        const ratio = least.cost_per_1k_tokens > 0 ? most.cost_per_1k_tokens / least.cost_per_1k_tokens : 0;
        return { most, least, ratio };
    }, [modelComparison]);

    // Scatter data: cost_per_request vs score
    const scatterData = useMemo(() => {
        return modelComparison.map((m) => ({
            ...m,
            x: m.cost_per_request,
            y: m.score,
            z: m.volume,
        }));
    }, [modelComparison]);

    const medianCost = useMemo(() => {
        const costs = modelComparison.map((m) => m.cost_per_request).sort((a, b) => a - b);
        if (!costs.length) return 0;
        const mid = Math.floor(costs.length / 2);
        return costs.length % 2 ? costs[mid] : (costs[mid - 1] + costs[mid]) / 2;
    }, [modelComparison]);

    const medianScore = useMemo(() => {
        const scores = modelComparison.map((m) => m.score).sort((a, b) => a - b);
        if (!scores.length) return 50;
        const mid = Math.floor(scores.length / 2);
        return scores.length % 2 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
    }, [modelComparison]);

    // Failure breakdown chart data
    const failureChartData = useMemo(() => {
        const modelsWithErrors = modelComparison.filter((m) => m.failure_modes && m.failure_modes.length > 0);
        if (!modelsWithErrors.length) return { data: [], modes: [] };

        const allModes = new Set();
        modelsWithErrors.forEach((m) => m.failure_modes.forEach((fm) => allModes.add(fm.mode)));
        const modes = [...allModes].slice(0, 6);

        const data = modelsWithErrors.map((m) => {
            const row = { model: m.model };
            modes.forEach((mode) => {
                const found = m.failure_modes.find((fm) => fm.mode === mode);
                row[mode] = found ? found.count : 0;
            });
            return row;
        });

        return { data, modes };
    }, [modelComparison]);

    // Tail ratio data for latency tab 2
    const tailRatioData = useMemo(() => {
        return modelComparison
            .filter((m) => m.latency_p50 > 0)
            .map((m) => ({
                model: m.model,
                ratio: parseFloat((m.latency_p99 / m.latency_p50).toFixed(2)),
            }))
            .sort((a, b) => b.ratio - a.ratio);
    }, [modelComparison]);

    // Sorted table data
    const sortedModels = useMemo(() => {
        const sorted = [...modelComparison];
        sorted.sort((a, b) => {
            const aVal = a[sortConfig.key] ?? 0;
            const bVal = b[sortConfig.key] ?? 0;
            return sortConfig.dir === "asc" ? aVal - bVal : bVal - aVal;
        });
        return sorted;
    }, [modelComparison, sortConfig]);

    const handleSort = (key) => {
        setSortConfig((prev) =>
            prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
        );
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ChevronDown className="w-3 h-3 text-slate-600 ml-1 inline" />;
        return sortConfig.dir === "asc" ? (
            <ChevronUp className="w-3 h-3 text-blue-400 ml-1 inline" />
        ) : (
            <ChevronDown className="w-3 h-3 text-blue-400 ml-1 inline" />
        );
    };

    const handleExport = () => {
        const exportData = modelComparison.map((m) => ({
            Model: m.model,
            Score: m.score,
            "P50 Latency (s)": m.latency_p50,
            "P90 Latency (s)": m.latency_p90,
            "Error Rate (%)": m.error_rate,
            "Error Count": m.error_count,
            "Total Cost ($)": m.cost,
            "Cost/Request ($)": m.cost_per_request,
            "Total Tokens": m.total_tokens,
            "Tokens/Request": m.tokens_per_request,
            "Cost/1K Tokens ($)": m.cost_per_1k_tokens,
            Volume: m.volume,
            "Top Failure Mode": m.failure_modes?.[0]?.mode || "None",
        }));
        exportToCSV(exportData, "models-comparison");
    };

    // ============== Render ==============

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-rose-500">{error}</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Models</h1>
                    <p className="mt-1 text-slate-400">Compare AI model performance, cost efficiency, and reliability</p>
                </div>
                <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
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
                    {/* Section 1: Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="bg-slate-900/50 border-slate-800 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Weighted Avg Score</p>
                                    <p className="text-2xl font-bold mt-1 text-emerald-400">
                                        {fmt(stats.weightedScore, 1)}%
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">by request volume</p>
                                </div>
                                <div className="p-2.5 bg-emerald-500/10 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-slate-900/50 border-slate-800 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Weighted Avg Latency</p>
                                    <p className="text-2xl font-bold mt-1 text-purple-400">
                                        {fmt(stats.weightedLatency, 2)}s
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">P50, by volume</p>
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
                                    <p className="text-2xl font-bold mt-1 text-amber-400">
                                        ${fmt(stats.totalCost, 4)}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">across {stats.totalModels} models</p>
                                </div>
                                <div className="p-2.5 bg-amber-500/10 rounded-lg">
                                    <DollarSign className="w-5 h-5 text-amber-400" />
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-slate-900/50 border-slate-800 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Avg Cost/Request</p>
                                    <p className="text-2xl font-bold mt-1 text-blue-400">
                                        ${fmt(stats.avgCostPerRequest, 4)}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {stats.totalVolume.toLocaleString()} total requests
                                    </p>
                                </div>
                                <div className="p-2.5 bg-blue-500/10 rounded-lg">
                                    <Zap className="w-5 h-5 text-blue-400" />
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Section 2: Insights Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Best Value */}
                        {bestValue ? (
                            <Card
                                className="bg-emerald-500/5 border-emerald-500/20 p-5 cursor-pointer hover:bg-emerald-500/10 transition-colors"
                                onClick={() => onNavigate?.("traces")}
                            >
                                <div className="flex items-start space-x-3">
                                    <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0">
                                        <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-emerald-400">Best Value</p>
                                        <p className="text-white font-semibold mt-1 truncate">{bestValue.model}</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            ${fmt(bestValue.cost_per_request, 4)}/req | Score: {fmt(bestValue.score, 1)}% | {bestValue.volume.toLocaleString()} req
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <Card className="bg-slate-900/30 border-slate-800 p-5">
                                <div className="flex items-start space-x-3">
                                    <div className="p-2 bg-slate-700/50 rounded-lg shrink-0">
                                        <ArrowUpRight className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500">Best Value</p>
                                        <p className="text-xs text-slate-600 mt-1">{"No models with score >= 50%"}</p>
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Needs Investigation */}
                        {needsInvestigation ? (
                            <Card
                                className="bg-rose-500/5 border-rose-500/20 p-5 cursor-pointer hover:bg-rose-500/10 transition-colors"
                                onClick={() => onNavigate?.("failure-modes")}
                            >
                                <div className="flex items-start space-x-3">
                                    <div className="p-2 bg-rose-500/20 rounded-lg shrink-0">
                                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-rose-400">Needs Investigation</p>
                                        <p className="text-white font-semibold mt-1 truncate">{needsInvestigation.model}</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {fmt(needsInvestigation.error_rate, 1)}% errors
                                            {needsInvestigation.failure_modes?.[0] ? ` | Top: ${needsInvestigation.failure_modes[0].mode}` : ""}
                                            {" | "}{needsInvestigation.volume.toLocaleString()} req
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <Card className="bg-slate-900/30 border-slate-800 p-5">
                                <div className="flex items-start space-x-3">
                                    <div className="p-2 bg-slate-700/50 rounded-lg shrink-0">
                                        <AlertTriangle className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500">No Failures</p>
                                        <p className="text-xs text-slate-600 mt-1">All models error-free</p>
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Token Efficiency Alert */}
                        {tokenAlert ? (
                            <Card className="bg-amber-500/5 border-amber-500/20 p-5">
                                <div className="flex items-start space-x-3">
                                    <div className="p-2 bg-amber-500/20 rounded-lg shrink-0">
                                        <TrendingDown className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-amber-400">Token Cost Spread</p>
                                        <p className="text-white font-semibold mt-1">
                                            {fmt(tokenAlert.ratio, 1)}x difference
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            <span className="truncate inline-block max-w-[100px] align-bottom" title={tokenAlert.most.model}>
                                                {tokenAlert.most.model}
                                            </span>
                                            {" "}${fmt(tokenAlert.most.cost_per_1k_tokens, 3)}/1K vs{" "}
                                            <span className="truncate inline-block max-w-[100px] align-bottom" title={tokenAlert.least.model}>
                                                {tokenAlert.least.model}
                                            </span>
                                            {" "}${fmt(tokenAlert.least.cost_per_1k_tokens, 3)}/1K
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <Card className="bg-slate-900/30 border-slate-800 p-5">
                                <div className="flex items-start space-x-3">
                                    <div className="p-2 bg-slate-700/50 rounded-lg shrink-0">
                                        <TrendingDown className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500">Token Efficiency</p>
                                        <p className="text-xs text-slate-600 mt-1">Need 2+ models with token data</p>
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>

                    {/* Section 3: Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Cost Efficiency Scatter */}
                        <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                                <h2 className="text-lg font-semibold text-white">Cost Efficiency</h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    Cost per request vs score — bubble size = volume
                                </p>
                            </div>
                            <div className="p-6">
                                <div className="h-72 min-w-0">
                                    {scatterData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis
                                                    type="number"
                                                    dataKey="x"
                                                    name="Cost/Req"
                                                    stroke="#64748b"
                                                    fontSize={11}
                                                    tickFormatter={(v) => `$${v.toFixed(3)}`}
                                                    label={{ value: "Cost/Request ($)", position: "insideBottom", offset: -5, style: { fill: "#64748b", fontSize: 10 } }}
                                                />
                                                <YAxis
                                                    type="number"
                                                    dataKey="y"
                                                    name="Score"
                                                    stroke="#64748b"
                                                    fontSize={11}
                                                    domain={[0, 100]}
                                                    tickFormatter={(v) => `${v}%`}
                                                    label={{ value: "Score", angle: -90, position: "insideLeft", style: { fill: "#64748b", fontSize: 10 } }}
                                                />
                                                <ZAxis type="number" dataKey="z" range={[60, 500]} name="Volume" />
                                                <ReferenceLine x={medianCost} stroke="#475569" strokeDasharray="4 4" label={{ value: "median cost", position: "top", style: { fill: "#475569", fontSize: 9 } }} />
                                                <ReferenceLine y={medianScore} stroke="#475569" strokeDasharray="4 4" label={{ value: "median score", position: "right", style: { fill: "#475569", fontSize: 9 } }} />
                                                <Tooltip content={<ScatterTooltipContent />} cursor={{ strokeDasharray: "3 3" }} />
                                                <Scatter data={scatterData} name="Models">
                                                    {scatterData.map((entry, i) => (
                                                        <Cell key={`sc-${i}`} fill={COLORS[i % COLORS.length]} />
                                                    ))}
                                                </Scatter>
                                            </ScatterChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-700 rounded-lg">
                                            <span className="text-slate-500 text-sm">No data</span>
                                        </div>
                                    )}
                                </div>
                                {/* Quadrant legend */}
                                <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] text-slate-500">
                                    <span>Top-Left: High quality, low cost</span>
                                    <span className="text-right">Top-Right: High quality, high cost</span>
                                    <span>Bottom-Left: Low quality, low cost</span>
                                    <span className="text-right">Bottom-Right: Low quality, high cost</span>
                                </div>
                            </div>
                        </Card>

                        {/* Failure Breakdown */}
                        <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                                <h2 className="text-lg font-semibold text-white">Failure Breakdown</h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    Failure modes by model — click model rows below for details
                                </p>
                            </div>
                            <div className="p-6">
                                <div className="h-72 min-w-0">
                                    {failureChartData.data.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                            <BarChart data={failureChartData.data} layout="vertical" margin={{ left: 10, right: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                                <XAxis type="number" stroke="#64748b" fontSize={11} />
                                                <YAxis
                                                    type="category"
                                                    dataKey="model"
                                                    stroke="#64748b"
                                                    fontSize={10}
                                                    width={100}
                                                    tickFormatter={(v) => (v.length > 15 ? v.slice(0, 15) + "..." : v)}
                                                />
                                                <Tooltip content={<FailureTooltipContent />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                                {failureChartData.modes.map((mode, i) => (
                                                    <Bar
                                                        key={mode}
                                                        dataKey={mode}
                                                        stackId="failures"
                                                        fill={FAILURE_COLORS[i % FAILURE_COLORS.length]}
                                                        name={mode}
                                                    />
                                                ))}
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-lg">
                                            <CheckCircle className="w-8 h-8 text-emerald-600 mb-2" />
                                            <span className="text-slate-500 text-sm">No failures recorded</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Section 4: Latency Comparison with Tabs */}
                    <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Latency Comparison</h2>
                                <p className="text-xs text-slate-500 mt-1">Response time analysis by model</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setLatencyTab("percentiles")}
                                    className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                                        latencyTab === "percentiles"
                                            ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/25"
                                            : "bg-slate-800/80 text-slate-300 border-slate-600 hover:text-white hover:border-slate-400 hover:bg-slate-700"
                                    }`}
                                >
                                    Percentiles
                                </button>
                                <button
                                    onClick={() => setLatencyTab("tail-ratio")}
                                    className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                                        latencyTab === "tail-ratio"
                                            ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/25"
                                            : "bg-slate-800/80 text-slate-300 border-slate-600 hover:text-white hover:border-slate-400 hover:bg-slate-700"
                                    }`}
                                >
                                    Tail Ratio
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="h-64 min-w-0">
                                {latencyTab === "percentiles" ? (
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                        <BarChart data={modelComparison}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis
                                                dataKey="model"
                                                stroke="#64748b"
                                                fontSize={11}
                                                tickFormatter={(v) => (v.length > 12 ? v.slice(0, 12) + "..." : v)}
                                            />
                                            <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}s`} />
                                            <Tooltip content={<LatencyTooltipContent />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                                            <Legend />
                                            <Bar dataKey="latency_p50" name="P50" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="latency_p90" name="P90" fill="#c084fc" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="latency_p95" name="P95" fill="#d8b4fe" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="latency_p99" name="P99" fill="#e9d5ff" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : tailRatioData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                        <BarChart data={tailRatioData} layout="vertical" margin={{ left: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                            <XAxis type="number" stroke="#64748b" fontSize={11} label={{ value: "P99/P50 Ratio", position: "insideBottom", offset: -5, style: { fill: "#64748b", fontSize: 10 } }} />
                                            <YAxis
                                                type="category"
                                                dataKey="model"
                                                stroke="#64748b"
                                                fontSize={10}
                                                width={100}
                                                tickFormatter={(v) => (v.length > 15 ? v.slice(0, 15) + "..." : v)}
                                            />
                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload?.[0]) {
                                                        return (
                                                            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                                                                <p className="text-white text-sm font-medium">{payload[0].payload.model}</p>
                                                                <p className="text-xs text-purple-400 mt-1">P99/P50 Ratio: {payload[0].value}x</p>
                                                                <p className="text-xs text-slate-500 mt-1">Higher = more inconsistent</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                                            />
                                            <Bar dataKey="ratio" name="Tail Ratio" radius={[0, 4, 4, 0]}>
                                                {tailRatioData.map((entry, i) => (
                                                    <Cell
                                                        key={`tr-${i}`}
                                                        fill={entry.ratio > 5 ? "#ef4444" : entry.ratio > 3 ? "#f59e0b" : "#8b5cf6"}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-700 rounded-lg">
                                        <span className="text-slate-500 text-sm">No latency data with P50 &gt; 0</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Section 5: Enhanced Table */}
                    <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Model Performance Details</h2>
                                <p className="text-xs text-slate-500 mt-1">Click a row for detailed breakdown</p>
                            </div>
                            <button
                                onClick={handleExport}
                                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Export CSV</span>
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-slate-900/50 border-b border-slate-800">
                                    <tr>
                                        {[
                                            { key: "model", label: "Model" },
                                            { key: "score", label: "Score" },
                                            { key: "latency_p50", label: "P50 Latency" },
                                            { key: "latency_p90", label: "P90 Latency" },
                                            { key: "error_rate", label: "Error Rate" },
                                            { key: "cost", label: "Total Cost" },
                                            { key: "cost_per_request", label: "Cost/Req" },
                                            { key: "tokens_per_request", label: "Tokens/Req" },
                                            { key: "volume", label: "Requests" },
                                        ].map((col) => (
                                            <th
                                                key={col.key}
                                                onClick={() => handleSort(col.key)}
                                                className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors select-none"
                                            >
                                                {col.label}
                                                <SortIcon columnKey={col.key} />
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-transparent divide-y divide-slate-800">
                                    {sortedModels.map((model, index) => (
                                        <tr
                                            key={model.model}
                                            onClick={() => setSelectedModel(model)}
                                            className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                                        >
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div
                                                        className="w-3 h-3 rounded-full mr-3 shrink-0"
                                                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                                    />
                                                    <span className="text-sm font-medium text-white">{model.model}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <span className="text-sm font-medium" style={{ color: getScoreColor(model.score) }}>
                                                        {fmt(model.score, 1)}%
                                                    </span>
                                                    <div className="ml-2 w-14 bg-slate-700 rounded-full h-1.5">
                                                        <div
                                                            className="h-1.5 rounded-full"
                                                            style={{ width: `${Math.min(model.score, 100)}%`, backgroundColor: getScoreColor(model.score) }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-300">
                                                {fmt(model.latency_p50, 3)}s
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-300">
                                                {fmt(model.latency_p90, 3)}s
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className={`text-sm font-medium ${model.error_rate > 10 ? "text-rose-400" : model.error_rate > 5 ? "text-amber-400" : "text-emerald-400"}`}>
                                                    {fmt(model.error_rate, 1)}%
                                                </span>
                                                {model.failure_modes?.[0] && (
                                                    <span className="text-xs text-slate-500 ml-1.5" title={model.failure_modes[0].mode}>
                                                        ({model.failure_modes[0].mode.length > 12 ? model.failure_modes[0].mode.slice(0, 12) + "..." : model.failure_modes[0].mode})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-300">
                                                ${fmt(model.cost, 4)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-300">
                                                ${fmt(model.cost_per_request, 4)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-300">
                                                {model.tokens_per_request > 0 ? Math.round(model.tokens_per_request).toLocaleString() : "-"}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-300">
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

            {/* SlidePanel for model detail */}
            <SlidePanel
                isOpen={!!selectedModel}
                onClose={() => setSelectedModel(null)}
                title={selectedModel?.model || "Model Details"}
                defaultWidth={550}
            >
                {selectedModel && (
                    <div className="space-y-6">
                        {/* Key Metrics */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-800/50 rounded-lg p-4">
                                <p className="text-xs text-slate-400">Score</p>
                                <p className="text-xl font-bold mt-1" style={{ color: getScoreColor(selectedModel.score) }}>
                                    {fmt(selectedModel.score, 1)}%
                                </p>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-4">
                                <p className="text-xs text-slate-400">Error Rate</p>
                                <p className={`text-xl font-bold mt-1 ${selectedModel.error_rate > 10 ? "text-rose-400" : selectedModel.error_rate > 5 ? "text-amber-400" : "text-emerald-400"}`}>
                                    {fmt(selectedModel.error_rate, 1)}%
                                </p>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-4">
                                <p className="text-xs text-slate-400">Cost/Request</p>
                                <p className="text-xl font-bold mt-1 text-amber-400">
                                    ${fmt(selectedModel.cost_per_request, 4)}
                                </p>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-4">
                                <p className="text-xs text-slate-400">Volume</p>
                                <p className="text-xl font-bold mt-1 text-white">
                                    {selectedModel.volume.toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {/* Latency Breakdown */}
                        <div>
                            <h3 className="text-sm font-semibold text-slate-300 mb-3">Latency Percentiles</h3>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: "P50", value: selectedModel.latency_p50 },
                                    { label: "P90", value: selectedModel.latency_p90 },
                                    { label: "P95", value: selectedModel.latency_p95 },
                                    { label: "P99", value: selectedModel.latency_p99 },
                                ].map((p) => (
                                    <div key={p.label} className="bg-slate-800/30 rounded-lg p-3 text-center">
                                        <p className="text-xs text-slate-500">{p.label}</p>
                                        <p className="text-sm font-semibold text-purple-400 mt-1">{fmt(p.value, 3)}s</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Token Stats */}
                        <div>
                            <h3 className="text-sm font-semibold text-slate-300 mb-3">Token Usage</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                                    <p className="text-xs text-slate-500">Total</p>
                                    <p className="text-sm font-semibold text-white mt-1">{selectedModel.total_tokens.toLocaleString()}</p>
                                </div>
                                <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                                    <p className="text-xs text-slate-500">Per Request</p>
                                    <p className="text-sm font-semibold text-white mt-1">{Math.round(selectedModel.tokens_per_request).toLocaleString()}</p>
                                </div>
                                <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                                    <p className="text-xs text-slate-500">$/1K Tokens</p>
                                    <p className="text-sm font-semibold text-amber-400 mt-1">${fmt(selectedModel.cost_per_1k_tokens, 4)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Trace Names */}
                        {selectedModel.trace_names?.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-slate-300 mb-3">Trace Types Using This Model</h3>
                                <div className="space-y-2">
                                    {selectedModel.trace_names.map((tn, i) => (
                                        <div key={i} className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-2.5">
                                            <span className="text-sm text-white">{tn.name}</span>
                                            <span className="text-xs text-slate-400 font-medium">{tn.count.toLocaleString()} traces</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Failure Modes */}
                        {selectedModel.failure_modes?.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-slate-300 mb-3">Failure Modes</h3>
                                <div className="space-y-2">
                                    {selectedModel.failure_modes.map((fm, i) => (
                                        <div key={i} className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-2.5">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: FAILURE_COLORS[i % FAILURE_COLORS.length] }} />
                                                <span className="text-sm text-white">{fm.mode}</span>
                                            </div>
                                            <span className="text-xs text-rose-400 font-medium">{fm.count} errors</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* View Traces Button */}
                        <button
                            onClick={() => {
                                setSelectedModel(null);
                                onNavigate?.("traces");
                            }}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            <span>View Traces</span>
                        </button>
                    </div>
                )}
            </SlidePanel>
        </div>
    );
};
