import React, { useState } from "react";
import { GanttChart } from "lucide-react";
import { Card } from "../ui/Card";

const TYPE_BADGE = {
  agent: "bg-blue-500/20 text-blue-400",
  llm: "bg-purple-500/20 text-purple-400",
  tool: "bg-amber-500/20 text-amber-400",
  unknown: "bg-slate-500/20 text-slate-400",
};

const BAR_COLORS = {
  agent: "bg-blue-500/70",
  llm: "bg-purple-500/70",
  tool: "bg-amber-500/70",
  unknown: "bg-slate-500/70",
};

const BAR_COLORS_ERROR = {
  agent: "bg-rose-500/70",
  llm: "bg-rose-500/70",
  tool: "bg-rose-500/70",
  unknown: "bg-rose-500/70",
};

function normalizeSpan(span) {
  const spanType = (span?.type ?? span?.spanType ?? span?.span_type ?? "unknown").toString();
  const startTime = span?.startTime ?? span?.start_time;
  const endTime = span?.endTime ?? span?.end_time;
  const durationMs = span?.durationMs ?? span?.duration_ms ?? 0;
  const tokens = span?.tokens ?? span?.total_tokens ?? span?.totalTokens ?? 0;
  const status = (span?.status ?? "ok").toString();
  const startMs = startTime ? new Date(startTime).getTime() : 0;
  const endMs = endTime ? new Date(endTime).getTime() : startMs + durationMs;
  return { ...span, spanType, startMs, endMs, durationMs: endMs - startMs || durationMs, tokens, status };
}

function formatMs(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export const TraceTimelineView = ({ trace }) => {
  const rawSpans = trace.spans || [];
  const [hoveredId, setHoveredId] = useState(null);

  if (rawSpans.length === 0) {
    return (
      <Card className="p-8 border-slate-800 bg-slate-900/30 text-center">
        <p className="text-slate-500">No spans to visualize</p>
      </Card>
    );
  }

  const spans = rawSpans.map(normalizeSpan);
  const minTime = Math.min(...spans.map((s) => s.startMs));
  const maxTime = Math.max(...spans.map((s) => s.endMs));
  const totalMs = maxTime - minTime || 1;

  // Generate tick marks
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((totalMs / tickCount) * i)
  );

  return (
    <Card className="p-6 border-slate-800 bg-slate-900/30">
      <div className="flex items-center gap-2 mb-5">
        <GanttChart className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Timeline
        </h3>
        <span className="text-xs text-slate-500 ml-2">
          Total: {formatMs(totalMs)}
        </span>
      </div>

      <div className="space-y-1.5">
        {spans.map((span) => {
          const offsetPct = ((span.startMs - minTime) / totalMs) * 100;
          const widthPct = Math.max((span.durationMs / totalMs) * 100, 1);
          const isError = span.status === "error";
          const isHovered = hoveredId === span.id;
          const barColor = isError
            ? BAR_COLORS_ERROR[span.spanType] || BAR_COLORS_ERROR.unknown
            : BAR_COLORS[span.spanType] || BAR_COLORS.unknown;

          return (
            <div
              key={span.id}
              className="flex items-center gap-3 group"
              onMouseEnter={() => setHoveredId(span.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Left label */}
              <div className="w-40 flex-shrink-0 flex items-center gap-2 min-w-0">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase flex-shrink-0 ${TYPE_BADGE[span.spanType] || TYPE_BADGE.unknown}`}>
                  {span.spanType}
                </span>
                <span className="text-xs text-slate-400 truncate" title={span.name}>
                  {span.name}
                </span>
              </div>

              {/* Bar container */}
              <div className="flex-1 h-7 bg-slate-800/40 rounded relative overflow-hidden">
                {/* Bar */}
                <div
                  className={`absolute top-0.5 bottom-0.5 rounded transition-all ${barColor} ${isHovered ? "brightness-125" : ""}`}
                  style={{ left: `${offsetPct}%`, width: `${widthPct}%` }}
                >
                  {widthPct > 8 && (
                    <span className="absolute inset-0 flex items-center px-1.5 text-[10px] text-white font-medium truncate">
                      {formatMs(span.durationMs)}
                    </span>
                  )}
                </div>

                {/* Hover tooltip */}
                {isHovered && widthPct <= 8 && (
                  <div
                    className="absolute -top-7 bg-slate-700 text-white text-[10px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-10"
                    style={{ left: `${offsetPct}%` }}
                  >
                    {span.name} — {formatMs(span.durationMs)}
                    {span.tokens > 0 && ` — ${span.tokens} tok`}
                  </div>
                )}
              </div>

              {/* Duration label */}
              <div className="w-16 flex-shrink-0 text-right">
                <span className="text-[11px] text-slate-500 font-mono">
                  {formatMs(span.durationMs)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time axis */}
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-800">
        <div className="w-40 flex-shrink-0" />
        <div className="flex-1 flex justify-between">
          {ticks.map((ms, i) => (
            <span key={i} className="text-[10px] text-slate-600 font-mono">
              {formatMs(ms)}
            </span>
          ))}
        </div>
        <div className="w-16 flex-shrink-0" />
      </div>
    </Card>
  );
};
