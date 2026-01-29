
import React from 'react';
import {
    Terminal,
    Cpu,
    Search,
    Database,
    Clock,
    DollarSign,
    AlertCircle,
    CheckCircle,
    HelpCircle,
    MoreHorizontal
} from 'lucide-react';
import { format } from 'date-fns';

const StatusBadge = ({ status }) => {
    const styles = {
        pass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        fail: "bg-red-500/10 text-red-400 border-red-500/20",
        review: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        pending: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    };

    const icons = {
        pass: CheckCircle,
        fail: AlertCircle,
        review: HelpCircle,
        pending: Clock,
    };

    const Icon = icons[status] || Clock;
    const style = styles[status] || styles.pending;

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
            <Icon className="w-3 h-3 mr-1" />
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pending"}
        </span>
    );
};

const TypeIcon = ({ type }) => {
    switch (type) {
        case 'llm': return <Cpu className="w-4 h-4 text-blue-400" />;
        case 'tool': return <Terminal className="w-4 h-4 text-purple-400" />;
        case 'embedding': return <Database className="w-4 h-4 text-green-400" />;
        case 'retrieval': return <Search className="w-4 h-4 text-amber-400" />;
        default: return <Terminal className="w-4 h-4 text-slate-400" />;
    }
};

export const TraceTable = ({ traces, loading, onSelectTrace }) => {
    if (loading) {
        return (
            <div className="p-8 text-center text-slate-400">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading traces...
            </div>
        );
    }

    if (traces.length === 0) {
        return (
            <div className="p-12 text-center text-slate-500">
                <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-slate-300 mb-1">No traces found</h3>
                <p>Run your agent or scripts to generate traces.</p>
            </div>
        );
    }

    return (
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="border-b border-slate-800 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-4 w-16">Type</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Input / Output Preview</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Tokens</th>
                    <th className="px-6 py-4 text-right">Latency</th>
                    <th className="px-6 py-4 text-right">Time</th>
                    <th className="px-6 py-4"></th>
                </tr>
            </thead>
            <tbody>
                {traces.map((trace) => (
                    <tr
                        key={trace.id}
                        onClick={() => onSelectTrace(trace.id)}
                        className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer group"
                    >
                        <td className="px-6 py-4">
                            {/* Text Badge for Trace Type */}
                            {(() => {
                                const isTool = trace.tags?.includes('tool');
                                const isAgent = trace.conversationId && !trace.tags?.includes('standalone');
                                const isRetrieval = trace.tags?.includes('retrieval');

                                let badgeClass = "bg-slate-800 text-slate-400 border-slate-700";
                                let text = "LLM";

                                if (isAgent) {
                                    text = "AGENT";
                                    badgeClass = "bg-purple-900/30 text-purple-400 border-purple-500/30";
                                } else if (isTool) {
                                    text = "TOOL";
                                    badgeClass = "bg-amber-900/30 text-amber-400 border-amber-500/30";
                                } else if (isRetrieval) {
                                    text = "RAG";
                                    badgeClass = "bg-emerald-900/30 text-emerald-400 border-emerald-500/30";
                                } else {
                                    // Default LLM standalone
                                    badgeClass = "bg-blue-900/30 text-blue-400 border-blue-500/30";
                                }

                                return (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>
                                        {text}
                                    </span>
                                );
                            })()}
                        </td>
                        <td className="px-6 py-4">
                            <div className="font-medium text-slate-200">{trace.name || "Untitled Trace"}</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{trace.modelName}</div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                            <div className="text-sm text-slate-300 truncate font-mono bg-slate-900/50 px-2 py-1 rounded border border-slate-800/50 mb-1">
                                in: {trace.userInputPreview}
                            </div>
                            <div className="text-sm text-slate-400 truncate font-mono">
                                out: {trace.assistantOutputPreview}
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <StatusBadge status={trace.status} />
                            {trace.score !== null && (
                                <div className="text-xs font-bold mt-1 text-slate-400">
                                    Score: {trace.score.toFixed(2)}
                                </div>
                            )}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-slate-400">
                            {trace.totalTokens?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-slate-400">
                            {(trace.latencyMs / 1000).toFixed(2)}s
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-slate-400 whitespace-nowrap">
                            {format(new Date(trace.startTime), 'MMM d, HH:mm')}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <MoreHorizontal className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};
