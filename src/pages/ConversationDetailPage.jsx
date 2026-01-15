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

const EvaluationBadge = ({ status, score }) => {
  if (status === "pass") {
    return (
      <div className="flex items-center space-x-2">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3.5 h-3.5 mr-1" />
          Pass
        </span>
        <span className="text-sm font-semibold text-green-600">{score}/10</span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center space-x-2">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3.5 h-3.5 mr-1" />
          Fail
        </span>
        <span className="text-sm font-semibold text-red-600">{score}/10</span>
      </div>
    );
  }
};

const TurnCard = ({ turn, turnNumber }) => {
  const [expanded, setExpanded] = useState(turn.assistant.evaluation.status === "fail");
  const evaluation = turn.assistant.evaluation;
  const isFail = evaluation.status === "fail";

  return (
    <div className={`border rounded-xl overflow-hidden ${isFail ? "border-red-200" : "border-gray-200"}`}>
      {/* Turn Header */}
      <div
        className={`px-4 py-2 flex items-center justify-between cursor-pointer ${
          isFail ? "bg-red-50" : "bg-gray-50"
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-3">
          <span className="text-xs font-medium text-gray-500">Turn {turnNumber}</span>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-500">{turn.assistant.model}</span>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-500">{turn.assistant.latency}</span>
        </div>
        <div className="flex items-center space-x-3">
          <EvaluationBadge status={evaluation.status} score={evaluation.score} />
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* User Message */}
      <div className="p-4 bg-white border-b border-gray-100">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 mb-1">User</p>
            <p className="text-sm text-gray-900">{turn.user.content}</p>
          </div>
        </div>
      </div>

      {/* Assistant Message */}
      <div className={`p-4 ${isFail ? "bg-red-50/50" : "bg-blue-50/30"}`}>
        <div className="flex items-start space-x-3">
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isFail ? "bg-red-500" : "bg-blue-600"
          }`}>
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 mb-1">Assistant</p>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{turn.assistant.content}</p>
          </div>
        </div>
      </div>

      {/* Expanded Evaluation Details */}
      {expanded && (
        <div className={`border-t ${isFail ? "border-red-200 bg-red-50/30" : "border-gray-200 bg-gray-50"}`}>
          <div className="p-4 space-y-4">
            {/* Reason */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Target className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 mb-1">Evaluation Reason</p>
                <p className="text-sm text-gray-700">{evaluation.reason}</p>
              </div>
            </div>

            {/* Failure Mode (only for failed responses) */}
            {isFail && evaluation.failureMode && (
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 mb-1">Failure Mode</p>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-red-100 text-red-800">
                    {evaluation.failureMode}
                  </span>
                </div>
              </div>
            )}

            {/* Recommended Action (only for failed responses) */}
            {isFail && evaluation.recommendedAction && (
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 mb-1">Recommended Action</p>
                  <p className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    {evaluation.recommendedAction}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ConversationDetailPage = ({ conversationId, onBack }) => {
  const { detail, loading, error } = useConversationDetail(conversationId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 font-medium">Error: {error}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
        <p className="text-gray-500">No session found</p>
      </div>
    );
  }

  const passCount = detail.turns?.filter((t) => t.assistant.evaluation.status === "pass").length || 0;
  const failCount = detail.turns?.filter((t) => t.assistant.evaluation.status === "fail").length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sessions
        </button>
        <div className="flex items-center space-x-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-4 h-4 mr-1" />
            {passCount} Passed
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            <XCircle className="w-4 h-4 mr-1" />
            {failCount} Failed
          </span>
        </div>
      </div>

      {/* Session Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center space-x-2">
          <span className="text-sm text-gray-500">Models:</span>
          {detail.models?.map((model, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium"
            >
              {model}
            </span>
          ))}
        </div>
      </div>

      {/* Conversation Timeline */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Conversation Timeline</h3>
        <div className="space-y-4">
          {detail.turns?.map((turn, idx) => (
            <TurnCard key={turn.id} turn={turn} turnNumber={idx + 1} />
          ))}
        </div>
      </div>
    </div>
  );
};
