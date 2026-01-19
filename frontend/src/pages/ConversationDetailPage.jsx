import React, { useState } from "react";
import {
  ArrowLeft,
  User,
  Bot,
  Clock,
  Hash,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
} from "lucide-react";
import { useConversationDetail } from "../hooks/useConversationDetail";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

const EvaluationBadge = ({ status, score }) => {
  if (status === "pass") {
    return (
      <div className="flex items-center space-x-2">
        <Badge variant="success" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle className="w-3.5 h-3.5 mr-1" />
          Pass
        </Badge>
        <span className="text-sm font-semibold text-emerald-400">{score}/10</span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center space-x-2">
        <Badge variant="error" className="bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <XCircle className="w-3.5 h-3.5 mr-1" />
          Fail
        </Badge>
        <span className="text-sm font-semibold text-rose-400">{score}/10</span>
      </div>
    );
  }
};

const SpanItem = ({ span }) => {
  const isLLM = span.type === "llm";
  const isTool = span.type === "tool";
  const isError = span.status === "error";

  return (
    <div className={`ml-4 pl-4 border-l-2 ${isError ? "border-rose-500/30" : "border-slate-800"} py-2`}>
      <div className="flex items-center justify-between group">
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className={`
            ${isLLM ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : ""}
            ${isTool ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : ""}
          `}>
            {span.type.toUpperCase()}
          </Badge>
          <span className="text-sm font-medium text-slate-300">{span.name}</span>
          {span.model && <span className="text-xs text-slate-500">({span.model})</span>}
        </div>
        <div className="flex items-center space-x-3 opacity-60 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-slate-500">{span.duration}</span>
          {isError && <Badge variant="error" className="bg-rose-500/10 text-rose-400 border-rose-500/20">Error</Badge>}
        </div>
      </div>

      {/* Inputs/Outputs Collapsible could go here, for now just show if error */}
      {isError && (
        <div className="mt-2 text-xs text-red-400 bg-red-900/10 p-2 rounded">
          {span.error}
        </div>
      )}

      {/* Show Output snippet for tools */}
      {isTool && span.outputs && (
        <div className="mt-1 text-xs text-slate-500 font-mono truncate max-w-lg">
          {span.outputs}
        </div>
      )}
    </div>
  );
};

const TurnCard = ({ turn, turnNumber }) => {
  const [expanded, setExpanded] = useState(turn.assistant.evaluation.status === "fail" || true); // Default expand for visibility
  const evaluation = turn.assistant.evaluation || {};
  const isFail = evaluation.status === "fail";

  return (
    <Card className={`p-0 overflow-hidden border ${isFail ? "border-rose-900/50" : "border-slate-800"}`}>
      {/* Turn Header */}
      <div
        className={`px-4 py-2 flex items-center justify-between cursor-pointer transition-colors ${isFail ? "bg-rose-900/20 hover:bg-rose-900/30" : "bg-slate-900/50 hover:bg-slate-800/50"
          }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-3">
          <span className="text-xs font-medium text-slate-400">Turn {turnNumber}</span>
          <span className="text-xs text-slate-600">|</span>
          <span className="text-xs text-slate-400">{turn.assistant.model}</span>
          <span className="text-xs text-slate-600">|</span>
          <span className="text-xs text-slate-400">{turn.assistant.latency}</span>
        </div>
        <div className="flex items-center space-x-3">
          {evaluation.status && <EvaluationBadge status={evaluation.status} score={evaluation.score} />}
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
                <p className="text-sm text-slate-200">{turn.user.content}</p>
              </div>
            </div>
          </div>

          {/* Spans (Execution Path) */}
          {turn.spans && turn.spans.length > 0 && (
            <div className="py-2 bg-slate-950/30 border-b border-slate-800/50">
              <p className="px-4 text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Execution Path</p>
              {turn.spans.map((span) => (
                <SpanItem key={span.id} span={span} />
              ))}
            </div>
          )}

          {/* Assistant Message */}
          <div className={`p-4 ${isFail ? "bg-rose-900/10" : "bg-blue-900/10"}`}>
            <div className="flex items-start space-x-3">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isFail ? "bg-rose-500" : "bg-blue-600"
                }`}>
                <Bot className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-400 mb-1">Assistant</p>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{turn.assistant.content}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Evaluation Details */}
      {expanded && evaluation.reason && (
        <div className={`border-t ${isFail ? "border-rose-900/30 bg-rose-900/10" : "border-slate-800 bg-slate-900/30"}`}>
          <div className="p-4 space-y-4">
            {/* Reason */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-400 mb-1">Evaluation Reason</p>
                <p className="text-sm text-slate-300">{evaluation.reason}</p>
              </div>
            </div>

            {/* Failure Mode (only for failed responses) */}
            {isFail && evaluation.failureMode && (
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-400 mb-1">Failure Mode</p>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
                    {evaluation.failureMode}
                  </span>
                </div>
              </div>
            )}

            {/* Recommended Action (only for failed responses) */}
            {isFail && evaluation.recommendedAction && (
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-400 mb-1">Recommended Action</p>
                  <p className="text-sm text-amber-100 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    {evaluation.recommendedAction}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export const ConversationDetailPage = ({ conversationId, onBack }) => {
  const { detail, loading, error } = useConversationDetail(conversationId);

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

  const passCount = detail.turns?.filter((t) => t.assistant.evaluation.status === "pass").length || 0;
  const failCount = detail.turns?.filter((t) => t.assistant.evaluation.status === "fail").length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          onClick={onBack}
          variant="secondary"
          className="bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sessions
        </Button>
        <div className="flex items-center space-x-4">
          <Badge variant="success" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-4 h-4 mr-1" />
            {passCount} Passed
          </Badge>
          <Badge variant="error" className="bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-4 h-4 mr-1" />
            {failCount} Failed
          </Badge>
        </div>
      </div>

      {/* Session Info Card */}
      <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">{detail.objective}</h2>
              <div className="flex items-center mt-2 space-x-4 text-blue-100 text-sm">
                <span className="flex items-center">
                  <Hash className="w-4 h-4 mr-1" />
                  {detail.userId}
                </span>
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {new Date(detail.startTime).toLocaleString()}
                </span>
                <span className="flex items-center">
                  <Zap className="w-4 h-4 mr-1" />
                  {detail.turns?.length || 0} turns
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-blue-100 text-sm">Avg Score</p>
              <p className="text-3xl font-bold text-white">{detail.avgScore?.toFixed(1)}</p>
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
        <h3 className="text-lg font-semibold text-white">Conversation Timeline</h3>
        <div className="space-y-4">
          {detail.turns?.map((turn, idx) => (
            <TurnCard key={turn.id} turn={turn} turnNumber={idx + 1} />
          ))}
        </div>
      </div>
    </div>
  );
};
