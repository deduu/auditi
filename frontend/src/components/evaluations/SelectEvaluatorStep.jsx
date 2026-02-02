import React, { useState, useEffect } from "react";
import { Search, Plus, CheckCircle, Sparkles, Loader2 } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import * as evaluatorsApi from "../../api/evaluatorsApi";

export const SelectEvaluatorStep = ({ onSelectEvaluator, onCreateCustomClick, selectedEvaluatorId, onDoubleClickEvaluator, refreshTrigger = 0 }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [localSelectedId, setLocalSelectedId] = useState(selectedEvaluatorId || null);
    const [managedEvaluators, setManagedEvaluators] = useState([]);
    const [customEvaluators, setCustomEvaluators] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadEvaluators = async () => {
            try {
                setLoading(true);
                const [managed, custom] = await Promise.all([
                    evaluatorsApi.getManagedEvaluators(),
                    evaluatorsApi.getCustomEvaluators()
                ]);
                setManagedEvaluators(managed || []);
                setCustomEvaluators(custom || []);
            } catch (error) {
                console.error("Failed to load evaluators:", error);
            } finally {
                setLoading(false);
            }
        };
        loadEvaluators();
    }, [refreshTrigger]);

    useEffect(() => {
        setLocalSelectedId(selectedEvaluatorId);
    }, [selectedEvaluatorId]);

    const allEvaluators = [...managedEvaluators, ...customEvaluators];

    const filteredEvaluators = allEvaluators.filter(
        (e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleSelect = (evaluator) => {
        setLocalSelectedId(evaluator.id);
        onSelectEvaluator?.(evaluator);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search evaluators..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-800 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
            </div>

            {/* Custom Evaluators (if any) */}
            {customEvaluators.length > 0 && (
                <div>
                    <div className="flex items-center space-x-2 mb-4">
                        <CheckCircle className="w-4 h-4 text-blue-400" />
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                            Custom Evaluators
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                        {customEvaluators
                            .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((evaluator) => (
                                <Card
                                    key={evaluator.id}
                                    onClick={() => handleSelect(evaluator)}
                                    onDoubleClick={() => onDoubleClickEvaluator?.(evaluator)}
                                    className={`p-4 cursor-pointer transition-all duration-200 ${localSelectedId === evaluator.id
                                        ? "bg-blue-600/10 border-blue-500/50 ring-1 ring-blue-500/30"
                                        : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-base font-medium text-white">{evaluator.name}</h4>
                                                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${evaluator.evaluation_scope === "simple" ? "bg-green-500/20 text-green-400" :
                                                    evaluator.evaluation_scope === "trace" ? "bg-purple-500/20 text-purple-400" :
                                                        "bg-blue-500/20 text-blue-400"
                                                    }`}>
                                                    {evaluator.evaluation_scope === "simple" ? "Simple" :
                                                        evaluator.evaluation_scope === "trace" ? "Trace" : "Auto"}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-400 mt-1">{evaluator.description || "Custom evaluator"}</p>
                                            <p className="text-xs text-slate-500 mt-1">Double-click to view/edit</p>
                                        </div>
                                        {localSelectedId === evaluator.id && (
                                            <CheckCircle className="w-5 h-5 text-blue-400 shrink-0" />
                                        )}
                                    </div>
                                </Card>
                            ))}
                    </div>
                </div>
            )}

            {/* Managed Evaluators List */}
            <div>
                <div className="flex items-center space-x-2 mb-4">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                        Langfuse Managed Evaluators
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {managedEvaluators
                        .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase())))
                        .map((evaluator) => (
                            <Card
                                key={evaluator.id}
                                onClick={() => handleSelect(evaluator)}
                                onDoubleClick={() => onDoubleClickEvaluator?.(evaluator)}
                                className={`p-4 cursor-pointer transition-all duration-200 ${localSelectedId === evaluator.id
                                    ? "bg-blue-600/10 border-blue-500/50 ring-1 ring-blue-500/30"
                                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-base font-medium text-white">{evaluator.name}</h4>
                                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${evaluator.evaluation_scope === "simple" ? "bg-green-500/20 text-green-400" :
                                                evaluator.evaluation_scope === "trace" ? "bg-purple-500/20 text-purple-400" :
                                                    "bg-blue-500/20 text-blue-400"
                                                }`}>
                                                {evaluator.evaluation_scope === "simple" ? "Simple" :
                                                    evaluator.evaluation_scope === "trace" ? "Trace" : "Auto"}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-400 mt-1">{evaluator.description}</p>
                                        <p className="text-xs text-slate-500 mt-1">Double-click to view prompt</p>
                                    </div>
                                    {localSelectedId === evaluator.id && (
                                        <CheckCircle className="w-5 h-5 text-blue-400 shrink-0" />
                                    )}
                                </div>
                            </Card>
                        ))}
                </div>

                {filteredEvaluators.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                        No evaluators match your search.
                    </div>
                )}
            </div>

            {/* Create Custom Button */}
            <div className="flex justify-end pt-4 border-t border-slate-800">
                <Button onClick={onCreateCustomClick}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Custom Evaluator
                </Button>
            </div>
        </div>
    );
};
