import React from "react";
import { ArrowDownUp, Bot, Wrench, Cpu } from "lucide-react";
import { Card } from "../ui/Card";

const COLUMNS = ["agent", "llm", "tool"];
const COL_X = { agent: 16.67, llm: 50, tool: 83.33 };

const COL_CONFIG = {
  agent: {
    label: "Agent",
    icon: Cpu,
    headerBg: "bg-blue-500/10 border-blue-500/30",
    headerText: "text-blue-400",
    lineColor: "#3b82f6",
  },
  llm: {
    label: "LLM",
    icon: Bot,
    headerBg: "bg-purple-500/10 border-purple-500/30",
    headerText: "text-purple-400",
    lineColor: "#a855f7",
  },
  tool: {
    label: "Tools",
    icon: Wrench,
    headerBg: "bg-amber-500/10 border-amber-500/30",
    headerText: "text-amber-400",
    lineColor: "#f59e0b",
  },
};

const ARROW_COLORS = {
  agent: "#3b82f6",
  llm: "#a855f7",
  tool: "#f59e0b",
  unknown: "#64748b",
};

function normalizeSpan(span) {
  const spanType = (span?.type ?? span?.spanType ?? span?.span_type ?? "unknown").toString();
  const durationMs = span?.durationMs ?? span?.duration_ms ?? 0;
  const status = (span?.status ?? "ok").toString();
  return { ...span, spanType, durationMs, status };
}

function formatMs(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function mapToColumn(type) {
  if (COLUMNS.includes(type)) return type;
  return "agent";
}

export const TraceSequenceView = ({ trace }) => {
  const rawSpans = trace.spans || [];
  if (rawSpans.length === 0) {
    return (
      <Card className="p-8 border-slate-800 bg-slate-900/30 text-center">
        <p className="text-slate-500">No spans to visualize</p>
      </Card>
    );
  }

  const spans = rawSpans.map(normalizeSpan);

  // Build messages: each span becomes an arrow from the previous span's column to this span's column
  const messages = spans.map((span, i) => {
    const toCol = mapToColumn(span.spanType);
    let fromCol;
    if (i === 0) {
      // First span: arrow from itself (self-activation)
      fromCol = toCol;
    } else {
      fromCol = mapToColumn(spans[i - 1].spanType);
    }
    return { span, fromCol, toCol };
  });

  const ROW_HEIGHT = 48;
  const totalHeight = messages.length * ROW_HEIGHT;
  const uniqueId = React.useId();

  return (
    <Card className="p-6 border-slate-800 bg-slate-900/30">
      <div className="flex items-center gap-2 mb-5">
        <ArrowDownUp className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Sequence Diagram
        </h3>
        <span className="text-xs text-slate-500 ml-2">
          {spans.length} step{spans.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 gap-4 mb-2">
        {COLUMNS.map((col) => {
          const cfg = COL_CONFIG[col];
          const Icon = cfg.icon;
          return (
            <div key={col} className="flex flex-col items-center">
              <div className={`px-4 py-2 rounded-lg border ${cfg.headerBg} flex items-center gap-2`}>
                <Icon className={`w-3.5 h-3.5 ${cfg.headerText}`} />
                <span className={`text-sm font-medium ${cfg.headerText}`}>
                  {cfg.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lifelines + Messages */}
      <div className="relative" style={{ height: totalHeight }}>
        {/* Dashed lifelines */}
        {COLUMNS.map((col) => (
          <div
            key={col}
            className="absolute top-0 bottom-0 border-l border-dashed border-slate-700/50"
            style={{ left: `${COL_X[col]}%` }}
          />
        ))}

        {/* SVG layer for arrows */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ overflow: "visible" }}
        >
          <defs>
            <marker
              id={`${uniqueId}-arrow`}
              viewBox="0 0 8 6"
              refX="7"
              refY="3"
              markerWidth="6"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <polygon points="0 0, 8 3, 0 6" fill="currentColor" />
            </marker>
          </defs>

          {messages.map(({ span, fromCol, toCol }, i) => {
            const y = i * ROW_HEIGHT + ROW_HEIGHT / 2;
            const fromX = COL_X[fromCol];
            const toX = COL_X[toCol];
            const color = ARROW_COLORS[toCol] || ARROW_COLORS.unknown;
            const isError = span.status === "error";
            const strokeColor = isError ? "#f43f5e" : color;

            if (fromCol === toCol) {
              // Self-activation: small loop arc
              const x = fromX;
              return (
                <g key={span.id} style={{ color: strokeColor }}>
                  <path
                    d={`M ${x}% ${y - 6} C ${x + 5}% ${y - 6}, ${x + 5}% ${y + 6}, ${x}% ${y + 6}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    markerEnd={`url(#${uniqueId}-arrow)`}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            }

            // Straight arrow between columns
            const isLeftToRight = toX > fromX;
            const nudge = isLeftToRight ? 1 : -1;
            return (
              <g key={span.id} style={{ color: strokeColor }}>
                <line
                  x1={`${fromX + nudge}%`}
                  y1={y}
                  x2={`${toX - nudge}%`}
                  y2={y}
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  markerEnd={`url(#${uniqueId}-arrow)`}
                />
              </g>
            );
          })}
        </svg>

        {/* Message labels */}
        {messages.map(({ span, fromCol, toCol }, i) => {
          const y = i * ROW_HEIGHT;
          const midX = (COL_X[fromCol] + COL_X[toCol]) / 2;
          const isError = span.status === "error";

          // Position label above the arrow, centered between columns
          // For self-arrows, offset to the right
          const isSelf = fromCol === toCol;
          const labelLeft = isSelf ? `${COL_X[fromCol] + 6}%` : `${midX}%`;
          const transform = isSelf ? "translateX(0)" : "translateX(-50%)";

          return (
            <div
              key={span.id}
              className="absolute flex flex-col items-start"
              style={{
                top: y + 4,
                left: labelLeft,
                transform,
              }}
            >
              <span className={`text-[11px] font-medium truncate max-w-[160px] ${isError ? "text-rose-400" : "text-slate-300"}`}>
                {span.name}
              </span>
              <span className="text-[10px] text-slate-500">
                {formatMs(span.durationMs)}
                {span.model && ` · ${span.model}`}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
