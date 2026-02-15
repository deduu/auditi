import React from "react";
import { LayoutDashboard, Clock, Coins, Zap, Layers, Target } from "lucide-react";
import { Card } from "../ui/Card";

const TYPE_COLORS = {
  agent: "bg-blue-500/20 text-blue-400",
  llm: "bg-purple-500/20 text-purple-400",
  tool: "bg-amber-500/20 text-amber-400",
  unknown: "bg-slate-500/20 text-slate-400",
};

const STATUS_COLORS = {
  ok: "bg-emerald-500/20 text-emerald-400",
  error: "bg-rose-500/20 text-rose-400",
};

const BAR_COLORS = [
  "bg-purple-500",
  "bg-purple-400",
  "bg-purple-600",
  "bg-indigo-500",
  "bg-violet-500",
];

function normalizeSpan(span) {
  const spanType = (span?.type ?? span?.spanType ?? span?.span_type ?? "unknown").toString();
  const durationMs = span?.durationMs ?? span?.duration_ms ?? 0;
  const inputTokens = span?.input_tokens ?? span?.inputTokens ?? 0;
  const outputTokens = span?.output_tokens ?? span?.outputTokens ?? 0;
  const tokens = span?.tokens ?? span?.total_tokens ?? span?.totalTokens ?? (inputTokens + outputTokens);
  const cost = span?.cost ?? 0;
  const status = (span?.status ?? "ok").toString();
  return { ...span, spanType, durationMs, inputTokens, outputTokens, tokens, cost, status };
}

function MetricCard({ icon: Icon, label, value, sublabel, className = "" }) {
  return (
    <div className={`bg-slate-800/50 rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white">{value}</p>
      {sublabel && <p className="text-[10px] text-slate-500 mt-0.5">{sublabel}</p>}
    </div>
  );
}

export const TraceSummaryView = ({ trace }) => {
  const rawSpans = trace.spans || [];
  if (rawSpans.length === 0) {
    return (
      <Card className="p-8 border-slate-800 bg-slate-900/30 text-center">
        <p className="text-slate-500">No spans to visualize</p>
      </Card>
    );
  }

  const spans = rawSpans.map(normalizeSpan);
  const llmSpans = spans.filter((s) => s.spanType === "llm");
  const toolSpans = spans.filter((s) => s.spanType === "tool");
  const agentSpans = spans.filter((s) => s.spanType === "agent");
  const errorSpans = spans.filter((s) => s.status === "error");

  const totalTokens = spans.reduce((sum, s) => sum + s.tokens, 0);
  const totalCost = spans.reduce((sum, s) => sum + s.cost, 0);

  const scoreDisplay = trace.score != null
    ? `${(trace.score * 100).toFixed(0)}%`
    : "N/A";

  const stepsBreakdown = [
    agentSpans.length > 0 && `${agentSpans.length} Agent`,
    llmSpans.length > 0 && `${llmSpans.length} LLM`,
    toolSpans.length > 0 && `${toolSpans.length} Tool`,
  ].filter(Boolean).join(" / ");

  return (
    <Card className="p-6 border-slate-800 bg-slate-900/30 space-y-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Trace Summary
        </h3>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          icon={Clock}
          label="Duration"
          value={`${(trace.latencyMs || 0).toFixed(0)}ms`}
        />
        <MetricCard
          icon={Coins}
          label="Cost"
          value={totalCost > 0 ? `$${totalCost.toFixed(6)}` : "$0"}
        />
        <MetricCard
          icon={Zap}
          label="Tokens"
          value={totalTokens.toLocaleString()}
        />
        <MetricCard
          icon={Layers}
          label="Steps"
          value={spans.length}
          sublabel={stepsBreakdown}
        />
        <MetricCard
          icon={Target}
          label="Score"
          value={scoreDisplay}
          sublabel={trace.status || "pending"}
        />
      </div>

      {/* Span Breakdown Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500 uppercase tracking-wider">
              <th className="py-2 text-left font-medium">#</th>
              <th className="py-2 text-left font-medium">Name</th>
              <th className="py-2 text-left font-medium">Type</th>
              <th className="py-2 text-left font-medium">Model</th>
              <th className="py-2 text-right font-medium">Duration</th>
              <th className="py-2 text-right font-medium">Tokens</th>
              <th className="py-2 text-right font-medium">Cost</th>
              <th className="py-2 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {spans.map((span, i) => (
              <tr
                key={span.id}
                className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
              >
                <td className="py-2 text-slate-500">{i + 1}</td>
                <td className="py-2 text-slate-300 max-w-[200px] truncate">{span.name}</td>
                <td className="py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${TYPE_COLORS[span.spanType] || TYPE_COLORS.unknown}`}>
                    {span.spanType}
                  </span>
                </td>
                <td className="py-2 text-slate-500">{span.model || "-"}</td>
                <td className="py-2 text-right text-slate-300 font-mono">
                  {span.durationMs > 0 ? `${span.durationMs.toFixed(1)}ms` : "-"}
                </td>
                <td className="py-2 text-right text-slate-300 font-mono">
                  {span.tokens > 0 ? span.tokens.toLocaleString() : "-"}
                </td>
                <td className="py-2 text-right text-emerald-400 font-mono">
                  {span.cost > 0 ? `$${span.cost.toFixed(4)}` : "-"}
                </td>
                <td className="py-2 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[span.status] || STATUS_COLORS.ok}`}>
                    {span.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Token Distribution */}
      {llmSpans.length > 1 && totalTokens > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">Token Distribution by LLM Call</p>
          <div className="flex h-5 rounded-full overflow-hidden bg-slate-800 gap-px">
            {llmSpans.map((s, i) => {
              const pct = (s.tokens / totalTokens) * 100;
              if (pct < 0.5) return null;
              return (
                <div
                  key={s.id}
                  style={{ width: `${pct}%` }}
                  className={`${BAR_COLORS[i % BAR_COLORS.length]} flex items-center justify-center`}
                  title={`${s.name}: ${s.tokens.toLocaleString()} tokens (${pct.toFixed(1)}%)`}
                >
                  {pct > 10 && (
                    <span className="text-[9px] text-white/80 truncate px-1">
                      {s.tokens.toLocaleString()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* I/O Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">Input Preview</p>
          <p className="text-xs text-slate-400 font-mono line-clamp-3 bg-slate-800/50 rounded p-2 whitespace-pre-wrap">
            {typeof trace.userInput === "string"
              ? trace.userInput.slice(0, 200)
              : JSON.stringify(trace.userInput || "").slice(0, 200)}
            {(trace.userInput || "").length > 200 && "..."}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Output Preview</p>
          <p className="text-xs text-slate-400 font-mono line-clamp-3 bg-slate-800/50 rounded p-2 whitespace-pre-wrap">
            {trace.assistantOutput
              ? (typeof trace.assistantOutput === "string"
                  ? trace.assistantOutput.slice(0, 200)
                  : JSON.stringify(trace.assistantOutput).slice(0, 200))
              : "No output"}
            {(trace.assistantOutput || "").length > 200 && "..."}
          </p>
        </div>
      </div>

      {/* Error Summary */}
      {errorSpans.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
          <p className="text-xs font-medium text-rose-400 mb-1">
            {errorSpans.length} span{errorSpans.length > 1 ? "s" : ""} with errors
          </p>
          {errorSpans.map((s) => (
            <p key={s.id} className="text-xs text-rose-300/70">
              {s.name}: {s.error || "Unknown error"}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
};
