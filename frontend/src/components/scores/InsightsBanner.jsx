import React, { useState } from "react";
import { Lightbulb, ChevronDown } from "lucide-react";

const borderColorByType = {
    success: "border-l-emerald-500",
    warning: "border-l-amber-500",
    danger: "border-l-rose-500",
    info: "border-l-blue-500",
};

const iconColorByType = {
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-rose-400",
    info: "text-blue-400",
};

export const InsightsBanner = ({ insights = [] }) => {
    const [showAll, setShowAll] = useState(false);

    if (!insights.length) return null;

    const displayed = showAll ? insights : insights.slice(0, 3);

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {displayed.map((insight, idx) => (
                    <div
                        key={idx}
                        className={`bg-slate-900/50 border border-slate-800 border-l-4 ${borderColorByType[insight.type] || borderColorByType.info} rounded-lg p-4 group relative`}
                    >
                        <div className="flex items-start gap-3">
                            <Lightbulb className={`w-4 h-4 mt-0.5 shrink-0 ${iconColorByType[insight.type] || iconColorByType.info}`} />
                            <div className="min-w-0">
                                <h4 className="text-sm font-medium text-white truncate">{insight.title}</h4>
                                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{insight.description}</p>
                                {insight.metric_value != null && (
                                    <span className="inline-block mt-2 text-xs font-mono font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                                        {typeof insight.metric_value === 'number' ? insight.metric_value.toFixed(2) : insight.metric_value}
                                    </span>
                                )}
                            </div>
                        </div>
                        {insight.recommendation && (
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl text-xs text-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                <p className="font-semibold text-white mb-1">Recommendation</p>
                                <p className="leading-relaxed">{insight.recommendation}</p>
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-slate-600"></div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {insights.length > 3 && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
                    {showAll ? 'Show less' : `Show all ${insights.length} insights`}
                </button>
            )}
        </div>
    );
};
