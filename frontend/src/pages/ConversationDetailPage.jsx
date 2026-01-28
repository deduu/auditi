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
  // Helper to format score
  const formatScore = (val) => {
    if (val === null || val === undefined) return "N/A";
    // If score is 0-1 range (typical for this backend), show as decimal
    // If score is > 1 (legacy/mock), assume 0-10 range
    if (val <= 1.0) return val.toFixed(2);
    return `${val.toFixed(1)}/10`;
  };

  if (status === "pass") {
    return (
      <div className="flex items-center space-x-2">
        <Badge
          variant="success"
          className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        >
          <CheckCircle className="w-3.5 h-3.5 mr-1" />
          Pass
        </Badge>
        <span className="text-sm font-semibold text-emerald-400">
          {formatScore(score)}
        </span>
      </div>
    );
  } else if (status === "fail") {
    return (
      <div className="flex items-center space-x-2">
        <Badge
          variant="error"
          className="bg-rose-500/10 text-rose-400 border border-rose-500/20"
        >
          <XCircle className="w-3.5 h-3.5 mr-1" />
          Fail
        </Badge>
        <span className="text-sm font-semibold text-rose-400">
          {formatScore(score)}
        </span>
      </div>
    );
  } else {
    // Review or unknown
    return (
      <div className="flex items-center space-x-2">
        <Badge
          variant="warning"
          className="bg-amber-500/10 text-amber-400 border border-amber-500/20"
        >
          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
          Review
        </Badge>
        <span className="text-sm font-semibold text-amber-400">
          {formatScore(score)}
        </span>
      </div>
    );
  }
};

