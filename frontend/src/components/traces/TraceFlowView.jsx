import React from "react";
import { GitBranch } from "lucide-react";
import { Card } from "../ui/Card";

const TYPE_STYLES = {
  agent: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-400",
  },
  llm: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-400",
    badge: "bg-purple-500/20 text-purple-400",
  },
  tool: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-400",
  },
  unknown: {
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-400",
    badge: "bg-slate-500/20 text-slate-400",
  },
};

function normalizeSpan(span) {
  const spanType = (span?.type ?? span?.spanType ?? span?.span_type ?? "unknown").toString();
  const durationMs = span?.durationMs ?? span?.duration_ms ?? 0;
  const inputTokens = span?.input_tokens ?? span?.inputTokens ?? 0;
  const outputTokens = span?.output_tokens ?? span?.outputTokens ?? 0;
  const tokens = span?.tokens ?? span?.total_tokens ?? span?.totalTokens ?? (inputTokens + outputTokens);
  const status = (span?.status ?? "ok").toString();
  return { ...span, spanType, durationMs, tokens, status };
}

function formatDuration(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms.toFixed(0)}ms`;
}

function Arrow() {
  return (
    <div className="flex items-center flex-shrink-0 px-0.5">
      <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
        <defs>
          <marker id="flow-arrow" viewBox="0 0 6 6" refX="5" refY="3"
            markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <polygon points="0 0, 6 3, 0 6" fill="#475569" />
          </marker>
        </defs>
        <line x1="0" y1="8" x2="22" y2="8"
          stroke="#475569" strokeWidth="1.5" markerEnd="url(#flow-arrow)" />
      </svg>
    </div>
  );
}

export const TraceFlowView = ({ trace }) => {
  const rawSpans = trace.spans || [];
  if (rawSpans.length === 0) {
    return (
      <Card className="p-8 border-slate-800 bg-slate-900/30 text-center">
        <p className="text-slate-500">No spans to visualize</p>
      </Card>
    );
  }

  const spans = rawSpans.map(normalizeSpan);

  return (
    <Card className="p-6 border-slate-800 bg-slate-900/30">
      <div className="flex items-center gap-2 mb-5">
        <GitBranch className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Execution Flow
        </h3>
        <span className="text-xs text-slate-500 ml-2">
          {spans.length} step{spans.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex items-stretch min-w-max">
          {spans.map((span, i) => {
            const styles = TYPE_STYLES[span.spanType] || TYPE_STYLES.unknown;
            const isError = span.status === "error";
            const borderColor = isError ? "border-rose-500/50" : styles.border;

            return (
              <React.Fragment key={span.id}>
                {/* Span Node */}
                <div
                  className={`w-44 flex-shrink-0 p-3 rounded-lg border ${styles.bg} ${borderColor} flex flex-col gap-1.5`}
                >
                  {/* Type badge */}
                  <div className="flex items-center justify-between">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${styles.badge}`}>
                      {span.spanType}
                    </span>
                    {isError && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/20 text-rose-400">
                        ERROR
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <p className="text-sm font-medium text-white truncate" title={span.name}>
                    {span.name}
                  </p>

                  {/* Model (LLM only) */}
                  {span.model && (
                    <p className="text-[11px] text-slate-500 truncate">{span.model}</p>
                  )}

                  {/* Metrics row */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-auto pt-1 border-t border-slate-700/50">
                    <span>{formatDuration(span.durationMs)}</span>
                    {span.tokens > 0 && (
                      <>
                        <span className="text-slate-700">|</span>
                        <span>{span.tokens.toLocaleString()} tok</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Arrow between nodes */}
                {i < spans.length - 1 && <Arrow />}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
