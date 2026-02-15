/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState, useRef, useEffect } from "react";
import { deleteTraces, exportTraces } from "../api/traces";
import { Filter, Eye, RefreshCw, Trash2, ChevronDown, ArrowRight, Terminal, Download, Search } from "lucide-react";
import { useTraces } from "../hooks/useTraces";
import { useModels } from "../hooks/useModels";
import { TraceTable } from "../components/traces/TraceTable";
import { PaginationFooter } from "../components/ui/PaginationFooter";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Toast, getNotificationsEnabled } from "../components/ui/Toast";
import { Modal } from "../components/ui/Modal";
import { SlidePanel } from "../components/ui/SlidePanel";
import { TraceDetailPage } from "./TraceDetailPage";

// ... other imports

export const TracesPage = ({ onSelectTrace }) => {
    const { traces, loading, filters, setFilters, refetch } = useTraces({
        status: 'all',
        trace_type: 'all',
        model: 'all',
        standalone_only: true
    });
    const { models } = useModels();
    const [showFilters, setShowFilters] = useState(false);

    // Toast for new traces and evaluation completions
    const [evalToast, setEvalToast] = useState(null);
    const prevTraceCountRef = useRef(null);
    const prevPendingCountRef = useRef(null);

    // Track newly arrived trace IDs for row highlight animation
    const prevTraceIdsRef = useRef(new Set());
    const [newItemIds, setNewItemIds] = useState(new Set());

    useEffect(() => {
        const totalCount = traces.length;
        const pendingCount = traces.filter(t => !t.status || t.status === "pending").length;

        // Detect newly arrived traces for row highlight
        const currentIds = new Set(traces.map(t => t.id));
        if (prevTraceIdsRef.current.size > 0) {
            const arrivedIds = new Set();
            for (const id of currentIds) {
                if (!prevTraceIdsRef.current.has(id)) arrivedIds.add(id);
            }
            if (arrivedIds.size > 0) {
                setNewItemIds(arrivedIds);
                setTimeout(() => setNewItemIds(new Set()), 3000);
            }
        }
        prevTraceIdsRef.current = currentIds;

        if (getNotificationsEnabled()) {
            // Detect new traces appearing
            if (prevTraceCountRef.current !== null && totalCount > prevTraceCountRef.current) {
                const newCount = totalCount - prevTraceCountRef.current;
                if (pendingCount > 0) {
                    setEvalToast({ message: `${newCount} new trace${newCount > 1 ? "s" : ""} ingested — evaluating...`, type: "info" });
                }
            }
            // Detect evaluations completing
            else if (prevPendingCountRef.current !== null && prevPendingCountRef.current > 0 && pendingCount < prevPendingCountRef.current) {
                const evaluated = prevPendingCountRef.current - pendingCount;
                setEvalToast({ message: `${evaluated} trace${evaluated > 1 ? "s" : ""} evaluated successfully`, type: "success" });
            }
        }

        prevTraceCountRef.current = totalCount;
        prevPendingCountRef.current = pendingCount;
    }, [traces]);

    // Selection state
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedTraceId, setSelectedTraceId] = useState(null);

    // Search state
    const [search, setSearch] = useState("");

    // Client-side pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Reset page when filters change
    React.useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set());
    }, [filters]);

    const totalPages = Math.ceil((traces?.length || 0) / pageSize);
    const paginatedTraces = traces?.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    ) || [];

    const activeFilterCount = Object.keys(filters).filter(k => k !== 'standalone_only' && k !== 'search' && filters[k] && filters[k] !== 'all').length;

    const handleToggleSelection = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleToggleAll = (isChecked) => {
        if (isChecked) {
            const allIds = paginatedTraces.map(t => t.id);
            setSelectedIds(new Set([...selectedIds, ...allIds]));
        } else {
            const newSelected = new Set(selectedIds);
            paginatedTraces.forEach(t => newSelected.delete(t.id));
            setSelectedIds(newSelected);
        }
    };

    const confirmDelete = () => {
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        // Optimistically close modal
        setShowDeleteModal(false);
        try {
            setIsDeleting(true);
            await deleteTraces(Array.from(selectedIds));
            setSelectedIds(new Set());
            refetch(); // Refresh list
        } catch (error) {
            console.error("Failed to delete traces", error);
            // Optionally show error toast here
        } finally {
            setIsDeleting(false);
        }
    };

    const handleExport = () => {
        exportTraces(filters);
    };

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearch(value);
        setCurrentPage(1);
        setFilters(prev => ({ ...prev, search: value || undefined }));
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">
                        {filters.standalone_only ? "Standalone Traces" : "All Traces"}
                    </h1>
                    <p className="mt-1 text-slate-400">
                        {filters.standalone_only
                            ? "Inspect independent LLM calls, embeddings, and tool usage"
                            : "View all system traces including agent conversations"}
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    {/* View Toggle */}
                    <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-700 mr-4 gap-1">
                        <button
                            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${filters.standalone_only && !filters.ask_auditi_only
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                            onClick={() => setFilters(prev => ({ ...prev, standalone_only: true, ask_auditi_only: false, exclude_ask_auditi: true }))}
                        >
                            Standalone
                        </button>
                        <div className="w-px h-5 bg-slate-700" />
                        <button
                            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${!filters.standalone_only && !filters.ask_auditi_only
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                            onClick={() => setFilters(prev => ({ ...prev, standalone_only: false, ask_auditi_only: false, exclude_ask_auditi: false }))}
                        >
                            All Traces
                        </button>
                        <div className="w-px h-5 bg-slate-700" />
                        <button
                            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${filters.ask_auditi_only
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                            onClick={() => setFilters(prev => ({ ...prev, standalone_only: false, ask_auditi_only: true, exclude_ask_auditi: false }))}
                        >
                            Ask Auditi
                        </button>
                    </div>

                    <Button variant="secondary" onClick={refetch}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button variant="primary" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                    <Button
                        variant="secondary"
                        className={`bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 ${showFilters ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter className="w-4 h-4 mr-2" />
                        Filter
                        {activeFilterCount > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full">
                                {activeFilterCount}
                            </span>
                        )}
                    </Button>
                </div>
            </div>

            {/* Filters Overlay */}
            {showFilters && (
                <Card className="p-4 bg-slate-900/50 border-slate-800 mb-6 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                value={filters.status || "all"}
                                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            >
                                <option value="all">All Statuses</option>
                                <option value="pass">Pass</option>
                                <option value="fail">Fail</option>
                                <option value="review">Review</option>
                                <option value="pending">Pending</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Type</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                value={filters.trace_type || "all"}
                                onChange={(e) => setFilters(prev => ({ ...prev, trace_type: e.target.value }))}
                            >
                                <option value="all">All Types</option>
                                <option value="llm">LLM Call</option>
                                <option value="tool">Tool Use</option>
                                <option value="retrieval">Retrieval / RAG</option>
                                <option value="embedding">Embedding</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Model</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                value={filters.model || "all"}
                                onChange={(e) => setFilters(prev => ({ ...prev, model: e.target.value }))}
                            >
                                <option value="all">All Models</option>
                                {models && models.map(model => (
                                    <option key={model.name} value={model.name}>{model.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-slate-400 hover:text-white"
                                onClick={() => {
                                    setFilters({});
                                    setSearch("");
                                    setShowFilters(false);
                                }}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                    type="text"
                    placeholder="Search traces by name, input, output, or eval reason..."
                    value={search}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            {/* Trace Table */}
            <Card className="p-0 overflow-hidden border-slate-800 bg-slate-900/50">
                <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center justify-end">
                        {selectedIds.size > 0 && (
                            <Button
                                variant="danger"
                                className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 flex items-center"
                                onClick={confirmDelete}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Selected ({selectedIds.size})
                            </Button>
                        )}
                    </div>
                </div>
                <TraceTable
                    traces={paginatedTraces}
                    loading={loading}
                    onSelectTrace={(id) => setSelectedTraceId(id)}
                    selectedIds={selectedIds}
                    onToggleSelection={handleToggleSelection}
                    onToggleAll={handleToggleAll}
                    newItemIds={newItemIds}
                    emptyState={filters.standalone_only ? (
                        <div className="p-12 text-center">
                            <Terminal className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                            <h3 className="text-lg font-medium text-slate-300 mb-2">No standalone traces yet</h3>
                            <p className="text-slate-500 mb-6">
                                Standalone traces appear here when you use the SDK outside of agent conversations.
                            </p>
                            <button
                                onClick={() => setFilters(prev => ({ ...prev, standalone_only: false }))}
                                className="inline-flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                            >
                                View All Traces
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </button>
                        </div>
                    ) : undefined}
                />
                {!loading && traces.length > 0 && (
                    <PaginationFooter
                        currentPage={currentPage}
                        totalPages={totalPages}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setCurrentPage(1);
                        }}
                        disabled={loading}
                    />
                )}
            </Card>

            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Traces"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-slate-300">
                        Are you sure you want to delete <span className="text-white font-semibold">{selectedIds.size}</span> traces?
                        This action cannot be undone.
                    </p>
                </div>
            </Modal>

            {/* Slide Panel for Trace Details */}
            <SlidePanel
                isOpen={!!selectedTraceId}
                onClose={() => setSelectedTraceId(null)}
                title="Trace Details"
            >
                {selectedTraceId && (
                    <TraceDetailPage
                        traceId={selectedTraceId}
                        onBack={() => setSelectedTraceId(null)}
                        inPanel={true}
                    />
                )}
            </SlidePanel>

            {evalToast && (
                <Toast
                    message={evalToast.message}
                    type={evalToast.type}
                    onClose={() => setEvalToast(null)}
                />
            )}
        </div>
    );
};
