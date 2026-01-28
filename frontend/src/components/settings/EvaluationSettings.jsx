import React, { useState, useEffect } from "react";
import { Brain, Save, AlertCircle, Loader2 } from "lucide-react";
import { SettingSection, ToggleSetting } from "./SettingsComponents";
import { settingsApi } from "../../api";
import { Button } from "../ui/Button";

export const EvaluationSettings = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await settingsApi.getEvalSettings();
            setConfig(data);
        } catch (err) {
            setError("Failed to load evaluation settings");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!config) return;
        try {
            setSaving(true);
            setError(null);
            setSuccess(false);
            await settingsApi.updateEvalSettings(config);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError("Failed to save settings");
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const updateConfig = (updates) => {
        setConfig((prev) => ({ ...prev, ...updates }));
    };

    const updateLLMConfig = (field, value) => {
        setConfig((prev) => ({
            ...prev,
            llm_config: { ...prev.llm_config, [field]: value },
        }));
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <SettingSection
                icon={Brain}
                title="Evaluation System"
                description="Configure how traces are evaluated"
            >
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center text-rose-400">
                    <AlertCircle className="w-5 h-5 mr-3" />
                    <div className="flex-1">
                        <p className="font-medium">Error loading settings</p>
                        <p className="text-sm opacity-80">{error}</p>
                    </div>
                    <Button variant="secondary" onClick={loadSettings} className="ml-4">
                        Retry
                    </Button>
                </div>
            </SettingSection>
        );
    }

    if (!config) return null;

    return (
        <div className="space-y-6">
            <SettingSection
                icon={Brain}
                title="Evaluation System"
                description="Configure how traces are evaluated"
            >
                <div className="space-y-6">
                    {/* Main Toggle */}
                    <ToggleSetting
                        label="Enable Evaluation"
                        description="Run automatic evaluations on new traces"
                        checked={config.enabled}
                        onChange={(val) => updateConfig({ enabled: val })}
                    />

                    {config.enabled && (
                        <>
                            {/* Evaluator Type */}
                            <div className="border-t border-slate-800 pt-4">
                                <label className="block text-sm font-medium text-slate-400 mb-2">Evaluator Type</label>
                                <div className="flex space-x-4">
                                    {["llm", "human"].map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => updateConfig({ evaluator_type: type })}
                                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${config.evaluator_type === type
                                                ? "bg-blue-600 text-white"
                                                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                                }`}
                                        >
                                            {type === "llm" ? "LLM Evaluator" : "Human Review"}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                    {config.evaluator_type === "llm"
                                        ? "Uses an LLM to automatically score and analyze traces."
                                        : "Marks traces for manual human review."}
                                </p>
                            </div>

                            {/* LLM Configuration */}
                            {config.evaluator_type === "llm" && (
                                <div className="border-t border-slate-800 pt-4 space-y-4">
                                    <h4 className="text-sm font-semibold text-white">LLM Provider Settings</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Provider</label>
                                            <select
                                                value={config.llm_config.provider}
                                                onChange={(e) => updateLLMConfig("provider", e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="openai">OpenAI</option>
                                                <option value="anthropic">Anthropic</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Model Name</label>
                                            <input
                                                type="text"
                                                value={config.llm_config.model}
                                                onChange={(e) => updateLLMConfig("model", e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">API Key (Optional override)</label>
                                        <input
                                            type="password"
                                            placeholder="Leave empty to use env var"
                                            value={config.llm_config.api_key || ""}
                                            onChange={(e) => updateLLMConfig("api_key", e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Temperature ({config.llm_config.temperature})</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={config.llm_config.temperature}
                                            onChange={(e) => updateLLMConfig("temperature", parseFloat(e.target.value))}
                                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Status Message */}
                    {(error || success) && (
                        <div className={`p-3 rounded-lg text-sm flex items-center ${error ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
                            <AlertCircle className="w-4 h-4 mr-2" />
                            {error || "Settings saved successfully!"}
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="flex justify-end pt-2">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </SettingSection>
        </div>
    );
};
