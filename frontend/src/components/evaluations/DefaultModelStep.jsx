import React, { useState, useEffect } from "react";
import { AlertTriangle, Plus, Trash2, Check, Settings, Loader2, Pencil } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import * as llmApi from "../../api/llmConnections";

export const DefaultModelStep = ({
    onSetupClick,
    defaultModel,
    connections = [],
    onConnectionsChange,
    onSetDefault,
    onDeleteConnection,
    onEditConnection
}) => {
    const [localConnections, setLocalConnections] = useState(connections);
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    useEffect(() => {
        setLocalConnections(connections);
    }, [connections]);

    const handleDeleteClick = (connectionId) => {
        if (confirmDeleteId === connectionId) {
            handleDelete(connectionId);
        } else {
            setConfirmDeleteId(connectionId);
            setTimeout(() => setConfirmDeleteId(prev => prev === connectionId ? null : prev), 3000);
        }
    };

    const handleDelete = async (connectionId) => {
        setConfirmDeleteId(null);
        setDeletingId(connectionId);
        try {
            await llmApi.deleteLLMConnection(connectionId);
            const updated = localConnections.filter(c => c.id !== connectionId);
            setLocalConnections(updated);
            onConnectionsChange?.(updated);
            onDeleteConnection?.(connectionId);
        } catch (error) {
            console.error("Failed to delete connection:", error);
        } finally {
            setDeletingId(null);
        }
    };

    const handleSetAsDefault = async (connection) => {
        setLoading(true);
        try {
            // Show model selection or use first available model
            const models = getModelsForProvider(connection.provider);
            const model = connection.default_model || models[0] || "gpt-4o";

            await llmApi.setDefaultModel({
                connection_id: connection.id,
                model_name: model
            });

            onSetDefault?.({
                connectionId: connection.id,
                provider: connection.provider,
                model: model
            });
        } catch (error) {
            console.error("Failed to set default:", error);
        } finally {
            setLoading(false);
        }
    };

    const getModelsForProvider = (provider) => {
        const models = {
            openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
            anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229"],
            google: ["gemini-1.5-pro", "gemini-1.5-flash"],
            azure: ["gpt-4", "gpt-35-turbo"],
            custom: []
        };
        return models[provider] || [];
    };

    const isConfigured = defaultModel && defaultModel.provider && defaultModel.model;
    const hasConnections = localConnections.length > 0;

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Status Card */}
            <Card className="bg-slate-900/50 border-slate-800">
                <div className="flex items-center justify-between p-6">
                    <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-xl ${isConfigured ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                            {isConfigured ? (
                                <Check className="w-6 h-6 text-emerald-400" />
                            ) : (
                                <AlertTriangle className="w-6 h-6 text-amber-400" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Default Evaluation Model</h3>
                            {isConfigured ? (
                                <p className="text-sm text-slate-400 mt-1">
                                    Using <span className="text-emerald-400 font-medium">{defaultModel.provider}</span> / <span className="text-emerald-400">{defaultModel.model}</span>
                                </p>
                            ) : (
                                <p className="text-sm text-amber-400 mt-1">
                                    No default model configured. Add an LLM connection below.
                                </p>
                            )}
                        </div>
                    </div>
                    <Button onClick={onSetupClick} variant={isConfigured ? "outline" : "primary"}>
                        <Settings className="w-4 h-4 mr-2" />
                        {isConfigured ? "Configure" : "Set up"}
                    </Button>
                </div>
            </Card>

            {/* Connections List */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                        LLM Connections ({localConnections.length})
                    </h4>
                    <Button variant="ghost" size="sm" onClick={onSetupClick}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Connection
                    </Button>
                </div>

                {hasConnections ? (
                    <div className="space-y-2">
                        {localConnections.map((connection) => (
                            <Card
                                key={connection.id}
                                className={`p-4 transition-all ${connection.is_default
                                        ? "bg-blue-500/5 border-blue-500/30"
                                        : "bg-slate-900/50 border-slate-800"
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-2 h-2 rounded-full ${connection.has_api_key ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                        <div>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-white font-medium">{connection.name}</span>
                                                <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-800 rounded">
                                                    {connection.provider}
                                                </span>
                                                {connection.is_default && (
                                                    <span className="text-xs text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded">
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            {connection.default_model && (
                                                <span className="text-xs text-slate-500">{connection.default_model}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        {!connection.is_default && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleSetAsDefault(connection)}
                                                disabled={loading}
                                            >
                                                Set as default
                                            </Button>
                                        )}
                                        <button
                                            onClick={() => onEditConnection?.(connection)}
                                            className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                            title="Edit connection"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(connection.id)}
                                            disabled={deletingId === connection.id}
                                            className={`p-2 rounded-lg transition-colors ${
                                                confirmDeleteId === connection.id
                                                    ? "text-red-400 bg-red-500/10"
                                                    : "text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                                            }`}
                                            title={confirmDeleteId === connection.id ? "Click again to confirm" : "Delete connection"}
                                        >
                                            {deletingId === connection.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                        {confirmDeleteId === connection.id && (
                                            <span className="text-xs text-red-400 animate-in fade-in duration-200">Delete?</span>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="p-8 bg-slate-900/30 border-slate-800 border-dashed">
                        <div className="text-center">
                            <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 mb-4">No LLM connections configured yet.</p>
                            <Button onClick={onSetupClick}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add First Connection
                            </Button>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};
