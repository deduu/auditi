import React, { useState, useEffect } from "react";
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Target, Clock, DollarSign, AlertTriangle, Activity } from "lucide-react";
import api from "../api";
import { Card } from "../components/ui/Card";

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

const ChartCard = ({ title, subtitle, children }) => (
    <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
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

export const TrendsPage = () => {
    const [trends, setTrends] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState("7d");

    useEffect(() => {
        const fetchTrends = async () => {
            setLoading(true);
            try {
                const data = await api.getTrends(timeRange);
                setTrends(data);
            } catch (err) {
                console.error("Failed to fetch trends:", err);
                setError("Failed to load trends data");
            } finally {
                setLoading(false);
            }
        };

        fetchTrends();
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
        // Handle different date formats
        if (dateStr.includes(' ')) {
            // Hour format: "2024-01-15 14:00"
            return dateStr.split(' ')[1];
        }
        if (dateStr.includes('-W')) {
            // Week format: "2024-W03"
            return `W${dateStr.split('-W')[1]}`;
        }
        // Day format: "2024-01-15"
        const parts = dateStr.split('-');
        return `${parts[1]}/${parts[2]}`;
    };

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-white">Trends</h1>
                    <p className="mt-1 text-slate-400">Track performance metrics over time</p>
                </div>
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

            {loading ? (
                <div className="flex items-center justify-center h-96">
                    <div className="text-slate-500">Loading trends data...</div>
                </div>
            ) : trends ? (
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
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trends.score?.data || []}>
                                    <defs>
                                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
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
                                    <YAxis
                                        domain={[0, 100]}
                                        stroke="#64748b"
                                        fontSize={12}
                                        tickFormatter={(v) => `${v}%`}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        name="Score"
                                        stroke="#3b82f6"
                                        fill="url(#scoreGradient)"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>

                    {/* Two-column charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Latency Over Time */}
                        <ChartCard title="Latency Over Time" subtitle="Average response time (seconds)">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trends.latency?.data || []}>
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
                                            tickFormatter={(v) => `${v}s`}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line
                                            type="monotone"
                                            dataKey="value"
                                            name="Latency"
                                            stroke="#a855f7"
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        {/* Cost Over Time */}
                        <ChartCard title="Cost Over Time" subtitle="Cumulative cost ($)">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trends.cost?.data || []}>
                                        <defs>
                                            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
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
                                            tickFormatter={(v) => `$${v}`}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            name="Cost"
                                            stroke="#f59e0b"
                                            fill="url(#costGradient)"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        {/* Error Rate Over Time */}
                        <ChartCard title="Error Rate Over Time" subtitle="Percentage of failed evaluations">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trends.error_rate?.data || []}>
                                        <defs>
                                            <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
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
                                            domain={[0, 'auto']}
                                            stroke="#64748b"
                                            fontSize={12}
                                            tickFormatter={(v) => `${v}%`}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            name="Error Rate"
                                            stroke="#f43f5e"
                                            fill="url(#errorGradient)"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        {/* Volume Over Time */}
                        <ChartCard title="Request Volume" subtitle="Number of evaluations">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={trends.volume?.data || []}>
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
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar
                                            dataKey="value"
                                            name="Volume"
                                            fill="#10b981"
                                            radius={[4, 4, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>
                    </div>
                </>
            ) : (
                <div className="flex items-center justify-center h-96">
                    <div className="text-slate-500">No trends data available</div>
                </div>
            )}
        </div>
    );
};
