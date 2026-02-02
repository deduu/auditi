import React, { useState } from "react";
import { deleteConversations } from "../api/conversations";
import { Users, TrendingUp, Filter, Download, X, Calendar, Database, Shield, Trash2, ChevronDown } from "lucide-react";
import { useConversations } from "../hooks/useConversations";
import { useModels } from "../hooks/useModels";
import { useMetrics } from "../hooks/useMetrics";
import { MetricsOverview } from "../components/dashboard/MetricsOverview";
import { ConversationTable } from "../components/conversations/ConversationTable";
import { PaginationFooter } from "../components/ui/PaginationFooter";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { exportToCSV } from "../utils/exportUtils";
import { Modal } from "../components/ui/Modal";
import { SlidePanel } from "../components/ui/SlidePanel";
import { ConversationDetailPage } from "./ConversationDetailPage";

// ... existing imports

export const ConversationsPage = ({ onSelectConversation }) => {
  const { conversations, loading, filters, setFilters, refetch } = useConversations();
  const { models } = useModels();
  const { metrics } = useMetrics(filters); // Fetch metrics
  const [showFilters, setShowFilters] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState(null);

  // Client-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Standardize on 10, 25, 50

  // ... useEffect and other logic

  const totalPages = Math.ceil((conversations?.length || 0) / pageSize);
  const paginatedConversations = conversations?.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  ) || [];

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
      const allIds = paginatedConversations.map(c => c.id);
      setSelectedIds(new Set([...selectedIds, ...allIds]));
    } else {
      const newSelected = new Set(selectedIds);
      paginatedConversations.forEach(c => newSelected.delete(c.id));
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
      await deleteConversations(Array.from(selectedIds));
      setSelectedIds(new Set());
      refetch(); // Refresh list
    } catch (error) {
      console.error("Failed to delete conversations", error);
      // Optionally show error toast here
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    // ... exist logic
    // Basic data cleanup for export
    const exportData = conversations.map(c => ({
      ID: c.id,
      User: c.userId,
      Objective: c.objective,
      Turns: c.totalTurns,
      Status: c.overallStatus,
      Score: c.avgScore,
      Latency: c.latency,
      Cost: c.cost,
      Models: c.models.join("; "),
      StartTime: c.startTime,
    }));
    exportToCSV(exportData, "conversations_export");
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const activeFilterCount = Object.keys(filters).filter(k => filters[k]).length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-slate-400">Monitor your AI agent performance and user sessions</p>
        </div>
        <div className="flex items-center space-x-3 relative">
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

          {showFilters && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Filter Sessions</h3>
                <button onClick={() => setShowFilters(false)} className="text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                    value={filters.status || ""}
                    onChange={(e) => handleFilterChange("status", e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                    <option value="review">Review</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Model</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                    value={filters.model || ""}
                    onChange={(e) => handleFilterChange("model", e.target.value)}
                  >
                    <option value="">All Models</option>
                    {models && models.map(model => (
                      <option key={model.name} value={model.name}>{model.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Time Range</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                    value={filters.range || "7d"}
                    onChange={(e) => handleFilterChange("range", e.target.value)}
                  >
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between space-x-3">
                <button
                  onClick={clearFilters}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Clear All
                </button>
                <Button size="sm" onClick={() => setShowFilters(false)}>Apply Filters</Button>
              </div>
            </div>
          )}

          <Button variant="primary" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Metrics Section */}
      <MetricsOverview filters={filters} />

      {/* Sessions Section */}
      <Card className="p-0 overflow-hidden border-slate-800 bg-slate-900/50">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">User Sessions</h2>
                <p className="text-sm text-slate-400">{conversations?.length || 0} sessions • Click to view conversation details and evaluations</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
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

              <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg">
                <span className="text-xs font-semibold text-slate-300">Total Requests: {metrics?.totalRequests ? metrics.totalRequests.toLocaleString() : 0}</span>
              </div>

              <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400">Live</span>
              </div>
            </div>
          </div>
        </div>
        <ConversationTable
          conversations={paginatedConversations}
          loading={loading}
          onSelectConversation={(id) => setSelectedConversationId(id)}
          selectedIds={selectedIds}
          onToggleSelection={handleToggleSelection}
          onToggleAll={handleToggleAll}
        />
        {/* Pagination Footer */}
        {!loading && conversations.length > 0 && (
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
        title="Delete Conversations"
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
            Are you sure you want to delete <span className="text-white font-semibold">{selectedIds.size}</span> conversations?
            This action cannot be undone and will permanently remove all associated traces and data.
          </p>
        </div>
      </Modal>

      {/* Slide Panel for Conversation Details */}
      <SlidePanel
        isOpen={!!selectedConversationId}
        onClose={() => setSelectedConversationId(null)}
        title="Conversation Details"
      >
        {selectedConversationId && (
          <ConversationDetailPage
            conversationId={selectedConversationId}
            onBack={() => setSelectedConversationId(null)}
            inPanel={true}
          />
        )}
      </SlidePanel>
    </div>
  );
};
