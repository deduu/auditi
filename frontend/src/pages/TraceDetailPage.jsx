/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React from "react";
import { ArrowLeft, Clock, DollarSign, Database, AlertCircle, CheckCircle, HelpCircle, User, Bot, Target } from "lucide-react";
import { useTraceDetail } from "../hooks/useTraces";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import ContentRenderer from "../components/ui/ContentRenderer";
import { formatDateTime } from "@utils/formatters";
import { EvaluationBadge } from "../components/ui/EvaluationBadge";
import { SpanItem } from "../components/ui/SpanItem";

export const TraceDetailPage = ({ traceId, onBack, inPanel = false }) => {
    const { trace, loading, error } = useTraceDetail(traceId);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error || !trace) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-300">Failed to load trace</h3>
                <p className="text-slate-500 mt-2">{error || "Trace not found"}</p>
                {!inPanel && <Button variant="secondary" className="mt-4" onClick={onBack}>Back to Traces</Button>}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    {!inPanel && (
                        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            {trace.name || "Untitled Trace"}
                            <EvaluationBadge status={trace.status} score={trace.score} />
                        </h1>
                        <div className="flex items-center text-sm text-slate-400 mt-1 space-x-4">
                            <span className="flex items-center">
                                <Clock className="w-3.5 h-3.5 mr-1.5" />
                                {formatDateTime(trace.startTime, "PPpp")}
                            </span>
                            <span className="flex items-center">
                                <Database className="w-3.5 h-3.5 mr-1.5" />
                                {trace.modelName || "Unknown Model"}
                            </span>
                            {(trace.cost > 0) && (
                                <span className="flex items-center text-slate-400">
                                    <DollarSign className="w-3.5 h-3.5 mr-1" />
                                    ${trace.cost.toFixed(6)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Evaluation Result */}
            {/* Trace Content Stack */}
            <div className="space-y-6">
                {/* Input Card */}
                <Card className="p-0 border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
                        <div className="bg-slate-700 rounded-full p-1"><User className="w-3 h-3 text-white" /></div>
                        <span className="font-medium text-slate-300 text-sm">Input</span>
                    </div>
                    <div className="p-4 bg-slate-950/30">
                        <ContentRenderer content={trace.userInput} type="auto" className="text-sm text-slate-200" />
                    </div>
                </Card>

                {/* Spans */}
                {trace.spans && trace.spans.length > 0 && (
                    <div className="bg-slate-900/20 border border-slate-800 rounded-lg overflow-hidden">
                        <div className="bg-slate-950/30 px-4 py-2 border-b border-slate-800/50">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Execution Path (Trace)
                            </p>
                        </div>
                        <div className="divide-y divide-slate-800/50">
                            {(() => {
                                // Find the last LLM/Agent span to mark as the final generator
                                const finalGeneratorIndex = trace.spans.findLastIndex(
                                    s => (s.type === 'llm' || s.type === 'agent' || s.spanType === 'llm')
                                );

                                return trace.spans.map((span, index) => (
                                    <SpanItem
                                        key={span.id}
                                        span={span}
                                        isFinalGenerator={index === finalGeneratorIndex && finalGeneratorIndex !== -1}
                                    />
                                ));
                            })()}
                        </div>
                    </div>
                )}

                {/* Detailed Evaluation Result (if available) */}
                <Card className="p-0 border-slate-800 overflow-hidden bg-slate-900/30">
                    <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-500/10 p-1 rounded-full"><Target className="w-3 h-3 text-blue-400" /></div>
                            <span className="font-medium text-slate-300 text-sm">Trace Evaluation (End-to-End)</span>
                        </div>
                        <div className="text-2xl font-bold text-white">
                            {trace.score !== null ? trace.score.toFixed(2) : "N/A"}
                        </div>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="flex items-start space-x-3">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-slate-400 mb-1">Reasoning</p>
                                <p className="text-sm text-slate-300 leading-relaxed">{trace.evalReason || "No evaluation reasoning available."}</p>
                            </div>
                        </div>

                        {trace.failureMode && (
                            <div className="flex items-start space-x-3 bg-rose-900/10 p-3 rounded-lg border border-rose-500/10">
                                <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-rose-400 mb-1">Failure Mode</p>
                                    <p className="text-sm text-rose-300">{trace.failureMode}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};
