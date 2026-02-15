/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState } from "react";
import { ArrowLeft, Clock, DollarSign, Database, AlertCircle, CheckCircle, HelpCircle, User, Bot, Target, Shield, ChevronDown, ChevronUp, Zap, List, GitBranch, GanttChart, ArrowDownUp, LayoutDashboard } from "lucide-react";
import { useTraceDetail } from "../hooks/useTraces";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Toast, getNotificationsEnabled } from "../components/ui/Toast";
import ContentRenderer from "../components/ui/ContentRenderer";
import { formatDateTime } from "@utils/formatters";
import { EvaluationBadge } from "../components/ui/EvaluationBadge";
import { SpanItem } from "../components/ui/SpanItem";
import { TraceFlowView } from "../components/traces/TraceFlowView";
import { TraceTimelineView } from "../components/traces/TraceTimelineView";
import { TraceSequenceView } from "../components/traces/TraceSequenceView";
import { TraceSummaryView } from "../components/traces/TraceSummaryView";

const TRACE_TABS = [
    { id: "detail", label: "Detail", icon: List },
    { id: "flow", label: "Flow", icon: GitBranch },
    { id: "timeline", label: "Timeline", icon: GanttChart },
    { id: "sequence", label: "Sequence", icon: ArrowDownUp },
    { id: "summary", label: "Summary", icon: LayoutDashboard },
];

const EvalCard = ({ evalId, evalData }) => {
    const [expanded, setExpanded] = useState(false);
    const hasLongText = (evalData.reason && evalData.reason.length > 120) ||
        (evalData.failure_mode && evalData.failure_mode.length > 80);

    return (
        <Card className="p-4 border-slate-800 bg-slate-900/30">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white">{evalData.name || evalId}</h4>
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        evalData.status === "pass"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : evalData.status === "fail"
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}>
                        {evalData.status === "pass" ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                        ) : evalData.status === "fail" ? (
                            <AlertCircle className="w-3 h-3 mr-1" />
                        ) : (
                            <HelpCircle className="w-3 h-3 mr-1" />
                        )}
                        {evalData.status}
                    </span>
                    <span className="text-lg font-bold text-white">
                        {evalData.score != null ? evalData.score.toFixed(2) : "N/A"}
                    </span>
                </div>
            </div>
            {evalData.reason && (
                <p className={`text-xs text-slate-400 mb-2 whitespace-pre-line ${!expanded && hasLongText ? "line-clamp-3" : ""}`}>
                    {evalData.reason}
                </p>
            )}
            {evalData.failure_mode && (
                <div className={`flex items-start gap-1.5 text-xs text-rose-400 bg-rose-900/10 px-2 py-1 rounded border border-rose-500/10 mb-2 ${!expanded && hasLongText ? "line-clamp-2" : ""}`}>
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span className="whitespace-pre-line">{evalData.failure_mode}</span>
                </div>
            )}
            {hasLongText && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                >
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {expanded ? "Show less" : "Show more"}
                </button>
            )}
        </Card>
    );
};

const EvalBreakdown = ({ evaluations }) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
            <Shield className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Per-Evaluator Breakdown
            </h3>
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">
                {Object.keys(evaluations).length}
            </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(evaluations).map(([evalId, evalData]) => (
                <EvalCard key={evalId} evalId={evalId} evalData={evalData} />
            ))}
        </div>
    </div>
);

export const TraceDetailPage = ({ traceId, onBack, inPanel = false }) => {
    const { trace, loading, error, justEvaluated } = useTraceDetail(traceId);
    const [activeTab, setActiveTab] = useState("detail");

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
                            {trace.spans && trace.spans.length > 0 && (
                                <span className="flex items-center">
                                    <Zap className="w-3.5 h-3.5 mr-1.5" />
                                    {trace.spans.length} {trace.spans.length === 1 ? "step" : "steps"}
                                </span>
                            )}
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

            {/* Tab Bar (only show when spans exist) */}
            {trace.spans && trace.spans.length > 0 && (
                <div className="border-b border-slate-800">
                    <nav className="flex space-x-1">
                        {TRACE_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                                        isActive
                                            ? "border-blue-500 text-blue-400"
                                            : "border-transparent text-slate-500 hover:text-slate-300"
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            )}

            {/* Detail Tab (default) */}
            {activeTab === "detail" && (
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

                {/* Output Card */}
                {trace.assistantOutput && (
                    <Card className="p-0 border-slate-800 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
                            <div className="bg-blue-700 rounded-full p-1"><Bot className="w-3 h-3 text-white" /></div>
                            <span className="font-medium text-slate-300 text-sm">Output</span>
                        </div>
                        <div className="p-4 bg-slate-950/30">
                            <ContentRenderer content={trace.assistantOutput} type="auto" className="text-sm text-slate-200" />
                        </div>
                    </Card>
                )}

                {/* Spans */}
                {trace.spans && trace.spans.length > 0 && (
                    <div className="bg-slate-900/20 border border-slate-800 rounded-lg overflow-hidden">
                        <div className="bg-slate-950/30 px-4 py-2 border-b border-slate-800/50">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Execution Path (Trace)
                                <span className="ml-2 px-1.5 py-0.5 bg-slate-700/50 text-slate-400 rounded-full text-xs font-medium normal-case">
                                    {trace.spans.length} {trace.spans.length === 1 ? "step" : "steps"}
                                </span>
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
                                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{trace.evalReason || "No evaluation reasoning available."}</p>
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

                {/* Per-Evaluator Results (when multi-evaluator data exists) */}
                {trace.evalMetadata?.evaluations && Object.keys(trace.evalMetadata.evaluations).length > 1 && (
                    <EvalBreakdown evaluations={trace.evalMetadata.evaluations} />
                )}
            </div>
            )}

            {/* Visualization Tabs */}
            {activeTab === "flow" && <TraceFlowView trace={trace} />}
            {activeTab === "timeline" && <TraceTimelineView trace={trace} />}
            {activeTab === "sequence" && <TraceSequenceView trace={trace} />}
            {activeTab === "summary" && <TraceSummaryView trace={trace} />}

            {justEvaluated && getNotificationsEnabled() && (
                <Toast
                    message={`Evaluation complete: ${trace.status}`}
                    type={trace.status === "pass" ? "success" : trace.status === "fail" ? "error" : "info"}
                />
            )}
        </div>
    );
};
