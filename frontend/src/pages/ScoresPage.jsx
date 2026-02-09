/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, BarChart3, Target, AlertCircle, ExternalLink, Clock, Cpu, ChevronDown } from "lucide-react";
import api from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SlidePanel } from "../components/ui/SlidePanel";
import { TraceDetailPage } from "./TraceDetailPage";
import { PaginationFooter } from "../components/ui/PaginationFooter";
import { exportToCSV } from "../utils/exportUtils";
import { TimeRangeFilter } from "../components/common/TimeRangeFilter";

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

const LowScoringTracesList = ({ traces, loading, total, onSelectTrace }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    // Reset page when traces change (e.g. time range switch)
    React.useEffect(() => { setCurrentPage(1); }, [traces]);

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

    const totalPages = Math.ceil(traces.length / pageSize);
    const paginatedTraces = traces.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div className="space-y-2">
            {paginatedTraces.map((trace) => (
                <div
                    key={trace.id}
                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group"
                    onClick={() => onSelectTrace(trace.id)}
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
            {totalPages > 1 && (
                <PaginationFooter
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(newSize) => { setPageSize(newSize); setCurrentPage(1); }}
                    pageSizeOptions={[5, 10, 25]}
                />
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
    const [selectedTraceId, setSelectedTraceId] = useState(null);
    const [expandedEvaluations, setExpandedEvaluations] = useState(new Set());
    const [evalTracesMap, setEvalTracesMap] = useState({});
    const [evalTracesLoadingMap, setEvalTracesLoadingMap] = useState({});
    const [evalPageMap, setEvalPageMap] = useState({});

    const handleExpandEvaluation = async (evaluation) => {
        const name = evaluation.name;
        setExpandedEvaluations(prev => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
        // Only fetch if not already cached
        if (!evalTracesMap[name]) {
            setEvalTracesLoadingMap(prev => ({ ...prev, [name]: true }));
            try {
                const traces = await api.getTraces({ name });
                setEvalTracesMap(prev => ({ ...prev, [name]: traces }));
            } catch (err) {
                console.error("Failed to fetch traces for evaluation:", err);
                setEvalTracesMap(prev => ({ ...prev, [name]: [] }));
            } finally {
                setEvalTracesLoadingMap(prev => ({ ...prev, [name]: false }));
            }
        }
    };

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
                    api.getLowScoringTraces({ timeRange, threshold: 50, limit: 50 })
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
                    <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
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
                            <h2 className="text-lg font-semibold text-white">Failed & Low-Scoring Traces</h2>
                            <p className="text-xs text-slate-500 mt-1">Traces that failed evaluation or scored below 50%</p>
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
                            onSelectTrace={setSelectedTraceId}
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
                            <div key={evaluation.id} className="p-6 hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => handleExpandEvaluation(evaluation)}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-3">
                                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedEvaluations.has(evaluation.name) ? 'rotate-180' : ''}`} />
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

                                {expandedEvaluations.has(evaluation.name) && (
                                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                                        <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">
                                            Individual Traces
                                        </p>
                                        {evalTracesLoadingMap[evaluation.name] ? (
                                            <div className="text-slate-500 text-sm py-4 text-center">Loading traces...</div>
                                        ) : (evalTracesMap[evaluation.name] || []).length === 0 ? (
                                            <div className="text-slate-500 text-sm py-4 text-center">No traces found</div>
                                        ) : (() => {
                                            const allTraces = evalTracesMap[evaluation.name] || [];
                                            const evalPage = evalPageMap[evaluation.name] || 1;
                                            const evalPageSize = 5;
                                            const evalTotalPages = Math.ceil(allTraces.length / evalPageSize);
                                            const paginatedTraces = allTraces.slice((evalPage - 1) * evalPageSize, evalPage * evalPageSize);
                                            return (
                                                <div className="space-y-2">
                                                    {paginatedTraces.map((trace) => (
                                                        <div
                                                            key={trace.id}
                                                            className="flex items-center justify-between p-2.5 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedTraceId(trace.id);
                                                            }}
                                                        >
                                                            <div className="flex items-center space-x-3 min-w-0">
                                                                <span className="text-xs font-mono text-slate-500 shrink-0">
                                                                    {trace.id.slice(0, 8)}
                                                                </span>
                                                                <span className="text-sm text-slate-300 truncate">
                                                                    {trace.userInputPreview || trace.name || "No input"}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center space-x-3 shrink-0">
                                                                {trace.score != null && (
                                                                    <span className={`text-sm font-bold ${getScoreColor(trace.score * 100)}`}>
                                                                        {Math.round(trace.score * 100)}%
                                                                    </span>
                                                                )}
                                                                <span className={`text-xs px-1.5 py-0.5 rounded ${trace.status === 'pass' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                        trace.status === 'fail' ? 'bg-rose-500/20 text-rose-400' :
                                                                            'bg-slate-700 text-slate-400'
                                                                    }`}>
                                                                    {trace.status || 'pending'}
                                                                </span>
                                                                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {evalTotalPages > 1 && (
                                                        <div onClick={(e) => e.stopPropagation()}>
                                                            <PaginationFooter
                                                                currentPage={evalPage}
                                                                totalPages={evalTotalPages}
                                                                pageSize={evalPageSize}
                                                                onPageChange={(page) => setEvalPageMap(prev => ({ ...prev, [evaluation.name]: page }))}
                                                                onPageSizeChange={() => { }}
                                                                pageSizeOptions={[5]}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-48 flex items-center justify-center">
                        <div className="text-slate-500">No evaluations found for this period</div>
                    </div>
                )}
            </Card>

            {/* Slide Panel for Trace Details */}
            <SlidePanel
                isOpen={!!selectedTraceId}
                onClose={() => setSelectedTraceId(null)}
                title="Trace Details"
            >
                {selectedTraceId && (
                    <TraceDetailPage
                        traceId={selectedTraceId}
                        onBack={() => setSelectedTraceId(null)}
                        inPanel={true}
                    />
                )}
            </SlidePanel>
        </div>
    );
};
