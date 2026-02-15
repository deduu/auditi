/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine,
    Cell
} from "recharts";
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Target,
    Clock,
    DollarSign,
    AlertTriangle,
    Activity,
    GitBranch,
    Lightbulb,
    ArrowRight,
    ArrowLeft,
    Zap,
    AlertCircle,
    BarChart3,
    CheckCircle,
    Info,
    Eye,
    EyeOff,
    X
} from "lucide-react";
import api from "../api";
import { Card } from "../components/ui/Card";
import { TimeRangeFilter } from "../components/common/TimeRangeFilter";
import { SlidePanel } from "../components/ui/SlidePanel";
import { TraceDetailPage } from "./TraceDetailPage";

const CORRELATION_COLORS = {
    strong_positive: '#10b981',
    moderate_positive: '#84cc16',
    weak_positive: '#a3e635',
    none: '#64748b',
    weak_negative: '#fbbf24',
    moderate_negative: '#f97316',
    strong_negative: '#ef4444',
};

const INSIGHT_STYLES = {
    danger: { bg: 'bg-red-500/5', border: 'border-red-500/20', icon: AlertCircle, iconColor: 'text-red-400', label: 'Critical' },
    warning: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', icon: AlertTriangle, iconColor: 'text-amber-400', label: 'Warning' },
    info: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', icon: Info, iconColor: 'text-blue-400', label: 'Info' },
    success: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', icon: CheckCircle, iconColor: 'text-emerald-400', label: 'Good' },
};

const SEVERITY_ORDER = { danger: 0, warning: 1, info: 2, success: 3 };

