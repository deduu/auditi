import React from "react";

export const ChangeIndicator = ({ value, invertColor = false }) => {
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
