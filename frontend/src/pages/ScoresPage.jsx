/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState, useEffect, useMemo } from "react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
    Target, TrendingUp, AlertTriangle, ExternalLink, Clock,
    BarChart3, ChevronDown, X, Bot, UserCheck
} from "lucide-react";
import api from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SlidePanel } from "../components/ui/SlidePanel";
import { TraceDetailPage } from "./TraceDetailPage";
import { PaginationFooter } from "../components/ui/PaginationFooter";
import { exportToCSV } from "../utils/exportUtils";
import { TimeRangeFilter } from "../components/common/TimeRangeFilter";
import { ChangeIndicator } from "../components/common/ChangeIndicator";
import { ChartCard } from "../components/common/ChartCard";
import { CustomTooltip } from "../components/common/CustomTooltip";
import { EmptyChart } from "../components/common/EmptyChart";
import { CHART_COLORS } from "../utils/constants";

import { InsightsBanner } from "../components/scores/InsightsBanner";

// ─── Helpers ───

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

const getDistributionBarColor = (range) => {
    switch (range) {
        case "75-100": return "bg-emerald-500";
        case "50-75": return "bg-amber-500";
        case "25-50": return "bg-orange-500";
        case "0-25": return "bg-rose-500";
        default: return "bg-slate-500";
    }
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.includes(' ')) return dateStr.split(' ')[1];
    if (dateStr.includes('-W')) return `W${dateStr.split('-W')[1]}`;
    const parts = dateStr.split('-');
    if (parts.length >= 3) return `${parts[1]}/${parts[2]}`;
    return dateStr;
};

const bucketRanges = {
    "0-25": [0, 25],
    "25-50": [25, 50],
    "50-75": [50, 75],
    "75-100": [75, 100]
};

// ─── Section Divider ───

const SectionDivider = ({ icon: Icon, label, sublabel }) => (
    <div className="flex items-center gap-3 pt-2">
        <div className="flex items-center gap-2 shrink-0">
            <Icon className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{label}</span>
        </div>
        {sublabel && <span className="text-xs text-slate-600">{sublabel}</span>}
        <div className="flex-1 h-px bg-slate-800" />
    </div>
);

// ─── Score Distribution (clickable) ───

const ScoreDistributionChart = ({ distribution, loading, activeBucket, onBucketClick }) => {
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
            {distribution.map((bucket) => {
                const isActive = activeBucket === bucket.range;
                return (
                    <div
                        key={bucket.range}
                        className={`space-y-1 p-2 rounded-lg cursor-pointer transition-all ${isActive ? 'ring-2 ring-blue-500 bg-slate-800/50' : 'hover:bg-slate-800/30'}`}
                        onClick={() => onBucketClick?.(isActive ? null : bucket.range)}
                    >
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
                );
            })}
        </div>
    );
};

// ─── Filter Chip (score bucket only) ───

const FilterChip = ({ activeScoreBucket, onClear }) => {
    if (!activeScoreBucket) return null;
    return (
        <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-slate-500">Filter:</span>
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-full">
                Score: {activeScoreBucket}%
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={onClear} />
            </span>
        </div>
    );
};

// ─── Low-Scoring Traces List ───

