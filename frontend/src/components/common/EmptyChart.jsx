import React from "react";

export const EmptyChart = ({ message = "No data" }) => (
    <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-700 rounded-lg bg-slate-900/30">
        <span className="text-slate-500 text-sm">{message}</span>
    </div>
);
