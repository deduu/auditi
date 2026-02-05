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

## Individual Step Evaluations
{span_evaluations}

## Full Execution Summary
{execution_summary}

## Final Response to User
{assistant_output}

## Execution Metadata
- Total steps: {step_count}
- Total tokens: {total_tokens}
- Total cost: \${total_cost:.4f}
- Total time: {total_time:.2f}s

## Evaluation Task
Provide a holistic evaluation considering:

1. **Step Quality**: Were individual steps appropriate? (See evaluations above)
2. **Flow Efficiency**: Was the sequence logical? Any redundant steps?
3. **Resource Usage**: Reasonable token/cost usage?
4. **Final Output**: Does the response fully address the user's query?
5. **Overall Effectiveness**: Did the agent successfully complete the task?

## Response Format (JSON only)
{
    "status": "pass" or "fail" or "review",
    "score": 0.0 to 1.0 (overall quality score),
    "failure_mode": null or one of ["hallucination", "incorrect_tool_use", "inefficient_execution", "incomplete_answer", "off_topic", "harmful", "poor_step_quality", "other"],
    "reason": "2-3 sentence explanation covering step quality, execution flow, and final output",
    "recommended_action": null or "specific actionable advice for improvement (1-2 sentences)",
    "step_quality_summary": "1 sentence about individual step quality",
    "efficiency_summary": "1 sentence about execution efficiency"
}

Guidelines:
- "pass" = Good steps AND efficient execution AND quality output (score >= 0.7)
- "fail" = Poor steps OR wasteful execution OR bad output (score < 0.5)
- "review" = Mixed results or borderline quality (0.5 <= score < 0.7)
- **recommended_action**: Only provide if status is "fail" or "review".

