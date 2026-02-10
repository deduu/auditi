import React from "react";
import { Badge } from "./Badge";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export const EvaluationBadge = ({ status, score }) => {
    // Helper to format score
    const formatScore = (val) => {
        if (val === null || val === undefined) return "N/A";
        // If score is 0-1 range (typical for this backend), show as decimal
        // If score is > 1 (legacy/mock), assume 0-10 range
        if (val <= 1.0) return val.toFixed(2);
        return `${val.toFixed(1)}/10`;
    };

    if (status === "pass") {
        return (
            <div className="flex items-center space-x-2">
                <Badge
                    variant="success"
                    className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    Pass
                </Badge>
                <span className="text-sm font-semibold text-emerald-400">
                    {formatScore(score)}
                </span>
            </div>
        );
    } else if (status === "fail") {
        return (
            <div className="flex items-center space-x-2">
                <Badge
                    variant="error"
                    className="bg-rose-500/10 text-rose-400 border border-rose-500/20"
                >
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                    Fail
                </Badge>
                <span className="text-sm font-semibold text-rose-400">
                    {formatScore(score)}
                </span>
            </div>
        );
    } else if (status === "review") {
        return (
            <div className="flex items-center space-x-2">
                <Badge
                    variant="warning"
                    className="bg-amber-500/10 text-amber-400 border border-amber-500/20"
                >
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                    Review
                </Badge>
                <span className="text-sm font-semibold text-amber-400">
                    {formatScore(score)}
                </span>
            </div>
        );
    } else {
        // Pending / Evaluating
        return (
            <div className="flex items-center space-x-2">
                <Badge
                    variant="secondary"
                    className="bg-blue-500/10 text-blue-400 border border-blue-500/20"
                >
                    <span className="relative flex h-2 w-2 mr-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Evaluating...
                </Badge>
            </div>
        );
    }
};
