import React, { useState, useEffect } from "react";
import {
    Play, Filter, Calendar, Layers, Tag, CheckCircle,
    AlertCircle, Loader2, ChevronDown, X, Database,
    Percent, Clock, RefreshCw
} from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { PaginationFooter } from "../ui/PaginationFooter";

// ... imports

/**
 * RunEvaluatorPage - Step 2 of LLM-as-a-Judge flow
 * Allows users to configure and execute evaluations on existing traces
 */
export const RunEvaluatorPage = ({
    evaluator,
    defaultModel,
    onBack,
    onExecute
}) => {
    // Target configuration
    const [targetType, setTargetType] = useState("live"); // live | dataset
    const [includeNew, setIncludeNew] = useState(true);
    const [includeExisting, setIncludeExisting] = useState(true);

    // Pagination state
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10);

    // Filter state
    const [filters, setFilters] = useState({
        dateFrom: "",
        dateTo: "",
        models: [],
        traceName: "",
        tags: [],
        status: "needs_evaluation" // Default to smart filter: Review + Pending
    });
    const [showFilters, setShowFilters] = useState(false);

    // Sampling and delay
    const [samplingRate, setSamplingRate] = useState(100);
    const [delaySeconds, setDelaySeconds] = useState(30);

    // Preview data
    const [previewTraces, setPreviewTraces] = useState([]);
    const [totalMatchingTraces, setTotalMatchingTraces] = useState(0);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Available filter options (fetched from API)
    const [availableModels, setAvailableModels] = useState([]);
    const [availableTags, setAvailableTags] = useState([]);

    // Execution state
    const [executing, setExecuting] = useState(false);
    const [executionProgress, setExecutionProgress] = useState(null);

    // Selected traces for evaluation
    const [selectedTraceIds, setSelectedTraceIds] = useState(new Set());

    // Fetch filter options on mount
    useEffect(() => {
        fetchFilterOptions();
        fetchPreviewTraces();
    }, []);

    // Refetch preview when filters change
    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchPreviewTraces();
        }, 500);
        return () => clearTimeout(debounce);
    }, [filters, includeExisting]);

    const fetchFilterOptions = async () => {
        try {
            // Fetch unique models from traces
            const modelsRes = await fetch("/api/v1/evaluation-jobs/traces/models");
            if (modelsRes.ok) {
                const models = await modelsRes.json();
                setAvailableModels(models);
            }

            // Fetch unique tags
            const tagsRes = await fetch("/api/v1/evaluation-jobs/traces/tags");
            if (tagsRes.ok) {
                const tags = await tagsRes.json();
                // Ensure common types are always available
                const defaultTags = ["llm", "agent", "tool", "retrieval", "standalone"];
                setAvailableTags(Array.from(new Set([...defaultTags, ...tags])));
            }
        } catch (error) {
            console.error("Failed to fetch filter options:", error);
        }
    };

    const fetchPreviewTraces = async () => {
        if (!includeExisting) {
            setPreviewTraces([]);
            setTotalMatchingTraces(0);
            return;
        }

        setLoadingPreview(true);
        try {
            const params = new URLSearchParams();
            if (filters.dateFrom) params.append("date_from", filters.dateFrom);
            if (filters.dateTo) params.append("date_to", filters.dateTo);
            if (filters.models.length) params.append("models", filters.models.join(","));
            if (filters.traceName) params.append("name", filters.traceName);
            if (filters.tags.length) params.append("tags", filters.tags.join(","));

            // Pass status if not 'all'
            if (filters.status !== "all") params.append("status", filters.status);

            params.append("limit", limit.toString());
            params.append("skip", (page * limit).toString());

            const res = await fetch(`/api/v1/evaluation-jobs/traces/preview?${params}`);
            if (res.ok) {
                const data = await res.json();
                setPreviewTraces(data.traces || []);
                setTotalMatchingTraces(data.total || 0);
                // Auto-select all traces on load if not checking specifically
                // Or preserve selection? For now re-select all matches displayed
                setSelectedTraceIds(new Set(data.traces?.map(t => t.id) || []));
            }
        } catch (error) {
            console.error("Failed to fetch preview:", error);
        } finally {
            setLoadingPreview(false);
        }
    };

    // Execution status notification
    const [executionStatus, setExecutionStatus] = useState(null); // null | 'sent' | 'completed' | 'failed'

    const handleExecute = async () => {
        setExecuting(true);
        setExecutionStatus(null);

        // Use selected traces if any, otherwise use sampling
        const tracesToEvaluate = selectedTraceIds.size > 0
            ? Array.from(selectedTraceIds)
            : null;

        setExecutionProgress({ evaluated: 0, total: tracesToEvaluate?.length || Math.round(totalMatchingTraces * samplingRate / 100) });

        try {
            const res = await fetch("/api/v1/evaluation-jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    evaluator_id: evaluator.id,
                    target_type: targetType,
                    include_new: includeNew,
                    include_existing: includeExisting,
                    sampling_rate: samplingRate / 100,
                    delay_seconds: delaySeconds,
                    filters: filters,
                    // Send selected trace IDs - if provided, backend will use these instead of query
                    trace_ids: tracesToEvaluate
                })
            });

            if (res.ok) {
                const job = await res.json();
                setExecutionStatus('sent');
                setExecutionProgress({ evaluated: 0, total: job.total_traces });
                // Poll for progress
                pollJobProgress(job.id);
            } else {
                const error = await res.json();
                setExecutionStatus('failed');
                console.error("Failed to start evaluation:", error);
                setExecuting(false);
            }
        } catch (error) {
            console.error("Failed to start evaluation:", error);
            setExecutionStatus('failed');
            setExecuting(false);
        }
    };

    const pollJobProgress = async (jobId) => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/v1/evaluation-jobs/${jobId}`);
                if (res.ok) {
                    const job = await res.json();
                    setExecutionProgress({
                        evaluated: job.evaluated_count,
                        total: job.total_traces
                    });

                    if (job.status === "completed") {
                        clearInterval(interval);
                        setExecuting(false);
                        setExecutionStatus('completed');
                        onExecute?.(job);
                    } else if (job.status === "failed") {
                        clearInterval(interval);
                        setExecuting(false);
                        setExecutionStatus('failed');
                    }
                }
            } catch (error) {
                clearInterval(interval);
                setExecuting(false);
                setExecutionStatus('failed');
            }
        }, 1000);
    };

    const clearFilters = () => {
        setFilters({
            dateFrom: "",
            dateTo: "",
            models: [],
            traceName: "",
            tags: [],
            status: "all"
        });
    };

    const selectAllTraces = () => {
        setSelectedTraceIds(new Set(previewTraces.map(t => t.id)));
    };

    const unselectAllTraces = () => {
        setSelectedTraceIds(new Set());
    };

    const toggleTraceSelection = (traceId) => {
        const newSet = new Set(selectedTraceIds);
        if (newSet.has(traceId)) {
            newSet.delete(traceId);
        } else {
            newSet.add(traceId);
        }
        setSelectedTraceIds(newSet);
    };

    const hasActiveFilters = filters.dateFrom || filters.dateTo ||
        filters.models.length > 0 || filters.traceName ||
        filters.tags.length > 0 || filters.status !== "all";

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-white">
                        Run Evaluator: <span className="text-blue-400">{evaluator?.name || "Custom"}</span>
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Configure how evaluations run on your traces
                    </p>
                </div>
                <div className="text-sm text-slate-500">
                    Model: <span className="text-slate-300">{defaultModel?.provider}/{defaultModel?.model}</span>
                </div>
            </div>

            {/* Target Section */}
            <Card className="bg-slate-900/50 border-slate-800 p-6">
                <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4">
                    Target Data
                </h3>

                {/* Target Type Pills */}
                <div className="flex space-x-2 mb-4">
                    <button
                        onClick={() => setTargetType("live")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${targetType === "live"
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                            }`}
                    >
                        <Database className="w-4 h-4 inline mr-2" />
                        Live tracing data
                    </button>
                    <button
                        onClick={() => setTargetType("dataset")}
                        disabled
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800/50 text-slate-600 border border-slate-700 cursor-not-allowed"
                    >
                        <Layers className="w-4 h-4 inline mr-2" />
                        Dataset runs
                        <span className="ml-2 text-xs bg-slate-700 px-1.5 py-0.5 rounded">Soon</span>
                    </button>
                </div>

                {/* Scope Checkboxes */}
                <div className="flex space-x-6 mb-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeNew}
                            onChange={(e) => setIncludeNew(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-300">New traces</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeExisting}
                            onChange={(e) => setIncludeExisting(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-300">Existing traces</span>
                    </label>
                </div>

                {/* Filter Toggle */}
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center space-x-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                    <Filter className="w-4 h-4" />
                    <span>Filters</span>
                    {hasActiveFilters && (
                        <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-xs">
                            Active
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
                </button>

                {/* Filter Panel */}
                {showFilters && (
                    <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-sm font-medium text-slate-300">Filter Traces</span>
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="text-xs text-slate-500 hover:text-slate-300 flex items-center"
                                >
                                    <X className="w-3 h-3 mr-1" />
                                    Clear all
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Date Range */}
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Date From</label>
                                <input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Date To</label>
                                <input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Model */}
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Model</label>
                                <select
                                    multiple
                                    value={filters.models}
                                    onChange={(e) => setFilters({
                                        ...filters,
                                        models: Array.from(e.target.selectedOptions, o => o.value)
                                    })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none h-20"
                                >
                                    {availableModels.map(model => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Trace Name */}
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Trace Name / Endpoint</label>
                                <input
                                    type="text"
                                    value={filters.traceName}
                                    onChange={(e) => setFilters({ ...filters, traceName: e.target.value })}
                                    placeholder="Search by name..."
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Status</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                >
                                    <option value="all">All</option>
                                    <option value="needs_evaluation">Pending / Review</option>
                                    <option value="success">Success</option>
                                    <option value="error">Error</option>
                                </select>
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Tags</label>
                                <select
                                    multiple
                                    value={filters.tags}
                                    onChange={(e) => setFilters({
                                        ...filters,
                                        tags: Array.from(e.target.selectedOptions, o => o.value)
                                    })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none h-20"
                                >
                                    {availableTags.map(tag => (
                                        <option key={tag} value={tag}>{tag}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Preview Table */}
                {includeExisting && (
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-4">
                                <span className="text-sm text-slate-400">
                                    Preview: <span className="text-white font-medium">{totalMatchingTraces}</span> matching traces
                                </span>
                                <span className="text-sm text-blue-400">
                                    ({selectedTraceIds.size} selected)
                                </span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={selectAllTraces}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={unselectAllTraces}
                                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    Unselect All
                                </button>
                                <button
                                    onClick={fetchPreviewTraces}
                                    disabled={loadingPreview}
                                    className="text-xs text-slate-500 hover:text-slate-300 flex items-center"
                                >
                                    <RefreshCw className={`w-3 h-3 mr-1 ${loadingPreview ? "animate-spin" : ""}`} />
                                    Refresh
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700">
                                        <th className="w-10 px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={previewTraces.length > 0 && selectedTraceIds.size === previewTraces.length}
                                                onChange={(e) => e.target.checked ? selectAllTraces() : unselectAllTraces()}
                                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                                            />
                                        </th>
                                        <th className="text-left px-3 py-2 text-slate-500 font-medium">Timestamp</th>
                                        <th className="text-left px-3 py-2 text-slate-500 font-medium">Name</th>
                                        <th className="text-left px-3 py-2 text-slate-500 font-medium">Input</th>
                                        <th className="text-left px-3 py-2 text-slate-500 font-medium">Output</th>
                                        <th className="text-right px-3 py-2 text-slate-500 font-medium">Latency</th>
                                        <th className="text-right px-3 py-2 text-slate-500 font-medium">Tokens</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingPreview ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-8 text-slate-500">
                                                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                            </td>
                                        </tr>
                                    ) : previewTraces.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-8 text-slate-500">
                                                No traces match the current filters
                                            </td>
                                        </tr>
                                    ) : (
                                        previewTraces.map((trace) => (
                                            <tr
                                                key={trace.id}
                                                className={`border-b border-slate-800 hover:bg-slate-800/30 cursor-pointer transition-colors ${selectedTraceIds.has(trace.id) ? 'bg-blue-500/5' : ''
                                                    }`}
                                                onClick={() => toggleTraceSelection(trace.id)}
                                            >
                                                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTraceIds.has(trace.id)}
                                                        onChange={() => toggleTraceSelection(trace.id)}
                                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-slate-400 text-xs">
                                                    {new Date(trace.start_time).toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2 text-white">{trace.name || "—"}</td>
                                                <td className="px-3 py-2 text-slate-300 max-w-32 truncate">
                                                    {trace.user_input?.substring(0, 50) || "—"}
                                                </td>
                                                <td className="px-3 py-2 text-slate-300 max-w-32 truncate">
                                                    {trace.assistant_output?.substring(0, 50) || "—"}
                                                </td>
                                                <td className="px-3 py-2 text-slate-400 text-right">
                                                    {trace.latency ? `${trace.latency.toFixed(0)}ms` : "—"}
                                                </td>
                                                <td className="px-3 py-2 text-slate-400 text-right">
                                                    {trace.total_tokens || "—"}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {/* Pagination Footer */}
                            <PaginationFooter
                                currentPage={page + 1}
                                totalPages={Math.ceil(totalMatchingTraces / limit)}
                                pageSize={limit}
                                onPageChange={(newPage) => setPage(newPage - 1)}
                                onPageSizeChange={(newSize) => {
                                    setLimit(newSize);
                                    setPage(0);
                                }}
                                disabled={loadingPreview}
                            />
                        </div>
                    </div>
                )}
            </Card>

            {/* Sampling & Delay */}
            <div className="grid grid-cols-2 gap-6">
                {/* Sampling */}
                <Card className="bg-slate-900/50 border-slate-800 p-6">
                    <div className="flex items-center space-x-2 mb-4">
                        <Percent className="w-4 h-4 text-slate-500" />
                        <h3 className="text-sm font-medium text-slate-300">Sampling</h3>
                    </div>
                    <div className="flex items-center space-x-4">
                        <input
                            type="range"
                            min="1"
                            max="100"
                            value={samplingRate}
                            onChange={(e) => setSamplingRate(parseInt(e.target.value))}
                            className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex items-center">
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={samplingRate}
                                onChange={(e) => setSamplingRate(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                                className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-center text-sm"
                            />
                            <span className="ml-1 text-slate-400">%</span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        Evaluate {Math.round(totalMatchingTraces * samplingRate / 100)} of {totalMatchingTraces} traces
                    </p>
                </Card>

                {/* Delay */}
                <Card className="bg-slate-900/50 border-slate-800 p-6">
                    <div className="flex items-center space-x-2 mb-4">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <h3 className="text-sm font-medium text-slate-300">Delay</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                        <input
                            type="number"
                            min="0"
                            max="3600"
                            value={delaySeconds}
                            onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 0)}
                            className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                        />
                        <span className="text-slate-400">seconds</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        Wait before evaluating new traces
                    </p>
                </Card>
            </div>

            {/* Execution Status Notification */}
            {executionStatus && (
                <div className={`p-4 rounded-lg border flex items-center justify-between animate-in slide-in-from-top-2 duration-300 ${executionStatus === 'sent' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                    executionStatus === 'completed' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                        'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                    <div className="flex items-center space-x-3">
                        {executionStatus === 'sent' && (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <div>
                                    <p className="font-medium">Traces sent for evaluation</p>
                                    <p className="text-sm opacity-80">
                                        {executionProgress?.total || 0} traces queued • Processing in background...
                                    </p>
                                </div>
                            </>
                        )}
                        {executionStatus === 'completed' && (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                <div>
                                    <p className="font-medium">Evaluation complete!</p>
                                    <p className="text-sm opacity-80">
                                        {executionProgress?.evaluated || 0} traces evaluated successfully
                                    </p>
                                </div>
                            </>
                        )}
                        {executionStatus === 'failed' && (
                            <>
                                <AlertCircle className="w-5 h-5" />
                                <div>
                                    <p className="font-medium">Evaluation failed</p>
                                    <p className="text-sm opacity-80">
                                        Check console for details or try again
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={() => setExecutionStatus(null)}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Execute Button */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="text-sm text-slate-400">
                    {executing && executionProgress && (
                        <div className="flex items-center space-x-2">
                            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${executionProgress.total > 0 ? (executionProgress.evaluated / executionProgress.total) * 100 : 0}%` }}
                                />
                            </div>
                            <span>
                                {executionProgress.evaluated} / {executionProgress.total}
                            </span>
                        </div>
                    )}
                </div>
                <Button
                    onClick={handleExecute}
                    disabled={executing || (!includeNew && !includeExisting) || (includeExisting && totalMatchingTraces === 0)}
                    size="lg"
                >
                    {executing ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Evaluating...
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4 mr-2" />
                            Execute Evaluation
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
};