const SpanItem = ({ span }) => {
  const [showDetails, setShowDetails] = useState(false);

  const spanType = (
    span?.type ??
    span?.spanType ??
    span?.span_type ??
    "unknown"
  ).toString();
  const isLLM = spanType === "llm";
  const isTool = spanType === "tool";

  // ✅ Normalize status
  const spanStatus = (span?.status ?? "ok").toString();
  const isError = spanStatus === "error";

  // ✅ Normalize timing fields (camelCase from API)
  const startTime = span?.start_time ?? span?.startTime;
  const endTime = span?.end_time ?? span?.endTime;

  // ✅ Normalize duration (API returns durationMs; old UI used duration string)
  const durationMs = span?.durationMs ?? span?.duration_ms;
  const durationLabel =
    span?.duration ??
    (typeof durationMs === "number" ? `${durationMs.toFixed(2)}ms` : "0.00ms");

  // ✅ Normalize tokens (API uses inputTokens/outputTokens/tokens)
  const inputTokens = span?.input_tokens ?? span?.inputTokens;
  const outputTokens = span?.output_tokens ?? span?.outputTokens;
  const totalTokens = span?.tokens ?? span?.total_tokens ?? span?.totalTokens;

  const hasTokens =
    Boolean(inputTokens) || Boolean(outputTokens) || Boolean(totalTokens);

  const resolvedTotalTokens =
    typeof totalTokens === "number" && totalTokens >= 0
      ? totalTokens
      : (inputTokens || 0) + (outputTokens || 0);

  const tokenParts = [];
  if (typeof inputTokens === "number" && inputTokens > 0)
    tokenParts.push(`in ${inputTokens}`);
  if (typeof outputTokens === "number" && outputTokens > 0)
    tokenParts.push(`out ${outputTokens}`);
  if (typeof resolvedTotalTokens === "number" && resolvedTotalTokens > 0)
    tokenParts.push(`total ${resolvedTotalTokens}`);



  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";

    const d = new Date(timestamp);

    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      timeZoneName: "short", // ✅ adds timezone, e.g. GMT+7
    });
  };


  const formatJSONValue = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    // Try to parse as JSON if it looks like a JSON string
    if (typeof value === "string") {
      const trimmed = value.trim();
      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
          const parsed = JSON.parse(trimmed);
          return JSON.stringify(parsed, null, 2);
        } catch {
          // Not valid JSON, return as-is
        }
      }
    }
    return String(value);
  };

  // Format JSON value with simple formatting (no HTML injection for safety)
  const formatJSONDisplay = (value) => {
    if (value === null || value === undefined) return "";

    // Convert to formatted JSON string
    let str;
    if (typeof value === "object") {
      str = JSON.stringify(value, null, 2);
    } else if (typeof value === "string") {
      // Try to parse if it looks like JSON
      const trimmed = value.trim();
      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
          const parsed = JSON.parse(trimmed);
          str = JSON.stringify(parsed, null, 2);
        } catch {
          str = value;
        }
      } else {
        str = value;
      }
    } else {
      str = String(value);
    }

    // Convert escaped newlines to actual newlines for display
    // This makes prompts more readable
    str = str.replace(/\\n/g, '\n');

    return str;
  };

  return (
    <div
      className={`ml-4 pl-4 border-l-2 ${isError ? "border-rose-500/30" : "border-slate-800"
        } py-2`}
    >
      <div
        className="flex items-center justify-between group cursor-pointer hover:bg-slate-800/30 -ml-4 pl-4 pr-2 py-1 rounded-r transition-colors"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center space-x-2">
          <Badge
            variant="outline"
            className={`
              ${isLLM ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : ""}
              ${isTool ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : ""}
              ${!isLLM && !isTool ? "bg-slate-800/50 text-slate-300 border-slate-700" : ""}
            `}
          >
            {spanType.toUpperCase()}
          </Badge>

          <span className="text-sm font-medium text-slate-300">
            {span?.name ?? "Unnamed span"}
          </span>

          {span?.model && (
            <span className="text-xs text-slate-500">({span.model})</span>
          )}
        </div>

        <div className="flex items-center space-x-3 opacity-60 group-hover:opacity-100 transition-opacity">
          {hasTokens && tokenParts.length > 0 && (
            <span className="text-xs text-slate-500">
              {tokenParts.join(" / ")}
            </span>
          )}

          {typeof span?.cost === "number" && span.cost > 0 && (
            <span className="text-xs text-emerald-400">
              ${span.cost.toFixed(4)}
            </span>
          )}

          <span className="text-xs text-slate-500">{durationLabel}</span>

          {isError && (
            <Badge
              variant="error"
              className="bg-rose-500/10 text-rose-400 border-rose-500/20"
            >
              Error
            </Badge>
          )}

          {showDetails ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="mt-2 space-y-3 bg-slate-900/50 border border-slate-800 rounded-lg p-3">
          {/* Timing Information */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Start Time:</span>
              <span className="ml-2 text-slate-300 font-mono">
                {formatTimestamp(startTime)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">End Time:</span>
              <span className="ml-2 text-slate-300 font-mono">
                {formatTimestamp(endTime)}
              </span>
            </div>
          </div>

          {/* Status and ID */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Status:</span>
              <Badge
                variant="outline"
                className={`ml-2 ${spanStatus === "ok"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  }`}
              >
                {spanStatus}
              </Badge>
            </div>
            <div className="truncate">
              <span className="text-slate-500">ID:</span>
              <span className="ml-2 text-slate-400 font-mono text-xs">
                {span?.id ?? "N/A"}
              </span>
            </div>
          </div>

          {/* Error Details */}
          {isError && span?.error && (
            <div className="bg-rose-900/20 border border-rose-500/20 rounded p-2">
              <p className="text-xs font-medium text-rose-400 mb-1">
                Error Details:
              </p>
              <p className="text-xs text-rose-300 font-mono">{span.error}</p>
            </div>
          )}

          {/* Inputs */}
          {span?.inputs && (
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Inputs:</p>
              <div className="bg-slate-950/50 border border-slate-700 rounded p-2 h-40 resize-y overflow-y-auto">
                <pre className="text-xs text-cyan-300 font-mono whitespace-pre-wrap break-words">
                  {formatJSONDisplay(span.inputs)}
                </pre>
              </div>
            </div>
          )}

          {/* Outputs */}
          {span?.outputs && (
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">
                Outputs:
              </p>
              <div className="bg-slate-950/50 border border-slate-700 rounded p-2 h-40 resize-y overflow-y-auto">
                <pre className="text-xs text-emerald-300 font-mono whitespace-pre-wrap break-words">
                  {formatJSONDisplay(span.outputs)}
                </pre>
              </div>
            </div>
          )}

          {/* Span Evaluation */}
          {span?.evaluation && (
            <div className={`p-3 rounded border ${span.evaluation.evalQualityScore >= 0.7
              ? "bg-emerald-900/10 border-emerald-500/20"
              : "bg-amber-900/10 border-amber-500/20"
              }`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-300">Evaluation</p>
                <div className="flex items-center space-x-2">
                  {span.evaluation.evalRelevant !== null && (
                    <Badge variant="outline" className={span.evaluation.evalRelevant ? "text-emerald-400 border-emerald-500/30" : "text-slate-500 border-slate-700"}>
                      {span.evaluation.evalRelevant ? "Relevant" : "Irrelevant"}
                    </Badge>
                  )}
                  {span.evaluation.evalQualityScore !== null && (
                    <span className={`text-xs font-bold ${span.evaluation.evalQualityScore >= 0.7 ? "text-emerald-400" : "text-amber-400"}`}>
                      {span.evaluation.evalQualityScore.toFixed(2)} Score
                    </span>
                  )}
                </div>
              </div>

              {span.evaluation.evalReasoning && (
                <p className="text-xs text-slate-400 mb-2 italic">"{span.evaluation.evalReasoning}"</p>
              )}

              {span.evaluation.evalIssues && span.evaluation.evalIssues.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-rose-400 mb-1">Issues:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {span.evaluation.evalIssues.map((issue, idx) => (
                      <li key={idx} className="text-xs text-rose-300">{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Token and Cost Details (for LLM spans) */}
          {isLLM && hasTokens && (
            <div className="bg-purple-900/10 border border-purple-500/20 rounded p-2">
              <p className="text-xs font-medium text-purple-400 mb-2">
                Resource Usage:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {typeof inputTokens === "number" && inputTokens > 0 && (
                  <div>
                    <span className="text-slate-500">Input Tokens:</span>
                    <span className="ml-2 text-purple-300 font-mono">
                      {inputTokens.toLocaleString()}
                    </span>
                  </div>
                )}
                {typeof outputTokens === "number" && outputTokens > 0 && (
                  <div>
                    <span className="text-slate-500">Output Tokens:</span>
                    <span className="ml-2 text-purple-300 font-mono">
                      {outputTokens.toLocaleString()}
                    </span>
                  </div>
                )}
                {typeof resolvedTotalTokens === "number" &&
                  resolvedTotalTokens > 0 && (
                    <div>
                      <span className="text-slate-500">Total Tokens:</span>
                      <span className="ml-2 text-purple-300 font-mono">
                        {resolvedTotalTokens.toLocaleString()}
                      </span>
                    </div>
                  )}
                {typeof span?.cost === "number" && span.cost > 0 && (
                  <div>
                    <span className="text-slate-500">Cost:</span>
                    <span className="ml-2 text-emerald-300 font-mono">
                      ${span.cost.toFixed(6)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TurnCard = ({ turn, turnNumber }) => {
  const evaluation = turn?.assistant?.evaluation ?? {};
  const [expanded, setExpanded] = useState(true); // keep your default expanded behavior

  const status = evaluation?.status ?? "review";
  const isFail = status === "fail";
  const isReview = status === "review";

  const latencyMs = turn?.assistant?.latencyMs ?? turn?.assistant?.latency_ms;
  const latencyLabel =
    turn?.assistant?.latency ??
    (typeof latencyMs === "number"
      ? `${(latencyMs / 1000).toFixed(1)}s`
      : "0.0s");

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
                <p className="text-sm text-slate-200">
                  {turn?.user?.content ?? ""}
                </p>
              </div>
            </div>
          </div>

          {/* Spans */}
          {Array.isArray(turn?.spans) && turn.spans.length > 0 && (
            <div className="py-2 bg-slate-950/30 border-b border-slate-800/50">
              <p className="px-4 text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Execution Path
              </p>
              {turn.spans.map((span) => (
                <SpanItem key={span.id} span={span} />
              ))}
            </div>
          )}

          {/* Assistant Message */}
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
                <p className="text-sm text-slate-200 whitespace-pre-wrap">
                  {turn?.assistant?.content ?? ""}
                </p>
              </div>
            </div>
          </div>
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
                <p className="text-sm text-slate-300">{evaluation.reason}</p>
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

  const passCount =
    detail.turns?.filter((t) => t.assistant.evaluation.status === "pass")
      .length || 0;
  const failCount =
    detail.turns?.filter((t) => t.assistant.evaluation.status === "fail")
      .length || 0;
  const reviewCount =
    detail.turns?.filter((t) => t.assistant.evaluation.status === "review")
      .length || 0;

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
              <p className="text-3xl font-bold text-white">
                {detail.avgScore?.toFixed(1)}
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
    </div>
  );
};
