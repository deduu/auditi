import React, { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { Card } from "../ui/Card";
import { Tooltip } from "../ui/Tooltip";

export const ExpandableMetricCard = ({ title, value, unit = "", trend, percentiles, tooltip, formatter = (v) => v }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const getTrendColor = (trend) => {
        if (!trend) return "text-slate-500";
        return trend.direction === "up" ? "text-emerald-400" : "text-rose-400";
    };

    const hasPercentiles = percentiles && (percentiles.p50 || percentiles.p95 || percentiles.p99);

    const formatValue = (val) => {
        if (val === undefined || val === null) return val;
        try {
            return formatter(val);
        } catch (e) {
            return val;
        }
    };

    return (
        <Card className="p-6 bg-slate-900/50 border-slate-800 backdrop-blur-sm transition-all duration-300 relative group">
            <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-400 font-medium">{title}</p>
                {tooltip && (
                    <Tooltip content={tooltip}>
                        <div className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors cursor-help">
                            <HelpCircle className="w-5 h-5 text-slate-400 hover:text-slate-200" />
                        </div>
                    </Tooltip>
                )}
            </div>

            <div className="flex items-end justify-between">
                <div>
                    <div className="flex items-baseline space-x-1">
                        <h3 className="text-2xl font-bold text-white">
                            {formatValue(value)}
                        </h3>
                        {unit && <span className="text-sm text-slate-500 font-medium">{unit}</span>}
                    </div>

                    {trend && (
                        <p className={`text-sm mt-1 flex items-center font-medium ${getTrendColor(trend)}`}>
                            <span className="mr-1">{trend.direction === "up" ? "↑" : "↓"}</span>
                            {Math.abs(trend.value)}%
                        </p>
                    )}
                </div>

                {hasPercentiles && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 rounded-full hover:bg-slate-800 text-slate-500 transition-colors"
                    >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                )}
            </div>

            {hasPercentiles && isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-2 animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="bg-slate-800/30 p-2 rounded">
                        <p className="text-xs text-slate-500 mb-1">P50 (Median)</p>
                        <p className="text-sm font-semibold text-slate-300">
                            {formatValue(percentiles.p50)}{unit}
                        </p>
                    </div>
                    {percentiles.p90 && (
                        <div className="bg-slate-800/30 p-2 rounded">
                            <p className="text-xs text-slate-500 mb-1">P90</p>
                            <p className="text-sm font-semibold text-slate-300">
                                {formatValue(percentiles.p90)}{unit}
                            </p>
                        </div>
                    )}
                    <div className="bg-slate-800/30 p-2 rounded">
                        <p className="text-xs text-slate-500 mb-1">P95</p>
                        <p className="text-sm font-semibold text-slate-300">
                            {formatValue(percentiles.p95)}{unit}
                        </p>
                    </div>
                    <div className="bg-slate-800/30 p-2 rounded">
                        <p className="text-xs text-slate-500 mb-1">P99</p>
                        <p className="text-sm font-semibold text-slate-300">
                            {formatValue(percentiles.p99)}{unit}
                        </p>
                    </div>
                </div>
            )}
        </Card>
    );
};
