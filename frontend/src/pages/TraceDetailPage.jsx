
import React from "react";
import { ArrowLeft, Clock, DollarSign, Database, AlertCircle, CheckCircle, HelpCircle } from "lucide-react";
import { useTraceDetail } from "../hooks/useTraces";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { format } from "date-fns";

const StatusBadge = ({ status }) => {
    const styles = {
        pass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        fail: "bg-red-500/10 text-red-400 border-red-500/20",
        review: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        pending: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    };
    const style = styles[status] || styles.pending;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pending"}
        </span>
    );
};

export const TraceDetailPage = ({ traceId, onBack }) => {
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
                <Button variant="secondary" className="mt-4" onClick={onBack}>Back to Traces</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            {trace.name || "Untitled Trace"}
                            <StatusBadge status={trace.status} />
                        </h1>
                        <div className="flex items-center text-sm text-slate-400 mt-1 space-x-4">
                            <span className="flex items-center">
                                <Clock className="w-3.5 h-3.5 mr-1.5" />
                                {format(new Date(trace.startTime), "PPpp")}
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
            <Card className="p-6 bg-slate-900/50 border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4">Evaluation Result</h3>
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <div className="text-sm font-medium text-slate-500 mb-1">Score</div>
                        <div className="text-3xl font-bold text-white mb-4">
                            {trace.score !== null ? trace.score.toFixed(2) : "N/A"}
                        </div>

                        <div className="text-sm font-medium text-slate-500 mb-1">Failure Mode</div>
                        {trace.failureMode ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                {trace.failureMode}
                            </span>
                        ) : (
                            <span className="text-slate-400 italic">None detected</span>
                        )}
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500 mb-2">Reasoning</div>
                        <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-lg border border-slate-800/50">
                            {trace.evalReason || "No evaluation reasoning available."}
                        </div>
                    </div>
                </div>
            </Card>

            {/* I/O Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-0 border-slate-800 overflow-hidden flex flex-col h-full">
                    <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 font-medium text-slate-300 text-sm">
                        Input
                    </div>
                    <div className="p-4 bg-slate-950 font-mono text-sm text-slate-300 whitespace-pre-wrap overflow-y-auto max-h-[500px]">
                        {trace.userInput}
                    </div>
                </Card>

                <Card className="p-0 border-slate-800 overflow-hidden flex flex-col h-full">
                    <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 font-medium text-slate-300 text-sm">
                        Output
                    </div>
                    <div className="p-4 bg-slate-950 font-mono text-sm text-slate-300 whitespace-pre-wrap overflow-y-auto max-h-[500px]">
                        {trace.assistantOutput}
                    </div>
                </Card>
            </div>

            {/* Spans (Simplified View) */}
            {trace.spans && trace.spans.length > 0 && (
                <Card className="p-6 bg-slate-900/50 border-slate-800">
                    <h3 className="text-lg font-semibold text-white mb-4">Execution Spans</h3>
                    <div className="space-y-3">
                        {trace.spans.map(span => (
                            <div key={span.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded uppercase ${span.spanType === 'llm' ? 'bg-blue-500/10 text-blue-400' :
                                            span.spanType === 'tool' ? 'bg-purple-500/10 text-purple-400' :
                                                'bg-slate-500/10 text-slate-400'
                                        }`}>
                                        {span.spanType}
                                    </span>
                                    <span className="text-sm font-medium text-slate-200">{span.name}</span>
                                </div>
                                <div className="text-xs text-slate-500 font-mono">
                                    {(span.durationMs / 1000).toFixed(3)}s
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};
