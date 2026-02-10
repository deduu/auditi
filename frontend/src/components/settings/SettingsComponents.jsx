import React from "react";
import { Card } from "../ui/Card";

export const SettingSection = ({ icon: Icon, title, description, children }) => (
    <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Icon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <p className="text-sm text-slate-400">{description}</p>
                </div>
            </div>
        </div>
        <div className="p-6">{children}</div>
    </Card>
);

export const ToggleSetting = ({ label, description, checked, onChange, disabled = false }) => {
    return (
        <div className="flex items-center justify-between py-3">
            <div>
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-sm text-slate-400">{description}</p>
            </div>
            <button
                onClick={() => !disabled && onChange(!checked)}
                disabled={disabled}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ring-1 ${checked ? "bg-emerald-500 ring-emerald-400" : "bg-rose-500/80 ring-rose-400"
                    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
                <span
                    className={`inline-block h-5 w-5 transform rounded-full shadow-md transition-transform ${checked ? "translate-x-6 bg-white" : "translate-x-0.5 bg-slate-400"
                        }`}
                />
            </button>
        </div>
    );
};
