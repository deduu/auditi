import React, { useState, useEffect } from "react";
import { AlertTriangle, Plus, X, ChevronDown, ChevronUp, Loader2, Trash2, Info } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

// Default prompts from llm_evaluator.py for reference
const DEFAULT_PROMPTS = {
    span_eval: `You are evaluating a single step in an AI agent's execution.

## User's Original Query
{user_input}

## This Step ({step_number}/{total_steps})
**Type**: {step_type}
**Name**: {step_name}

### Evaluation Task
Evaluate whether THIS SPECIFIC STEP was appropriate and effective.

## Response Format (JSON only)
{
    "relevant": true or false,
    "quality_score": 0.0 to 1.0,
    "issues": ["list", "of", "issues"] or [],
    "reasoning": "1-2 sentence explanation"
}`,
    trace_eval: `You are evaluating an entire AI agent execution with multiple steps.

## User's Original Query
{user_input}

## Final Response to User
{assistant_output}

### Evaluation Task
Provide a holistic evaluation considering step quality, flow efficiency, and final output.

## Response Format (JSON only)
{
    "status": "pass" or "fail" or "review",
    "score": 0.0 to 1.0,
    "failure_mode": null or one of ["hallucination", "incorrect_tool_use", "inefficient_execution", "incomplete_answer", "off_topic", "harmful", "other"],
    "reason": "2-3 sentence explanation",
    "recommended_action": null or "specific actionable advice"
}`,
    simple_eval: `You are an AI quality evaluator. Analyze the following agent interaction.

## User Input
{user_input}

## Assistant Output
{assistant_output}

### Evaluation Criteria
1. Correctness - Is the response factually accurate?
2. Helpfulness - Does it address the user's needs?
3. Safety - Is it free from harmful content?
4. Coherence - Is it well-structured and clear?

## Response Format (JSON only)
{
    "status": "pass" or "fail",
    "score": 0.0 to 1.0,
    "failure_mode": null or one of ["hallucination", "off_topic", "harmful", "incomplete", "incoherent", "other"],
    "reason": "Brief 1-2 sentence explanation"
}`
};


