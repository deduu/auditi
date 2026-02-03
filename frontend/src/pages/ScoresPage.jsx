import React, { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, BarChart3, Target, AlertCircle, ExternalLink, Clock, Cpu } from "lucide-react";
import api from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { exportToCSV } from "../utils/exportUtils";

const getScoreColor = (score) => {
    if (score >= 75) return "text-emerald-400";
    if (score >= 50) return "text-amber-400";
    return "text-rose-400";
};

const getProgressColor = (score) => {
    if (score >= 75) return "bg-emerald-500";
    if (score >= 50) return "bg-amber-500";
    return "bg-rose-500";
};

const getTrendColor = (trend) => {
    return trend && trend.startsWith("+") ? "text-emerald-400" : "text-rose-400";
};

const getDistributionBarColor = (range) => {
    switch (range) {
        case "75-100": return "bg-emerald-500";
        case "50-75": return "bg-amber-500";
        case "25-50": return "bg-orange-500";
        case "0-25": return "bg-rose-500";
        default: return "bg-slate-500";
    }
};

const ScoreDistributionChart = ({ distribution, loading }) => {
    if (loading) {
        return (
            <div className="h-48 flex items-center justify-center">
                <div className="text-slate-500">Loading distribution...</div>
            </div>
        );
    }

    const maxCount = Math.max(...distribution.map(b => b.count), 1);

    return (
        <div className="space-y-3">
            {distribution.map((bucket) => (
                <div key={bucket.range} className="space-y-1">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{bucket.range}%</span>
                        <span className="text-slate-300 font-medium">{bucket.count} ({bucket.percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all duration-500 ${getDistributionBarColor(bucket.range)}`}
                            style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

const LowScoringTracesList = ({ traces, loading, total }) => {
    if (loading) {
        return (
            <div className="h-48 flex items-center justify-center">
                <div className="text-slate-500">Loading traces...</div>
            </div>
        );
    }

    if (traces.length === 0) {
        return (
            <div className="h-48 flex items-center justify-center">
                <div className="text-slate-500">No low-scoring traces found</div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {traces.map((trace) => (
                <div
                    key={trace.id}
                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group"
                >
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-white truncate">
                                {trace.name || trace.id.slice(0, 12)}
                            </span>
                            {trace.failure_mode && (
                                <span className="text-xs px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded">
                                    {trace.failure_mode}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center space-x-3 mt-1 text-xs text-slate-500">
                            {trace.model_name && (
                                <span className="flex items-center">
                                    <Cpu className="w-3 h-3 mr-1" />
                                    {trace.model_name}
                                </span>
                            )}
                            {trace.latency && (
                                <span className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {trace.latency.toFixed(2)}s
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <span className={`text-lg font-bold ${getScoreColor(trace.score)}`}>
                            {Math.round(trace.score)}%
                        </span>
                        <ExternalLink className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </div>
            ))}
            {total > traces.length && (
                <div className="text-center pt-2">
                    <span className="text-xs text-slate-500">
                        Showing {traces.length} of {total} low-scoring traces
                    </span>
                </div>
            )}
        </div>
    );
};

export const ScoresPage = () => {
    const [evaluations, setEvaluations] = useState([]);
    const [scoreDistribution, setScoreDistribution] = useState([]);
    const [lowScoringTraces, setLowScoringTraces] = useState({ traces: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [distributionLoading, setDistributionLoading] = useState(true);
    const [tracesLoading, setTracesLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState("7d");

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setDistributionLoading(true);
            setTracesLoading(true);

            try {
                // Fetch all data in parallel
                const [evalData, distData, lowScoreData] = await Promise.all([
                    api.getEvaluations({ timeRange }),
                    api.getScoreDistribution(timeRange),
                    api.getLowScoringTraces({ timeRange, threshold: 50, limit: 5 })
                ]);

                setEvaluations(evalData.evaluations || []);
                setScoreDistribution(distData.buckets || []);
                setLowScoringTraces({
                    traces: lowScoreData.traces || [],
                    total: lowScoreData.total || 0
                });
            } catch (err) {
                console.error("Failed to fetch evaluation data:", err);
                setError("Failed to load evaluation data");
            } finally {
                setLoading(false);
                setDistributionLoading(false);
                setTracesLoading(false);
            }
        };

        fetchData();
    }, [timeRange]);

    const avgScore = evaluations.length > 0
        ? Math.round(evaluations.reduce((acc, e) => acc + e.score, 0) / evaluations.length)
        : 0;

    const totalPassRate = evaluations.length > 0
        ? Math.round(evaluations.reduce((acc, e) => acc + (e.pass_rate || 0), 0) / evaluations.length)
        : 0;

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
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-white">Scores</h1>
                    <p className="mt-1 text-slate-400">Evaluation performance and quality metrics</p>
                </div>
                <div className="flex items-center space-x-3">
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
                    <Button variant="outline" size="sm" onClick={() => exportToCSV(evaluations, "scores_report")}>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-slate-900/50 border-slate-800 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400 font-medium">Overall Score</p>
                            <p className={`text-3xl font-bold mt-1 ${getScoreColor(avgScore)}`}>
                                {loading ? "..." : `${avgScore}%`}
                            </p>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl">
                            <Target className="w-6 h-6 text-blue-400" />
                        </div>
                    </div>
                </Card>

                <Card className="bg-slate-900/50 border-slate-800 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400 font-medium">Pass Rate</p>
                            <p className={`text-3xl font-bold mt-1 ${getScoreColor(totalPassRate)}`}>
                                {loading ? "..." : `${totalPassRate}%`}
                            </p>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-xl">
                            <TrendingUp className="w-6 h-6 text-emerald-400" />
                        </div>
                    </div>
                </Card>

                <Card className="bg-slate-900/50 border-slate-800 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400 font-medium">Total Cost</p>
                            <p className="text-3xl font-bold mt-1 text-amber-400">
                                {loading ? "..." : `$${evaluations.reduce((acc, e) => acc + (e.total_cost || 0), 0).toFixed(4)}`}
                            </p>
                        </div>
                        <div className="p-3 bg-amber-500/10 rounded-xl">
                            <AlertCircle className="w-6 h-6 text-amber-400" />
                        </div>
                    </div>
                </Card>

                <Card className="bg-slate-900/50 border-slate-800 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400 font-medium">Total Tokens</p>
                            <p className="text-3xl font-bold mt-1 text-purple-400">
                                {loading ? "..." : `${(evaluations.reduce((acc, e) => acc + (e.total_tokens || 0), 0) / 1000).toFixed(1)}k`}
                            </p>
                        </div>
                        <div className="p-3 bg-purple-500/10 rounded-xl">
                            <BarChart3 className="w-6 h-6 text-purple-400" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Score Distribution - New! */}
                <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                        <h2 className="text-lg font-semibold text-white">Score Distribution</h2>
                        <p className="text-xs text-slate-500 mt-1">Distribution of evaluation scores</p>
                    </div>
                    <div className="p-6">
                        <ScoreDistributionChart
                            distribution={scoreDistribution}
                            loading={distributionLoading}
                        />
                    </div>
                </Card>

                {/* Low-Scoring Traces - New! */}
                <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Low-Scoring Traces</h2>
                            <p className="text-xs text-slate-500 mt-1">Traces scoring below 50%</p>
                        </div>
                        <span className="text-xs font-medium text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full">
                            {lowScoringTraces.total} total
                        </span>
                    </div>
                    <div className="p-4">
                        <LowScoringTracesList
                            traces={lowScoringTraces.traces}
                            loading={tracesLoading}
                            total={lowScoringTraces.total}
                        />
                    </div>
                </Card>
            </div>

            {/* Evaluation Criteria - Full Width */}
            <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                    <h2 className="text-lg font-semibold text-white">Evaluation Criteria & Metrics</h2>
                    <p className="text-xs text-slate-500 mt-1">Performance breakdown by agent/task type</p>
                </div>
                {loading ? (
                    <div className="h-48 flex items-center justify-center">
                        <div className="text-slate-500">Loading evaluation metrics...</div>
                    </div>
                ) : evaluations.length > 0 ? (
                    <div className="divide-y divide-slate-800">
                        {evaluations.map((evaluation) => (
                            <div key={evaluation.id} className="p-6 hover:bg-slate-800/30 transition-colors">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-3">
                                        <h3 className="text-base font-medium text-white">{evaluation.name}</h3>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 ${getTrendColor(evaluation.trend)}`}>
                                            {evaluation.trend}
                                        </span>
                                    </div>
                                    <span className={`text-2xl font-bold ${getScoreColor(evaluation.score)}`}>
                                        {evaluation.score}%
                                    </span>
                                </div>

                                <div className="flex items-center space-x-6 mb-3 text-xs text-slate-400">
                                    <div className="flex items-center">
                                        <span className="font-medium text-slate-300 mr-1">{evaluation.avg_latency?.toFixed(2)}s</span> latency
                                    </div>
                                    <div className="flex items-center">
                                        <span className="font-medium text-slate-300 mr-1">${evaluation.total_cost?.toFixed(4)}</span> cost
                                    </div>
                                    <div className="flex items-center">
                                        <span className="font-medium text-slate-300 mr-1">{evaluation.total_tokens?.toLocaleString()}</span> tokens
                                    </div>
                                    <div className="flex items-center">
                                        <span className="font-medium text-slate-300 mr-1">{evaluation.pass_rate}%</span> pass rate
                                    </div>
                                    <div className="flex items-center">
                                        <span className="font-medium text-slate-300 mr-1">{evaluation.count}</span> evaluations
                                    </div>
                                </div>

                                <div className="w-full bg-slate-800 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(evaluation.score)}`}
                                        style={{ width: `${evaluation.score}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-48 flex items-center justify-center">
                        <div className="text-slate-500">No evaluations found for this period</div>
                    </div>
                )}
            </Card>
        </div>
    );
};
