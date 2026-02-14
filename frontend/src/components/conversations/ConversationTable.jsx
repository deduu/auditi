import React from "react";
import { formatDate, parseUTCDate } from "@utils/formatters";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "../ui/Badge";

const Spinner = ({ size = "md" }) => {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex items-center justify-center p-12">
      <div
        className={`animate-spin rounded-full border-b-2 border-blue-500 ${sizes[size]}`}
      />
    </div>
  );
};

const getStatusBadge = (status, passCount, failCount) => {
  if (status === "pass") {
    return (
      <Badge variant="success">
        <CheckCircle className="w-3 h-3 mr-1" />
        Pass ({passCount}/{passCount + failCount})
      </Badge>
    );
  } else if (status === "fail") {
    return (
      <Badge variant="error">
        <XCircle className="w-3 h-3 mr-1" />
        Fail ({passCount}/{passCount + failCount})
      </Badge>
    );
  } else if (status === "review") {
    return (
      <Badge variant="warning">
        <AlertCircle className="w-3 h-3 mr-1" />
        Review ({passCount}/{passCount + failCount})
      </Badge>
    );
  } else {
    return (
      <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
        <span className="relative flex h-2 w-2 mr-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
        Evaluating...
      </Badge>
    );
  }
};



export const ConversationTable = ({
  conversations,
  loading,
  onSelectConversation,
  selectedIds = new Set(),
  onToggleSelection = () => { },
  onToggleAll = () => { },
  newItemIds = new Set(),
}) => {
  if (loading) {
    return <Spinner size="lg" />;
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500">
        No sessions found
      </div>
    );
  }

  const allSelected = conversations.length > 0 && conversations.every(c => selectedIds.has(c.id));

  return (
    <div className="overflow-x-auto">
      <style>{`
        @keyframes newRowGlow {
          0% { background-color: rgba(59, 130, 246, 0.15); }
          100% { background-color: transparent; }
        }
        .animate-new-row {
          animation: newRowGlow 3s ease-out forwards;
        }
      `}</style>
      <table className="min-w-full">
        <thead className="bg-slate-900/50 border-b border-slate-800">
          <tr>
            <th className="px-6 py-3 w-4">
              <input
                type="checkbox"
                className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/50"
                checked={allSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Date/Time
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              User
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Objective
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Turns
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Models
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Avg. Score
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Avg. Latency
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Cost
            </th>
          </tr>
        </thead>
        <tbody className="bg-transparent divide-y divide-slate-800">
          {conversations.map((session) => {
            const isSelected = selectedIds.has(session.id);
            const isNew = newItemIds.has(session.id);
            return (
              <tr
                key={session.id}
                className={`transition-colors border-b border-slate-800 last:border-0 ${isSelected ? 'bg-blue-900/10 hover:bg-blue-900/20' : 'hover:bg-slate-800/50'
                  } ${isNew ? 'animate-new-row' : ''}`}
                onClick={() => onSelectConversation(session.id)}
              >
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/50"
                    checked={isSelected}
                    onChange={() => onToggleSelection(session.id)}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-white">
                    {formatDate(session.startTime)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {parseUTCDate(session.startTime)?.toLocaleTimeString() ?? "N/A"}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                    {session.userId}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-300 max-w-xs truncate">
                    {session.objective}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-slate-400">
                    {session.totalTurns} turns
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-400">
                  <div className="flex flex-wrap gap-1">
                    {session.models?.map((model, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs border border-slate-700"
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`text-sm font-bold ${session.avgScore >= 0.8
                      ? "text-emerald-400"
                      : session.avgScore >= 0.5
                        ? "text-amber-400"
                        : "text-rose-400"
                      }`}
                  >
                    {session.avgScore?.toFixed(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(session.overallStatus, session.passCount, session.failCount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {session.latency}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {session.cost}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
