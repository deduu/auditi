/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState, useEffect } from "react";
import { Check, ChevronRight, Play, Loader2, Zap, ZapOff } from "lucide-react";
import { DefaultModelStep } from "../components/evaluations/DefaultModelStep";
import { SelectEvaluatorStep } from "../components/evaluations/SelectEvaluatorStep";
import { RunEvaluatorPage } from "../components/evaluations/RunEvaluatorPage";
import { DefaultModelModal, CreateEvaluatorModal, EditEvaluatorModal, EditConnectionModal } from "../components/evaluations/EvaluationModals";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import * as llmApi from "../api/llmConnections";
import * as evaluatorsApi from "../api/evaluatorsApi";

export const LLMJudgePage = () => {
    const [loading, setLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [defaultModel, setDefaultModel] = useState(null);
    const [selectedEvaluator, setSelectedEvaluator] = useState(null);
    const [connections, setConnections] = useState([]);
    const [autoEvalEnabled, setAutoEvalEnabled] = useState(false);
    const [togglingAutoEval, setTogglingAutoEval] = useState(false);

    // Modal states
    const [showDefaultModelModal, setShowDefaultModelModal] = useState(false);
    const [showCreateEvaluatorModal, setShowCreateEvaluatorModal] = useState(false);
    const [showEditEvaluatorModal, setShowEditEvaluatorModal] = useState(false);
    const [evaluatorToEdit, setEvaluatorToEdit] = useState(null);
    const [showEditConnectionModal, setShowEditConnectionModal] = useState(false);
    const [connectionToEdit, setConnectionToEdit] = useState(null);
    const [evaluatorsRefreshTrigger, setEvaluatorsRefreshTrigger] = useState(0);

    const steps = [
        { id: 0, label: "Set up default model" },
        { id: 1, label: "Select Evaluator" },
        { id: 2, label: "Run Evaluator" }
    ];

    // Load initial state from backend
    useEffect(() => {
        const loadState = async () => {
            try {
                setLoading(true);

                // Fetch connections
                const connectionsData = await llmApi.getLLMConnections();
                setConnections(connectionsData || []);

                // Fetch default model
                const defaultModelData = await llmApi.getDefaultModel();
                if (defaultModelData?.is_configured) {
                    setDefaultModel({
                        connectionId: defaultModelData.connection_id,
                        provider: defaultModelData.provider,
                        model: defaultModelData.model_name
                    });
                }

                // Fetch setup state
                const setupState = await evaluatorsApi.getSetupState();
                if (setupState) {
                    // Determine step based on state
                    if (setupState.has_default_model) {
                        setCurrentStep(Math.max(setupState.current_step || 0, 1));
                    } else {
                        setCurrentStep(0);
                    }
                    if (setupState.selected_evaluator_id) {
                        setSelectedEvaluator({ id: setupState.selected_evaluator_id });
                    }
                    setAutoEvalEnabled(setupState.auto_eval_enabled || false);
                }
            } catch (error) {
                console.error("Failed to load LLM Judge state:", error);
            } finally {
                setLoading(false);
            }
        };

        loadState();
    }, []);

    const handleToggleAutoEval = async () => {
        setTogglingAutoEval(true);
        try {
            const newValue = !autoEvalEnabled;
            await evaluatorsApi.updateSetupState({
                auto_eval_enabled: newValue,
                active_evaluator_id: newValue && selectedEvaluator ? selectedEvaluator.id : null
            });
            setAutoEvalEnabled(newValue);
        } catch (error) {
            console.error("Failed to toggle auto-eval:", error);
        } finally {
            setTogglingAutoEval(false);
        }
    };

    const handleDefaultModelSave = async (modelConfig) => {
        try {
            // Save to backend
            await llmApi.setDefaultModel({
                connection_id: modelConfig.connectionId,
                model_name: modelConfig.model
            });

            setDefaultModel({
                connectionId: modelConfig.connectionId,
                provider: modelConfig.provider,
                model: modelConfig.model
            });

            // Update step
            setCurrentStep(1);
            await evaluatorsApi.updateSetupState({ current_step: 1 });

            setShowDefaultModelModal(false);
        } catch (error) {
            console.error("Failed to save default model:", error);
        }
    };

    const handleConnectionCreated = async (newConnection) => {
        try {
            const created = await llmApi.createLLMConnection({
                provider: newConnection.provider,
                name: newConnection.providerName || newConnection.provider,
                api_key: newConnection.apiKey,
                base_url: newConnection.baseUrl,
                custom_model_name: newConnection.customModelName
            });
            setConnections(prev => [...prev, created]);
            return created;
        } catch (error) {
            console.error("Failed to create connection:", error);
            throw error;
        }
    };

    const handleConnectionsChange = (updatedConnections) => {
        setConnections(updatedConnections);
    };

    const handleDeleteConnection = async (connectionId) => {
        // Check if this was the default
        if (defaultModel?.connectionId === connectionId) {
            setDefaultModel(null);
        }
    };

    const handleEditConnection = (connection) => {
        setConnectionToEdit(connection);
        setShowEditConnectionModal(true);
    };

    const handleConnectionUpdated = async (connectionId, updatedData) => {
        try {
            const payload = {
                provider: updatedData.provider,
                name: updatedData.providerName || updatedData.provider,
                base_url: updatedData.baseUrl || null,
                custom_model_name: updatedData.customModelName || null,
            };
            if (updatedData.apiKey) {
                payload.api_key = updatedData.apiKey;
            }
            const updated = await llmApi.updateLLMConnection(connectionId, payload);
            setConnections(prev =>
                prev.map(c => c.id === connectionId ? updated : c)
            );
            if (defaultModel?.connectionId === connectionId) {
                setDefaultModel(prev => ({
                    ...prev,
                    provider: updated.provider,
                }));
            }
        } catch (error) {
            console.error("Failed to update connection:", error);
            throw error;
        }
    };

    const handleSetDefault = (config) => {
        setDefaultModel({
            connectionId: config.connectionId,
            provider: config.provider,
            model: config.model
        });
        if (currentStep === 0) {
            setCurrentStep(1);
        }
    };

    const handleEvaluatorSelect = async (evaluator) => {
        setSelectedEvaluator(evaluator);
        await evaluatorsApi.updateSetupState({
            selected_evaluator_id: evaluator.id,
            active_evaluator_id: autoEvalEnabled ? evaluator.id : null
        });
    };

    const handleCreateEvaluatorSave = async (evaluatorConfig) => {
        try {
            const created = await evaluatorsApi.createEvaluator(evaluatorConfig);
            setSelectedEvaluator(created);
            setEvaluatorsRefreshTrigger(prev => prev + 1);
            setShowCreateEvaluatorModal(false);
        } catch (error) {
            console.error("Failed to create evaluator:", error);
        }
    };

    const handleProceedToRun = async () => {
        if (selectedEvaluator) {
            setCurrentStep(2);
            await evaluatorsApi.updateSetupState({ current_step: 2 });
        }
    };

    const handleStepClick = async (stepId) => {
        // Allow going back to previous steps or forward if requirements met
        if (stepId <= currentStep || (stepId === 1 && defaultModel) || (stepId === 2 && selectedEvaluator)) {
            setCurrentStep(stepId);
            await evaluatorsApi.updateSetupState({ current_step: stepId });
        }
    };

    const handleEvaluatorDoubleClick = (evaluator) => {
        setEvaluatorToEdit(evaluator);
        setShowEditEvaluatorModal(true);
    };

    const handleEditEvaluatorSave = async (updates) => {
        if (!evaluatorToEdit || evaluatorToEdit.evaluator_type === "managed") return;
        try {
            const updated = await evaluatorsApi.updateEvaluator(evaluatorToEdit.id, updates);
            // Update selected evaluator if it's the same one
            if (selectedEvaluator?.id === evaluatorToEdit.id) {
                setSelectedEvaluator(updated);
            }
            setEvaluatorsRefreshTrigger(prev => prev + 1);
            setShowEditEvaluatorModal(false);
        } catch (error) {
            console.error("Failed to update evaluator:", error);
        }
    };

    const canEnableAutoEval = defaultModel && selectedEvaluator;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Page Header with Auto-Eval Toggle */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Set up evaluator</h1>

                    {/* Step Indicator */}
                    <div className="mt-6 flex items-center space-x-2 text-sm">
                        {steps.map((step, index) => {
                            const isCompleted = step.id < currentStep || (step.id === 0 && defaultModel) || (step.id === 1 && selectedEvaluator && currentStep >= 2);
                            const isActive = step.id === currentStep;
                            const isClickable = step.id <= currentStep || (step.id === 1 && defaultModel) || (step.id === 2 && selectedEvaluator);

                            return (
                                <div key={step.id} className="flex items-center">
                                    <button
                                        onClick={() => handleStepClick(step.id)}
                                        disabled={!isClickable}
                                        className={`flex items-center font-medium transition-colors ${isActive || isCompleted ? "text-white" : "text-slate-500"
                                            } ${isClickable && !isActive ? "hover:text-blue-400 cursor-pointer" : ""} ${!isClickable ? "cursor-not-allowed" : ""}`}
                                    >
                                        {isCompleted ? (
                                            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mr-2 text-xs">
                                                <Check className="w-3 h-3" />
                                            </span>
                                        ) : (
                                            <span
                                                className={`w-5 h-5 rounded-full flex items-center justify-center mr-2 text-xs border ${isActive
                                                    ? "border-blue-500 text-blue-400 bg-blue-500/10"
                                                    : "border-slate-700 text-slate-500"
                                                    }`}
                                            >
                                                {step.id}
                                            </span>
                                        )}
                                        {step.label}
                                    </button>
                                    {index < steps.length - 1 && (
                                        <ChevronRight className="w-4 h-4 text-slate-700 mx-2" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Auto-Eval Toggle */}
                <Card className={`p-4 transition-all duration-300 ${autoEvalEnabled ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-900/50 border-slate-800'}`}>
                    <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-lg transition-colors ${autoEvalEnabled ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
                            {autoEvalEnabled ? (
                                <Zap className="w-5 h-5 text-emerald-400" />
                            ) : (
                                <ZapOff className="w-5 h-5 text-slate-500" />
                            )}
                        </div>
                        <div>
                            <div className="text-sm font-medium text-white">Auto-Evaluation</div>
                            <div className={`text-xs ${autoEvalEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {autoEvalEnabled ? 'Enabled' : 'Disabled'}
                            </div>
                        </div>
                        <button
                            onClick={handleToggleAutoEval}
                            disabled={(!canEnableAutoEval && !autoEvalEnabled) || togglingAutoEval}
                            style={{
                                backgroundColor: autoEvalEnabled ? '#10b981' : '#334155',
                            }}
                            className={`relative w-12 h-7 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${(!canEnableAutoEval && !autoEvalEnabled) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'
                                }`}
                        >
                            <span
                                style={{
                                    transform: autoEvalEnabled ? 'translateX(20px)' : 'translateX(0)',
                                }}
                                className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300"
                            />
                        </button>
                    </div>
                    {!canEnableAutoEval && !autoEvalEnabled && (
                        <p className="text-xs text-amber-400 mt-2">
                            Complete setup to enable auto-evaluation
                        </p>
                    )}
                </Card>
            </div>

            {/* Content Area */}
            <div className="mt-8">
                {currentStep === 0 && (
                    <DefaultModelStep
                        onSetupClick={() => setShowDefaultModelModal(true)}
                        defaultModel={defaultModel}
                        connections={connections}
                        onConnectionsChange={handleConnectionsChange}
                        onSetDefault={handleSetDefault}
                        onDeleteConnection={handleDeleteConnection}
                        onEditConnection={handleEditConnection}
                    />
                )}

                {currentStep === 1 && (
                    <>
                        <SelectEvaluatorStep
                            onSelectEvaluator={handleEvaluatorSelect}
                            onCreateCustomClick={() => setShowCreateEvaluatorModal(true)}
                            selectedEvaluatorId={selectedEvaluator?.id}
                            onDoubleClickEvaluator={handleEvaluatorDoubleClick}
                            refreshTrigger={evaluatorsRefreshTrigger}
                        />
                        {selectedEvaluator && (
                            <div className="flex justify-end mt-6">
                                <Button onClick={handleProceedToRun}>
                                    Continue to Run
                                    <ChevronRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        )}
                    </>
                )}

                {currentStep === 2 && (
                    <RunEvaluatorPage
                        evaluator={selectedEvaluator}
                        defaultModel={defaultModel}
                        onBack={() => setCurrentStep(1)}
                        onExecute={(job) => {
                        }}
                    />
                )}
            </div>

            {/* Modals */}
            <DefaultModelModal
                isOpen={showDefaultModelModal}
                onClose={() => setShowDefaultModelModal(false)}
                onSave={handleDefaultModelSave}
                connections={connections}
                onConnectionCreated={handleConnectionCreated}
            />

            <CreateEvaluatorModal
                isOpen={showCreateEvaluatorModal}
                onClose={() => setShowCreateEvaluatorModal(false)}
                onSave={handleCreateEvaluatorSave}
                defaultModel={defaultModel}
            />

            <EditEvaluatorModal
                isOpen={showEditEvaluatorModal}
                onClose={() => setShowEditEvaluatorModal(false)}
                evaluator={evaluatorToEdit}
                onSave={handleEditEvaluatorSave}
                defaultModel={defaultModel}
            />

            <EditConnectionModal
                isOpen={showEditConnectionModal}
                onClose={() => setShowEditConnectionModal(false)}
                connection={connectionToEdit}
                onConnectionUpdated={handleConnectionUpdated}
            />
        </div>
    );
};
