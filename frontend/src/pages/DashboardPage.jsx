import React, { useState, useEffect, useMemo } from "react";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Cell,
    ReferenceLine
} from "recharts";
import {
    ChevronDown,
    Info,
    Maximize2,
    Download
} from "lucide-react";
import api from "../api";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { TimeRangeFilter } from "../components/common/TimeRangeFilter";
import { exportToCSV } from "../utils/exportUtils";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// ============== Reusable Components ==============

const ChangeIndicator = ({ value, invertColor = false }) => {
    if (value === null || value === undefined || !isFinite(value)) return null;
    const isPositive = value > 0;
    const isZero = value === 0;
    const isGood = invertColor ? !isPositive : isPositive;
    return (
        <span className={`inline-flex items-center text-xs font-medium ml-2 ${isZero ? 'text-slate-500' : isGood ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? '↑' : isZero ? '→' : '↓'} {Math.abs(value).toFixed(1)}%
        </span>
    );
};

const EmptyChart = ({ message = "No data" }) => (
    <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-700 rounded-lg bg-slate-900/30">
        <span className="text-slate-500 text-sm">{message}</span>
    </div>
);

const TraceListCard = ({ total, data, traceType, onTypeChange, onShowAll, showAllTraces = false, countsByType, onExpand, isExpanded = false, changePercent }) => {
    const displayData = data && !isExpanded && !showAllTraces ? data.slice(0, 5) : data;

    return (
        <Card className={`bg-slate-900/50 border-slate-800 p-6 flex flex-col ${isExpanded ? '' : 'max-h-96'}`}>
            <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-bold text-white">Traces</h3>
                    {!isExpanded && onExpand && (
                        <button
                            onClick={onExpand}
                            className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors"
                            title="Expand"
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="flex items-baseline space-x-2 mb-4">
                    <span className="text-3xl font-bold text-white">{(total || 0).toLocaleString()}</span>
                    <ChangeIndicator value={changePercent} />
                    <span className="text-sm text-slate-400">Total traces tracked</span>
                </div>
                {/* Underline tabs */}
                <div className="flex items-center gap-5 border-b border-slate-700">
                    {['all', 'agent', 'standalone'].map((type) => {
                        const count = countsByType?.[type];
                        return (
                            <button
                                key={type}
                                onClick={() => onTypeChange(type === 'all' ? null : type)}
                                className={`relative pb-2.5 text-sm font-medium transition-colors duration-200
                                    ${(type === 'all' && !traceType) || traceType === type
                                        ? "text-blue-400"
                                        : "text-slate-400 hover:text-slate-200"
                                    }`}
                            >
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                {count !== undefined && (
                                    <span className="ml-1.5 text-xs text-slate-500">({count.toLocaleString()})</span>
                                )}
                                {((type === 'all' && !traceType) || traceType === type) && (
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {displayData && displayData.length > 0 ? (
                    displayData.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm group hover:bg-slate-800/50 p-2 rounded-md transition-colors cursor-pointer">
                            <div className="flex items-center space-x-3 w-3/4">
                                <div className="w-1 h-8 rounded-full shrink-0 bg-indigo-400/80" />
                                <span className="text-slate-300 truncate font-medium" title={item.name}>{item.name}</span>
                            </div>
                            <span className="text-slate-400 font-medium">{item.count.toLocaleString()}</span>
                        </div>
                    ))
                ) : (
                    <div className="text-slate-500 text-sm text-center py-4">No trace data available</div>
                )}
            </div>

            {!isExpanded && data && data.length > 5 && (
                <button
                    className="flex items-center justify-center w-full mt-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-md transition-all duration-200 cursor-pointer"
                    onClick={onShowAll}
                >
                    <ChevronDown className={`w-4 h-4 mr-1 transition-transform duration-200 ${showAllTraces ? 'rotate-180' : ''}`} />
                    {showAllTraces ? 'Show less' : 'Show all'}
                </button>
            )}
        </Card>
    );
};

const ModelCostTableCard = ({ total, data, onExpand, isExpanded = false, changePercent }) => (
    <Card className={`bg-slate-900/50 border-slate-800 p-6 flex flex-col ${isExpanded ? '' : 'max-h-96'}`}>
        <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white">Model costs</h3>
                {!isExpanded && onExpand && (
                    <button
                        onClick={onExpand}
                        className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors"
                        title="Expand"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                )}
            </div>
            <div className="flex items-center space-x-2">
                <span className="text-3xl font-bold text-white">${(total || 0).toFixed(6)}</span>
                <ChangeIndicator value={changePercent} invertColor />
                <span className="text-sm text-slate-400">Total cost</span>
                <div className="group relative inline-block">
                    <Info className="w-4 h-4 text-slate-500 hover:text-blue-400 cursor-help transition-colors" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl text-xs text-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] pointer-events-none">
                        <div className="font-semibold text-white mb-1">Cost Calculation</div>
                        <p className="leading-relaxed">Total cost is calculated based on input and output token usage across all models, using each model's pricing rates.</p>
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-slate-600"></div>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[200px]">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 font-semibold uppercase sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
                    <tr>
                        <th className="pb-3 text-left">Model</th>
                        <th className="pb-3 text-right">Tokens</th>
                        <th className="pb-3 text-right">USD</th>
                        <th className="pb-3 text-right">Share</th>
                    </tr>
                </thead>
                <tbody className="text-slate-300 divide-y divide-slate-800/50">
                    {data && data.length > 0 ? (
                        data.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                <td className="py-3 pr-2 font-medium truncate max-w-[140px]" title={item.model}>{item.model}</td>
                                <td className="py-3 px-2 text-right text-slate-400">
                                    {item.tokens >= 1000000
                                        ? `${(item.tokens / 1000000).toFixed(2)}M`
                                        : item.tokens >= 1000
                                            ? `${(item.tokens / 1000).toFixed(2)}K`
                                            : item.tokens}
                                </td>
                                <td className="py-3 pl-2 text-right font-medium text-slate-300">
                                    ${item.cost.toFixed(6)}
                                </td>
                                <td className="py-3 pl-2 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${total ? (item.cost / total * 100) : 0}%` }} />
                                        </div>
                                        <span className="text-slate-400 text-xs w-10 text-right">{total ? (item.cost / total * 100).toFixed(1) : 0}%</span>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="4" className="py-4 text-center text-slate-500">No model cost data</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </Card>
);