const LowScoringTracesList = ({ traces, loading, onSelectTrace, activeScoreBucket }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    React.useEffect(() => { setCurrentPage(1); }, [traces, activeScoreBucket]);

    const filteredTraces = useMemo(() => {
        let result = traces || [];
        if (activeScoreBucket && bucketRanges[activeScoreBucket]) {
            const [min, max] = bucketRanges[activeScoreBucket];
            result = result.filter(t => t.score >= min && t.score < (max === 100 ? 101 : max));
        }
        return result;
    }, [traces, activeScoreBucket]);

    if (loading) {
        return (
            <div className="h-48 flex items-center justify-center">
                <div className="text-slate-500">Loading traces...</div>
            </div>
        );
    }

    if (filteredTraces.length === 0) {
        return (
            <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-700 rounded-lg">
                <div className="text-slate-500 text-sm">
                    {activeScoreBucket ? "No traces match the current filter" : "No low-scoring traces found"}
                </div>
            </div>
        );
    }

    const totalPages = Math.ceil(filteredTraces.length / pageSize);
    const paginatedTraces = filteredTraces.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div className="space-y-2">
            {paginatedTraces.map((trace) => (
                <div
                    key={trace.id}
                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group"
                    onClick={() => onSelectTrace(trace.id)}
                >
                    {/* Severity dot */}
                    <div className={`w-1.5 h-8 rounded-full mr-3 shrink-0 ${trace.score < 25 ? 'bg-rose-500' : trace.score < 50 ? 'bg-orange-500' : 'bg-amber-500'}`} />
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
                            {trace.model_name && (
                                <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded">
                                    {trace.model_name}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center space-x-3 mt-1 text-xs text-slate-500">
                            {trace.latency != null && (
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

// ─── Human Annotation Score Trends Chart ───

const AnnotationScoreTrendsChart = ({ scoreTrendsData, loading }) => {
    const chartData = useMemo(() => {
        if (!scoreTrendsData?.data?.length) return [];
        const byDate = {};
        scoreTrendsData.data.forEach(({ date, evaluator_name, value }) => {
            if (!byDate[date]) byDate[date] = { date };
            byDate[date][evaluator_name] = value;
        });
        return Object.values(byDate);
    }, [scoreTrendsData]);

    return (
        <ChartCard
            title="Annotation Score Trends"
            subtitle="Average score per annotation dimension over time"
            info="Tracks how human annotation scores evolve per scoring dimension (e.g. relevance, coherence). A declining trend may indicate regression in quality that your annotators are catching."
        >
            {scoreTrendsData?.total_avg != null && (
                <div className="mb-3">
                    <span className="text-xl font-bold text-emerald-400">{scoreTrendsData.total_avg.toFixed(1)}%</span>
                    <span className="text-slate-400 ml-2 text-sm">Average annotation score</span>
                </div>
            )}
            <div className="h-56">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <span className="text-slate-500 text-sm">Loading annotation trends...</span>
                    </div>
                ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={12} minTickGap={40} />
                            <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} tickFormatter={v => `${v}%`} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }} />
                            <Legend />
                            {(scoreTrendsData?.evaluators || []).map((name, idx) => (
                                <Line key={name} type="monotone" dataKey={name} name={name} stroke={CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} dot={false} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <EmptyChart message="No annotation score data yet — start annotating to see trends" />
                )}
            </div>
        </ChartCard>
    );
};

// ═══════════════════════════════════════════
// ─── Main ScoresPage Component ───
// ═══════════════════════════════════════════

export const ScoresPage = () => {
    const [timeRange, setTimeRange] = useState("7d");
    const [selectedTraceId, setSelectedTraceId] = useState(null);

    // ─── Primary data (LLM-as-a-Judge) ───
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [trends, setTrends] = useState(null);
    const [scoreDistribution, setScoreDistribution] = useState([]);
    const [lowScoringTraces, setLowScoringTraces] = useState({ traces: [], total: 0 });
    const [insights, setInsights] = useState([]);

    // ─── Secondary data ───
    const [evaluations, setEvaluations] = useState([]);
    const [scoreTrendsData, setScoreTrendsData] = useState(null);
    const [secondaryLoading, setSecondaryLoading] = useState(true);

    // ─── Cross-chart filter state ───
    const [activeScoreBucket, setActiveScoreBucket] = useState(null);

    // ─── Evaluation table state ───
    const [expandedEvaluations, setExpandedEvaluations] = useState(new Set());
    const [evalTracesMap, setEvalTracesMap] = useState({});
    const [evalTracesLoadingMap, setEvalTracesLoadingMap] = useState({});
    const [evalPageMap, setEvalPageMap] = useState({});

    // ─── Primary fetch (LLM evaluation data) ───
    useEffect(() => {
        const fetchPrimary = async () => {
            setLoading(true);
            setError(null);
            try {
                const [trendsData, distData, lowScoreData, insightsData] = await Promise.all([
                    api.getTrends(timeRange),
                    api.getScoreDistribution(timeRange),
                    api.getLowScoringTraces({ timeRange, threshold: 50, limit: 50 }),
                    api.getInsights(timeRange)
                ]);
                setTrends(trendsData);
                setScoreDistribution(distData.buckets || []);
                setLowScoringTraces({ traces: lowScoreData.traces || [], total: lowScoreData.total || 0 });
                setInsights(insightsData.insights || []);
            } catch (err) {
                console.error("Failed to fetch primary data:", err);
                setError("Failed to load evaluation data");
            } finally {
                setLoading(false);
            }
        };
        fetchPrimary();
    }, [timeRange]);

    // ─── Secondary fetch (evaluators + annotation trends) ───
    useEffect(() => {
        const fetchSecondary = async () => {
            setSecondaryLoading(true);
            try {
                const [scoreTrends, evalData] = await Promise.all([
                    api.getScoreTrendsByEvaluator({ timeRange, limit: 5 }),
                    api.getEvaluations({ timeRange })
                ]);
                setScoreTrendsData(scoreTrends);
                setEvaluations(evalData.evaluations || []);
            } catch (err) {
                console.error("Failed to fetch secondary data:", err);
            } finally {
                setSecondaryLoading(false);
            }
        };
        fetchSecondary();
    }, [timeRange]);

    // ─── Derived values ───
    const overallScore = trends?.score?.current != null ? trends.score.current : null;
    const scoreChange = trends?.score?.change_percent;
    const errorRate = trends?.error_rate?.current != null ? trends.error_rate.current : null;
    const errorRateChange = trends?.error_rate?.change_percent;

    const avgPassRate = evaluations.length > 0
        ? evaluations.reduce((acc, e) => acc + (e.pass_rate || 0), 0) / evaluations.length
        : null;

    // ─── Expand evaluation row ───
    const handleExpandEvaluation = async (evaluation) => {
        const name = evaluation.name;
        setExpandedEvaluations(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
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

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-rose-500">{error}</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* ════════ Header ════════ */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-white">Scores</h1>
                    <p className="mt-1 text-slate-400">Automated evaluation and human annotation quality metrics</p>
                </div>
                <div className="flex items-center space-x-3">
                    <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
                    <Button variant="outline" size="sm" onClick={() => exportToCSV(evaluations, "scores_report")}>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-96">
                    <div className="text-slate-500">Loading scores...</div>
                </div>
            ) : (
                <>
                    {/* ═══════════════════════════════════════════════════════════
                        LLM-as-a-Judge Section
                       ═══════════════════════════════════════════════════════════ */}
                    <SectionDivider
                        icon={Bot}
                        label="LLM-as-a-Judge"
                        sublabel="Automated evaluation scores from your configured evaluators"
                    />

                    {/* ════════ S1: Summary Cards ════════ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Overall Score */}
                        <Card className="bg-slate-900/50 border-slate-800 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-400 font-medium">Overall Score</p>
                                    <div className="flex items-baseline mt-1">
                                        <p className={`text-3xl font-bold ${overallScore != null ? getScoreColor(overallScore) : 'text-slate-500'}`}>
                                            {overallScore != null ? `${overallScore.toFixed(1)}%` : "—"}
                                        </p>
                                        <ChangeIndicator value={scoreChange} />
                                    </div>
                                </div>
                                <div className="p-3 bg-blue-500/10 rounded-xl">
                                    <Target className="w-6 h-6 text-blue-400" />
                                </div>
                            </div>
                        </Card>

                        {/* Pass Rate */}
                        <Card className="bg-slate-900/50 border-slate-800 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-400 font-medium">Pass Rate</p>
                                    <div className="flex items-baseline mt-1">
                                        <p className={`text-3xl font-bold ${avgPassRate != null ? getScoreColor(avgPassRate) : 'text-slate-500'}`}>
                                            {avgPassRate != null ? `${avgPassRate.toFixed(1)}%` : secondaryLoading ? "..." : "—"}
                                        </p>
                                    </div>
                                </div>
                                <div className="p-3 bg-emerald-500/10 rounded-xl">
                                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                                </div>
                            </div>
                        </Card>

                        {/* Error Rate */}
                        <Card className="bg-slate-900/50 border-slate-800 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-400 font-medium">Error Rate</p>
                                    <div className="flex items-baseline mt-1">
                                        <p className={`text-3xl font-bold ${errorRate != null ? (errorRate < 5 ? 'text-emerald-400' : errorRate < 15 ? 'text-amber-400' : 'text-rose-400') : 'text-slate-500'}`}>
                                            {errorRate != null ? `${errorRate.toFixed(1)}%` : "—"}
                                        </p>
                                        <ChangeIndicator value={errorRateChange} invertColor />
                                    </div>
                                </div>
                                <div className="p-3 bg-rose-500/10 rounded-xl">
                                    <AlertTriangle className="w-6 h-6 text-rose-400" />
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* ════════ S2: Insights Banner ════════ */}
                    <InsightsBanner insights={insights} />

                    {/* ════════ S3: Score Distribution + Low-Scoring Traces ════════ */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ChartCard
                            title="Score Distribution"
                            subtitle="Based on automated LLM evaluation results — click a range to filter traces"
                            info="Distribution of automated evaluation scores. Click a bucket to filter the low-scoring traces list."
                            rightContent={activeScoreBucket && (
                                <button
                                    onClick={() => setActiveScoreBucket(null)}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    Clear filter
                                </button>
                            )}
                        >
                            <ScoreDistributionChart
                                distribution={scoreDistribution}
                                loading={false}
                                activeBucket={activeScoreBucket}
                                onBucketClick={setActiveScoreBucket}
                            />
                        </ChartCard>

                        {/* Inline low-scoring traces preview */}
                        <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Failed & Low-Scoring Traces</h2>
                                    <p className="text-xs text-slate-500 mt-1">Traces that failed or scored below 50% in LLM evaluation</p>
                                </div>
                                <span className="text-xs font-medium text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full">
                                    {lowScoringTraces.total} total
                                </span>
                            </div>
                            <div className="p-4">
                                <FilterChip
                                    activeScoreBucket={activeScoreBucket}
                                    onClear={() => setActiveScoreBucket(null)}
                                />
                                <LowScoringTracesList
                                    traces={lowScoringTraces.traces}
                                    loading={loading}
                                    onSelectTrace={setSelectedTraceId}
                                    activeScoreBucket={activeScoreBucket}
                                />
                            </div>
                        </Card>
                    </div>

                    {/* ════════ S4: Evaluator Performance Table ════════ */}
                    <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                            <h2 className="text-lg font-semibold text-white">LLM Evaluator Performance</h2>
                            <p className="text-xs text-slate-500 mt-1">Automated evaluator breakdown — score, pass rate, cost, and latency per evaluator</p>
                        </div>
                        {secondaryLoading ? (
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
                                                {evaluation.trend != null && (
                                                    <ChangeIndicator value={parseFloat(evaluation.trend)} />
                                                )}
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

                    {/* ═══════════════════════════════════════════════════════════
                        Human Annotation Section
                       ═══════════════════════════════════════════════════════════ */}
                    <SectionDivider
                        icon={UserCheck}
                        label="Human Annotation"
                        sublabel="Scores from manual human review via annotation queues"
                    />

                    {/* ════════ S5: Annotation Score Trends ════════ */}
                    <AnnotationScoreTrendsChart
                        scoreTrendsData={scoreTrendsData}
                        loading={secondaryLoading}
                    />

                </>
            )}

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
