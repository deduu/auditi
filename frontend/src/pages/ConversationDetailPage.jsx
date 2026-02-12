/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState } from "react";
import { formatTimestamp } from "@utils/formatters";
import {
  ArrowLeft,
  User,
  Bot,
  Clock,
  Hash,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  Shield,
} from "lucide-react";
import { useConversationDetail } from "../hooks/useConversationDetail";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Toast, getNotificationsEnabled } from "../components/ui/Toast";

import ContentRenderer from "../components/ui/ContentRenderer";
import { EvaluationBadge } from "../components/ui/EvaluationBadge";
import { SpanItem } from "../components/ui/SpanItem";





const ConvEvalCard = ({ evalId, evalData }) => {
  const [cardExpanded, setCardExpanded] = useState(false);
  const hasLongText = (evalData.reason && evalData.reason.length > 120) ||
      (evalData.failure_mode && evalData.failure_mode.length > 80);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white">{evalData.name || evalId}</span>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
            evalData.status === "pass"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : evalData.status === "fail"
                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          }`}>
            {evalData.status === "pass" ? (
              <CheckCircle className="w-3 h-3 mr-1" />
            ) : evalData.status === "fail" ? (
              <AlertCircle className="w-3 h-3 mr-1" />
            ) : (
              <HelpCircle className="w-3 h-3 mr-1" />
            )}
            {evalData.status}
          </span>
          <span className="text-sm font-bold text-white">
            {evalData.score != null ? evalData.score.toFixed(2) : "N/A"}
          </span>
        </div>
      </div>
      {evalData.reason && (
        <p className={`text-xs text-slate-400 mb-1 whitespace-pre-line ${!cardExpanded && hasLongText ? "line-clamp-3" : ""}`}>
          {evalData.reason}
        </p>
      )}
      {evalData.failure_mode && (
        <div className={`flex items-start gap-1.5 text-xs text-rose-400 bg-rose-900/10 px-2 py-1 rounded border border-rose-500/10 mb-1 ${!cardExpanded && hasLongText ? "line-clamp-2" : ""}`}>
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span className="whitespace-pre-line">{evalData.failure_mode}</span>
        </div>
      )}
      {hasLongText && (
        <button
          onClick={() => setCardExpanded(!cardExpanded)}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
        >
          {cardExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {cardExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
};

const TurnCard = ({ turn, turnNumber }) => {
  const evaluation = turn?.assistant?.evaluation ?? {};
  const [expanded, setExpanded] = useState(true); // keep your default expanded behavior

  const status = evaluation?.status;
  const isFail = status === "fail";
  const isReview = status === "review";

  const latencyMs = turn?.assistant?.latencyMs ?? turn?.assistant?.latency_ms;
  const latencyLabel =
    turn?.assistant?.latency ??
    (typeof latencyMs === "number"
      ? `${(latencyMs / 1000).toFixed(1)}s`
      : "0.0s");

  // Identify final generator span (last LLM/Agent span)
  const finalGeneratorIndex = turn.spans?.findLastIndex(
    s => (s.type === 'llm' || s.type === 'agent' || s.spanType === 'llm')
  );
  const hasFinalGenerator = finalGeneratorIndex !== undefined && finalGeneratorIndex !== -1;

  return (
    <Card
      className={`p-0 overflow-hidden border ${isFail
        ? "border-rose-900/50"
        : isReview
          ? "border-amber-900/50"
          : "border-slate-800"
        }`}
    >
      {/* Turn Header */}
      <div
        className={`px-4 py-2 flex items-center justify-between cursor-pointer transition-colors ${isFail
          ? "bg-rose-900/20 hover:bg-rose-900/30"
          : isReview
            ? "bg-amber-900/10 hover:bg-amber-900/20"
            : "bg-slate-900/50 hover:bg-slate-800/50"
          }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-3">
          <span className="text-xs font-medium text-slate-400">
            Turn {turnNumber}
          </span>
          <span className="text-xs text-slate-600">|</span>
          <span className="text-xs text-slate-400">
            {turn?.assistant?.model ?? "Unknown"}
          </span>
          <span className="text-xs text-slate-600">|</span>
          <span className="text-xs text-slate-400">{latencyLabel}</span>
        </div>

        <div className="flex items-center space-x-3">
          {status && (
            <EvaluationBadge status={status} score={evaluation?.score ?? 0} />
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 bg-slate-900/20">
          {/* User Message */}
          <div className="p-4 border-b border-slate-800/50">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                <User className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-400 mb-1">User</p>
                <div className="text-sm text-slate-200">
                  <ContentRenderer content={turn?.user?.content} />
                </div>
              </div>
            </div>
          </div>

          {/* Spans */}
          {Array.isArray(turn?.spans) && turn.spans.length > 0 && (
            <div className="py-2 bg-slate-950/30 border-b border-slate-800/50">
              <p className="px-4 text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Execution Path
              </p>
              {turn.spans.map((span, index) => (
                <SpanItem
                  key={span.id}
                  span={span}
                  isFinalGenerator={hasFinalGenerator && index === finalGeneratorIndex}
                />
              ))}
            </div>
          )}

          {/* Assistant Message - Display if no execution path or no final generator identified */}
          {!hasFinalGenerator && (
            <div
              className={`p-4 ${isFail ? "bg-rose-900/10" : "bg-blue-900/10"}`}
            >
              <div className="flex items-start space-x-3">
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isFail ? "bg-rose-500" : "bg-blue-600"
                    }`}
                >
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-400 mb-1">
                    Assistant
                  </p>
                  <div className="text-sm text-slate-100 leading-relaxed">
                    <ContentRenderer content={turn?.assistant?.content} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expanded Evaluation Details */}
      {expanded && evaluation?.reason && (
        <div
          className={`border-t ${isFail
            ? "border-rose-900/30 bg-rose-900/10"
            : isReview
              ? "border-amber-900/30 bg-amber-900/10"
              : "border-slate-800 bg-slate-900/30"
            }`}
        >
          <div className="p-4 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-400 mb-1">
                  Evaluation Reason
                </p>
                <p className="text-sm text-slate-300 whitespace-pre-line">{evaluation.reason}</p>
              </div>
            </div>

            {isFail && evaluation?.failureMode && (
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-400 mb-1">
                    Failure Mode
                  </p>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
                    {evaluation.failureMode}
                  </span>
                </div>
              </div>
            )}

            {isFail && evaluation?.recommendedAction && (
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-400 mb-1">
                    Recommended Action
                  </p>
                  <p className="text-sm text-amber-100 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    {evaluation.recommendedAction}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-Evaluator Breakdown (multi-evaluator results) */}
      {expanded && turn.evalMetadata?.evaluations && Object.keys(turn.evalMetadata.evaluations).length > 1 && (
        <div className="border-t border-slate-800 bg-slate-900/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-purple-400" />
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Per-Evaluator Breakdown
            </h4>
            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">
              {Object.keys(turn.evalMetadata.evaluations).length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(turn.evalMetadata.evaluations).map(([evalId, evalData]) => (
              <ConvEvalCard key={evalId} evalId={evalId} evalData={evalData} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export const ConversationDetailPage = ({ conversationId, onBack, inPanel = false }) => {
  const { detail, loading, error, justEvaluated } = useConversationDetail(conversationId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-center">
        <p className="text-rose-400 font-medium">Error: {error}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <p className="text-slate-500">No session found</p>
      </div>
    );
  }

  const passCount =
    detail.turns?.filter((t) => t?.assistant?.evaluation?.status === "pass")
      .length || 0;
  const failCount =
    detail.turns?.filter((t) => t?.assistant?.evaluation?.status === "fail")
      .length || 0;
  const reviewCount =
    detail.turns?.filter((t) => t?.assistant?.evaluation?.status === "review")
      .length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        {!inPanel && (
          <Button
            onClick={onBack}
            variant="secondary"
            className="bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sessions
          </Button>
        )}
        <div className="flex items-center space-x-4">
          <Badge
            variant="success"
            className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            {passCount} Passed
          </Badge>
          <Badge
            variant="error"
            className="bg-rose-500/10 text-rose-400 border border-rose-500/20"
          >
            <XCircle className="w-4 h-4 mr-1" />
            {failCount} Failed
          </Badge>
          <Badge
            variant="warning"
            className="bg-amber-500/10 text-amber-400 border border-amber-500/20"
          >
            <AlertTriangle className="w-4 h-4 mr-1" />
            {reviewCount} Review
          </Badge>
        </div>
      </div>

      {/* Session Info Card */}
      <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {detail.objective}
              </h2>
              <div className="flex items-center mt-2 space-x-4 text-blue-100 text-sm">
                <span className="flex items-center">
                  <Hash className="w-4 h-4 mr-1" />
                  {detail.userId}
                </span>
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {formatTimestamp(detail.startTime)}
                </span>
                <span className="flex items-center">
                  <Zap className="w-4 h-4 mr-1" />
                  {detail.turns?.length || 0} turns
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-blue-100 text-sm">Avg Score</p>
              <p className="text-3xl font-bold text-white">
                {detail.avgScore?.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Models used */}
        <div className="px-6 py-3 bg-slate-900/50 border-b border-slate-800 flex items-center space-x-2">
          <span className="text-sm text-slate-400">Models:</span>
          {detail.models?.map((model, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-md text-xs font-medium border border-blue-500/20"
            >
              {model}
            </span>
          ))}
        </div>
      </Card>

      {/* Conversation Timeline */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">
          Conversation Timeline
        </h3>
        <div className="space-y-4">
          {detail.turns?.map((turn, idx) => (
            <TurnCard key={turn.id} turn={turn} turnNumber={idx + 1} />
          ))}
        </div>
      </div>

      {justEvaluated && getNotificationsEnabled() && (
        <Toast
          message={`Evaluation complete: ${detail.overallStatus}`}
          type={detail.overallStatus === "pass" ? "success" : detail.overallStatus === "fail" ? "error" : "info"}
        />
      )}
    </div>
  );
};
