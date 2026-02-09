/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  SkipForward,
  CheckCircle,
  MessageSquare,
  Clock,
  Bot,
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { annotationsApi } from '../../api';
import { ScoreInput } from './ScoreInput';
import { SpanItem } from '../ui/SpanItem';

export const AnnotationWorkflow = ({ queue, onBack, onComplete }) => {
  const [currentItem, setCurrentItem] = useState(null);
  const [scoreConfigs, setScoreConfigs] = useState([]);
  const [progress, setProgress] = useState({ total: 0, completed: 0, remaining: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Store current scores for each config
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState('');
  const [hasDraft, setHasDraft] = useState(false);

  // Toggle for showing LLM evaluation insights
  const [showLLMEvaluation, setShowLLMEvaluation] = useState(false);

  // Helper to generate draft storage key
  const getDraftKey = (itemId) => `annotation_draft_${queue.id}_${itemId}`;

  useEffect(() => {
    loadNextItem();
  }, [queue.id]);

  const loadNextItem = async () => {
    setLoading(true);
    try {
      const response = await annotationsApi.getNextQueueItem(queue.id);

      if (response.item) {
        setCurrentItem(response.item);
        setScoreConfigs(response.score_configs || []);
        setProgress(response.queue_progress || { total: 0, completed: 0, remaining: 0 });

        // Check for saved draft first
        const draftKey = getDraftKey(response.item.id);
        const savedDraft = localStorage.getItem(draftKey);

        if (savedDraft) {
          try {
            const draft = JSON.parse(savedDraft);
            setScores(draft.scores || {});
            setComment(draft.comment || '');
            setHasDraft(true);
          } catch (e) {
            console.error('Failed to parse draft:', e);
            initializeScores(response);
          }
        } else {
          initializeScores(response);
        }
      } else {
        // Queue is complete
        setCurrentItem(null);
        setProgress(response.queue_progress || { total: 0, completed: 0, remaining: 0 });
      }
    } catch (error) {
      console.error('Failed to load next item:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeScores = (response) => {
    // Initialize all scores as null - don't pre-fill with existing annotations to avoid bias
    const initialScores = {};
    response.score_configs?.forEach((config) => {
      initialScores[config.id] = null;
    });
    setScores(initialScores);
    setComment('');
    setHasDraft(false);
  };

  const handleComplete = async (skip = false) => {
    setSaving(true);
    try {
      // Build annotations from scores
      const annotations = Object.entries(scores)
        .filter(([_, value]) => value !== null)
        .map(([configId, value]) => ({
          object_type: currentItem.object_type,
          object_id: currentItem.object_id,
          score_config_id: configId,
          value: value,
          comment: comment || null,
          source: 'queue',
        }));

      await annotationsApi.completeQueueItem(queue.id, currentItem.id, {
        annotations,
        skip,
      });

      // Clear draft from localStorage
      clearDraft();

      // Load next item
      await loadNextItem();
    } catch (error) {
      console.error('Failed to complete item:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = () => {
    if (!currentItem) return;
    const draftKey = getDraftKey(currentItem.id);
    const draft = { scores, comment, savedAt: new Date().toISOString() };
    localStorage.setItem(draftKey, JSON.stringify(draft));
    setHasDraft(true);
  };

  const clearDraft = () => {
    if (!currentItem) return;
    const draftKey = getDraftKey(currentItem.id);
    localStorage.removeItem(draftKey);
    setHasDraft(false);
  };

  const updateScore = (configId, value) => {
    setScores((prev) => ({ ...prev, [configId]: value }));
  };

  const allScoresProvided = scoreConfigs.every((config) => scores[config.id] !== null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  // Queue completed
  if (!currentItem) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Queues
        </Button>

        <Card className="p-12 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Queue Complete!</h2>
          <p className="text-slate-400 mb-6">
            All items in "{queue.name}" have been annotated.
          </p>
          <div className="flex justify-center space-x-4">
            <Button variant="outline" onClick={onBack}>
              View All Queues
            </Button>
            <Button onClick={() => onComplete?.()}>Done</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Queues
        </Button>

        <div className="flex items-center space-x-4">
          {/* Progress */}
          <div className="flex items-center space-x-3">
            <div className="text-sm text-slate-400">
              {progress.completed} / {progress.total} completed
            </div>
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{
                  width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Content to Review */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Content to Review</h3>

            {/* LLM Evaluation Toggle - Show when spans exist and have evaluation data */}
            {currentItem?.object_data?.spans?.length > 0 && (
              (() => {
                const hasEvaluations = currentItem.object_data.spans.some(s => s.evaluation);
                return hasEvaluations ? (
                  <button
                    onClick={() => setShowLLMEvaluation(!showLLMEvaluation)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-all ${showLLMEvaluation
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                      }`}
                    title={showLLMEvaluation ? 'Hide LLM insights to avoid bias' : 'Show LLM evaluation insights'}
                  >
                    {showLLMEvaluation ? (
                      <>
                        <Eye className="w-4 h-4" />
                        <Sparkles className="w-3 h-3" />
                        <span>LLM Insights ON</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4" />
                        <span>LLM Insights OFF</span>
                      </>
                    )}
                  </button>
                ) : null;
              })()
            )}
          </div>

          {currentItem.object_type === 'trace' && currentItem.object_data && (
            <Card className="space-y-4">
              {/* User Input */}
              {currentItem.object_data.user_input && (
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <User className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-slate-300">User Input</span>
                  </div>
                  <div className="p-3 bg-slate-800 rounded-lg text-slate-200 text-sm whitespace-pre-wrap">
                    {currentItem.object_data.user_input}
                  </div>
                </div>
              )}


              {/* Execution Path (Spans) */}
              {currentItem.object_data.spans && currentItem.object_data.spans.length > 0 && (
                <ExecutionPath spans={currentItem.object_data.spans} showEvaluation={showLLMEvaluation} />
              )}

              {/* Assistant Output */}
              {currentItem.object_data.assistant_output && (
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Bot className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-slate-300">Assistant Response</span>
                  </div>
                  <div className="p-3 bg-slate-800 rounded-lg text-slate-200 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {currentItem.object_data.assistant_output}
                  </div>
                </div>
              )}



              {/* Metadata */}
              <div className="flex items-center space-x-4 text-xs text-slate-500 pt-2 border-t border-slate-700">
                {currentItem.object_data.model_name && (
                  <span>Model: {currentItem.object_data.model_name}</span>
                )}
                {currentItem.object_data.latency && (
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {currentItem.object_data.latency.toFixed(2)}s
                  </span>
                )}
                {currentItem.object_data.status && (
                  <span className={`px-2 py-0.5 rounded-full ${currentItem.object_data.status === 'pass'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : currentItem.object_data.status === 'fail'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-amber-500/20 text-amber-400'
                    }`}>
                    {currentItem.object_data.status}
                  </span>
                )}
              </div>
            </Card>
          )}

          {currentItem.object_type === 'span' && currentItem.object_data && (
            <Card className="space-y-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-sm font-medium text-slate-300">
                  {currentItem.object_data.span_type}: {currentItem.object_data.name}
                </span>
              </div>

              {currentItem.object_data.inputs && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Input</div>
                  <pre className="p-3 bg-slate-800 rounded-lg text-slate-200 text-xs overflow-x-auto">
                    {JSON.stringify(currentItem.object_data.inputs, null, 2)}
                  </pre>
                </div>
              )}

              {currentItem.object_data.outputs && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Output</div>
                  <pre className="p-3 bg-slate-800 rounded-lg text-slate-200 text-xs overflow-x-auto max-h-64 overflow-y-auto">
                    {currentItem.object_data.outputs}
                  </pre>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right: Scoring Panel */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Annotation</h3>

          <Card className="space-y-6">
            {/* Score Inputs */}
            {scoreConfigs.map((config) => (
              <div key={config.id}>
                <ScoreInput
                  config={config}
                  value={scores[config.id]}
                  onChange={(value) => updateScore(config.id, value)}
                />
              </div>
            ))}

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <MessageSquare className="w-4 h-4 inline mr-2" />
                Comment (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add any notes about this annotation..."
                rows={3}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Draft indicator */}
            {hasDraft && (
              <div className="flex items-center justify-center py-2 px-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400">
                <Save className="w-3 h-3 mr-2" />
                Draft restored from previous session
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700">
              <Button
                variant="ghost"
                onClick={() => handleComplete(true)}
                disabled={saving}
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Skip
              </Button>

              <div className="flex items-center space-x-2">
                {/* Save Draft Button */}
                <Button
                  variant="outline"
                  onClick={saveDraft}
                  disabled={saving}
                  className="text-slate-300"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </Button>

                <Button
                  onClick={() => handleComplete(false)}
                  disabled={saving || !allScoresProvided}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 mr-2" />
                  )}
                  Complete & Next
                </Button>
              </div>
            </div>
          </Card>

          {/* Previous Annotations section removed to avoid biasing human evaluators */}
        </div>
      </div>
    </div>
  );
};

// Collapsible Execution Path component
const ExecutionPath = ({ spans, showEvaluation = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Find the last LLM/Agent span to mark as the final generator
  const finalGeneratorIndex = spans.findLastIndex(
    (s) => s.spanType === 'llm' || s.type === 'llm' || s.spanType === 'agent'
  );

  // Check if any span has evaluation data
  const hasEvaluations = spans.some(s => s.evaluation);

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-slate-300">
            Execution Path
          </span>
          <span className="text-xs text-slate-500">
            ({spans.length} step{spans.length !== 1 ? 's' : ''})
          </span>
          {hasEvaluations && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${showEvaluation
                ? 'bg-purple-500/20 text-purple-300'
                : 'bg-slate-700 text-slate-400'
              }`}>
              <Sparkles className="w-3 h-3 inline mr-1" />
              LLM Evaluated
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="divide-y divide-slate-800/50 bg-slate-900/30">
          {spans.map((span, index) => (
            <SpanItem
              key={span.id}
              span={span}
              isFinalGenerator={index === finalGeneratorIndex && finalGeneratorIndex !== -1}
              showEvaluation={showEvaluation}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnotationWorkflow;