const TrendIndicator = ({ value, invertColors = false }) => {
    if (value === 0) {
        return (
            <span className="flex items-center text-slate-400 text-sm">
                <Minus className="w-4 h-4 mr-1" />
                0%
            </span>
        );
    }

    const isPositive = value > 0;
    const isGood = invertColors ? !isPositive : isPositive;

    return (
        <span className={`flex items-center text-sm ${isGood ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
            {isPositive ? '+' : ''}{value.toFixed(1)}%
        </span>
    );
};

const MetricCard = ({ title, value, unit, change, icon: Icon, color, invertTrend = false }) => {
    const colorClasses = {
        blue: 'bg-blue-500/10 text-blue-400',
        emerald: 'bg-emerald-500/10 text-emerald-400',
        amber: 'bg-amber-500/10 text-amber-400',
        rose: 'bg-rose-500/10 text-rose-400',
        purple: 'bg-purple-500/10 text-purple-400',
    };

    return (
        <Card className="bg-slate-900/50 border-slate-800 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-400 font-medium">{title}</p>
                    <p className={`text-3xl font-bold mt-1 text-${color}-400`}>
                        {value}{unit}
                    </p>
                    <div className="mt-2">
                        <TrendIndicator value={change} invertColors={invertTrend} />
                    </div>
                </div>
                <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </Card>
    );
};

const ChartCard = ({ title, subtitle, badge, children, className = "" }) => (
    <Card className={`bg-slate-900/50 border-slate-800 p-0 overflow-hidden ${className}`}>
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <div>
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            </div>
            {badge !== undefined && badge > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                    {badge} anomal{badge === 1 ? 'y' : 'ies'}
                </span>
            )}
        </div>
        <div className="p-6">
            {children}
        </div>
    </Card>
);

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                <p className="text-slate-400 text-xs mb-2">{label}</p>
                {payload.map((entry, index) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
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
                <p className="text-white font-medium text-sm mb-1">{data.label || 'Trace'}</p>
                <p className="text-xs text-slate-400">X: {data.x?.toFixed(3)}</p>
                <p className="text-xs text-slate-400">Y: {data.y?.toFixed(1)}%</p>
                <p className="text-xs text-purple-400 mt-1">Click to view trace</p>
            </div>
        );
    }
    return null;
};

const CorrelationBadge = ({ interpretation, correlation }) => {
    const color = CORRELATION_COLORS[interpretation] || '#64748b';
    const label = interpretation.replace('_', ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase());

    return (
        <div className="flex items-center space-x-2">
            <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
            />
            <span className="text-sm text-slate-300">{label}</span>
            <span className="text-sm font-mono text-slate-400">
                (r = {correlation.toFixed(3)})
            </span>
        </div>
    );
};

// --- Helpers ---

/**
 * Compute ISO date range for a chart bucket based on the time range granularity.
 * - 24h timeRange → 1-hour buckets (date format "YYYY-MM-DD HH:00")
 * - 7d/30d → 1-day buckets (date format "YYYY-MM-DD")
 * - 90d → 1-week buckets (date format "YYYY-Www")
 */
const getBucketDateRange = (dateStr, timeRange) => {
    if (!dateStr) return { date_from: null, date_to: null };

    // Hourly bucket: "2026-02-05 14:00"
    if (dateStr.includes(' ')) {
        const from = new Date(dateStr.replace(' ', 'T') + ':00Z');
        const to = new Date(from.getTime() + 60 * 60 * 1000);
        return { date_from: from.toISOString(), date_to: to.toISOString() };
    }

    // Weekly bucket: "2026-W06"
    if (dateStr.includes('-W')) {
        const [yearStr, weekStr] = dateStr.split('-W');
        const year = parseInt(yearStr);
        const week = parseInt(weekStr);
        // ISO week: Jan 4 is always in week 1
        const jan4 = new Date(Date.UTC(year, 0, 4));
        const dayOfWeek = jan4.getUTCDay() || 7; // Mon=1 ... Sun=7
        const monday = new Date(jan4.getTime() + ((week - 1) * 7 - (dayOfWeek - 1)) * 86400000);
        const nextMonday = new Date(monday.getTime() + 7 * 86400000);
        return { date_from: monday.toISOString(), date_to: nextMonday.toISOString() };
    }

    // Daily bucket: "2026-02-05"
    const from = new Date(dateStr + 'T00:00:00Z');
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    return { date_from: from.toISOString(), date_to: to.toISOString() };
};

// --- Inline sub-components ---

const InsightsPanel = ({ insights }) => {
    if (!insights?.insights?.length) return null;

    const sorted = [...insights.insights].sort(
        (a, b) => (SEVERITY_ORDER[a.type] ?? 3) - (SEVERITY_ORDER[b.type] ?? 3)
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-3">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-semibold text-white">Actionable Insights</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sorted.map((insight, i) => {
                    const style = INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.info;
                    const IconComp = style.icon;
                    return (
                        <Card key={i} className={`${style.bg} ${style.border} p-4`}>
                            <div className="flex items-start space-x-3">
                                <IconComp className={`w-5 h-5 ${style.iconColor} mt-0.5 shrink-0`} />
                                <div className="min-w-0">
                                    <div className="flex items-center space-x-2 mb-1">
                                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${style.bg} ${style.iconColor}`}>
                                            {style.label}
                                        </span>
                                        <h3 className="text-sm font-medium text-white truncate">{insight.title}</h3>
                                    </div>
                                    <p className="text-xs text-slate-400 mb-2">{insight.description}</p>
                                    {insight.metric_value !== undefined && (
                                        <p className="text-xs text-slate-500">
                                            Metric: <span className="text-white font-mono">{typeof insight.metric_value === 'number' ? insight.metric_value.toFixed(2) : insight.metric_value}</span>
                                        </p>
                                    )}
                                    {insight.recommendation && (
                                        <div className="mt-2 flex items-start space-x-1.5">
                                            <ArrowRight className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
                                            <p className="text-xs text-slate-500">{insight.recommendation}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

const DrillDownTraceList = ({ traces, loading, metric, date, onSelectTrace }) => {
    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!traces?.length) {
        return (
            <div className="text-center py-12 text-slate-500">
                No traces found for this time bucket.
            </div>
        );
    }

    return (
        <div className="space-y-3 p-4">
            <div className="mb-4">
                <p className="text-sm text-slate-400">
                    {traces.length} trace{traces.length !== 1 ? 's' : ''} for <span className="text-white font-medium">{date}</span>
                    {metric && <> &middot; <span className="text-slate-300 capitalize">{metric}</span></>}
                </p>
            </div>
            {traces.map((trace) => (
                <button
                    key={trace.id}
                    onClick={() => onSelectTrace(trace.id)}
                    className="w-full text-left p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                    <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">{trace.name || 'Unnamed trace'}</p>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{trace.userInputPreview}</p>
                        </div>
                        <div className="flex items-center space-x-3 ml-3 shrink-0">
                            {trace.score !== null && trace.score !== undefined && (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    trace.score >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                                    trace.score >= 40 ? 'bg-amber-500/20 text-amber-400' :
                                    'bg-red-500/20 text-red-400'
                                }`}>
                                    {trace.score.toFixed(0)}%
                                </span>
                            )}
                            {trace.latencyMs !== undefined && (
                                <span className="text-xs text-slate-500">{(trace.latencyMs / 1000).toFixed(2)}s</span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                                trace.status === 'pass' ? 'bg-emerald-500/20 text-emerald-400' :
                                trace.status === 'fail' ? 'bg-red-500/20 text-red-400' :
                                'bg-slate-500/20 text-slate-400'
                            }`}>
                                {trace.status}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
};

/**
 * TrendChartWithAnomalies - Renders a trend chart with optional anomaly overlay.
 * Merges trend data with anomaly metric data by matching date strings.
 */
const TrendChartWithAnomalies = ({
    metricKey, trendData, anomalyMetric, showAnomalies, onChartClick,
    chartType, stroke, fill, gradientId, yDomain, yFormatter, name
}) => {
    const mergedData = useMemo(() => {
        if (!trendData) return [];
        if (!showAnomalies || !anomalyMetric?.data_points) return trendData;

        const anomalyMap = {};
        for (const pt of anomalyMetric.data_points) {
            anomalyMap[pt.date] = pt;
        }
        return trendData.map(d => {
            const anomaly = anomalyMap[d.date];
            return {
                ...d,
                isAnomaly: anomaly?.is_anomaly || false,
                z_score: anomaly?.z_score,
                anomaly_type: anomaly?.anomaly_type,
            };
        });
    }, [trendData, anomalyMetric, showAnomalies]);

    const anomalyCount = showAnomalies
        ? mergedData.filter(d => d.isAnomaly).length
        : (anomalyMetric?.anomaly_count || 0);

    const handleClick = useCallback((state) => {
        if (state?.activePayload?.[0]?.payload) {
            const point = state.activePayload[0].payload;
            onChartClick(point.date, metricKey);
        }
    }, [onChartClick, metricKey]);

    const renderDot = useCallback((props) => {
        if (!showAnomalies || !props.payload?.isAnomaly) return null;
        return (
            <circle
                key={`anomaly-${props.index}`}
                cx={props.cx}
                cy={props.cy}
                r={6}
                fill="#ef4444"
                stroke="#fff"
                strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                    e.stopPropagation();
                    onChartClick(props.payload.date, metricKey);
                }}
            />
        );
    }, [showAnomalies, onChartClick, metricKey]);

    const tooltipContent = useCallback(({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                    <p className="text-slate-400 text-xs mb-2">{label}</p>
                    <p className="text-sm" style={{ color: stroke }}>
                        {name}: {typeof data.value === 'number' ? data.value.toFixed(2) : data.value}
                    </p>
                    {showAnomalies && data.isAnomaly && (
                        <>
                            <p className="text-xs text-slate-400 mt-1">Z-Score: {data.z_score?.toFixed(2)}</p>
                            <p className="text-sm text-red-400 font-medium">Anomaly: {data.anomaly_type}</p>
                        </>
                    )}
                    <p className="text-xs text-purple-400 mt-1">Click to view traces</p>
                </div>
            );
        }
        return null;
    }, [showAnomalies, stroke, name]);

    const isBar = chartType === 'bar';
    const isLine = chartType === 'line';

    return (
        <ChartCard title={`${name} Over Time`} badge={showAnomalies ? anomalyCount : undefined}>
            <div className={metricKey === 'score' ? "h-72 min-w-0" : "h-64 min-w-0"}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    {isBar ? (
                        <BarChart data={mergedData} onClick={handleClick} style={{ cursor: 'pointer' }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="date" tickFormatter={formatDateHelper} stroke="#64748b" fontSize={12} />
                            <YAxis stroke="#64748b" fontSize={12} domain={yDomain} tickFormatter={yFormatter} />
                            <Tooltip content={tooltipContent} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                            {showAnomalies && anomalyMetric && (
                                <>
                                    <ReferenceLine y={anomalyMetric.mean} stroke="#64748b" strokeDasharray="3 3"
                                        label={{ value: 'Mean', position: 'right', fill: '#64748b', fontSize: 10 }} />
                                    <ReferenceLine y={anomalyMetric.mean + 2 * anomalyMetric.std_dev} stroke="#f59e0b" strokeDasharray="3 3"
                                        label={{ value: '+2\u03c3', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                    <ReferenceLine y={anomalyMetric.mean - 2 * anomalyMetric.std_dev} stroke="#f59e0b" strokeDasharray="3 3"
                                        label={{ value: '-2\u03c3', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                </>
                            )}
                            <Bar dataKey="value" name={name} fill={stroke} radius={[4, 4, 0, 0]}>
                                {showAnomalies && mergedData.map((entry, idx) => (
                                    <Cell key={idx} fill={entry.isAnomaly ? '#ef4444' : stroke} />
                                ))}
                            </Bar>
                        </BarChart>
                    ) : isLine ? (
                        <LineChart data={mergedData} onClick={handleClick} style={{ cursor: 'pointer' }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="date" tickFormatter={formatDateHelper} stroke="#64748b" fontSize={12} />
                            <YAxis stroke="#64748b" fontSize={12} domain={yDomain} tickFormatter={yFormatter} />
                            <Tooltip content={tooltipContent} cursor={{ stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1 }} />
                            {showAnomalies && anomalyMetric && (
                                <>
                                    <ReferenceLine y={anomalyMetric.mean} stroke="#64748b" strokeDasharray="3 3"
                                        label={{ value: 'Mean', position: 'right', fill: '#64748b', fontSize: 10 }} />
                                    <ReferenceLine y={anomalyMetric.mean + 2 * anomalyMetric.std_dev} stroke="#f59e0b" strokeDasharray="3 3"
                                        label={{ value: '+2\u03c3', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                    <ReferenceLine y={anomalyMetric.mean - 2 * anomalyMetric.std_dev} stroke="#f59e0b" strokeDasharray="3 3"
                                        label={{ value: '-2\u03c3', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                </>
                            )}
                            <Line type="monotone" dataKey="value" name={name} stroke={stroke} strokeWidth={2}
                                dot={showAnomalies ? renderDot : false} activeDot={{ r: 4, cursor: 'pointer' }} />
                        </LineChart>
                    ) : (
                        <AreaChart data={mergedData} onClick={handleClick} style={{ cursor: 'pointer' }}>
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={stroke} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={stroke} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="date" tickFormatter={formatDateHelper} stroke="#64748b" fontSize={12} />
                            <YAxis stroke="#64748b" fontSize={12} domain={yDomain} tickFormatter={yFormatter} />
                            <Tooltip content={tooltipContent} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                            {showAnomalies && anomalyMetric && (
                                <>
                                    <ReferenceLine y={anomalyMetric.mean} stroke="#64748b" strokeDasharray="3 3"
                                        label={{ value: 'Mean', position: 'right', fill: '#64748b', fontSize: 10 }} />
                                    <ReferenceLine y={anomalyMetric.mean + 2 * anomalyMetric.std_dev} stroke="#f59e0b" strokeDasharray="3 3"
                                        label={{ value: '+2\u03c3', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                    <ReferenceLine y={anomalyMetric.mean - 2 * anomalyMetric.std_dev} stroke="#f59e0b" strokeDasharray="3 3"
                                        label={{ value: '-2\u03c3', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                </>
                            )}
                            <Area type="monotone" dataKey="value" name={name} stroke={stroke}
                                fill={`url(#${gradientId})`} strokeWidth={2}
                                dot={showAnomalies ? renderDot : false} activeDot={{ r: 4, cursor: 'pointer' }} />
                        </AreaChart>
                    )}
                </ResponsiveContainer>
            </div>
        </ChartCard>
    );
};

// Module-level helper to avoid recreating inside component
const formatDateHelper = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.includes(' ')) return dateStr.split(' ')[1];
    if (dateStr.includes('-W')) return `W${dateStr.split('-W')[1]}`;
    const parts = dateStr.split('-');
    return `${parts[1]}/${parts[2]}`;
};

// --- Main component ---

export const TrendsPage = () => {
    // Per-tab data
    const [trends, setTrends] = useState(null);
    const [anomalies, setAnomalies] = useState(null);
    const [insights, setInsights] = useState(null);
    const [correlations, setCorrelations] = useState(null);
    const [costForecast, setCostForecast] = useState(null);

    // Per-tab loaded flags
    const [overviewLoaded, setOverviewLoaded] = useState(false);
    const [correlationsLoaded, setCorrelationsLoaded] = useState(false);
    const [forecastLoaded, setForecastLoaded] = useState(false);

    // Loading per tab
    const [overviewLoading, setOverviewLoading] = useState(false);
    const [correlationsLoading, setCorrelationsLoading] = useState(false);
    const [forecastLoading, setForecastLoading] = useState(false);

    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState("7d");
    const [activeTab, setActiveTab] = useState("overview");

    // Anomaly overlay toggle
    const [showAnomalies, setShowAnomalies] = useState(false);

    // Drill-down state
    const [drillDownDate, setDrillDownDate] = useState(null);
    const [drillDownMetric, setDrillDownMetric] = useState(null);
    const [drillDownTraces, setDrillDownTraces] = useState([]);
    const [drillDownLoading, setDrillDownLoading] = useState(false);
    const [selectedTraceId, setSelectedTraceId] = useState(null);

    // Build anomaly lookup by metric key
    const anomalyByMetric = useMemo(() => {
        if (!anomalies?.metrics) return {};
        const map = {};
        for (const m of anomalies.metrics) {
            map[m.metric] = m;
        }
        return map;
    }, [anomalies]);

    // --- Per-tab fetch functions ---

    const fetchOverview = useCallback(async (tr) => {
        setOverviewLoading(true);
        try {
            const [trendsData, anomaliesData, insightsData] = await Promise.all([
                api.getTrends(tr),
                api.getAnomalies({ timeRange: tr }),
                api.getInsights(tr)
            ]);
            setTrends(trendsData);
            setAnomalies(anomaliesData);
            setInsights(insightsData);
            setOverviewLoaded(true);
        } catch (err) {
            console.error("Failed to fetch overview data:", err);
            setError("Failed to load overview data");
        } finally {
            setOverviewLoading(false);
        }
    }, []);

    const fetchCorrelations = useCallback(async (tr) => {
        setCorrelationsLoading(true);
        try {
            const data = await api.getCorrelations(tr);
            setCorrelations(data);
            setCorrelationsLoaded(true);
        } catch (err) {
            console.error("Failed to fetch correlations:", err);
            setError("Failed to load correlations data");
        } finally {
            setCorrelationsLoading(false);
        }
    }, []);

    const fetchForecast = useCallback(async (tr) => {
        setForecastLoading(true);
        try {
            const data = await api.getCostForecast({ timeRange: tr, forecastDays: 7 });
            setCostForecast(data);
            setForecastLoaded(true);
        } catch (err) {
            console.error("Failed to fetch forecast:", err);
            setError("Failed to load forecast data");
        } finally {
            setForecastLoading(false);
        }
    }, []);

    // Fetch active tab on mount and when tab changes
    useEffect(() => {
        if (activeTab === "overview" && !overviewLoaded) {
            fetchOverview(timeRange);
        } else if (activeTab === "correlations" && !correlationsLoaded) {
            fetchCorrelations(timeRange);
        } else if (activeTab === "forecast" && !forecastLoaded) {
            fetchForecast(timeRange);
        }
    }, [activeTab, overviewLoaded, correlationsLoaded, forecastLoaded, timeRange, fetchOverview, fetchCorrelations, fetchForecast]);

    // Reset all flags when timeRange changes and reload active tab
    const handleTimeRangeChange = useCallback((newRange) => {
        setTimeRange(newRange);
        setOverviewLoaded(false);
        setCorrelationsLoaded(false);
        setForecastLoaded(false);
        setError(null);
        // Close any open drill-down
        setDrillDownDate(null);
        setSelectedTraceId(null);
    }, []);

    // --- Drill-down handlers ---

    const handleChartClick = useCallback(async (dateStr, metric) => {
        const { date_from, date_to } = getBucketDateRange(dateStr, timeRange);
        if (!date_from) return;

        setDrillDownDate(dateStr);
        setDrillDownMetric(metric);
        setSelectedTraceId(null);
        setDrillDownLoading(true);
        setDrillDownTraces([]);

        try {
            const data = await api.getTraces({ date_from, date_to });
            const traces = data?.items ?? data ?? [];
            setDrillDownTraces(traces);
        } catch (err) {
            console.error("Failed to fetch drill-down traces:", err);
            setDrillDownTraces([]);
        } finally {
            setDrillDownLoading(false);
        }
    }, [timeRange]);

    const handleCloseDrillDown = useCallback(() => {
        setDrillDownDate(null);
        setDrillDownMetric(null);
        setSelectedTraceId(null);
        setDrillDownTraces([]);
    }, []);

    const handleBackFromDetail = useCallback(() => {
        // If opened from trace list, go back to list; if from scatter, close entirely
        if (drillDownDate) {
            setSelectedTraceId(null);
        } else {
            handleCloseDrillDown();
        }
    }, [drillDownDate, handleCloseDrillDown]);

    // Determine if SlidePanel is open
    const isPanelOpen = !!(drillDownDate || selectedTraceId);

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-rose-500">{error}</div>
            </div>
        );
    }

    // Combine historical and forecast data for the chart
    const combinedCostData = costForecast ? [
        ...(costForecast.historical || []).map(h => ({
            date: h.date,
            actual: h.value,
            forecast: null,
            lower: null,
            upper: null
        })),
        ...(costForecast.forecast || []).map(f => ({
            date: f.date,
            actual: null,
            forecast: f.forecast,
            lower: f.lower_bound,
            upper: f.upper_bound
        }))
    ] : [];

    // Total anomaly count for tab badge
    const totalAnomalies = anomalies?.total_anomalies || 0;

    // Current loading state
    const isLoading =
        (activeTab === "overview" && overviewLoading) ||
        (activeTab === "correlations" && correlationsLoading) ||
        (activeTab === "forecast" && forecastLoading);

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-white">Trends</h1>
                    <p className="mt-1 text-slate-400">Track performance metrics, correlations, and forecasts</p>
                </div>
                <div className="flex items-center space-x-3">
                    {/* Tab Selector */}
                    <div className="flex gap-2">
                        {[
                            { id: 'overview', label: 'Overview', icon: TrendingUp, badge: totalAnomalies },
                            { id: 'correlations', label: 'Correlations', icon: GitBranch },
                            { id: 'forecast', label: 'Forecast', icon: BarChart3 }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center space-x-1.5 border ${activeTab === tab.id
                                    ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/25"
                                    : "bg-slate-800/80 text-slate-300 border-slate-600 hover:text-white hover:border-slate-400 hover:bg-slate-700"
                                    }`}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                <span>{tab.label}</span>
                                {tab.badge > 0 && (
                                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.id
                                        ? "bg-white/20 text-white"
                                        : "bg-red-500/20 text-red-400"
                                        }`}>
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Time Range */}
                    <TimeRangeFilter value={timeRange} onChange={handleTimeRangeChange} />
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-96">
                    <div className="text-slate-500">Loading data...</div>
                </div>
            ) : (
                <>
                    {/* Overview Tab (merged Trends + Anomalies + Insights) */}
                    {activeTab === "overview" && trends && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <MetricCard
                                    title="Avg Score"
                                    value={trends.score?.current?.toFixed(1) || 0}
                                    unit="%"
                                    change={trends.score?.change_percent || 0}
                                    icon={Target}
                                    color="blue"
                                />
                                <MetricCard
                                    title="Avg Latency"
                                    value={trends.latency?.current?.toFixed(2) || 0}
                                    unit="s"
                                    change={trends.latency?.change_percent || 0}
                                    icon={Clock}
                                    color="purple"
                                    invertTrend={true}
                                />
                                <MetricCard
                                    title="Total Cost"
                                    value={`$${(trends.cost?.current || 0).toFixed(4)}`}
                                    unit=""
                                    change={trends.cost?.change_percent || 0}
                                    icon={DollarSign}
                                    color="amber"
                                    invertTrend={true}
                                />
                                <MetricCard
                                    title="Error Rate"
                                    value={trends.error_rate?.current?.toFixed(1) || 0}
                                    unit="%"
                                    change={trends.error_rate?.change_percent || 0}
                                    icon={AlertTriangle}
                                    color="rose"
                                    invertTrend={true}
                                />
                                <MetricCard
                                    title="Volume"
                                    value={trends.volume?.current || 0}
                                    unit=""
                                    change={trends.volume?.change_percent || 0}
                                    icon={Activity}
                                    color="emerald"
                                />
                            </div>

                            {/* Anomaly toggle */}
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-400">Click any chart data point to drill down into traces</p>
                                <button
                                    onClick={() => setShowAnomalies(prev => !prev)}
                                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                        showAnomalies
                                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {showAnomalies ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                    <span>Show Anomalies: {showAnomalies ? 'ON' : 'OFF'}</span>
                                    {totalAnomalies > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
                                            {totalAnomalies}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Score Over Time */}
                            <TrendChartWithAnomalies
                                metricKey="score"
                                trendData={trends.score?.data || []}
                                anomalyMetric={anomalyByMetric.score}
                                showAnomalies={showAnomalies}
                                onChartClick={handleChartClick}
                                chartType="area"
                                stroke="#3b82f6"
                                gradientId="scoreGradient"
                                yDomain={[0, 100]}
                                yFormatter={(v) => `${v}%`}
                                name="Score"
                            />

                            {/* Two-column charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <TrendChartWithAnomalies
                                    metricKey="latency"
                                    trendData={trends.latency?.data || []}
                                    anomalyMetric={anomalyByMetric.latency}
                                    showAnomalies={showAnomalies}
                                    onChartClick={handleChartClick}
                                    chartType="line"
                                    stroke="#a855f7"
                                    gradientId="latencyGradient"
                                    yFormatter={(v) => `${v}s`}
                                    name="Latency"
                                />

                                <TrendChartWithAnomalies
                                    metricKey="cost"
                                    trendData={trends.cost?.data || []}
                                    anomalyMetric={anomalyByMetric.cost}
                                    showAnomalies={showAnomalies}
                                    onChartClick={handleChartClick}
                                    chartType="area"
                                    stroke="#f59e0b"
                                    gradientId="costGradient"
                                    yFormatter={(v) => `$${v}`}
                                    name="Cost"
                                />

                                <TrendChartWithAnomalies
                                    metricKey="error_rate"
                                    trendData={trends.error_rate?.data || []}
                                    anomalyMetric={anomalyByMetric.error_rate}
                                    showAnomalies={showAnomalies}
                                    onChartClick={handleChartClick}
                                    chartType="area"
                                    stroke="#f43f5e"
                                    gradientId="errorGradient"
                                    yDomain={[0, 'auto']}
                                    yFormatter={(v) => `${v}%`}
                                    name="Error Rate"
                                />

                                <TrendChartWithAnomalies
                                    metricKey="volume"
                                    trendData={trends.volume?.data || []}
                                    anomalyMetric={anomalyByMetric.volume}
                                    showAnomalies={showAnomalies}
                                    onChartClick={handleChartClick}
                                    chartType="bar"
                                    stroke="#10b981"
                                    gradientId="volumeGradient"
                                    name="Volume"
                                />
                            </div>

                            {/* Insights Panel */}
                            <InsightsPanel insights={insights} />
                        </>
                    )}

                    {/* Correlations Tab */}
                    {activeTab === "correlations" && correlations && (
                        <div className="space-y-6">
                            <Card className="bg-slate-900/50 border-slate-800 p-6">
                                <div className="flex items-center space-x-3 mb-4">
                                    <GitBranch className="w-5 h-5 text-purple-400" />
                                    <h2 className="text-lg font-semibold text-white">Metric Correlations</h2>
                                </div>
                                <p className="text-sm text-slate-400 mb-6">
                                    Understanding how different metrics relate to each other can help identify optimization opportunities. Click any data point to view the trace.
                                </p>

                                {correlations.correlations?.length > 0 ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {correlations.correlations.map((corr, index) => (
                                            <Card key={index} className="bg-slate-800/50 border-slate-700 p-0 overflow-hidden">
                                                <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/30">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium text-white capitalize">
                                                            {corr.x_metric} vs {corr.y_metric}
                                                        </span>
                                                        <CorrelationBadge
                                                            interpretation={corr.interpretation}
                                                            correlation={corr.correlation}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="p-4">
                                                    <div className="h-48">
                                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                            <ScatterChart>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                                <XAxis
                                                                    type="number"
                                                                    dataKey="x"
                                                                    name={corr.x_metric}
                                                                    stroke="#64748b"
                                                                    fontSize={10}
                                                                    tickFormatter={(v) => corr.x_metric === 'cost' ? `$${v.toFixed(3)}` : v.toFixed(1)}
                                                                />
                                                                <YAxis
                                                                    type="number"
                                                                    dataKey="y"
                                                                    name={corr.y_metric}
                                                                    stroke="#64748b"
                                                                    fontSize={10}
                                                                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                                                                />
                                                                <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255, 255, 255, 0.2)' }} />
                                                                <Scatter
                                                                    data={corr.data_points}
                                                                    fill={CORRELATION_COLORS[corr.interpretation]}
                                                                    fillOpacity={0.6}
                                                                    cursor="pointer"
                                                                    onClick={(data) => {
                                                                        if (data?.payload?.id) {
                                                                            setSelectedTraceId(data.payload.id);
                                                                        }
                                                                    }}
                                                                />
                                                            </ScatterChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                    <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                                                        <div className="flex items-start space-x-2">
                                                            <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                                                            <p className="text-xs text-slate-400">{corr.insight}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-slate-500">
                                        Not enough data points for correlation analysis.
                                        Need at least 5 traces with scores.
                                    </div>
                                )}
                            </Card>

                            {/* Correlation Legend */}
                            <Card className="bg-slate-900/50 border-slate-800 p-6">
                                <h3 className="text-sm font-medium text-white mb-4">Correlation Strength Guide</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { key: 'strong_positive', label: 'Strong Positive', desc: 'r > 0.7' },
                                        { key: 'moderate_positive', label: 'Moderate Positive', desc: '0.4 < r < 0.7' },
                                        { key: 'weak_positive', label: 'Weak Positive', desc: '0.2 < r < 0.4' },
                                        { key: 'none', label: 'No Correlation', desc: '-0.2 < r < 0.2' },
                                    ].map(item => (
                                        <div key={item.key} className="flex items-center space-x-2">
                                            <div
                                                className="w-4 h-4 rounded"
                                                style={{ backgroundColor: CORRELATION_COLORS[item.key] }}
                                            />
                                            <div>
                                                <p className="text-xs text-slate-300">{item.label}</p>
                                                <p className="text-xs text-slate-500">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Forecast Tab */}
                    {activeTab === "forecast" && costForecast && (
                        <div className="space-y-6">
                            {/* Forecast Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="bg-slate-900/50 border-slate-800 p-6">
                                    <p className="text-sm text-slate-400 font-medium">Avg Daily Cost</p>
                                    <p className="text-3xl font-bold mt-1 text-amber-400">
                                        ${costForecast.avg_daily_cost?.toFixed(4) || 0}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">Based on {timeRange} data</p>
                                </Card>

                                <Card className="bg-slate-900/50 border-slate-800 p-6">
                                    <p className="text-sm text-slate-400 font-medium">7-Day Projected Cost</p>
                                    <p className="text-3xl font-bold mt-1 text-purple-400">
                                        ${costForecast.projected_total?.toFixed(4) || 0}
                                    </p>
                                    <div className="mt-2">
                                        <TrendIndicator
                                            value={costForecast.projected_change_percent || 0}
                                            invertColors={true}
                                        />
                                    </div>
                                </Card>

                                <Card className="bg-slate-900/50 border-slate-800 p-6">
                                    <p className="text-sm text-slate-400 font-medium">Monthly Projection</p>
                                    <p className="text-3xl font-bold mt-1 text-blue-400">
                                        ${((costForecast.avg_daily_cost || 0) * 30).toFixed(2)}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">At current rate</p>
                                </Card>
                            </div>

                            {/* Forecast Chart */}
                            <ChartCard
                                title="Cost Forecast"
                                subtitle="Historical data + 7-day projection with confidence interval"
                            >
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                        <AreaChart data={combinedCostData}>
                                            <defs>
                                                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={formatDateHelper}
                                                stroke="#64748b"
                                                fontSize={12}
                                            />
                                            <YAxis
                                                stroke="#64748b"
                                                fontSize={12}
                                                tickFormatter={(v) => `$${v.toFixed(3)}`}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                                            <Legend />

                                            {/* Confidence interval area */}
                                            <Area
                                                type="monotone"
                                                dataKey="upper"
                                                stroke="transparent"
                                                fill="#8b5cf6"
                                                fillOpacity={0.1}
                                                name="Upper Bound"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="lower"
                                                stroke="transparent"
                                                fill="#1e1b4b"
                                                fillOpacity={1}
                                                name="Lower Bound"
                                            />

                                            {/* Actual cost */}
                                            <Area
                                                type="monotone"
                                                dataKey="actual"
                                                stroke="#f59e0b"
                                                fill="url(#actualGradient)"
                                                strokeWidth={2}
                                                name="Actual Cost"
                                            />

                                            {/* Forecast */}
                                            <Line
                                                type="monotone"
                                                dataKey="forecast"
                                                stroke="#8b5cf6"
                                                strokeWidth={2}
                                                strokeDasharray="5 5"
                                                dot={false}
                                                name="Forecast"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>

                            {/* Forecast Notes */}
                            <Card className="bg-blue-500/5 border-blue-500/20 p-6">
                                <div className="flex items-start space-x-3">
                                    <Lightbulb className="w-5 h-5 text-blue-400 mt-0.5" />
                                    <div>
                                        <h3 className="text-sm font-medium text-blue-400 mb-2">About This Forecast</h3>
                                        <ul className="text-xs text-slate-400 space-y-1">
                                            <li className="flex items-center">
                                                <ArrowRight className="w-3 h-3 mr-2 text-blue-400" />
                                                Forecast is based on linear trend analysis of historical data
                                            </li>
                                            <li className="flex items-center">
                                                <ArrowRight className="w-3 h-3 mr-2 text-blue-400" />
                                                Shaded area represents 95% confidence interval
                                            </li>
                                            <li className="flex items-center">
                                                <ArrowRight className="w-3 h-3 mr-2 text-blue-400" />
                                                Actual costs may vary based on usage patterns and model selection
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}
                </>
            )}

            {/* Drill-down SlidePanel */}
            <SlidePanel
                isOpen={isPanelOpen}
                onClose={handleCloseDrillDown}
                title={selectedTraceId ? "Trace Details" : `Traces for ${drillDownDate || ''}`}
            >
                {selectedTraceId ? (
                    <TraceDetailPage
                        traceId={selectedTraceId}
                        onBack={handleBackFromDetail}
                        inPanel={true}
                    />
                ) : drillDownDate ? (
                    <DrillDownTraceList
                        traces={drillDownTraces}
                        loading={drillDownLoading}
                        metric={drillDownMetric}
                        date={drillDownDate}
                        onSelectTrace={(id) => setSelectedTraceId(id)}
                    />
                ) : null}
            </SlidePanel>
        </div>
    );
};
