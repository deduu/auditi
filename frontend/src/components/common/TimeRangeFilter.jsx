import React, { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

const DEFAULT_OPTIONS = [
    { id: "24h", label: "Last 24 Hours" },
    { id: "7d", label: "Last 7 Days" },
    { id: "30d", label: "Last 30 Days" },
    { id: "90d", label: "Last 90 Days" },
];

export const TimeRangeFilter = ({ value, onChange, options = DEFAULT_OPTIONS }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedLabel = options.find((o) => o.id === value)?.label || value.toUpperCase();

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 bg-slate-800/50 border rounded-lg text-sm text-slate-300 hover:border-slate-500 transition-all duration-200 ${
                    isOpen ? "border-blue-500 ring-1 ring-blue-500/30" : "border-slate-600"
                }`}
            >
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{selectedLabel}</span>
                <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2">
                        <div className="space-y-1">
                            {options.map((range) => (
                                <button
                                    key={range.id}
                                    onClick={() => {
                                        onChange(range.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                                        value === range.id
                                            ? "bg-blue-600/10 text-blue-400"
                                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                                    }`}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
