
import React, { useState } from "react";
import { deleteTraces } from "../api/traces";
import { Filter, Eye, RefreshCw, Trash2, ChevronDown } from "lucide-react";
import { useTraces } from "../hooks/useTraces";
import { useModels } from "../hooks/useModels";
import { TraceTable } from "../components/traces/TraceTable";
import { PaginationFooter } from "../components/ui/PaginationFooter";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

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

    // Selection state
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedTraceId, setSelectedTraceId] = useState(null);

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

    const activeFilterCount = Object.keys(filters).filter(k => k !== 'standalone_only' && filters[k] && filters[k] !== 'all').length;

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
                    <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700 mr-4">
                        <button
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${filters.standalone_only
                                ? 'bg-blue-600 text-white shadow-lg ring-1 ring-blue-500/50'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                            onClick={() => setFilters(prev => ({ ...prev, standalone_only: true }))}
                        >
                            Standalone
                        </button>
                        <button
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${!filters.standalone_only
                                ? 'bg-blue-600 text-white shadow-lg ring-1 ring-blue-500/50'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                            onClick={() => setFilters(prev => ({ ...prev, standalone_only: false }))}
                        >
                            All Traces
                        </button>
                    </div>

                    <Button variant="secondary" onClick={refetch}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
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
                                    setShowFilters(false);
                                }}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

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
        </div>
    );
};
