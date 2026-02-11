import React from "react";
import { Info } from "lucide-react";
import { Card } from "../ui/Card";

export const ChartCard = ({ title, subtitle, info, children, tabs, activeTab, onTabChange, rightContent }) => (
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