const ScoreTableCard = ({ total, data, onShowMore, showMore = false, onExpand, isExpanded = false, onNavigate, changePercent }) => (
    <Card className={`bg-slate-900/50 border-slate-800 p-6 flex flex-col ${isExpanded ? '' : 'max-h-96'}`}>
        <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white">Annotation Scores</h3>
                {!isExpanded && onExpand && (
                    <button
                        onClick={onExpand}
                        className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors"
                        title="Expand"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                )}
            </div>
            <div className="flex items-center space-x-2">
                <span className="text-3xl font-bold text-white">{(total || 0).toLocaleString()}</span>
                <ChangeIndicator value={changePercent} />
                <span className="text-sm text-slate-400">Total scores tracked</span>
                <div className="group relative inline-block">
                    <Info className="w-4 h-4 text-slate-500 hover:text-blue-400 cursor-help transition-colors" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl text-xs text-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] pointer-events-none">
                        <div className="font-semibold text-white mb-1">Annotation Scores</div>
                        <p className="leading-relaxed">Scores from manual human annotations only. To start annotating, visit the Human Annotation page.</p>
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-slate-600"></div>
                    </div>
                </div>
            </div>
            {onNavigate && (
                <button
                    onClick={() => onNavigate('human-annotation')}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                    Go to Human Annotation →
                </button>
            )}
        </div>

        <div className={`flex-1 overflow-y-auto custom-scrollbar ${isExpanded ? '' : showMore ? 'max-h-[400px]' : 'max-h-[200px]'}`}>
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 font-semibold uppercase sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
                    <tr>
                        <th className="pb-3 text-left w-1/3">Name</th>
                        <th className="pb-3 text-right">#</th>
                        <th className="pb-3 text-right">Avg</th>
                        <th className="pb-3 text-right text-rose-400/80">0</th>
                        <th className="pb-3 text-right text-emerald-400/80">1</th>
                    </tr>
                </thead>
                <tbody className="text-slate-300 divide-y divide-slate-800/50">
                    {data && data.length > 0 ? (
                        data.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30 transition-colors cursor-pointer">
                                <td className="py-3 pr-2 font-medium truncate max-w-[120px]" title={item.name}>{item.name}</td>
                                <td className="py-3 px-1 text-right text-slate-400">
                                    {item.count >= 1000 ? `${(item.count / 1000).toFixed(2)}K` : item.count}
                                </td>
                                <td className="py-3 px-1 text-right font-medium text-slate-200">{(item.avg * 100).toFixed(0)}%</td>
                                <td className="py-3 px-1 text-right text-rose-400">
                                    {item.fail_count >= 1000 ? `${(item.fail_count / 1000).toFixed(1)}K` : item.fail_count}
                                </td>
                                <td className="py-3 pl-1 text-right text-emerald-400">
                                    {item.pass_count >= 1000 ? `${(item.pass_count / 1000).toFixed(1)}K` : item.pass_count}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="5" className="py-4 text-center text-slate-500">
                                <div>No annotation scores yet</div>
                                {onNavigate && (
                                    <button
                                        onClick={() => onNavigate('human-annotation')}
                                        className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                                    >
                                        Start annotating on the Human Annotation page →
                                    </button>
                                )}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {!isExpanded && (
            <button
                className="flex items-center justify-center w-full mt-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-md transition-all duration-200 cursor-pointer"
                onClick={onShowMore}
            >
                <ChevronDown className={`w-4 h-4 mr-1 transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`} />
                {showMore ? 'Show less' : 'Show top 20'}
            </button>
        )}
    </Card>
);

const ChartCard = ({ title, subtitle, info, children, tabs, activeTab, onTabChange, rightContent }) => (
    <Card className="bg-slate-900/50 border-slate-800 p-0 h-full flex flex-col">
        <div className="px-6 pt-5 pb-0 relative overflow-visible">
            {/* Header row: Title + Right content (filters) */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">{title}</h2>
                        {info && (
                            <div className="group relative inline-block">
                                <Info className="w-4 h-4 text-slate-500 hover:text-blue-400 cursor-help transition-colors" />
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl text-xs text-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] pointer-events-none">
                                    <p className="leading-relaxed">{info}</p>
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-slate-600"></div>
                                </div>
                            </div>
                        )}
                    </div>
                    {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
                </div>
                {rightContent && <div className="flex items-center gap-3">{rightContent}</div>}
            </div>

            {/* Tabs row with underline style */}
            {tabs && (
                <div className="flex items-center gap-6 border-b border-slate-700">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`relative pb-3 text-sm font-medium transition-colors duration-200 whitespace-nowrap
                                ${activeTab === tab.id
                                    ? "text-blue-400"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                        >
                            {tab.label}
                            {activeTab === tab.id && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
        <div className="p-6 flex-1 overflow-hidden">{children}</div>
    </Card>
);

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl z-50">
                <p className="text-slate-400 text-xs mb-2">{label}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between space-x-4 text-sm">
                        <span style={{ color: entry.color }}>{entry.name}:</span>
                        <span className="font-mono text-slate-200">
                            {typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const DropdownFilter = ({ value, options, onChange }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-sm text-slate-300 hover:border-slate-500 transition-all duration-200"
            >
                <span>{value}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 py-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                        {options && options.map(opt => (
                            <button
                                key={opt}
                                onClick={() => { onChange(opt); setIsOpen(false); }}
                                className={`block w-full text-left px-4 py-2 text-sm transition-colors ${value === opt
                                    ? 'bg-blue-600/20 text-blue-400'
                                    : 'text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// ============== Main Dashboard Component ==============

export const DashboardPage = ({ onNavigate }) => {
    const [timeRange, setTimeRange] = useState("7d");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Data states
    const [trends, setTrends] = useState(null);
    const [models, setModels] = useState([]);
    const [dashboardKPIs, setDashboardKPIs] = useState(null);
    const [observationsData, setObservationsData] = useState(null);
    const [latencyData, setLatencyData] = useState(null);
    const [userConsumptionData, setUserConsumptionData] = useState(null);
    const [scoreTrendsData, setScoreTrendsData] = useState(null);

    // UI States
    const [traceType, setTraceType] = useState(null); // null (all), 'agent', 'standalone'
    const [section2LeftTab, setSection2LeftTab] = useState("traces");
    const [section2RightTab, setSection2RightTab] = useState("score");
    const [section3LeftTab, setSection3LeftTab] = useState("token-cost");
    const [latencyPercentile, setLatencyPercentile] = useState("99th Percentile");
    const [selectedModel, setSelectedModel] = useState("All models");
    const [showAllTraces, setShowAllTraces] = useState(false);
    const [showMoreScores, setShowMoreScores] = useState(false);
    const [expandedCard, setExpandedCard] = useState(null); // 'traces' | 'models' | 'scores' | null
    const [healthTab, setHealthTab] = useState("cost");

    // Initial Fetch
    useEffect(() => {
        const fetchBaseData = async () => {
            setLoading(true);
            try {
                const [trendsData, modelsData] = await Promise.all([
                    api.getTrends(timeRange),
                    api.getModelComparison(timeRange)
                ]);
                setTrends(trendsData);
                setModels(modelsData.models || []);
            } catch (err) {
                console.error("Failed to fetch dashboard data:", err);
                setError("Failed to load dashboard data");
            } finally {
                setLoading(false);
            }
        };
        fetchBaseData();
    }, [timeRange]);

    // Fetch KPI data when timeRange or traceType changes
    useEffect(() => {
        const fetchKPIs = async () => {
            try {
                const data = await api.getDashboardKpis({ timeRange, limit: 10, traceType });
                setDashboardKPIs(data);
            } catch (err) {
                console.error("Failed to fetch KPIs:", err);
            }
        };
        fetchKPIs();
    }, [timeRange, traceType]);

    // Reset observations data when timeRange changes
    useEffect(() => {
        setObservationsData(null);
    }, [timeRange]);

    // Fetch latency percentiles data
    useEffect(() => {
        const fetchLatencyData = async () => {
            try {
                const data = await api.getLatencyPercentilesTimeSeries(timeRange);
                setLatencyData(data);
            } catch (err) {
                console.error("Failed to fetch latency data:", err);
                setLatencyData({ trace_latency: [], generation_latency: [], span_latency: [] });
            }
        };
        fetchLatencyData();
    }, [timeRange]);

    // Fetch user consumption data
    useEffect(() => {
        const fetchUserConsumption = async () => {
            try {
                const metric = section3LeftTab === "token-cost" ? "cost" : "count";
                const data = await api.getUserConsumption({ timeRange, metric, limit: 10 });
                setUserConsumptionData(data);
            } catch (err) {
                console.error("Failed to fetch user consumption:", err);
                setUserConsumptionData(null);
            }
        };
        fetchUserConsumption();
    }, [timeRange, section3LeftTab]);

    // Fetch per-evaluator score trends
    useEffect(() => {
        const fetchScoreTrends = async () => {
            try {
                const data = await api.getScoreTrendsByEvaluator({ timeRange, limit: 5 });
                setScoreTrendsData(data);
            } catch (err) {
                console.error("Failed to fetch score trends:", err);
                setScoreTrendsData(null);
            }
        };
        fetchScoreTrends();
    }, [timeRange]);

    // Fetch Observations when tab is active
    useEffect(() => {
        if (section2LeftTab === "observations") {
            const fetchObservations = async () => {
                try {
                    const data = await api.getObservationsByLevel(timeRange);
                    setObservationsData(data);
                } catch (err) {
                    console.error("Failed to fetch observations:", err);
                    setObservationsData({ data: [], levels: [] });
                }
            };
            fetchObservations();
        }
    }, [section2LeftTab, timeRange]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        if (dateStr.includes(' ')) return dateStr.split(' ')[1];
        if (dateStr.includes('-W')) return `W${dateStr.split('-W')[1]}`;
        const parts = dateStr.split('-');
        if (parts.length >= 3) return `${parts[1]}/${parts[2]}`;
        return dateStr;
    };

    // Transform user consumption flat data into Recharts pivot format
    const transformUserConsumptionData = (rawData) => {
        if (!rawData?.data?.length) return [];
        const users = rawData.users || [];
        const byDate = {};
        rawData.data.forEach(({ date, user_id, value }) => {
            if (!byDate[date]) {
                const entry = { date };
                users.forEach(u => { entry[u] = 0; });
                byDate[date] = entry;
            }
            byDate[date][user_id] = value;
        });
        return Object.values(byDate);
    };

    const userConsumptionChartData = useMemo(
        () => transformUserConsumptionData(userConsumptionData),
        [userConsumptionData]
    );

    // Transform score trends flat data into Recharts pivot format
    const transformScoreTrendsData = (rawData) => {
        if (!rawData?.data?.length) return [];
        const byDate = {};
        rawData.data.forEach(({ date, evaluator_name, value }) => {
            if (!byDate[date]) byDate[date] = { date };
            byDate[date][evaluator_name] = value;
        });
        return Object.values(byDate);
    };

    // Export user consumption data as CSV
    const handleExportUserConsumption = async () => {
        try {
            const metric = section3LeftTab === "token-cost" ? "cost" : "count";
            const allData = await api.getUserConsumption({ timeRange, metric, limit: 1000 });
            if (allData?.data?.length) {
                exportToCSV(allData.data, `user_consumption_${metric}`);
            }
        } catch (err) {
            console.error("Failed to export user consumption:", err);
        }
    };

    // Derived Data Calculations
    const totalTraces = trends?.volume?.current || 0;

    // Model Filter Options
    const modelOptions = useMemo(() => ["All models", ...models.map(m => m.model)], [models]);

    // Filter models
    const filteredModels = useMemo(() => {
        if (selectedModel === "All models") return models;
        return models.filter(m => m.model === selectedModel);
    }, [models, selectedModel]);

    // Model Performance Charts Data
    const modelPerformanceData = useMemo(() => {
        if (!filteredModels.length) return [];

        switch (section2RightTab) {
            case "score":
                return [...filteredModels]
                    .filter(m => m.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .map((m, i) => ({ name: m.model, value: m.score, fill: COLORS[i % COLORS.length] }))
                    .slice(0, 7);
            case "error-rate":
                return [...filteredModels]
                    .sort((a, b) => b.error_rate - a.error_rate)
                    .map((m, i) => ({ name: m.model, value: m.error_rate, fill: COLORS[i % COLORS.length] }))
                    .slice(0, 7);
            case "efficiency":
                return [...filteredModels]
                    .filter(m => m.volume > 0)
                    .map(m => ({ ...m, costPerReq: m.cost / m.volume }))
                    .sort((a, b) => a.costPerReq - b.costPerReq)
                    .map((m, i) => ({ name: m.model, value: m.costPerReq, fill: COLORS[i % COLORS.length] }))
                    .slice(0, 7);
            default:
                return [];
        }
    }, [filteredModels, section2RightTab]);

    // Latency percentile data
    const percentileKey = {
        "50th Percentile": "latency_p50",
        "90th Percentile": "latency_p90",
        "95th Percentile": "latency_p95",
        "99th Percentile": "latency_p99"
    }[latencyPercentile] || "latency_p99";

    const modelLatencyData = filteredModels.map((m, i) => ({
        model: m.model,
        latency: m[percentileKey] || 0,
        fill: COLORS[i % COLORS.length]
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
                    <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                    <p className="mt-1 text-slate-400">Overview of your AI system performance</p>
                </div>
                <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-96">
                    <div className="text-slate-500">Loading dashboard...</div>
                </div>
            ) : (
                <>
                    {/* ============== SECTION 1: High-Level KPI Cards ============== */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <TraceListCard
                            total={dashboardKPIs?.traces?.total}
                            data={dashboardKPIs?.traces?.by_name}
                            traceType={traceType}
                            onTypeChange={setTraceType}
                            showAllTraces={showAllTraces}
                            onShowAll={() => setShowAllTraces(!showAllTraces)}
                            countsByType={dashboardKPIs?.traces?.counts_by_type}
                            onExpand={() => setExpandedCard('traces')}
                            changePercent={trends?.volume?.change_percent}
                        />
                        <ModelCostTableCard
                            total={dashboardKPIs?.model_costs?.total}
                            data={dashboardKPIs?.model_costs?.by_model}
                            onExpand={() => setExpandedCard('models')}
                            changePercent={trends?.cost?.change_percent}
                        />
                        <ScoreTableCard
                            total={dashboardKPIs?.scores?.total}
                            data={dashboardKPIs?.scores?.by_evaluator}
                            showMore={showMoreScores}
                            onShowMore={() => setShowMoreScores(!showMoreScores)}
                            onExpand={() => setExpandedCard('scores')}
                            onNavigate={onNavigate}
                            changePercent={trends?.score?.change_percent}
                        />
                    </div>

                    {/* ============== SECTION 2: Activity + Model Usage ============== */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT: Traces by Time */}
                        <ChartCard
                            title={section2LeftTab === "traces" ? "Traces by Time" : "Observations by Level"}
                            info={section2LeftTab === "traces"
                                ? "Track trace volume over time to spot usage spikes or drops. A sudden change may indicate deployment issues or traffic shifts."
                                : "See how different span types (LLM, tool, agent) are distributed over time. A drop in a specific type may signal a broken integration."}
                            tabs={[
                                { id: "traces", label: "Traces" },
                                { id: "observations", label: "Observations by Level" }
                            ]}
                            activeTab={section2LeftTab}
                            onTabChange={setSection2LeftTab}
                        >
                            <div className="mb-4">
                                <span className="text-2xl font-bold text-white">{totalTraces}</span>
                                <span className="text-slate-400 ml-2">Traces tracked</span>
                            </div>
                            <div className="h-64">
                                {section2LeftTab === "traces" ? (
                                    trends?.volume?.data?.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                            <AreaChart data={trends.volume.data}>
                                                <defs>
                                                    <linearGradient id="traceGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={12} minTickGap={40} />
                                                <YAxis stroke="#64748b" fontSize={12} />
                                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                                                {trends.volume.previous > 0 && (
                                                    <ReferenceLine y={trends.volume.previous} stroke="#64748b" strokeDasharray="5 5" label={{ value: "Prev avg", position: "insideTopRight", fill: "#64748b", fontSize: 11 }} />
                                                )}
                                                <Area type="monotone" dataKey="value" name="Traces" stroke="#3b82f6" fill="url(#traceGradient)" strokeWidth={2} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : <EmptyChart />
                                ) : (
                                    !observationsData ? (
                                        <div className="h-full flex items-center justify-center">
                                            <span className="text-slate-500 text-sm">Loading observations...</span>
                                        </div>
                                    ) : observationsData?.data?.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                            <AreaChart data={observationsData.data}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={12} minTickGap={40} />
                                                <YAxis stroke="#64748b" fontSize={12} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend />
                                                {observationsData.levels.map((level, i) => (
                                                    <Area
                                                        key={level}
                                                        type="monotone"
                                                        dataKey={level}
                                                        stackId="1"
                                                        stroke={COLORS[i % COLORS.length]}
                                                        fill={COLORS[i % COLORS.length]}
                                                        fillOpacity={0.6}
                                                    />
                                                ))}
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : <EmptyChart message="No observation data" />
                                )}
                            </div>
                        </ChartCard>

                        {/* RIGHT: Model Performance */}
                        <ChartCard
                            title="Model Performance"
                            subtitle="Compare models by quality, reliability, and efficiency"
                            info="Compare models side-by-side on quality (score), reliability (error rate), and cost efficiency (cost per request) to decide which model to use or optimize."
                            tabs={[
                                { id: "score", label: "Avg Score" },
                                { id: "error-rate", label: "Error Rate" },
                                { id: "efficiency", label: "Cost / Request" }
                            ]}
                            activeTab={section2RightTab}
                            onTabChange={setSection2RightTab}
                            rightContent={<DropdownFilter value={selectedModel} options={modelOptions} onChange={setSelectedModel} />}
                        >
                            {(() => {
                                const headlineConfig = {
                                    score: {
                                        value: filteredModels.length ? (filteredModels.reduce((a, m) => a + m.score, 0) / filteredModels.length).toFixed(1) + "%" : "—",
                                        label: "Avg score across models",
                                        color: "text-emerald-400",
                                        xFormat: (v) => `${v.toFixed(0)}%`,
                                        barName: "Score",
                                    },
                                    "error-rate": {
                                        value: filteredModels.length ? (filteredModels.reduce((a, m) => a + m.error_rate, 0) / filteredModels.length).toFixed(2) + "%" : "—",
                                        label: "Avg error rate",
                                        color: "text-rose-400",
                                        xFormat: (v) => `${v.toFixed(1)}%`,
                                        barName: "Error Rate",
                                    },
                                    efficiency: {
                                        value: filteredModels.length && filteredModels.some(m => m.volume > 0)
                                            ? "$" + (filteredModels.reduce((a, m) => a + m.cost, 0) / filteredModels.reduce((a, m) => a + m.volume, 0)).toFixed(6)
                                            : "—",
                                        label: "Avg cost per request",
                                        color: "text-amber-400",
                                        xFormat: (v) => `$${v.toFixed(4)}`,
                                        barName: "Cost/Req",
                                    },
                                };
                                const h = headlineConfig[section2RightTab];
                                return (
                                    <>
                                        <div className="mb-4">
                                            <span className={`text-2xl font-bold ${h.color}`}>{h.value}</span>
                                            <span className="text-slate-400 ml-2">{h.label}</span>
                                        </div>
                                        <div className="h-64">
                                            {modelPerformanceData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                    <BarChart data={modelPerformanceData} layout="vertical">
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                                        <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={h.xFormat} />
                                                        <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={120} tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + '...' : v} />
                                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                                                        <Bar dataKey="value" name={h.barName} radius={[0, 4, 4, 0]}>
                                                            {modelPerformanceData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <EmptyChart message="No model performance data" />
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </ChartCard>
                    </div>

                    {/* ============== SECTION 3: User Consumption + Score Trends ============== */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT: User consumption */}
                        <ChartCard
                            title="User consumption"
                            subtitle={`Showing top 10 users by ${section3LeftTab === "token-cost" ? "token cost" : "trace count"}. Export for full data.`}
                            info="Identify which users are driving the most cost or usage. Use this to detect runaway consumers, allocate budgets, or investigate unusual activity."
                            tabs={[
                                { id: "token-cost", label: "Token cost" },
                                { id: "trace-count", label: "Count of Traces" }
                            ]}
                            activeTab={section3LeftTab}
                            onTabChange={setSection3LeftTab}
                            rightContent={
                                <button
                                    onClick={handleExportUserConsumption}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-lg text-xs text-slate-300 hover:border-slate-500 hover:text-white transition-all"
                                    title="Export all user data as CSV"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Export
                                </button>
                            }
                        >
                            <div className="mb-4">
                                <span className="text-2xl font-bold text-blue-400">
                                    {userConsumptionData
                                        ? section3LeftTab === "token-cost"
                                            ? `$${(userConsumptionData.total || 0).toFixed(4)}`
                                            : (userConsumptionData.total || 0).toLocaleString()
                                        : "—"}
                                </span>
                                <span className="text-slate-400 ml-2">
                                    {section3LeftTab === "token-cost" ? "Total cost" : "Total traces"}
                                </span>
                            </div>
                            <div className="h-64">
                                {!userConsumptionData ? (
                                    <div className="h-full flex items-center justify-center">
                                        <span className="text-slate-500 text-sm">Loading user consumption...</span>
                                    </div>
                                ) : userConsumptionData.data?.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                        <LineChart data={userConsumptionChartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={12} minTickGap={40} />
                                            <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => section3LeftTab === "token-cost" ? `$${v.toFixed(2)}` : v} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1 }} />
                                            <Legend />
                                            {userConsumptionData.users.map((userId, idx) => (
                                                <Line key={userId} type="monotone" dataKey={userId} name={userId} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={userConsumptionChartData.length <= 2} />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <EmptyChart message="No user consumption data available" />
                                )}
                            </div>
                        </ChartCard>

                        {/* RIGHT: Scores by evaluator */}
                        <ChartCard
                            title="Scores"
                            subtitle="Average score per evaluator over time"
                            info="Track how each evaluator's scores trend over time. A declining score for a specific evaluator may indicate degrading quality in that area."
                        >
                            <div className="mb-4">
                                <span className="text-2xl font-bold text-emerald-400">
                                    {scoreTrendsData ? `${scoreTrendsData.total_avg.toFixed(1)}%` : trends?.score?.current ? `${(trends.score.current).toFixed(1)}%` : "—"}
                                </span>
                                <span className="text-slate-400 ml-2">Average score</span>
                            </div>
                            <div className="h-60">
                                {scoreTrendsData?.data?.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                        <LineChart data={transformScoreTrendsData(scoreTrendsData)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={12} minTickGap={40} />
                                            <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}%`} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1 }} />
                                            <Legend />
                                            {scoreTrendsData.evaluators.map((name, idx) => (
                                                <Line key={name} type="monotone" dataKey={name} name={name} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={false} />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : trends?.score?.data?.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                        <LineChart data={trends.score.data}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={12} minTickGap={40} />
                                            <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}%`} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1 }} />
                                            <Line type="monotone" dataKey="value" name="Score" stroke="#10b981" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <EmptyChart />
                                )}
                            </div>
                        </ChartCard>
                    </div>

                    {/* ============== SECTION 4: Latency Percentiles ============== */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { title: "Trace latency percentiles", key: "trace_latency", info: "End-to-end latency of full traces at P50/P90/P95/P99. A widening gap between P50 and P99 indicates inconsistent performance affecting some users." },
                            { title: "Generation latency percentiles", key: "generation_latency", info: "LLM generation call latency at each percentile. Use this to identify if slow responses are caused by the LLM provider." },
                            { title: "Span latency percentiles", key: "span_latency", info: "Processing time across all span types. Compare with trace latency to understand how much overhead your application adds beyond LLM calls." },
                        ].map(({ title, key, info }) => (
                            <ChartCard key={key} title={title} info={info}>
                                <div className="h-48">
                                    {!latencyData ? (
                                        <div className="h-full flex items-center justify-center">
                                            <span className="text-slate-500 text-sm">Loading...</span>
                                        </div>
                                    ) : latencyData[key]?.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                            <LineChart data={latencyData[key]}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={11} minTickGap={40} />
                                                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}s`} />
                                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1 }} />
                                                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                                                <Line type="monotone" dataKey="p50" name="P50" stroke="#10b981" strokeWidth={2} dot={false} />
                                                <Line type="monotone" dataKey="p90" name="P90" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                                <Line type="monotone" dataKey="p95" name="P95" stroke="#ef4444" strokeWidth={2} dot={false} />
                                                <Line type="monotone" dataKey="p99" name="P99" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyChart message={`No ${title.toLowerCase().replace(' percentiles', '')} data`} />
                                    )}
                                </div>
                            </ChartCard>
                        ))}
                    </div>

                    {/* ============== SECTION 5: Model Latencies ============== */}
                    <ChartCard
                        title="Model latencies"
                        subtitle="Latencies (seconds) per LLM generation"
                        info="Compare response times across models at different percentiles. Use this to choose faster models or identify models that need caching or optimization."
                        tabs={[
                            { id: "50th Percentile", label: "50th Percentile" },
                            { id: "90th Percentile", label: "90th Percentile" },
                            { id: "95th Percentile", label: "95th Percentile" },
                            { id: "99th Percentile", label: "99th Percentile" }
                        ]}
                        activeTab={latencyPercentile}
                        onTabChange={setLatencyPercentile}
                        rightContent={
                            <DropdownFilter value={selectedModel} options={modelOptions} onChange={setSelectedModel} />
                        }
                    >
                        <div className="h-80">
                            {modelLatencyData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <BarChart data={modelLatencyData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="model" stroke="#64748b" fontSize={11} tickFormatter={(v) => v.length > 15 ? v.slice(0, 15) + '...' : v} />
                                        <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}s`} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                                        <Bar dataKey="latency" name={`Latency (${latencyPercentile})`} radius={[4, 4, 0, 0]}>
                                            {modelLatencyData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyChart />
                            )}
                        </div>
                    </ChartCard>

                    {/* ============== SECTION 6: System Health Trends ============== */}
                    <ChartCard
                        title="System Health"
                        subtitle="Cost, latency, and error rate trends over time"
                        info="Monitor operational health at a glance. Rising costs, increasing latency, or growing error rates are early warning signs that need investigation."
                        tabs={[
                            { id: "cost", label: "Cost" },
                            { id: "latency", label: "Latency" },
                            { id: "error-rate", label: "Error Rate" }
                        ]}
                        activeTab={healthTab}
                        onTabChange={setHealthTab}
                    >
                        {(() => {
                            const config = {
                                cost: {
                                    data: trends?.cost?.data,
                                    current: trends?.cost?.current,
                                    change: trends?.cost?.change_percent,
                                    label: "Total cost",
                                    format: (v) => `$${(v || 0).toFixed(4)}`,
                                    yFormat: (v) => `$${v.toFixed(2)}`,
                                    color: "#f59e0b",
                                    gradientId: "costGradient",
                                    invertColor: true,
                                },
                                latency: {
                                    data: trends?.latency?.data,
                                    current: trends?.latency?.current,
                                    change: trends?.latency?.change_percent,
                                    label: "Avg latency",
                                    format: (v) => `${(v || 0).toFixed(2)}s`,
                                    yFormat: (v) => `${v.toFixed(1)}s`,
                                    color: "#8b5cf6",
                                    gradientId: "latencyGradient",
                                    invertColor: true,
                                },
                                "error-rate": {
                                    data: trends?.error_rate?.data,
                                    current: trends?.error_rate?.current,
                                    change: trends?.error_rate?.change_percent,
                                    label: "Error rate",
                                    format: (v) => `${(v || 0).toFixed(2)}%`,
                                    yFormat: (v) => `${v.toFixed(1)}%`,
                                    color: "#ef4444",
                                    gradientId: "errorGradient",
                                    invertColor: true,
                                },
                            };
                            const c = config[healthTab];
                            return (
                                <>
                                    <div className="mb-4 flex items-baseline">
                                        <span className="text-2xl font-bold text-white">{c.format(c.current)}</span>
                                        <ChangeIndicator value={c.change} invertColor={c.invertColor} />
                                        <span className="text-slate-400 ml-2">{c.label}</span>
                                    </div>
                                    <div className="h-72">
                                        {c.data?.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                <AreaChart data={c.data}>
                                                    <defs>
                                                        <linearGradient id={c.gradientId} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor={c.color} stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                    <XAxis dataKey="date" tickFormatter={formatDate} stroke="#64748b" fontSize={12} minTickGap={40} />
                                                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={c.yFormat} />
                                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                                                    <Area type="monotone" dataKey="value" name={c.label} stroke={c.color} fill={`url(#${c.gradientId})`} strokeWidth={2} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <EmptyChart message={`No ${c.label.toLowerCase()} data`} />
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </ChartCard>
                </>
            )}

            {/* Expanded KPI Card Modal */}
            <Modal
                isOpen={!!expandedCard}
                onClose={() => setExpandedCard(null)}
                title={expandedCard === 'traces' ? 'Traces' : expandedCard === 'models' ? 'Model Costs' : 'Scores'}
                size="xl"
            >
                {expandedCard === 'traces' && (
                    <TraceListCard
                        total={dashboardKPIs?.traces?.total}
                        data={dashboardKPIs?.traces?.by_name}
                        traceType={traceType}
                        onTypeChange={setTraceType}
                        showAllTraces={true}
                        onShowAll={() => {}}
                        countsByType={dashboardKPIs?.traces?.counts_by_type}
                        isExpanded
                    />
                )}
                {expandedCard === 'models' && (
                    <ModelCostTableCard
                        total={dashboardKPIs?.model_costs?.total}
                        data={dashboardKPIs?.model_costs?.by_model}
                        isExpanded
                    />
                )}
                {expandedCard === 'scores' && (
                    <ScoreTableCard
                        total={dashboardKPIs?.scores?.total}
                        data={dashboardKPIs?.scores?.by_evaluator}
                        showMore={true}
                        onShowMore={() => {}}
                        isExpanded
                        onNavigate={onNavigate}
                    />
                )}
            </Modal>
        </div>
    );
};
