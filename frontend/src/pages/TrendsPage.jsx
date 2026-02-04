import React, { useState, useEffect } from "react";
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
    Zap,
    AlertCircle
} from "lucide-react";
import api from "../api";
import { Card } from "../components/ui/Card";

const CORRELATION_COLORS = {
    strong_positive: '#10b981',
    moderate_positive: '#84cc16',
    weak_positive: '#a3e635',
    none: '#64748b',
    weak_negative: '#fbbf24',
    moderate_negative: '#f97316',
    strong_negative: '#ef4444',
};

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

const ChartCard = ({ title, subtitle, children, className = "" }) => (
    <Card className={`bg-slate-900/50 border-slate-800 p-0 overflow-hidden ${className}`}>
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
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

export const TrendsPage = () => {
    const [trends, setTrends] = useState(null);
    const [correlations, setCorrelations] = useState(null);
    const [costForecast, setCostForecast] = useState(null);
    const [anomalies, setAnomalies] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState("7d");
    const [activeTab, setActiveTab] = useState("trends");

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [trendsData, correlationsData, forecastData, anomaliesData] = await Promise.all([
                    api.getTrends(timeRange),
                    api.getCorrelations(timeRange),
                    api.getCostForecast({ timeRange, forecastDays: 7 }),
                    api.getAnomalies({ timeRange })
                ]);
                setTrends(trendsData);
                setCorrelations(correlationsData);
                setCostForecast(forecastData);
                setAnomalies(anomaliesData);
            } catch (err) {
                console.error("Failed to fetch data:", err);
                setError("Failed to load data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [timeRange]);

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-rose-500">{error}</div>
            </div>
        );
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        if (dateStr.includes(' ')) {
            return dateStr.split(' ')[1];
        }
        if (dateStr.includes('-W')) {
            return `W${dateStr.split('-W')[1]}`;
        }
        const parts = dateStr.split('-');
        return `${parts[1]}/${parts[2]}`;
    };

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
                    <div className="flex bg-slate-900/80 border border-slate-800 rounded-lg p-1">
                        {[
                            { id: 'trends', label: 'Trends' },
                            { id: 'anomalies', label: 'Anomalies', badge: anomalies?.total_anomalies || 0 },
                            { id: 'correlations', label: 'Correlations' },
                            { id: 'forecast', label: 'Forecast' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center space-x-1 ${activeTab === tab.id
                                    ? "bg-purple-600 text-white shadow-lg"
                                    : "text-slate-400 hover:text-white"
                                    }`}
                            >
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
                    <div className="flex bg-slate-900/80 border border-slate-800 rounded-lg p-1">
                        {["24h", "7d", "30d", "90d"].map((range) => (
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
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-96">
                    <div className="text-slate-500">Loading data...</div>
                </div>
            ) : (
                <>
                    {/* Trends Tab */}
                    {activeTab === "trends" && trends && (
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

                            {/* Score Over Time */}
                            <ChartCard title="Score Over Time" subtitle="Average evaluation score trend">
                                <div className="h-72 min-w-0">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                        <AreaChart data={trends.score?.data || []}>
                                            <defs>
                                                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={12} />
                                            <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}%`} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area type="monotone" dataKey="value" name="Score" stroke="#3b82f6" fill="url(#scoreGradient)" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>

                            {/* Two-column charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <ChartCard title="Latency Over Time" subtitle="Average response time (seconds)">
                                    <div className="h-64 min-w-0">
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                            <LineChart data={trends.latency?.data || []}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={12} />
                                                <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}s`} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Line type="monotone" dataKey="value" name="Latency" stroke="#a855f7" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartCard>

                                <ChartCard title="Cost Over Time" subtitle="Daily cost ($)">
                                    <div className="h-64 min-w-0">
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                            <AreaChart data={trends.cost?.data || []}>
                                                <defs>
                                                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={12} />
                                                <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `$${v}`} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Area type="monotone" dataKey="value" name="Cost" stroke="#f59e0b" fill="url(#costGradient)" strokeWidth={2} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartCard>

                                <ChartCard title="Error Rate Over Time" subtitle="Percentage of failed evaluations">
                                    <div className="h-64 min-w-0">
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                            <AreaChart data={trends.error_rate?.data || []}>
                                                <defs>
                                                    <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={12} />
                                                <YAxis domain={[0, 'auto']} stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}%`} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Area type="monotone" dataKey="value" name="Error Rate" stroke="#f43f5e" fill="url(#errorGradient)" strokeWidth={2} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartCard>

                                <ChartCard title="Request Volume" subtitle="Number of evaluations">
                                    <div className="h-64 min-w-0">
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                            <BarChart data={trends.volume?.data || []}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={12} />
                                                <YAxis stroke="#64748b" fontSize={12} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Bar dataKey="value" name="Volume" fill="#10b981" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </ChartCard>
                            </div>
                        </>
                    )}

                    {/* Anomalies Tab */}
                    {activeTab === "anomalies" && anomalies && (
                        <div className="space-y-6">
                            {/* Anomaly Summary */}
                            <Card className="bg-slate-900/50 border-slate-800 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-3">
                                        <Zap className="w-5 h-5 text-amber-400" />
                                        <h2 className="text-lg font-semibold text-white">Anomaly Detection</h2>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${anomalies.total_anomalies === 0
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        : anomalies.total_anomalies <= 3
                                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                                        }`}>
                                        {anomalies.total_anomalies} Anomalies Detected
                                    </div>
                                </div>
                                <p className="text-sm text-slate-400">{anomalies.summary}</p>
                            </Card>

                            {/* Anomaly Charts by Metric */}
                            {anomalies.metrics?.filter(m => m.data_points?.length > 0).map((metric) => (
                                <ChartCard
                                    key={metric.metric}
                                    title={`${metric.metric.charAt(0).toUpperCase() + metric.metric.slice(1)} Anomalies`}
                                    subtitle={`Mean: ${metric.mean.toFixed(2)}, Std Dev: ${metric.std_dev.toFixed(2)} | ${metric.anomaly_count} anomalies`}
                                >
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                            <AreaChart data={metric.data_points}>
                                                <defs>
                                                    <linearGradient id={`gradient-${metric.metric}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis
                                                    dataKey="date"
                                                    tickFormatter={formatDate}
                                                    stroke="#64748b"
                                                    fontSize={12}
                                                />
                                                <YAxis stroke="#64748b" fontSize={12} />
                                                <Tooltip
                                                    content={({ active, payload, label }) => {
                                                        if (active && payload && payload.length) {
                                                            const data = payload[0].payload;
                                                            return (
                                                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                                                                    <p className="text-slate-400 text-xs mb-2">{label}</p>
                                                                    <p className="text-sm text-white">Value: {data.value.toFixed(2)}</p>
                                                                    <p className="text-sm text-slate-400">Z-Score: {data.z_score.toFixed(2)}</p>
                                                                    {data.is_anomaly && (
                                                                        <p className="text-sm text-red-400 font-medium mt-1">
                                                                            Anomaly: {data.anomaly_type}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                {/* Reference lines for mean and thresholds */}
                                                <ReferenceLine
                                                    y={metric.mean}
                                                    stroke="#64748b"
                                                    strokeDasharray="3 3"
                                                    label={{ value: 'Mean', position: 'right', fill: '#64748b', fontSize: 10 }}
                                                />
                                                <ReferenceLine
                                                    y={metric.mean + 2 * metric.std_dev}
                                                    stroke="#f59e0b"
                                                    strokeDasharray="3 3"
                                                    label={{ value: '+2σ', position: 'right', fill: '#f59e0b', fontSize: 10 }}
                                                />
                                                <ReferenceLine
                                                    y={metric.mean - 2 * metric.std_dev}
                                                    stroke="#f59e0b"
                                                    strokeDasharray="3 3"
                                                    label={{ value: '-2σ', position: 'right', fill: '#f59e0b', fontSize: 10 }}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="value"
                                                    stroke="#3b82f6"
                                                    fill={`url(#gradient-${metric.metric})`}
                                                    strokeWidth={2}
                                                />
                                                {/* Anomaly points */}
                                                <Scatter
                                                    data={metric.data_points.filter(d => d.is_anomaly)}
                                                    fill="#ef4444"
                                                    shape={(props) => {
                                                        const { cx, cy } = props;
                                                        return (
                                                            <circle
                                                                cx={cx}
                                                                cy={cy}
                                                                r={6}
                                                                fill="#ef4444"
                                                                stroke="#fff"
                                                                strokeWidth={2}
                                                            />
                                                        );
                                                    }}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Anomaly List for this metric */}
                                    {metric.anomalies?.length > 0 && (
                                        <div className="mt-4 border-t border-slate-800 pt-4">
                                            <h4 className="text-sm font-medium text-slate-300 mb-3">Detected Anomalies</h4>
                                            <div className="space-y-2">
                                                {metric.anomalies.map((anomaly, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/20 rounded-lg"
                                                    >
                                                        <div className="flex items-center space-x-3">
                                                            <AlertCircle className="w-4 h-4 text-red-400" />
                                                            <div>
                                                                <p className="text-sm text-white">{anomaly.date}</p>
                                                                <p className="text-xs text-slate-400">
                                                                    Value: {anomaly.value.toFixed(2)} | Z-Score: {anomaly.z_score.toFixed(2)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${anomaly.anomaly_type === 'spike' || anomaly.anomaly_type === 'high'
                                                            ? 'bg-red-500/20 text-red-400'
                                                            : 'bg-blue-500/20 text-blue-400'
                                                            }`}>
                                                            {anomaly.anomaly_type}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </ChartCard>
                            ))}

                            {/* Anomaly Detection Info */}
                            <Card className="bg-blue-500/5 border-blue-500/20 p-6">
                                <div className="flex items-start space-x-3">
                                    <Lightbulb className="w-5 h-5 text-blue-400 mt-0.5" />
                                    <div>
                                        <h3 className="text-sm font-medium text-blue-400 mb-2">About Anomaly Detection</h3>
                                        <ul className="text-xs text-slate-400 space-y-1">
                                            <li className="flex items-center">
                                                <ArrowRight className="w-3 h-3 mr-2 text-blue-400" />
                                                Anomalies are detected using Z-score analysis (threshold: ±2 standard deviations)
                                            </li>
                                            <li className="flex items-center">
                                                <ArrowRight className="w-3 h-3 mr-2 text-blue-400" />
                                                <span className="text-red-400">Spikes/High</span> indicate values significantly above normal
                                            </li>
                                            <li className="flex items-center">
                                                <ArrowRight className="w-3 h-3 mr-2 text-blue-400" />
                                                <span className="text-blue-400">Drops/Low</span> indicate values significantly below normal
                                            </li>
                                            <li className="flex items-center">
                                                <ArrowRight className="w-3 h-3 mr-2 text-blue-400" />
                                                Review anomalies to identify potential issues or opportunities
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </Card>
                        </div>
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
                                    Understanding how different metrics relate to each other can help identify optimization opportunities.
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
                                                                <Tooltip content={<ScatterTooltip />} />
                                                                <Scatter
                                                                    data={corr.data_points}
                                                                    fill={CORRELATION_COLORS[corr.interpretation]}
                                                                    fillOpacity={0.6}
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
                                                tickFormatter={formatDate}
                                                stroke="#64748b"
                                                fontSize={12}
                                            />
                                            <YAxis
                                                stroke="#64748b"
                                                fontSize={12}
                                                tickFormatter={(v) => `$${v.toFixed(3)}`}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
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
        </div>
    );
};