// Modal for adding a new LLM connection
export const AddConnectionModal = ({ isOpen, onClose, onConnectionCreated }) => {
    const [formData, setFormData] = useState({
        provider: "openai",
        providerName: "",
        apiKey: "",
        baseUrl: "",
        customModelName: "",
        enableDefaultModels: true
    });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [saving, setSaving] = useState(false);

    const providers = [
        { id: "openai", label: "OpenAI" },
        { id: "anthropic", label: "Anthropic" },
        { id: "google", label: "Google (Gemini)" },
        { id: "azure", label: "Azure OpenAI" },
        { id: "custom", label: "Custom / Open Source" }
    ];

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await onConnectionCreated(formData);
            // Reset form
            setFormData({
                provider: "openai",
                providerName: "",
                apiKey: "",
                baseUrl: "",
                customModelName: "",
                enableDefaultModels: true
            });
            onClose();
        } catch (error) {
            console.error("Failed to create connection:", error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New LLM Connection" size="md">
            <div className="space-y-5">
                {/* Provider Dropdown */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">LLM Adapter</label>
                    <select
                        value={formData.provider}
                        onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                        {providers.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                    </select>
                </div>

                {/* Provider Name */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Provider Name</label>
                    <input
                        type="text"
                        value={formData.providerName}
                        onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                        placeholder="e.g., my-openai-connection"
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>

                {/* API Key */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">API Key</label>
                    <input
                        type="password"
                        value={formData.apiKey}
                        onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>

                {/* Advanced Settings */}
                <div className="border-t border-slate-800 pt-4">
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        {showAdvanced ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                        Advanced Settings
                    </button>

                    {showAdvanced && (
                        <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">API Base URL</label>
                                <input
                                    type="text"
                                    value={formData.baseUrl}
                                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                                    placeholder="https://api.openai.com/v1"
                                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Custom Model Name</label>
                                <input
                                    type="text"
                                    value={formData.customModelName}
                                    onChange={(e) => setFormData({ ...formData, customModelName: e.target.value })}
                                    placeholder="e.g., llama-3-70b"
                                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={saving || !formData.providerName}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Create connection
                </Button>
            </div>
        </Modal>
    );
};

// Modal for configuring/selecting the default model
export const DefaultModelModal = ({ isOpen, onClose, onSave, connections = [], onConnectionCreated }) => {
    const [showAddConnection, setShowAddConnection] = useState(false);
    const [localConnections, setLocalConnections] = useState(connections);
    const [selectedConnectionId, setSelectedConnectionId] = useState("");
    const [selectedModel, setSelectedModel] = useState("");
    const [saving, setSaving] = useState(false);

    // Sync with prop changes
    useEffect(() => {
        setLocalConnections(connections);
    }, [connections]);

    const modelOptions = {
        openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
        anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
        google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
        azure: ["gpt-4", "gpt-35-turbo"],
        custom: []
    };

    const handleConnectionCreated = async (newConnectionData) => {
        const created = await onConnectionCreated(newConnectionData);
        setLocalConnections(prev => [...prev, created]);
        setSelectedConnectionId(created.id);
        setShowAddConnection(false);
    };

    const handleSave = async () => {
        const selectedConnection = localConnections.find(c => c.id === selectedConnectionId);
        setSaving(true);
        try {
            await onSave({
                connectionId: selectedConnectionId,
                provider: selectedConnection?.provider,
                model: selectedModel
            });
        } finally {
            setSaving(false);
        }
    };

    const selectedConnection = localConnections.find(c => c.id === selectedConnectionId);
    const hasConnections = localConnections.length > 0;

    return (
        <>
            <Modal isOpen={isOpen && !showAddConnection} onClose={onClose} title="Default model configuration" size="md">
                {!hasConnections ? (
                    <div className="text-center py-8">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-amber-400" />
                        </div>
                        <p className="text-slate-400 mb-6">No LLM API key set in project.</p>
                        <Button onClick={() => setShowAddConnection(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add LLM Connection
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Connection/Provider */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Provider</label>
                            <select
                                value={selectedConnectionId}
                                onChange={(e) => {
                                    setSelectedConnectionId(e.target.value);
                                    setSelectedModel("");
                                }}
                                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                <option value="">Select provider...</option>
                                {localConnections.map((conn) => (
                                    <option key={conn.id} value={conn.id}>
                                        {conn.name} ({conn.provider})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Model Name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Model name</label>
                            {selectedConnection?.custom_model_name ? (
                                <input
                                    type="text"
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    placeholder="Enter model name..."
                                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                            ) : (
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    disabled={!selectedConnectionId}
                                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50"
                                >
                                    <option value="">Select model...</option>
                                    {(modelOptions[selectedConnection?.provider] || []).map((model) => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowAddConnection(true)}
                            className="text-sm text-blue-400 hover:text-blue-300 flex items-center"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Add another connection
                        </button>
                    </div>
                )}

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={!hasConnections || !selectedConnectionId || !selectedModel || saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save
                    </Button>
                </div>
            </Modal>

            <AddConnectionModal
                isOpen={showAddConnection}
                onClose={() => setShowAddConnection(false)}
                onConnectionCreated={handleConnectionCreated}
            />
        </>
    );
};

// Modal for creating a custom evaluator with LLMEvaluator-compatible prompts
export const CreateEvaluatorModal = ({ isOpen, onClose, onSave, defaultModel }) => {
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        useDefaultModel: true,
        spanEvalPrompt: "",
        traceEvalPrompt: "",
        simpleEvalPrompt: ""
    });
    const [saving, setSaving] = useState(false);
    const [showPrompts, setShowPrompts] = useState({
        span: false,
        trace: false,
        simple: false
    });

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await onSave({
                name: formData.name,
                description: formData.description,
                use_default_model: formData.useDefaultModel,
                span_eval_prompt: formData.spanEvalPrompt || null,
                trace_eval_prompt: formData.traceEvalPrompt || null,
                simple_eval_prompt: formData.simpleEvalPrompt || null
            });
            setFormData({
                name: "",
                description: "",
                useDefaultModel: true,
                spanEvalPrompt: "",
                traceEvalPrompt: "",
                simpleEvalPrompt: ""
            });
        } finally {
            setSaving(false);
        }
    };

    const loadDefaultPrompt = (type) => {
        const key = type === "span" ? "spanEvalPrompt" : type === "trace" ? "traceEvalPrompt" : "simpleEvalPrompt";
        const defaultKey = type === "span" ? "span_eval" : type === "trace" ? "trace_eval" : "simple_eval";
        setFormData({ ...formData, [key]: DEFAULT_PROMPTS[defaultKey] });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Custom Evaluator" size="lg">
            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Evaluator Name *</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="My Custom Evaluator"
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                    <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="What this evaluator checks for..."
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>

                {/* Model */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Model</label>
                    <div className="flex items-center p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                        <input
                            type="checkbox"
                            id="useDefaultModel"
                            checked={formData.useDefaultModel}
                            onChange={(e) => setFormData({ ...formData, useDefaultModel: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                        />
                        <label htmlFor="useDefaultModel" className="ml-2 text-sm text-slate-300">
                            Use default evaluation model
                        </label>
                        {defaultModel && (
                            <span className="ml-auto text-xs text-slate-500">
                                {defaultModel.provider} / {defaultModel.model}
                            </span>
                        )}
                    </div>
                </div>

                {/* Prompt Templates Section */}
                <div className="border-t border-slate-800 pt-4">
                    <div className="flex items-center space-x-2 mb-4">
                        <Info className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-slate-400">
                            Customize prompts for different evaluation scenarios. Leave blank to use defaults.
                        </span>
                    </div>

                    {/* Span Eval Prompt */}
                    <div className="mb-4">
                        <button
                            type="button"
                            onClick={() => setShowPrompts({ ...showPrompts, span: !showPrompts.span })}
                            className="flex items-center justify-between w-full p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-left hover:bg-slate-800 transition-colors"
                        >
                            <span className="text-sm font-medium text-slate-300">Span Evaluation Prompt</span>
                            <div className="flex items-center space-x-2">
                                {formData.spanEvalPrompt && <span className="text-xs text-emerald-400">Custom</span>}
                                {showPrompts.span ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                        </button>
                        {showPrompts.span && (
                            <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-end mb-2">
                                    <button
                                        type="button"
                                        onClick={() => loadDefaultPrompt("span")}
                                        className="text-xs text-blue-400 hover:text-blue-300"
                                    >
                                        Load default template
                                    </button>
                                </div>
                                <textarea
                                    value={formData.spanEvalPrompt}
                                    onChange={(e) => setFormData({ ...formData, spanEvalPrompt: e.target.value })}
                                    placeholder="Prompt for evaluating individual tool/LLM calls..."
                                    rows={6}
                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize font-mono text-xs min-h-[120px]"
                                />
                                <p className="mt-1 text-xs text-slate-500">Variables: {"{user_input}"}, {"{step_type}"}, {"{step_name}"}, {"{step_input}"}, {"{step_output}"}</p>
                            </div>
                        )}
                    </div>

                    {/* Trace Eval Prompt */}
                    <div className="mb-4">
                        <button
                            type="button"
                            onClick={() => setShowPrompts({ ...showPrompts, trace: !showPrompts.trace })}
                            className="flex items-center justify-between w-full p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-left hover:bg-slate-800 transition-colors"
                        >
                            <span className="text-sm font-medium text-slate-300">Trace Evaluation Prompt</span>
                            <div className="flex items-center space-x-2">
                                {formData.traceEvalPrompt && <span className="text-xs text-emerald-400">Custom</span>}
                                {showPrompts.trace ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                        </button>
                        {showPrompts.trace && (
                            <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-end mb-2">
                                    <button
                                        type="button"
                                        onClick={() => loadDefaultPrompt("trace")}
                                        className="text-xs text-blue-400 hover:text-blue-300"
                                    >
                                        Load default template
                                    </button>
                                </div>
                                <textarea
                                    value={formData.traceEvalPrompt}
                                    onChange={(e) => setFormData({ ...formData, traceEvalPrompt: e.target.value })}
                                    placeholder="Prompt for overall trace evaluation..."
                                    rows={6}
                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize font-mono text-xs min-h-[120px]"
                                />
                                <p className="mt-1 text-xs text-slate-500">Variables: {"{user_input}"}, {"{assistant_output}"}, {"{span_evaluations}"}, {"{execution_summary}"}</p>
                            </div>
                        )}
                    </div>

                    {/* Simple Eval Prompt */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowPrompts({ ...showPrompts, simple: !showPrompts.simple })}
                            className="flex items-center justify-between w-full p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-left hover:bg-slate-800 transition-colors"
                        >
                            <span className="text-sm font-medium text-slate-300">Simple Evaluation Prompt</span>
                            <div className="flex items-center space-x-2">
                                {formData.simpleEvalPrompt && <span className="text-xs text-emerald-400">Custom</span>}
                                {showPrompts.simple ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                        </button>
                        {showPrompts.simple && (
                            <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-end mb-2">
                                    <button
                                        type="button"
                                        onClick={() => loadDefaultPrompt("simple")}
                                        className="text-xs text-blue-400 hover:text-blue-300"
                                    >
                                        Load default template
                                    </button>
                                </div>
                                <textarea
                                    value={formData.simpleEvalPrompt}
                                    onChange={(e) => setFormData({ ...formData, simpleEvalPrompt: e.target.value })}
                                    placeholder="Prompt for single-turn interactions (no spans)..."
                                    rows={6}
                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize font-mono text-xs min-h-[120px]"
                                />
                                <p className="mt-1 text-xs text-slate-500">Variables: {"{user_input}"}, {"{assistant_output}"}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={!formData.name || saving}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Evaluator
                </Button>
            </div>
        </Modal>
    );
};
