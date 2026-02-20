/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState, useEffect, useMemo } from "react";
import { formatDate } from "@utils/formatters";
import {
  Plus,
  Database,
  Trash2,
  Download,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  FileJson,
  Eye,
  Upload,
  Package,
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { PaginationFooter } from "../components/ui/PaginationFooter";
import { datasetsApi, annotationsApi } from "../api";
import { ImportChatGPTModal } from "../components/datasets/ImportChatGPTModal";

export const DatasetsPage = () => {
  const [datasets, setDatasets] = useState([]);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalDatasets, setTotalDatasets] = useState(0);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // View state
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [view, setView] = useState("list"); // "list", "detail"

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showImportChatGPTModal, setShowImportChatGPTModal] = useState(false);
  const [datasetForAction, setDatasetForAction] = useState(null);

  useEffect(() => {
    loadData();
  }, [page, pageSize, searchQuery]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [datasetsData, queuesData] = await Promise.all([
        datasetsApi.getDatasets({ page, pageSize, search: searchQuery }),
        annotationsApi.getAnnotationQueues(),
      ]);
      setDatasets(datasetsData.datasets || []);
      setTotalDatasets(datasetsData.total || 0);
      setQueues(queuesData || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDataset = (dataset) => {
    setSelectedDataset(dataset);
    setView("detail");
  };

  const handleBackToList = () => {
    setSelectedDataset(null);
    setView("list");
    loadData();
  };

  const handleExport = (dataset) => {
    setDatasetForAction(dataset);
    setShowExportModal(true);
  };

  const handleDelete = (dataset) => {
    setDatasetForAction(dataset);
    setShowDeleteModal(true);
  };

  const handleEdit = (dataset) => {
    setDatasetForAction(dataset);
    setShowEditModal(true);
  };

  const handleAddItem = (dataset) => {
    setDatasetForAction(dataset);
    setShowAddItemModal(true);
  };

  const confirmDelete = async () => {
    if (!datasetForAction) return;
    try {
      await datasetsApi.deleteDataset(datasetForAction.id);
      loadData();
    } catch (error) {
      console.error("Failed to delete dataset:", error);
    } finally {
      setShowDeleteModal(false);
      setDatasetForAction(null);
    }
  };

  const hasDatasets = datasets.length > 0 || totalDatasets > 0;
  const completedQueues = queues.filter((q) => q.completed_items > 0);

  // Dataset Detail View
  if (view === "detail" && selectedDataset) {
    return (
      <>
        <DatasetDetailView
          dataset={selectedDataset}
          onBack={handleBackToList}
          onExport={handleExport}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onAddItem={handleAddItem}
        />

        {/* Modals - must be rendered in detail view too */}
        <ExportDatasetModal
          isOpen={showExportModal}
          onClose={() => {
            setShowExportModal(false);
            setDatasetForAction(null);
          }}
          dataset={datasetForAction}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDatasetForAction(null);
          }}
          dataset={datasetForAction}
          onConfirm={confirmDelete}
        />

        <EditDatasetModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setDatasetForAction(null);
          }}
          dataset={datasetForAction}
          onSave={(updatedDataset) => {
            setSelectedDataset(updatedDataset);
            setShowEditModal(false);
            setDatasetForAction(null);
          }}
        />

        <AddItemModal
          isOpen={showAddItemModal}
          onClose={() => {
            setShowAddItemModal(false);
            setDatasetForAction(null);
          }}
          dataset={datasetForAction}
          onSave={() => {
            setShowAddItemModal(false);
            setDatasetForAction(null);
            // Trigger reload in detail view
            setSelectedDataset({ ...selectedDataset });
          }}
        />
      </>
    );
  }

  // Loading state
  if (loading && datasets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Datasets</h1>
          <p className="mt-1 text-slate-400">
            Manage evaluation datasets for testing and fine-tuning
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {completedQueues.length > 0 && (
            <Button variant="secondary" onClick={() => setShowPublishModal(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Publish from Queue
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowImportChatGPTModal(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import ChatGPT
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Dataset
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {!hasDatasets && !loading && (
        <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30 p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Database className="w-8 h-8 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">Get Started with Datasets</h3>
              <p className="text-slate-400 mb-4">
                Datasets are collections of input/output pairs used for evaluation and fine-tuning.
                Create datasets by:
              </p>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <div className="font-medium text-white">Create Manually</div>
                    <div className="text-sm text-slate-400">Add items with input/expected output pairs</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <div className="font-medium text-white">Publish from Annotations</div>
                    <div className="text-sm text-slate-400">Convert completed annotation queues to datasets</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <div className="font-medium text-white">Import from ChatGPT</div>
                    <div className="text-sm text-slate-400">Upload your ChatGPT export data as a dataset</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Dataset
                </Button>
                {completedQueues.length > 0 && (
                  <Button variant="secondary" onClick={() => setShowPublishModal(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Publish from Queue
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Search Bar */}
      {hasDatasets && (
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search datasets..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-sm text-slate-400">
            {totalDatasets} dataset{totalDatasets !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Datasets List */}
      {hasDatasets && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : datasets.length === 0 ? (
            <Card className="p-8 text-center">
              <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-white mb-2">No Datasets Found</h4>
              <p className="text-slate-400">
                Try adjusting your search query.
              </p>
            </Card>
          ) : (
            <>
              {datasets.map((dataset) => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  onView={handleViewDataset}
                  onExport={handleExport}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}

              <PaginationFooter
                currentPage={page}
                totalPages={Math.ceil(totalDatasets / pageSize)}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                className="rounded-lg mt-4 border border-slate-700"
              />
            </>
          )}
        </div>
      )}

      {/* Quick Stats */}
      {hasDatasets && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/50 p-4">
            <div className="text-sm text-slate-400 mb-1">Total Datasets</div>
            <div className="text-2xl font-bold text-white">{totalDatasets}</div>
          </Card>
          <Card className="bg-slate-900/50 p-4">
            <div className="text-sm text-slate-400 mb-1">Total Items</div>
            <div className="text-2xl font-bold text-blue-400">
              {datasets.reduce((acc, d) => acc + (d.item_count || 0), 0)}
            </div>
          </Card>
          <Card className="bg-slate-900/50 p-4">
            <div className="text-sm text-slate-400 mb-1">From Annotations</div>
            <div className="text-2xl font-bold text-emerald-400">
              {datasets.filter((d) => d.source_type === "annotation_queue").length}
            </div>
          </Card>
        </div>
      )}

      {/* Modals */}
      <CreateDatasetModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={() => {
          loadData();
          setShowCreateModal(false);
        }}
      />

      <PublishFromQueueModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        queues={completedQueues}
        onSave={() => {
          loadData();
          setShowPublishModal(false);
        }}
      />

      <ExportDatasetModal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setDatasetForAction(null);
        }}
        dataset={datasetForAction}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDatasetForAction(null);
        }}
        dataset={datasetForAction}
        onConfirm={confirmDelete}
      />

      <EditDatasetModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setDatasetForAction(null);
        }}
        dataset={datasetForAction}
        onSave={() => {
          loadData();
          setShowEditModal(false);
          setDatasetForAction(null);
        }}
      />

      <AddItemModal
        isOpen={showAddItemModal}
        onClose={() => {
          setShowAddItemModal(false);
          setDatasetForAction(null);
        }}
        dataset={datasetForAction}
        onSave={() => {
          loadData();
          setShowAddItemModal(false);
          setDatasetForAction(null);
        }}
      />

      <ImportChatGPTModal
        isOpen={showImportChatGPTModal}
        onClose={() => setShowImportChatGPTModal(false)}
        onSuccess={() => {
          loadData();
          setShowImportChatGPTModal(false);
        }}
      />
    </div>
  );
};

// Dataset Card Component
const DatasetCard = ({ dataset, onView, onExport, onDelete, onEdit }) => {
  const sourceLabel = {
    manual: "Manual",
    annotation_queue: "From Annotations",
    import: "Imported",
    chatgpt_import: "ChatGPT Import",
  };

  return (
    <Card className="p-4 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          <div className="p-2 bg-blue-500/20 rounded-lg shrink-0">
            <Database className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-medium text-white truncate">{dataset.name}</h3>
              <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded">
                v{dataset.version}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${dataset.source_type === "annotation_queue"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : dataset.source_type === "chatgpt_import"
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-slate-700 text-slate-400"
                }`}>
                {sourceLabel[dataset.source_type] || dataset.source_type}
              </span>
            </div>
            {dataset.description && (
              <p className="text-sm text-slate-400 truncate mt-0.5">{dataset.description}</p>
            )}
            <div className="flex items-center space-x-4 mt-1 text-xs text-slate-500">
              <span>{dataset.item_count} items</span>
              <span>Created {formatDate(dataset.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-4">
          <Button size="sm" variant="ghost" onClick={() => onView(dataset)}>
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(dataset)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onExport(dataset)}>
            <Download className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300" onClick={() => onDelete(dataset)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

// Dataset Detail View Component
const DatasetDetailView = ({ dataset, onBack, onExport, onDelete, onEdit, onAddItem }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [savingItem, setSavingItem] = useState(false);
  const [itemError, setItemError] = useState(null);

  useEffect(() => {
    loadItems();
    loadStats();
  }, [dataset.id, page, pageSize]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await datasetsApi.getDatasetItems(dataset.id, { page, pageSize });
      setItems(data.items || []);
      setTotalItems(data.total || 0);
    } catch (error) {
      console.error("Failed to load items:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await datasetsApi.getDatasetStats(dataset.id);
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const toggleExpand = (itemId) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditFormData({
      input: JSON.stringify(item.input, null, 2),
      expected_output: item.expected_output ? JSON.stringify(item.expected_output, null, 2) : "",
      metadata: item.metadata ? JSON.stringify(item.metadata, null, 2) : "",
    });
    setItemError(null);
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
    setEditFormData({});
    setItemError(null);
  };

  const saveEditItem = async (itemId) => {
    setSavingItem(true);
    setItemError(null);
    try {
      // Parse JSON fields
      const input = JSON.parse(editFormData.input);
      const expectedOutput = editFormData.expected_output.trim()
        ? JSON.parse(editFormData.expected_output)
        : null;
      const metadata = editFormData.metadata.trim()
        ? JSON.parse(editFormData.metadata)
        : null;

      await datasetsApi.updateDatasetItem(dataset.id, itemId, {
        input,
        expectedOutput,
        metadata,
      });

      // Reload items
      await loadItems();
      setEditingItemId(null);
      setEditFormData({});
    } catch (err) {
      if (err instanceof SyntaxError) {
        setItemError("Invalid JSON format. Please check your input.");
      } else {
        setItemError(err.message || "Failed to save item");
      }
    } finally {
      setSavingItem(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-white">{dataset.name}</h1>
              <span className="text-sm px-2 py-0.5 bg-slate-700 text-slate-300 rounded">
                v{dataset.version}
              </span>
            </div>
            {dataset.description && (
              <p className="text-slate-400 mt-1">{dataset.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="secondary" onClick={() => onAddItem(dataset)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
          <Button variant="secondary" onClick={() => onEdit(dataset)}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="secondary" onClick={() => onExport(dataset)}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="danger" onClick={() => onDelete(dataset)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 p-4">
            <div className="text-sm text-slate-400 mb-1">Total Items</div>
            <div className="text-xl font-bold text-white">{stats.total_items}</div>
          </Card>
          <Card className="bg-slate-900/50 p-4">
            <div className="text-sm text-slate-400 mb-1">With Expected Output</div>
            <div className="text-xl font-bold text-emerald-400">{stats.items_with_expected_output}</div>
          </Card>
          <Card className="bg-slate-900/50 p-4">
            <div className="text-sm text-slate-400 mb-1">From Traces</div>
            <div className="text-xl font-bold text-blue-400">{stats.items_from_traces}</div>
          </Card>
          <Card className="bg-slate-900/50 p-4">
            <div className="text-sm text-slate-400 mb-1">From Spans</div>
            <div className="text-xl font-bold text-purple-400">{stats.items_from_spans}</div>
          </Card>
        </div>
      )}

      {/* Items List */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Dataset Items</h3>
          <span className="text-sm text-slate-400">{totalItems} items</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No items in this dataset yet.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="border border-slate-700 rounded-lg overflow-hidden"
              >
                {/* Item Header */}
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <FileJson className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-sm text-white truncate">
                      {typeof item.input === "object"
                        ? item.input.user_input || JSON.stringify(item.input).slice(0, 60)
                        : String(item.input).slice(0, 60)}
                      {String(item.input.user_input || JSON.stringify(item.input)).length > 60 && "..."}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {item.source_trace_id && (
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                        trace
                      </span>
                    )}
                    {item.source_span_id && (
                      <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                        span
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
                    {/* Edit/View Toggle */}
                    <div className="flex items-center justify-end space-x-2">
                      {editingItemId === item.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEditItem}
                            disabled={savingItem}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveEditItem(item.id)}
                            disabled={savingItem}
                          >
                            <Save className="w-4 h-4 mr-1" />
                            {savingItem ? "Saving..." : "Save"}
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditItem(item)}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Edit Item
                        </Button>
                      )}
                    </div>

                    {/* Error Message */}
                    {editingItemId === item.id && itemError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                        {itemError}
                      </div>
                    )}

                    {/* Input */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-slate-300">Input *</h4>
                        {editingItemId !== item.id && (
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(item.input, null, 2), `input-${item.id}`)}
                            className="text-xs text-slate-400 hover:text-white flex items-center"
                          >
                            {copiedId === `input-${item.id}` ? (
                              <Check className="w-3 h-3 mr-1" />
                            ) : (
                              <Copy className="w-3 h-3 mr-1" />
                            )}
                            Copy
                          </button>
                        )}
                      </div>
                      {editingItemId === item.id ? (
                        <textarea
                          value={editFormData.input}
                          onChange={(e) => setEditFormData({ ...editFormData, input: e.target.value })}
                          rows={6}
                          className="w-full p-3 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder='{"key": "value"}'
                        />
                      ) : (
                        <pre className="p-3 bg-slate-800 rounded text-xs text-slate-300 overflow-x-auto">
                          {JSON.stringify(item.input, null, 2)}
                        </pre>
                      )}
                    </div>

                    {/* Expected Output */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-slate-300">Expected Output</h4>
                        {editingItemId !== item.id && item.expected_output && (
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(item.expected_output, null, 2), `output-${item.id}`)}
                            className="text-xs text-slate-400 hover:text-white flex items-center"
                          >
                            {copiedId === `output-${item.id}` ? (
                              <Check className="w-3 h-3 mr-1" />
                            ) : (
                              <Copy className="w-3 h-3 mr-1" />
                            )}
                            Copy
                          </button>
                        )}
                      </div>
                      {editingItemId === item.id ? (
                        <textarea
                          value={editFormData.expected_output}
                          onChange={(e) => setEditFormData({ ...editFormData, expected_output: e.target.value })}
                          rows={6}
                          className="w-full p-3 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder='{"expected": "output"} (optional)'
                        />
                      ) : item.expected_output ? (
                        <pre className="p-3 bg-slate-800 rounded text-xs text-slate-300 overflow-x-auto">
                          {JSON.stringify(item.expected_output, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No expected output defined</p>
                      )}
                    </div>

                    {/* Metadata */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-slate-300">Metadata</h4>
                      </div>
                      {editingItemId === item.id ? (
                        <textarea
                          value={editFormData.metadata}
                          onChange={(e) => setEditFormData({ ...editFormData, metadata: e.target.value })}
                          rows={4}
                          className="w-full p-3 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder='{"key": "value"} (optional)'
                        />
                      ) : item.metadata && Object.keys(item.metadata).length > 0 ? (
                        <pre className="p-3 bg-slate-800 rounded text-xs text-slate-300 overflow-x-auto max-h-40">
                          {JSON.stringify(item.metadata, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No metadata</p>
                      )}
                    </div>

                    {/* Annotations (read-only) */}
                    {item.annotations && Object.keys(item.annotations).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-2">Annotations</h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(item.annotations).map(([key, ann]) => (
                            <div
                              key={key}
                              className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-sm"
                            >
                              <span className="text-slate-400">{key}:</span>{" "}
                              <span className="text-emerald-400 font-medium">
                                {ann.label || ann.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Source Links */}
                    {(item.source_trace_id || item.source_span_id) && (
                      <div className="flex items-center space-x-4 text-xs text-slate-500">
                        {item.source_trace_id && (
                          <span>Trace: {item.source_trace_id.slice(0, 8)}...</span>
                        )}
                        {item.source_span_id && (
                          <span>Span: {item.source_span_id.slice(0, 8)}...</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            <PaginationFooter
              currentPage={page}
              totalPages={Math.ceil(totalItems / pageSize)}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              className="rounded-lg mt-4 border border-slate-700"
            />
          </div>
        )}
      </Card>
    </div>
  );
};

// Create Dataset Modal
const CreateDatasetModal = ({ isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({ name: "", description: "" });
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await datasetsApi.createDataset(formData);
      onSave();
    } catch (err) {
      setError(err.message || "Failed to create dataset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Dataset"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !formData.name}>
            {saving ? "Creating..." : "Create Dataset"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Dataset Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., customer-support-eval-v1"
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">Use "/" for folders: "evaluation/qa-dataset"</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="What is this dataset for?"
            rows={3}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </form>
    </Modal>
  );
};

// Publish from Queue Modal
const PublishFromQueueModal = ({ isOpen, onClose, queues, onSave }) => {
  const [selectedQueueId, setSelectedQueueId] = useState("");
  const [formData, setFormData] = useState({
    datasetName: "",
    description: "",
    includeExecutionPath: false,
    includeLLMEvaluation: false,
    onlyCompleted: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedQueueId(queues[0]?.id || "");
      setFormData({
        datasetName: "",
        description: "",
        includeExecutionPath: false,
        includeLLMEvaluation: false,
        onlyCompleted: true,
      });
      setError(null);
    }
  }, [isOpen, queues]);

  const selectedQueue = queues.find((q) => q.id === selectedQueueId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedQueueId) return;
    setSaving(true);
    setError(null);
    try {
      await datasetsApi.publishFromQueue(selectedQueueId, formData);
      onSave();
    } catch (err) {
      setError(err.message || "Failed to publish dataset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Publish Dataset from Annotation Queue"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !formData.datasetName || !selectedQueueId}>
            {saving ? "Publishing..." : "Publish Dataset"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Queue Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Select Queue *</label>
          <select
            value={selectedQueueId}
            onChange={(e) => setSelectedQueueId(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {queues.map((queue) => (
              <option key={queue.id} value={queue.id}>
                {queue.name} ({queue.completed_items} completed items)
              </option>
            ))}
          </select>
        </div>

        {/* Dataset Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Dataset Name *</label>
          <input
            type="text"
            value={formData.datasetName}
            onChange={(e) => setFormData({ ...formData, datasetName: e.target.value })}
            placeholder="e.g., customer-support-annotated-v1"
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
            rows={2}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Options */}
        <div className="space-y-3">
          <label className="flex items-center p-3 rounded-lg border border-slate-700 hover:border-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.includeExecutionPath}
              onChange={(e) => setFormData({ ...formData, includeExecutionPath: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600"
            />
            <div className="ml-3">
              <div className="text-sm font-medium text-white">Include Execution Path</div>
              <div className="text-xs text-slate-400">Include spans and tool calls in metadata</div>
            </div>
          </label>

          <label className={`flex items-center p-3 rounded-lg border border-slate-700 hover:border-slate-600 cursor-pointer ${!formData.includeExecutionPath ? "opacity-50" : ""
            }`}>
            <input
              type="checkbox"
              checked={formData.includeLLMEvaluation}
              onChange={(e) => setFormData({ ...formData, includeLLMEvaluation: e.target.checked })}
              disabled={!formData.includeExecutionPath}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600"
            />
            <div className="ml-3">
              <div className="text-sm font-medium text-white">Include LLM Evaluation</div>
              <div className="text-xs text-slate-400">Include LLM-as-a-judge scores for spans</div>
            </div>
          </label>
        </div>

        {/* Preview */}
        {selectedQueue && (
          <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <p className="text-sm text-slate-400">
              Will create dataset with{" "}
              <span className="text-white font-medium">{selectedQueue.completed_items}</span> items
              from completed annotations.
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
};

// Export Dataset Modal
const ExportDatasetModal = ({ isOpen, onClose, dataset }) => {
  const [format, setFormat] = useState("jsonl");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setFormat("jsonl");
      setError(null);
    }
  }, [isOpen]);

  const handleExport = async () => {
    if (!dataset) return;
    setExporting(true);
    setError(null);
    try {
      await datasetsApi.exportDataset(dataset.id, { format });
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
      title="Export Dataset"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleExport} disabled={exporting || !dataset?.item_count}>
            <Download className="w-4 h-4 mr-2" />
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-slate-400">
          Export <span className="text-white font-medium">{dataset?.item_count || 0}</span> items
          from "{dataset?.name}".
        </p>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

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
                <div className={`w-4 h-4 rounded-full border-2 ${format === opt.value ? "border-blue-500 bg-blue-500" : "border-slate-600"
                  }`} />
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

// Delete Confirm Modal
const DeleteConfirmModal = ({ isOpen, onClose, dataset, onConfirm }) => {
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
      title="Delete Dataset"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button variant="danger" onClick={handleConfirm} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-slate-300">
          Are you sure you want to delete{" "}
          <span className="text-white font-semibold">"{dataset?.name}"</span>?
        </p>
        <p className="text-sm text-slate-500">
          This will archive the dataset and its {dataset?.item_count || 0} items.
        </p>
      </div>
    </Modal>
  );
};

// Edit Dataset Modal
const EditDatasetModal = ({ isOpen, onClose, dataset, onSave }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && dataset) {
      setFormData({
        name: dataset.name || "",
        description: dataset.description || "",
      });
      setError(null);
    }
  }, [isOpen, dataset]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dataset) return;
    setSaving(true);
    setError(null);
    try {
      const updatedDataset = await datasetsApi.updateDataset(dataset.id, formData);
      onSave(updatedDataset);
    } catch (err) {
      setError(err.message || "Failed to update dataset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Dataset"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !formData.name}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Dataset Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., customer-support-eval-v1"
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="What is this dataset for?"
            rows={3}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </form>
    </Modal>
  );
};

// Add Item Modal
const AddItemModal = ({ isOpen, onClose, dataset, onSave }) => {
  const [formData, setFormData] = useState({
    input: '{\n  "user_input": ""\n}',
    expected_output: "",
    metadata: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        input: '{\n  "user_input": ""\n}',
        expected_output: "",
        metadata: "",
      });
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dataset) return;
    setSaving(true);
    setError(null);
    try {
      // Parse JSON fields
      const input = JSON.parse(formData.input);
      const expectedOutput = formData.expected_output.trim()
        ? JSON.parse(formData.expected_output)
        : null;
      const metadata = formData.metadata.trim()
        ? JSON.parse(formData.metadata)
        : null;

      await datasetsApi.createDatasetItem(dataset.id, {
        input,
        expectedOutput,
        metadata,
      });

      onSave();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Invalid JSON format. Please check your input.");
      } else {
        setError(err.message || "Failed to add item");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Dataset Item"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Adding..." : "Add Item"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Input * (JSON)</label>
          <textarea
            value={formData.input}
            onChange={(e) => setFormData({ ...formData, input: e.target.value })}
            rows={6}
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder='{"user_input": "What is the weather?"}'
          />
          <p className="text-xs text-slate-500 mt-1">The test input data in JSON format</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Expected Output (JSON, optional)</label>
          <textarea
            value={formData.expected_output}
            onChange={(e) => setFormData({ ...formData, expected_output: e.target.value })}
            rows={6}
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder='{"response": "The expected response..."}'
          />
          <p className="text-xs text-slate-500 mt-1">The expected/ideal output (ground truth)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Metadata (JSON, optional)</label>
          <textarea
            value={formData.metadata}
            onChange={(e) => setFormData({ ...formData, metadata: e.target.value })}
            rows={3}
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder='{"category": "greeting", "difficulty": "easy"}'
          />
          <p className="text-xs text-slate-500 mt-1">Additional context about this item</p>
        </div>
      </form>
    </Modal>
  );
};

export default DatasetsPage;
