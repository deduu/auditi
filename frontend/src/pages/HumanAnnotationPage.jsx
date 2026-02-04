import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  ListTodo,
  Trash2,
  CheckCircle2,
  Settings,
  FileText,
  Users,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
  Download,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { PaginationFooter } from "../components/ui/PaginationFooter";
import { annotationsApi } from "../api";
import { ScoreConfigManager } from "../components/annotations/ScoreConfigManager";
import { AnnotationWorkflow } from "../components/annotations/AnnotationWorkflow";
import { QueueCard } from "../components/annotations/QueueCard";
import { QueueFilterBar } from "../components/annotations/QueueFilterBar";
import * as tracesApi from "../api/traces";

export const HumanAnnotationPage = () => {
  const [scoreConfigs, setScoreConfigs] = useState([]);
  const [queues, setQueues] = useState([]);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("overview"); // "overview", "configs", "workflow"

  // Modal states
  const [showCreateQueueModal, setShowCreateQueueModal] = useState(false);
  const [showAddTracesModal, setShowAddTracesModal] = useState(false);
  const [queueForTraces, setQueueForTraces] = useState(null);
  const [showViewCompletedModal, setShowViewCompletedModal] = useState(false);
  const [queueForViewing, setQueueForViewing] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [queueForExport, setQueueForExport] = useState(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [queuesForDelete, setQueuesForDelete] = useState([]);

  // Filter and selection states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    scoreConfigId: "all",
    progress: "all",
    dateRange: "all",
    search: "",
  });
  const [selectedQueueIds, setSelectedQueueIds] = useState(new Set());

  // Pagination state for queue list
  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState(10);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configsData, queuesData] = await Promise.all([
        annotationsApi.getScoreConfigs(),
        annotationsApi.getAnnotationQueues(),
      ]);
      setScoreConfigs(configsData || []);
      setQueues(queuesData || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const filteredQueues = useMemo(() => {
    return queues.filter((queue) => {
      // Status filter
      if (filters.status !== "all") {
        const isEmpty = queue.total_items === 0;
        const isComplete = queue.progress_percentage >= 100 && !isEmpty;
        const isActive = !isEmpty && !isComplete;

        if (filters.status === "active" && !isActive) return false;
        if (filters.status === "completed" && !isComplete) return false;
        if (filters.status === "empty" && !isEmpty) return false;
      }

      // Score config filter
      if (filters.scoreConfigId !== "all") {
        if (!queue.score_config_ids?.includes(filters.scoreConfigId)) return false;
      }

      // Progress filter
      if (filters.progress !== "all") {
        const progress = queue.progress_percentage || 0;
        if (filters.progress === "not_started" && progress > 0) return false;
        if (filters.progress === "in_progress" && (progress === 0 || progress >= 100)) return false;
        if (filters.progress === "completed" && progress < 100) return false;
      }

      // Date range filter
      if (filters.dateRange !== "all" && queue.created_at) {
        const createdAt = new Date(queue.created_at);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        if (filters.dateRange === "today" && createdAt < startOfToday) return false;
        if (filters.dateRange === "week" && createdAt < startOfWeek) return false;
        if (filters.dateRange === "month" && createdAt < startOfMonth) return false;
      }

      // Search filter
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const nameMatch = queue.name?.toLowerCase().includes(query);
        const descMatch = queue.description?.toLowerCase().includes(query);
        if (!nameMatch && !descMatch) return false;
      }

      return true;
    });
  }, [queues, filters]);

  // Reset page when filters change
  useEffect(() => {
    setQueuePage(1);
  }, [filters]);

  // Paginated queues
  const paginatedQueues = useMemo(() => {
    const startIndex = (queuePage - 1) * queuePageSize;
    return filteredQueues.slice(startIndex, startIndex + queuePageSize);
  }, [filteredQueues, queuePage, queuePageSize]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status !== "all") count++;
    if (filters.scoreConfigId !== "all") count++;
    if (filters.progress !== "all") count++;
    if (filters.dateRange !== "all") count++;
    if (filters.search) count++;
    return count;
  }, [filters]);

  // Selection handlers
  const handleToggleSelection = (queueId) => {
    const newSelected = new Set(selectedQueueIds);
    if (newSelected.has(queueId)) {
      newSelected.delete(queueId);
    } else {
      newSelected.add(queueId);
    }
    setSelectedQueueIds(newSelected);
  };

  const handleToggleAll = (isChecked) => {
    if (isChecked) {
      setSelectedQueueIds(new Set(filteredQueues.map((q) => q.id)));
    } else {
      setSelectedQueueIds(new Set());
    }
  };

  const handleQueueSelect = (queue) => {
    setSelectedQueue(queue);
    setView("workflow");
  };

  const handleBackToOverview = () => {
    setSelectedQueue(null);
    setView("overview");
    loadData(); // Refresh data
  };

  const handleAddTraces = (queue) => {
    setQueueForTraces(queue);
    setShowAddTracesModal(true);
  };

  const handleDeleteQueue = async (queue) => {
    setQueuesForDelete([queue]);
    setShowDeleteConfirmModal(true);
  };

  const handleBatchDelete = () => {
    const selected = queues.filter((q) => selectedQueueIds.has(q.id));
    setQueuesForDelete(selected);
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = async () => {
    try {
      await Promise.all(
        queuesForDelete.map((q) => annotationsApi.deleteAnnotationQueue(q.id))
      );
      setSelectedQueueIds(new Set());
      loadData();
    } catch (error) {
      console.error("Failed to delete queues:", error);
    } finally {
      setShowDeleteConfirmModal(false);
      setQueuesForDelete([]);
    }
  };

  const handleViewCompleted = (queue) => {
    setQueueForViewing(queue);
    setShowViewCompletedModal(true);
  };

  const handleExport = (queue) => {
    setQueueForExport(queue);
    setShowExportModal(true);
  };

  // If in workflow mode
  if (view === "workflow" && selectedQueue) {
    return (
      <AnnotationWorkflow
        queue={selectedQueue}
        onBack={handleBackToOverview}
        onComplete={handleBackToOverview}
      />
    );
  }

  // If viewing score configs
  if (view === "configs") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Score Configurations</h1>
            <p className="mt-1 text-slate-400">Define scoring criteria for human annotation</p>
          </div>
          <Button variant="ghost" onClick={() => setView("overview")}>
            Back to Overview
          </Button>
        </div>
        <ScoreConfigManager onConfigSelect={() => { }} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  // Check if setup is needed
  const needsSetup = scoreConfigs.length === 0;
  const hasQueues = queues.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Human Annotation</h1>
          <p className="mt-1 text-slate-400">
            Review and score AI responses with human expertise
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            className={showFilters ? "ring-2 ring-blue-500" : ""}
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
          <Button variant="ghost" onClick={() => setView("configs")}>
            <Settings className="w-4 h-4 mr-2" />
            Manage Score Configs
          </Button>
        </div>
      </div>

      {/* Setup Guide - Shows when no configs exist */}
      {needsSetup && (
        <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30 p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">Get Started with Human Annotation</h3>
              <p className="text-slate-400 mb-4">
                Human annotation allows your team to review and score AI responses. Follow these steps:
              </p>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <div className="font-medium text-white">Create Score Configs</div>
                    <div className="text-sm text-slate-400">Define what metrics you want to measure</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <div className="font-medium text-white">Create an Annotation Queue</div>
                    <div className="text-sm text-slate-400">Organize traces for review</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <div className="font-medium text-white">Add Traces & Start Annotating</div>
                    <div className="text-sm text-slate-400">Add traces to the queue and begin reviewing</div>
                  </div>
                </div>
              </div>
              <Button onClick={() => setView("configs")}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Score Config
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Filter Bar */}
      {!needsSetup && showFilters && (
        <QueueFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          scoreConfigs={scoreConfigs}
        />
      )}

      {/* Batch Action Bar - Shows when items are selected */}
      {selectedQueueIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <span className="text-sm text-blue-300">
            {selectedQueueIds.size} queue{selectedQueueIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 hover:text-white"
              onClick={() => setSelectedQueueIds(new Set())}
            >
              Clear Selection
            </Button>
            <Button size="sm" variant="danger" onClick={handleBatchDelete}>
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* Annotation Queues Section */}
      {!needsSetup && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-white">Annotation Queues</h3>
              <p className="text-sm text-slate-400">
                {filteredQueues.length === queues.length
                  ? `${queues.length} queue${queues.length !== 1 ? "s" : ""}`
                  : `${filteredQueues.length} of ${queues.length} queues`}
              </p>
            </div>
            <Button onClick={() => setShowCreateQueueModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Queue
            </Button>
          </div>

          {!hasQueues ? (
            <Card className="p-8 text-center">
              <ListTodo className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-white mb-2">No Annotation Queues Yet</h4>
              <p className="text-slate-400 mb-4">
                Create a queue to organize traces for human review.
              </p>
              <Button onClick={() => setShowCreateQueueModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Queue
              </Button>
            </Card>
          ) : filteredQueues.length === 0 ? (
            <Card className="p-8 text-center">
              <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-white mb-2">No Queues Match Filters</h4>
              <p className="text-slate-400 mb-4">
                Try adjusting your filters to see more queues.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({
                    status: "all",
                    scoreConfigId: "all",
                    progress: "all",
                    dateRange: "all",
                    search: "",
                  })
                }
              >
                Clear Filters
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Select All */}
              {filteredQueues.length > 0 && (
                <div className="flex items-center space-x-2 px-1">
                  <input
                    type="checkbox"
                    checked={selectedQueueIds.size === filteredQueues.length}
                    onChange={(e) => handleToggleAll(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500/50 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-sm text-slate-400">Select All</span>
                </div>
              )}

              {/* Queue Cards */}
              {paginatedQueues.map((queue) => (
                <QueueCard
                  key={queue.id}
                  queue={queue}
                  scoreConfigs={scoreConfigs}
                  isSelected={selectedQueueIds.has(queue.id)}
                  onToggleSelect={handleToggleSelection}
                  onStart={handleQueueSelect}
                  onView={handleViewCompleted}
                  onAddTraces={handleAddTraces}
                  onDelete={handleDeleteQueue}
                  onExport={handleExport}
                />
              ))}

              {/* Pagination Footer */}
              {filteredQueues.length > 0 && (
                <PaginationFooter
                  currentPage={queuePage}
                  totalPages={Math.ceil(filteredQueues.length / queuePageSize)}
                  pageSize={queuePageSize}
                  onPageChange={setQueuePage}
                  onPageSizeChange={setQueuePageSize}
                  className="rounded-lg mt-4 border border-slate-700"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      {!needsSetup && hasQueues && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 p-4">
            <div className="text-sm text-slate-400 mb-1">Total Queues</div>
            <div className="text-2xl font-bold text-white">{queues.length}</div>
          </Card>
          <Card className="bg-slate-900/50 p-4">
            <div className="text-sm text-slate-400 mb-1">Pending Items</div>
            <div className="text-2xl font-bold text-amber-400">
              {queues.reduce((acc, q) => acc + (q.pending_items || 0), 0)}
            </div>
          </Card>
          <Card className="bg-slate-900/50 p-4">
            <div className="text-sm text-slate-400 mb-1">Completed</div>
            <div className="text-2xl font-bold text-emerald-400">
              {queues.reduce((acc, q) => acc + (q.completed_items || 0), 0)}
            </div>
          </Card>
          <Card className="bg-slate-900/50 p-4">
            <div className="text-sm text-slate-400 mb-1">Score Configs</div>
            <div className="text-2xl font-bold text-blue-400">{scoreConfigs.length}</div>
          </Card>
        </div>
      )}

      {/* Modals */}
      <CreateQueueModal
        isOpen={showCreateQueueModal}
        onClose={() => setShowCreateQueueModal(false)}
        scoreConfigs={scoreConfigs}
        onSave={() => {
          loadData();
          setShowCreateQueueModal(false);
        }}
      />

      <AddTracesModal
        isOpen={showAddTracesModal}
        onClose={() => {
          setShowAddTracesModal(false);
          setQueueForTraces(null);
        }}
        queue={queueForTraces}
        onSave={() => {
          loadData();
          setShowAddTracesModal(false);
          setQueueForTraces(null);
        }}
      />

      <ViewCompletedModal
        isOpen={showViewCompletedModal}
        onClose={() => {
          setShowViewCompletedModal(false);
          setQueueForViewing(null);
        }}
        queue={queueForViewing}
        scoreConfigs={scoreConfigs}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setQueueForExport(null);
        }}
        queue={queueForExport}
      />

      <DeleteConfirmModal
        isOpen={showDeleteConfirmModal}
        onClose={() => {
          setShowDeleteConfirmModal(false);
          setQueuesForDelete([]);
        }}
        queues={queuesForDelete}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

// Create Queue Modal
const CreateQueueModal = ({ isOpen, onClose, scoreConfigs, onSave }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    score_config_ids: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({ name: "", description: "", score_config_ids: [] });
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await annotationsApi.createAnnotationQueue(formData);
      onSave();
    } catch (error) {
      console.error("Failed to create queue:", error);
    } finally {
      setSaving(false);
    }
  };

  const toggleScoreConfig = (configId) => {
    setFormData((prev) => ({
      ...prev,
      score_config_ids: prev.score_config_ids.includes(configId)
        ? prev.score_config_ids.filter((id) => id !== configId)
        : [...prev.score_config_ids, configId],
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Annotation Queue"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !formData.name || formData.score_config_ids.length === 0}
          >
            {saving ? "Creating..." : "Create Queue"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Queue Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Customer Support Review"
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="What is this queue for?"
            rows={2}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Score Configurations *</label>
          <p className="text-xs text-slate-500 mb-3">
            Select which scores annotators will assign to each trace
          </p>
          <div className="space-y-2">
            {scoreConfigs.map((config) => (
              <label
                key={config.id}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${formData.score_config_ids.includes(config.id)
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-700 hover:border-slate-600"
                  }`}
              >
                <input
                  type="checkbox"
                  checked={formData.score_config_ids.includes(config.id)}
                  onChange={() => toggleScoreConfig(config.id)}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="font-medium text-white">{config.name}</div>
                  {config.description && (
                    <div className="text-xs text-slate-400 mt-0.5">{config.description}</div>
                  )}
                </div>
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${formData.score_config_ids.includes(config.id)
                    ? "border-blue-500 bg-blue-500"
                    : "border-slate-600"
                    }`}
                >
                  {formData.score_config_ids.includes(config.id) && (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
};

// Add Traces Modal
const AddTracesModal = ({ isOpen, onClose, queue, onSave }) => {
  const [traces, setTraces] = useState([]);
  const [selectedTraceIds, setSelectedTraceIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadTraces();
      setSelectedTraceIds([]);
      setSearchQuery("");
    }
  }, [isOpen]);

  const loadTraces = async () => {
    setLoading(true);
    try {
      const data = await tracesApi.getTraces({ limit: 100 });
      setTraces(data || []);
    } catch (error) {
      console.error("Failed to load traces:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTraces = async () => {
    if (!queue || selectedTraceIds.length === 0) return;
    setSaving(true);
    try {
      const items = selectedTraceIds.map((id) => ({
        object_type: "trace",
        object_id: id,
      }));
      await annotationsApi.addItemsToQueue(queue.id, items);
      onSave();
    } catch (error) {
      console.error("Failed to add traces:", error);
    } finally {
      setSaving(false);
    }
  };

  const toggleTrace = (traceId) => {
    setSelectedTraceIds((prev) =>
      prev.includes(traceId)
        ? prev.filter((id) => id !== traceId)
        : [...prev, traceId]
    );
  };

  const selectAll = () => {
    setSelectedTraceIds(filteredTraces.map((t) => t.id));
  };

  const deselectAll = () => {
    setSelectedTraceIds([]);
  };

  const filteredTraces = traces.filter((trace) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      trace.user_input?.toLowerCase().includes(query) ||
      trace.name?.toLowerCase().includes(query) ||
      trace.model_name?.toLowerCase().includes(query)
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add Traces to "${queue?.name || "Queue"}"`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAddTraces} disabled={saving || selectedTraceIds.length === 0}>
            {saving ? "Adding..." : `Add ${selectedTraceIds.length} Trace${selectedTraceIds.length !== 1 ? "s" : ""}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Search and Selection Controls */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search traces..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <button onClick={selectAll} className="text-blue-400 hover:text-blue-300">
              Select All
            </button>
            <span className="text-slate-600">|</span>
            <button onClick={deselectAll} className="text-slate-400 hover:text-white">
              Deselect All
            </button>
          </div>
        </div>

        {/* Selected count */}
        <div className="text-sm text-slate-400">
          {selectedTraceIds.length} of {filteredTraces.length} traces selected
        </div>

        {/* Traces List */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : filteredTraces.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No traces found. Run some conversations first.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
            {filteredTraces.map((trace) => (
              <label
                key={trace.id}
                className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${selectedTraceIds.includes(trace.id)
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-700 hover:border-slate-600"
                  }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTraceIds.includes(trace.id)}
                  onChange={() => toggleTrace(trace.id)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mr-3 mt-0.5 ${selectedTraceIds.includes(trace.id)
                    ? "border-blue-500 bg-blue-500"
                    : "border-slate-600"
                    }`}
                >
                  {selectedTraceIds.includes(trace.id) && (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-sm font-medium text-white truncate">
                      {trace.name || "Unnamed Trace"}
                    </span>
                    {trace.status && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${trace.status === "pass"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : trace.status === "fail"
                            ? "bg-rose-500/20 text-rose-400"
                            : "bg-amber-500/20 text-amber-400"
                          }`}
                      >
                        {trace.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {trace.user_input || "No input"}
                  </p>
                  <div className="flex items-center space-x-3 mt-1 text-xs text-slate-500">
                    {trace.model_name && <span>{trace.model_name}</span>}
                    {trace.start_time && (
                      <span>{new Date(trace.start_time).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

// View Completed Items Modal
const ViewCompletedModal = ({ isOpen, onClose, queue, scoreConfigs }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [itemAnnotations, setItemAnnotations] = useState({});

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (isOpen && queue) {
      loadCompletedItems();
      setPage(1); // Reset to first page on open
      setExpandedItems(new Set()); // Reset expanded items
    }
  }, [isOpen, queue]);

  const loadCompletedItems = async () => {
    setLoading(true);
    try {
      const data = await annotationsApi.getQueueItems(queue.id, { status: "completed" });
      setItems(data || []);
    } catch (error) {
      console.error("Failed to load completed items:", error);
    } finally {
      setLoading(false);
    }
  };

  // Paginated items
  const paginatedItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, page, pageSize]);

  const loadItemAnnotations = async (item) => {
    if (itemAnnotations[item.id]) return; // Already loaded

    try {
      const data = await annotationsApi.getObjectAnnotations(item.object_type, item.object_id);
      // Filter annotations to only show annotations from this specific queue item
      const queueAnnotations = (data.annotations || []).filter(
        (ann) => ann.queue_item_id === item.id
      );
      setItemAnnotations((prev) => ({ ...prev, [item.id]: queueAnnotations }));
    } catch (error) {
      console.error("Failed to load annotations:", error);
    }
  };

  const toggleExpand = async (item) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item.id)) {
        newSet.delete(item.id);
      } else {
        newSet.add(item.id);
        // Load annotations if not already loaded (fire and forget)
        loadItemAnnotations(item);
      }
      return newSet;
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Completed Annotations - "${queue?.name || "Queue"}"`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Summary */}
        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
          <span className="text-sm text-slate-400">Total completed items:</span>
          <span className="text-lg font-semibold text-emerald-400">{items.length}</span>
        </div>

        {/* Items List */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No completed annotations yet.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
              {paginatedItems.map((item) => (
                <div
                  key={item.id}
                  className="border border-slate-700 rounded-lg overflow-hidden"
                >
                  {/* Item Header */}
                  <button
                    onClick={() => toggleExpand(item)}
                    className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-medium text-white">
                        {item.object_type === "trace" ? "Trace" : "Span"}: {item.object_id.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {item.completed_at && (
                        <span className="text-xs text-slate-500">
                          {new Date(item.completed_at).toLocaleDateString()}
                        </span>
                      )}
                      {expandedItems.has(item.id) ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {expandedItems.has(item.id) && (
                    <div className="p-4 border-t border-slate-700 bg-slate-900/30 space-y-4">
                      {/* Annotations */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-2">Annotations</h4>
                        {itemAnnotations[item.id] ? (
                          itemAnnotations[item.id].length > 0 ? (
                            <div className="space-y-2">
                              {itemAnnotations[item.id].map((ann) => {
                                const config = scoreConfigs.find((c) => c.id === ann.score_config_id);
                                return (
                                  <div
                                    key={ann.id}
                                    className="flex items-center justify-between p-2 bg-slate-800/50 rounded"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm text-slate-400">
                                        {config?.name || "Unknown Score"}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                      <span className="text-lg font-bold text-white">
                                        {ann.value}
                                      </span>
                                      {config?.data_type === "binary" && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${ann.value === 1
                                          ? "bg-emerald-500/20 text-emerald-400"
                                          : "bg-rose-500/20 text-rose-400"
                                          }`}>
                                          {ann.value === 1
                                            ? (config?.binary_labels?.true_label || "Yes")
                                            : (config?.binary_labels?.false_label || "No")}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">No annotations recorded.</p>
                          )
                        ) : (
                          <div className="flex items-center space-x-2 text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Loading annotations...</span>
                          </div>
                        )}
                      </div>

                      {/* Comments */}
                      {itemAnnotations[item.id]?.some((a) => a.comment) && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-300 mb-2">Comments</h4>
                          {itemAnnotations[item.id]
                            .filter((a) => a.comment)
                            .map((ann) => (
                              <div key={`comment-${ann.id}`} className="p-2 bg-slate-800/30 rounded text-sm text-slate-400 italic">
                                "{ann.comment}"
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <PaginationFooter
              currentPage={page}
              totalPages={Math.ceil(items.length / pageSize)}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              className="rounded-lg border border-slate-700 mt-2"
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

// Export Modal
const ExportModal = ({ isOpen, onClose, queue }) => {
  const [format, setFormat] = useState("jsonl");
  const [includeExecutionPath, setIncludeExecutionPath] = useState(false);
  const [includeLLMEvaluation, setIncludeLLMEvaluation] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setFormat("jsonl");
      setIncludeExecutionPath(false);
      setIncludeLLMEvaluation(false);
      setError(null);
    }
  }, [isOpen]);

  const handleExport = async () => {
    if (!queue) return;
    setExporting(true);
    setError(null);
    try {
      await annotationsApi.exportQueueAnnotations(queue.id, {
        format,
        includeExecutionPath,
        includeLLMEvaluation,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const formatOptions = [
    { value: "jsonl", label: "JSONL", desc: "Recommended for fine-tuning" },
    { value: "csv", label: "CSV", desc: "Compatible with spreadsheets" },
    { value: "parquet", label: "Parquet", desc: "Efficient for large datasets" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Annotations"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleExport}
            disabled={exporting || !queue?.completed_items}
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <p className="text-slate-400">
          Export <span className="text-white font-medium">{queue?.completed_items || 0}</span> completed annotations for model training.
        </p>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Format Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Format</label>
          <div className="space-y-2">
            {formatOptions.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${format === opt.value
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-700 hover:border-slate-600"
                  }`}
              >
                <input
                  type="radio"
                  value={opt.value}
                  checked={format === opt.value}
                  onChange={(e) => setFormat(e.target.value)}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="font-medium text-white">{opt.label}</div>
                  <div className="text-xs text-slate-400">{opt.desc}</div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 ${format === opt.value
                    ? "border-blue-500 bg-blue-500"
                    : "border-slate-600"
                    }`}
                />
              </label>
            ))}
          </div>
        </div>

        {/* Additional Data Options */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Include Additional Data</label>
          <div className="space-y-3">
            {/* Execution Path Toggle */}
            <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
              includeExecutionPath
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-slate-700 hover:border-slate-600"
            }`}>
              <input
                type="checkbox"
                checked={includeExecutionPath}
                onChange={(e) => setIncludeExecutionPath(e.target.checked)}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="font-medium text-white flex items-center">
                  <svg className="w-4 h-4 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Execution Path (Spans)
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Include tool calls, LLM invocations, and intermediate steps
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors ${
                includeExecutionPath ? "bg-emerald-500" : "bg-slate-700"
              }`}>
                <div className={`w-4 h-4 rounded-full bg-white mt-1 transition-transform ${
                  includeExecutionPath ? "translate-x-5" : "translate-x-1"
                }`} />
              </div>
            </label>

            {/* LLM Evaluation Toggle */}
            <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
              includeLLMEvaluation
                ? "border-purple-500 bg-purple-500/10"
                : "border-slate-700 hover:border-slate-600"
            } ${!includeExecutionPath ? "opacity-50 pointer-events-none" : ""}`}>
              <input
                type="checkbox"
                checked={includeLLMEvaluation}
                onChange={(e) => setIncludeLLMEvaluation(e.target.checked)}
                disabled={!includeExecutionPath}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="font-medium text-white flex items-center">
                  <svg className="w-4 h-4 mr-2 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  LLM Evaluation Data
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Include LLM-as-a-judge scores, reasoning, and issues for spans
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors ${
                includeLLMEvaluation ? "bg-purple-500" : "bg-slate-700"
              }`}>
                <div className={`w-4 h-4 rounded-full bg-white mt-1 transition-transform ${
                  includeLLMEvaluation ? "translate-x-5" : "translate-x-1"
                }`} />
              </div>
            </label>
            {!includeExecutionPath && (
              <p className="text-xs text-slate-500 pl-3">
                Enable "Execution Path" to include LLM evaluation data
              </p>
            )}
          </div>
        </div>

        {/* Export Preview Info */}
        {(includeExecutionPath || includeLLMEvaluation) && (
          <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <p className="text-xs text-slate-400">
              <span className="text-slate-300 font-medium">Export will include:</span>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                <li>User input & assistant output</li>
                <li>Human annotations</li>
                {includeExecutionPath && <li>Execution path with tool calls and spans</li>}
                {includeLLMEvaluation && <li>LLM-as-a-judge evaluation scores</li>}
              </ul>
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

// Delete Confirmation Modal
const DeleteConfirmModal = ({ isOpen, onClose, queues, onConfirm }) => {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Queue"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-slate-300">
          Are you sure you want to delete{" "}
          <span className="text-white font-semibold">
            {queues.length === 1 ? `"${queues[0]?.name}"` : `${queues.length} queues`}
          </span>
          ?
        </p>
        <p className="text-sm text-slate-500">
          This action cannot be undone. All queue items will be deactivated.
        </p>
      </div>
    </Modal>
  );
};

export default HumanAnnotationPage;