Respond ONLY with valid JSON, nothing else.`,
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
        evaluationScope: "auto",
        useDefaultModel: true,
        spanEvalPrompt: "",
        traceEvalPrompt: "",
        simpleEvalPrompt: "",
        schemaMode: "flexible",
        customFields: []
    });
    const [saving, setSaving] = useState(false);
    const [showPrompts, setShowPrompts] = useState({
        span: false,
        trace: false,
        simple: false
    });
    const [showSchemaBuilder, setShowSchemaBuilder] = useState(false);

    // Build output_schema from customFields
    const buildOutputSchema = () => {
        if (formData.customFields.length === 0) return null;
        const schema = {
            type: "object",
            properties: {},
            required: []
        };
        formData.customFields.forEach(field => {
            if (field.name) {
                schema.properties[field.name] = { type: field.type || "string" };
                if (field.required) {
                    schema.required.push(field.name);
                }
            }
        });
        return schema.required.length > 0 || Object.keys(schema.properties).length > 0 ? schema : null;
    };

    const addCustomField = () => {
        setFormData({
            ...formData,
            customFields: [...formData.customFields, { name: "", type: "string", required: false }]
        });
    };

    const updateCustomField = (index, key, value) => {
        const updated = [...formData.customFields];
        updated[index] = { ...updated[index], [key]: value };
        setFormData({ ...formData, customFields: updated });
    };

    const removeCustomField = (index) => {
        setFormData({
            ...formData,
            customFields: formData.customFields.filter((_, i) => i !== index)
        });
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await onSave({
                name: formData.name,
                description: formData.description,
                evaluation_scope: formData.evaluationScope,
                use_default_model: formData.useDefaultModel,
                span_eval_prompt: formData.spanEvalPrompt || null,
                trace_eval_prompt: formData.traceEvalPrompt || null,
                simple_eval_prompt: formData.simpleEvalPrompt || null,
                schema_mode: formData.schemaMode,
                output_schema: buildOutputSchema()
            });
            setFormData({
                name: "",
                description: "",
                evaluationScope: "auto",
                useDefaultModel: true,
                spanEvalPrompt: "",
                traceEvalPrompt: "",
                simpleEvalPrompt: "",
                schemaMode: "flexible",
                customFields: []
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

                {/* Evaluation Scope */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Evaluation Scope</label>
                    <select
                        value={formData.evaluationScope}
                        onChange={(e) => setFormData({ ...formData, evaluationScope: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                        <option value="auto">Auto-detect (Recommended)</option>
                        <option value="simple">Simple (LLM calls, embeddings)</option>
                        <option value="trace">Agent Trace (Multi-step with spans)</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                        {formData.evaluationScope === "auto" && "Automatically selects trace prompt for agent calls, simple prompt for LLM/embedding calls."}
                        {formData.evaluationScope === "simple" && "Uses only simple prompt (user_input, assistant_output). Best for LLM calls without spans."}
                        {formData.evaluationScope === "trace" && "Uses full agent context (span evaluations, execution summary). For multi-step agent traces."}
                    </p>
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

                {/* Schema Validation Mode */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Schema Validation</label>
                    <select
                        value={formData.schemaMode}
                        onChange={(e) => setFormData({ ...formData, schemaMode: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                        <option value="flexible">Flexible (Recommended)</option>
                        <option value="strict">Strict</option>
                        <option value="none">None</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                        {formData.schemaMode === "flexible" && "Extracts core fields with smart normalization. Logs warnings but doesn't fail."}
                        {formData.schemaMode === "strict" && "Validates all fields strictly. Reports errors for missing required fields."}
                        {formData.schemaMode === "none" && "No custom schema validation. Only core fields are extracted."}
                    </p>
                </div>

                {/* Custom Output Fields */}
                <div className="border-t border-slate-800 pt-4">
                    <button
                        type="button"
                        onClick={() => setShowSchemaBuilder(!showSchemaBuilder)}
                        className="flex items-center justify-between w-full p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-left hover:bg-slate-800 transition-colors"
                    >
                        <div>
                            <span className="text-sm font-medium text-slate-300">Custom Output Fields</span>
                            <p className="text-xs text-slate-500 mt-0.5">Define additional fields beyond status, score, reason</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            {formData.customFields.length > 0 && (
                                <span className="text-xs text-emerald-400">{formData.customFields.length} field(s)</span>
                            )}
                            {showSchemaBuilder ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                    </button>
                    {showSchemaBuilder && (
                        <div className="mt-3 p-3 bg-slate-900/50 border border-slate-700 rounded-lg animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs text-slate-400">
                                    Core fields (status, score, failure_mode, reason) are always extracted.
                                </p>
                                <button
                                    type="button"
                                    onClick={addCustomField}
                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                                >
                                    <Plus className="w-3 h-3 mr-1" /> Add Field
                                </button>
                            </div>
                            {formData.customFields.length === 0 ? (
                                <p className="text-center text-slate-500 text-xs py-4">
                                    No custom fields defined. Click "Add Field" to define additional output fields.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {formData.customFields.map((field, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={field.name}
                                                onChange={(e) => updateCustomField(index, "name", e.target.value)}
                                                placeholder="field_name"
                                                className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs placeholder-slate-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                            />
                                            <select
                                                value={field.type}
                                                onChange={(e) => updateCustomField(index, "type", e.target.value)}
                                                className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                            >
                                                <option value="string">Text</option>
                                                <option value="number">Number</option>
                                                <option value="boolean">Boolean</option>
                                                <option value="array">Array</option>
                                            </select>
                                            <label className="flex items-center text-xs text-slate-400 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={field.required}
                                                    onChange={(e) => updateCustomField(index, "required", e.target.checked)}
                                                    className="w-3 h-3 mr-1 rounded border-slate-600 bg-slate-800 text-blue-500"
                                                />
                                                Req
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => removeCustomField(index)}
                                                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
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

// Modal for viewing/editing an evaluator
export const EditEvaluatorModal = ({ isOpen, onClose, evaluator, onSave, defaultModel }) => {
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        evaluationScope: "auto",
        useDefaultModel: true,
        spanEvalPrompt: "",
        traceEvalPrompt: "",
        simpleEvalPrompt: ""
    });
    const [saving, setSaving] = useState(false);
    const [showPrompts, setShowPrompts] = useState({
        span: false,
        trace: true,  // Show trace prompt by default
        simple: false
    });

    const isManaged = evaluator?.evaluator_type === "managed";

    // Load evaluator data when opening
    useEffect(() => {
        if (evaluator && isOpen) {
            setFormData({
                name: evaluator.name || "",
                description: evaluator.description || "",
                evaluationScope: evaluator.evaluation_scope || "auto",
                useDefaultModel: evaluator.use_default_model !== false,
                spanEvalPrompt: evaluator.span_eval_prompt || "",
                traceEvalPrompt: evaluator.trace_eval_prompt || "",
                simpleEvalPrompt: evaluator.simple_eval_prompt || ""
            });
        }
    }, [evaluator, isOpen]);

    const handleSubmit = async () => {
        if (isManaged) {
            onClose();
            return;
        }

        setSaving(true);
        try {
            await onSave({
                name: formData.name,
                description: formData.description,
                evaluation_scope: formData.evaluationScope,
                use_default_model: formData.useDefaultModel,
                span_eval_prompt: formData.spanEvalPrompt || null,
                trace_eval_prompt: formData.traceEvalPrompt || null,
                simple_eval_prompt: formData.simpleEvalPrompt || null
            });
            onClose();
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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isManaged ? `View: ${evaluator?.name}` : `Edit: ${evaluator?.name}`}
            size="lg"
        >
            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
                {/* Type Badge */}
                <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${isManaged
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-blue-500/20 text-blue-400"
                        }`}>
                        {isManaged ? "Managed Evaluator" : "Custom Evaluator"}
                    </span>
                    {isManaged && (
                        <span className="text-xs text-slate-500">
                            (Read-only - create a custom evaluator to modify prompts)
                        </span>
                    )}
                </div>

                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Evaluator Name</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        disabled={isManaged}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-60"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                    <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        disabled={isManaged}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-60"
                    />
                </div>

                {/* Evaluation Scope */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Evaluation Scope</label>
                    {isManaged ? (
                        <div className="flex items-center px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg">
                            <span className={`px-2 py-1 text-xs font-medium rounded ${formData.evaluationScope === "simple" ? "bg-green-500/20 text-green-400" :
                                    formData.evaluationScope === "trace" ? "bg-purple-500/20 text-purple-400" :
                                        "bg-blue-500/20 text-blue-400"
                                }`}>
                                {formData.evaluationScope === "simple" ? "Simple" :
                                    formData.evaluationScope === "trace" ? "Agent Trace" : "Auto-detect"}
                            </span>
                            <span className="ml-2 text-sm text-slate-400">
                                {formData.evaluationScope === "auto" && "Uses appropriate prompt based on trace type"}
                                {formData.evaluationScope === "simple" && "Uses simple prompt (input/output only)"}
                                {formData.evaluationScope === "trace" && "Uses full agent context with spans"}
                            </span>
                        </div>
                    ) : (
                        <>
                            <select
                                value={formData.evaluationScope}
                                onChange={(e) => setFormData({ ...formData, evaluationScope: e.target.value })}
                                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                <option value="auto">Auto-detect (Recommended)</option>
                                <option value="simple">Simple (LLM calls, embeddings)</option>
                                <option value="trace">Agent Trace (Multi-step with spans)</option>
                            </select>
                            <p className="mt-1 text-xs text-slate-500">
                                {formData.evaluationScope === "auto" && "Automatically selects trace prompt for agent calls, simple prompt for LLM/embedding calls."}
                                {formData.evaluationScope === "simple" && "Uses only simple prompt (user_input, assistant_output). Best for LLM calls without spans."}
                                {formData.evaluationScope === "trace" && "Uses full agent context (span evaluations, execution summary). For multi-step agent traces."}
                            </p>
                        </>
                    )}
                </div>

                {/* Model (for custom only) */}
                {!isManaged && (
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Model</label>
                        <div className="flex items-center p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                            <input
                                type="checkbox"
                                id="editUseDefaultModel"
                                checked={formData.useDefaultModel}
                                onChange={(e) => setFormData({ ...formData, useDefaultModel: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                            />
                            <label htmlFor="editUseDefaultModel" className="ml-2 text-sm text-slate-300">
                                Use default evaluation model
                            </label>
                            {defaultModel && (
                                <span className="ml-auto text-xs text-slate-500">
                                    {defaultModel.provider} / {defaultModel.model}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Prompt Templates Section */}
                <div className="border-t border-slate-800 pt-4">
                    <div className="flex items-center space-x-2 mb-4">
                        <Info className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-slate-400">
                            {isManaged
                                ? "View the prompt template used by this evaluator"
                                : "Customize prompts for different evaluation scenarios"
                            }
                        </span>
                    </div>

                    {/* Trace Eval Prompt (main one) */}
                    <div className="mb-4">
                        <button
                            type="button"
                            onClick={() => setShowPrompts({ ...showPrompts, trace: !showPrompts.trace })}
                            className="flex items-center justify-between w-full p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-left hover:bg-slate-800 transition-colors"
                        >
                            <span className="text-sm font-medium text-slate-300">Trace Evaluation Prompt</span>
                            <div className="flex items-center space-x-2">
                                {formData.traceEvalPrompt && <span className="text-xs text-emerald-400">Has content</span>}
                                {showPrompts.trace ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                        </button>
                        {showPrompts.trace && (
                            <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                                {!isManaged && (
                                    <div className="flex justify-end mb-2">
                                        <button
                                            type="button"
                                            onClick={() => loadDefaultPrompt("trace")}
                                            className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            Load default template
                                        </button>
                                    </div>
                                )}
                                <textarea
                                    value={formData.traceEvalPrompt}
                                    onChange={(e) => setFormData({ ...formData, traceEvalPrompt: e.target.value })}
                                    placeholder="Prompt for overall trace evaluation..."
                                    rows={10}
                                    readOnly={isManaged}
                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize font-mono text-xs min-h-[200px] disabled:opacity-60"
                                />
                                <p className="mt-1 text-xs text-slate-500">Variables: {"{user_input}"}, {"{assistant_output}"}</p>
                            </div>
                        )}
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
                                {formData.spanEvalPrompt && <span className="text-xs text-emerald-400">Has content</span>}
                                {showPrompts.span ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                        </button>
                        {showPrompts.span && (
                            <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                                {!isManaged && (
                                    <div className="flex justify-end mb-2">
                                        <button
                                            type="button"
                                            onClick={() => loadDefaultPrompt("span")}
                                            className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            Load default template
                                        </button>
                                    </div>
                                )}
                                <textarea
                                    value={formData.spanEvalPrompt}
                                    onChange={(e) => setFormData({ ...formData, spanEvalPrompt: e.target.value })}
                                    placeholder="Prompt for evaluating individual spans..."
                                    rows={6}
                                    readOnly={isManaged}
                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize font-mono text-xs min-h-[120px] disabled:opacity-60"
                                />
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
                                {formData.simpleEvalPrompt && <span className="text-xs text-emerald-400">Has content</span>}
                                {showPrompts.simple ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                        </button>
                        {showPrompts.simple && (
                            <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                                {!isManaged && (
                                    <div className="flex justify-end mb-2">
                                        <button
                                            type="button"
                                            onClick={() => loadDefaultPrompt("simple")}
                                            className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            Load default template
                                        </button>
                                    </div>
                                )}
                                <textarea
                                    value={formData.simpleEvalPrompt}
                                    onChange={(e) => setFormData({ ...formData, simpleEvalPrompt: e.target.value })}
                                    placeholder="Prompt for single-turn interactions..."
                                    rows={6}
                                    readOnly={isManaged}
                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize font-mono text-xs min-h-[120px] disabled:opacity-60"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                <Button variant="ghost" onClick={onClose}>
                    {isManaged ? "Close" : "Cancel"}
                </Button>
                {!isManaged && (
                    <Button onClick={handleSubmit} disabled={!formData.name || saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Changes
                    </Button>
                )}
            </div>
        </Modal>
    );
};
