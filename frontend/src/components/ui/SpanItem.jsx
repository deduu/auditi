import React, { useState } from "react";
import { Badge } from "./Badge";
import ContentRenderer from "./ContentRenderer";
import { ChevronDown, ChevronUp } from "lucide-react";

export const SpanItem = ({ span, isFinalGenerator = false, showEvaluation = true }) => {
    const [showDetails, setShowDetails] = useState(isFinalGenerator); // Auto-expand if final generator

    const spanType = (
        span?.type ??
        span?.spanType ??
        span?.span_type ??
        "unknown"
    ).toString();
    const isLLM = spanType === "llm";
    const isTool = spanType === "tool";

    // ✅ Normalize status
    const spanStatus = (span?.status ?? "ok").toString();
    const isError = spanStatus === "error";

    // ✅ Normalize timing fields (camelCase from API)
    const startTime = span?.start_time ?? span?.startTime;
    const endTime = span?.end_time ?? span?.endTime;

    // ✅ Normalize duration (API returns durationMs; old UI used duration string)
    const durationMs = span?.durationMs ?? span?.duration_ms;
    const durationLabel =
        span?.duration ??
        (typeof durationMs === "number" ? `${durationMs.toFixed(2)}ms` : "0.00ms");

    // ✅ Normalize tokens (API uses inputTokens/outputTokens/tokens)
    const inputTokens = span?.input_tokens ?? span?.inputTokens;
    const outputTokens = span?.output_tokens ?? span?.outputTokens;
    const totalTokens = span?.tokens ?? span?.total_tokens ?? span?.totalTokens;

    const hasTokens =
        Boolean(inputTokens) || Boolean(outputTokens) || Boolean(totalTokens);

    const resolvedTotalTokens =
        typeof totalTokens === "number" && totalTokens >= 0
            ? totalTokens
            : (inputTokens || 0) + (outputTokens || 0);

    const tokenParts = [];
    if (typeof inputTokens === "number" && inputTokens > 0)
        tokenParts.push(`in ${inputTokens}`);
    if (typeof outputTokens === "number" && outputTokens > 0)
        tokenParts.push(`out ${outputTokens}`);
    if (typeof resolvedTotalTokens === "number" && resolvedTotalTokens > 0)
        tokenParts.push(`total ${resolvedTotalTokens}`);

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return "N/A";

        const d = new Date(timestamp);

        return d.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
            timeZoneName: "short", // ✅ adds timezone, e.g. GMT+7
        });
    };

    return (
        <div
            className={`ml-4 pl-4 border-l-2 ${isError ? "border-rose-500/30" : isFinalGenerator ? "border-blue-500" : "border-slate-800"
                } py-2`}
        >
            <div
                className={`flex items-center justify-between group cursor-pointer hover:bg-slate-800/30 -ml-4 pl-4 pr-2 py-1 rounded-r transition-colors ${isFinalGenerator ? "bg-blue-500/5" : ""
                    }`}
                onClick={() => setShowDetails(!showDetails)}
            >
                <div className="flex items-center space-x-2">
                    <Badge
                        variant="outline"
                        className={`
              ${isLLM ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : ""}
              ${isTool ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : ""}
              ${!isLLM && !isTool ? "bg-slate-800/50 text-slate-300 border-slate-700" : ""}
            `}
                    >
                        {spanType.toUpperCase()}
                    </Badge>

                    {/* Final Generator Badge */}
                    {isFinalGenerator && (
                        <Badge
                            variant="outline"
                            className="bg-blue-500/10 text-blue-400 border-blue-500/30 font-bold"
                        >
                            FINAL RESPONSE
                        </Badge>
                    )}

                    <span className={`text-sm font-medium ${isFinalGenerator ? "text-white" : "text-slate-300"}`}>
                        {span?.name ?? "Unnamed span"}
                    </span>

                    {span?.model && (
                        <span className="text-xs text-slate-500">({span.model})</span>
                    )}
                </div>

                <div className="flex items-center space-x-3 opacity-60 group-hover:opacity-100 transition-opacity">
                    {hasTokens && tokenParts.length > 0 && (
                        <span className="text-xs text-slate-500">
                            {tokenParts.join(" / ")}
                        </span>
                    )}

                    {typeof span?.cost === "number" && span.cost > 0 && (
                        <span className="text-xs text-emerald-400">
                            ${span.cost.toFixed(4)}
                        </span>
                    )}

                    <span className="text-xs text-slate-500">{durationLabel}</span>

                    {isError && (
                        <Badge
                            variant="error"
                            className="bg-rose-500/10 text-rose-400 border-rose-500/20"
                        >
                            Error
                        </Badge>
                    )}

                    {showDetails ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                </div>
            </div>

            {/* Expanded Details */}
            {showDetails && (
                <div className="mt-2 space-y-3 bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                    {/* Timing Information */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span className="text-slate-500">Start Time:</span>
                            <span className="ml-2 text-slate-300 font-mono">
                                {formatTimestamp(startTime)}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-500">End Time:</span>
                            <span className="ml-2 text-slate-300 font-mono">
                                {formatTimestamp(endTime)}
                            </span>
                        </div>
                    </div>

                    {/* Status and ID */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span className="text-slate-500">Status:</span>
                            <Badge
                                variant="outline"
                                className={`ml-2 ${spanStatus === "ok"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                    }`}
                            >
                                {spanStatus}
                            </Badge>
                        </div>
                        <div className="truncate">
                            <span className="text-slate-500">ID:</span>
                            <span className="ml-2 text-slate-400 font-mono text-xs">
                                {span?.id ?? "N/A"}
                            </span>
                        </div>
                    </div>

                    {/* Error Details */}
                    {isError && span?.error && (
                        <div className="bg-rose-900/20 border border-rose-500/20 rounded p-2">
                            <p className="text-xs font-medium text-rose-400 mb-1">
                                Error Details:
                            </p>
                            <p className="text-xs text-rose-300 font-mono">{span.error}</p>
                        </div>
                    )}

                    {/* Inputs */}
                    {span?.inputs && (
                        <div>
                            <p className="text-xs font-medium text-slate-400 mb-1">Inputs:</p>
                            <div className="bg-slate-950/50 border border-slate-700 rounded p-2 h-60 resize-y overflow-y-auto">
                                <ContentRenderer content={span.inputs} type="auto" className="text-xs" />
                            </div>
                        </div>
                    )}

                    {/* Outputs */}
                    {span?.outputs && (
                        <div>
                            <p className="text-xs font-medium text-slate-400 mb-1">
                                Outputs:
                            </p>
                            <div className="bg-slate-950/50 border border-slate-700 rounded p-2 h-60 resize-y overflow-y-auto">
                                <ContentRenderer content={span.outputs} type="auto" className="text-xs" />
                            </div>
                        </div>
                    )}

                    {/* Span Evaluation - conditionally shown based on showEvaluation prop */}
                    {showEvaluation && span?.evaluation && (
                        <div className={`p-3 rounded border ${span.evaluation.evalQualityScore >= 0.7
                            ? "bg-emerald-900/10 border-emerald-500/20"
                            : "bg-amber-900/10 border-amber-500/20"
                            }`}>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-slate-300">
                                    <span className="inline-flex items-center">
                                        <svg className="w-3 h-3 mr-1 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                        LLM Evaluation
                                    </span>
                                </p>
                                <div className="flex items-center space-x-2">
                                    {span.evaluation.evalRelevant !== null && (
                                        <Badge variant="outline" className={span.evaluation.evalRelevant ? "text-emerald-400 border-emerald-500/30" : "text-slate-500 border-slate-700"}>
                                            {span.evaluation.evalRelevant ? "Relevant" : "Irrelevant"}
                                        </Badge>
                                    )}
                                    {span.evaluation.evalQualityScore !== null && (
                                        <span className={`text-xs font-bold ${span.evaluation.evalQualityScore >= 0.7 ? "text-emerald-400" : "text-amber-400"}`}>
                                            {span.evaluation.evalQualityScore.toFixed(2)} Score
                                        </span>
                                    )}
                                </div>
                            </div>

                            {span.evaluation.evalReasoning && (
                                <p className="text-xs text-slate-400 mb-2 italic">"{span.evaluation.evalReasoning}"</p>
                            )}

                            {span.evaluation.evalIssues && span.evaluation.evalIssues.length > 0 && (
                                <div>
                                    <p className="text-xs font-medium text-rose-400 mb-1">Issues:</p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        {span.evaluation.evalIssues.map((issue, idx) => (
                                            <li key={idx} className="text-xs text-rose-300">{issue}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Token and Cost Details (for LLM spans) */}
                    {isLLM && hasTokens && (
                        <div className="bg-purple-900/10 border border-purple-500/20 rounded p-2">
                            <p className="text-xs font-medium text-purple-400 mb-2">
                                Resource Usage:
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {typeof inputTokens === "number" && inputTokens > 0 && (
                                    <div>
                                        <span className="text-slate-500">Input Tokens:</span>
                                        <span className="ml-2 text-purple-300 font-mono">
                                            {inputTokens.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {typeof outputTokens === "number" && outputTokens > 0 && (
                                    <div>
                                        <span className="text-slate-500">Output Tokens:</span>
                                        <span className="ml-2 text-purple-300 font-mono">
                                            {outputTokens.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {typeof resolvedTotalTokens === "number" &&
                                    resolvedTotalTokens > 0 && (
                                        <div>
                                            <span className="text-slate-500">Total Tokens:</span>
                                            <span className="ml-2 text-purple-300 font-mono">
                                                {resolvedTotalTokens.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                {typeof span?.cost === "number" && span.cost > 0 && (
                                    <div>
                                        <span className="text-slate-500">Cost:</span>
                                        <span className="ml-2 text-emerald-300 font-mono">
                                            ${span.cost.toFixed(6)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
