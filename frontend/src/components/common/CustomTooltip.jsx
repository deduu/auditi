import React from "react";

export const CustomTooltip = ({ active, payload, label }) => {
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
