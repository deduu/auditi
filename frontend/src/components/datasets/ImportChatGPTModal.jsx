import React, { useState, useEffect } from "react";
import {
  Upload,
  FileJson,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Filter,
  X,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { datasetsApi } from "../../api";

export const ImportChatGPTModal = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState(1); // 1=upload, 2=preview, 3=confirm
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filter config
  const [filters, setFilters] = useState({
    skip_system_messages: true,
    model_filter: "",
    date_from: "",
    date_to: "",
    min_message_length: 1,
    max_conversations: "",
  });

  // Preview data
  const [preview, setPreview] = useState(null);

  // Commit config
  const [datasetName, setDatasetName] = useState("");
  const [description, setDescription] = useState("");
  const [importing, setImporting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFile(null);
      setError(null);
      setPreview(null);
      setDatasetName("");
      setDescription("");
      setLoading(false);
      setImporting(false);
      setFilters({
        skip_system_messages: true,
        model_filter: "",
        date_from: "",
        date_to: "",
        min_message_length: 1,
        max_conversations: "",
      });
    }
  }, [isOpen]);

  const validateAndSetFile = (f) => {
    setError(null);
    const validExtensions = [".json", ".zip"];
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));

    if (!validExtensions.includes(ext)) {
      setError("Please upload a .json or .zip file");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError("File too large. Maximum size is 50MB.");
      return;
    }
    setFile(f);
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected) validateAndSetFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSetFile(dropped);
  };

  const buildFilterConfig = () => {
    const config = { skip_system_messages: filters.skip_system_messages };
    if (filters.model_filter) config.model_filter = filters.model_filter;
    if (filters.date_from) config.date_from = filters.date_from;
    if (filters.date_to) config.date_to = filters.date_to;
    if (filters.min_message_length > 0)
      config.min_message_length = filters.min_message_length;
    if (filters.max_conversations)
      config.max_conversations = parseInt(filters.max_conversations);
    return config;
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const data = await datasetsApi.previewChatGPTImport(
        file,
        buildFilterConfig()
      );
      setPreview(data);

      if (!datasetName) {
        const baseName = file.name.replace(/\.(json|zip)$/i, "");
        setDatasetName(`chatgpt-import-${baseName}`);
      }

      setStep(2);
    } catch (err) {
      setError(err.message || "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !datasetName) return;
    setImporting(true);
    setError(null);
    try {
      const commitConfig = {
        dataset_name: datasetName,
        description: description || undefined,
        ...buildFilterConfig(),
      };
      await datasetsApi.commitChatGPTImport(file, commitConfig);
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to import");
    } finally {
      setImporting(false);
    }
  };

  // ---- Sub-components ----

  const StepIndicator = () => (
    <div className="flex items-center space-x-2 mb-6">
      {[
        { num: 1, label: "Upload" },
        { num: 2, label: "Preview" },
        { num: 3, label: "Import" },
      ].map((s, i) => (
        <React.Fragment key={s.num}>
          {i > 0 && (
            <div
              className={`flex-1 h-0.5 ${step >= s.num ? "bg-blue-500" : "bg-slate-700"}`}
            />
          )}
          <div
            className={`flex items-center space-x-2 ${step >= s.num ? "text-blue-400" : "text-slate-500"}`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s.num
                  ? "bg-blue-500 text-white"
                  : step > s.num
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-slate-700 text-slate-500"
              }`}
            >
              {step > s.num ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                s.num
              )}
            </div>
            <span className="text-sm font-medium">{s.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );

  const FilterSection = () => {
    const [expanded, setExpanded] = useState(false);
    return (
      <div className="border border-slate-700 rounded-lg">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">
              Filter Options
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
        {expanded && (
          <div className="p-3 border-t border-slate-700 space-y-3">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={filters.skip_system_messages}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    skip_system_messages: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600"
              />
              <span className="text-sm text-slate-300">
                Skip system/tool messages
              </span>
            </label>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Model Filter
              </label>
              <input
                type="text"
                value={filters.model_filter}
                onChange={(e) =>
                  setFilters({ ...filters, model_filter: e.target.value })
                }
                placeholder="e.g., gpt-4, gpt-4o"
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) =>
                    setFilters({ ...filters, date_from: e.target.value })
                  }
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) =>
                    setFilters({ ...filters, date_to: e.target.value })
                  }
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Min Message Length (chars)
              </label>
              <input
                type="number"
                value={filters.min_message_length}
                min="0"
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    min_message_length: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Max Conversations (optional)
              </label>
              <input
                type="number"
                value={filters.max_conversations}
                min="1"
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    max_conversations: e.target.value,
                  })
                }
                placeholder="Import all"
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const UploadStep = () => (
    <div className="space-y-4">
      {/* Drag and drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-500/5"
            : file
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-slate-700 hover:border-slate-600"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {file ? (
          <div className="space-y-2">
            <FileJson className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-white font-medium">{file.name}</p>
            <p className="text-sm text-slate-400">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              onClick={() => setFile(null)}
              className="text-sm text-red-400 hover:text-red-300 inline-flex items-center"
            >
              <X className="w-3 h-3 mr-1" />
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="w-12 h-12 text-slate-500 mx-auto" />
            <p className="text-white">Drop your ChatGPT export file here</p>
            <p className="text-sm text-slate-400">
              or click to browse (.zip or .json)
            </p>
            <input
              type="file"
              accept=".json,.zip"
              onChange={handleFileSelect}
              className="hidden"
              id="chatgpt-file-input"
            />
            <label htmlFor="chatgpt-file-input">
              <span className="inline-flex items-center px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
                Browse Files
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400">
        <p>
          Upload your ChatGPT data export file. You can get this from ChatGPT
          Settings &gt; Data Controls &gt; Export Data.
        </p>
        <p className="mt-1">
          Accepted:{" "}
          <span className="text-white">.zip</span> (full export) or{" "}
          <span className="text-white">conversations.json</span>
        </p>
      </div>

      <FilterSection />
    </div>
  );

  const PreviewStep = () => (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-slate-800/50 p-3">
          <div className="text-xs text-slate-400">Conversations</div>
          <div className="text-lg font-bold text-white">
            {preview.filtered_conversations}
          </div>
          <div className="text-xs text-slate-500">
            of {preview.total_conversations_in_file} total
          </div>
        </Card>
        <Card className="bg-slate-800/50 p-3">
          <div className="text-xs text-slate-400">Dataset Items</div>
          <div className="text-lg font-bold text-blue-400">
            {preview.total_items}
          </div>
          <div className="text-xs text-slate-500">user/assistant pairs</div>
        </Card>
        <Card className="bg-slate-800/50 p-3">
          <div className="text-xs text-slate-400">Models Found</div>
          <div className="text-lg font-bold text-emerald-400">
            {preview.model_slugs_found.length}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {preview.model_slugs_found.join(", ") || "N/A"}
          </div>
        </Card>
      </div>

      {/* Date range */}
      {preview.date_range && (
        <div className="text-sm text-slate-400">
          Date range:{" "}
          <span className="text-white">
            {new Date(preview.date_range.earliest).toLocaleDateString()}
          </span>{" "}
          to{" "}
          <span className="text-white">
            {new Date(preview.date_range.latest).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Skipped reasons */}
      {Object.keys(preview.skipped_reasons).length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-sm font-medium text-amber-400 mb-2">
            Skipped items:
          </p>
          <div className="space-y-1">
            {Object.entries(preview.skipped_reasons).map(([reason, count]) => (
              <div key={reason} className="flex justify-between text-sm">
                <span className="text-slate-400">
                  {reason.replace(/_/g, " ")}
                </span>
                <span className="text-amber-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample items */}
      {preview.sample_items.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">
            Sample Items (first {preview.sample_items.length})
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {preview.sample_items.map((item, i) => (
              <div
                key={i}
                className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg"
              >
                <div className="text-xs text-blue-400 mb-1">User:</div>
                <p className="text-sm text-white mb-2 line-clamp-2">
                  {item.input?.user_input}
                </p>
                <div className="text-xs text-emerald-400 mb-1">Assistant:</div>
                <p className="text-sm text-slate-300 line-clamp-2">
                  {item.expected_output?.assistant_output}
                </p>
                {item.metadata?.model_slug && (
                  <div className="mt-1 text-xs text-slate-500">
                    Model: {item.metadata.model_slug}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const ConfirmStep = () => (
    <div className="space-y-4">
      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
        <p className="text-blue-400">
          Ready to create a dataset with{" "}
          <span className="font-bold text-white">{preview.total_items}</span>{" "}
          items from{" "}
          <span className="font-bold text-white">
            {preview.filtered_conversations}
          </span>{" "}
          conversations.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Dataset Name *
        </label>
        <input
          type="text"
          value={datasetName}
          onChange={(e) => setDatasetName(e.target.value)}
          placeholder="e.g., chatgpt-customer-support-v1"
          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Imported from ChatGPT conversations..."
          rows={3}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center w-full">
      {step > 1 && (
        <Button
          variant="ghost"
          onClick={() => setStep(step - 1)}
          disabled={loading || importing}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      )}
      <div className="flex-1" />
      <div className="flex items-center space-x-2">
        <Button variant="ghost" onClick={onClose} disabled={importing}>
          Cancel
        </Button>
        {step === 1 && (
          <Button onClick={handlePreview} disabled={!file || loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                Preview
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        )}
        {step === 2 && (
          <Button
            onClick={() => setStep(3)}
            disabled={!preview || preview.total_items === 0}
          >
            Continue
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
        {step === 3 && (
          <Button
            onClick={handleCommit}
            disabled={importing || !datasetName.trim()}
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>Import {preview?.total_items} Items</>
            )}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import ChatGPT Conversations"
      size="lg"
      footer={footer}
    >
      <StepIndicator />

      {error && (
        <div className="p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-start">
          <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {step === 1 && <UploadStep />}
      {step === 2 && <PreviewStep />}
      {step === 3 && <ConfirmStep />}
    </Modal>
  );
};

export default ImportChatGPTModal;
