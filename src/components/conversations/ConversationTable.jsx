import React from "react";
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
  } else {
    return (
      <Badge variant="warning">
        <AlertCircle className="w-3 h-3 mr-1" />
        Review ({passCount}/{passCount + failCount})
      </Badge>
    );
  }
};

const SessionRow = ({ session, onClick }) => {
  return (
    <tr
      className="hover:bg-slate-800/50 cursor-pointer transition-colors border-b border-slate-800 last:border-0"
      onClick={() => onClick(session.id)}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-white">
          {new Date(session.startTime).toLocaleDateString()}
        </div>
        <div className="text-xs text-slate-500">
          {new Date(session.startTime).toLocaleTimeString()}
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
          className={`text-sm font-bold ${
            session.avgScore >= 8
              ? "text-emerald-400"
              : session.avgScore >= 6
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
};

export const ConversationTable = ({
  conversations,
  loading,
  onSelectConversation,
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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="bg-slate-900/50 border-b border-slate-800">
          <tr>
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
              Avg Score
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Latency
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cost
            </th>
          </tr>
        </thead>
        <tbody className="bg-transparent divide-y divide-slate-800">
          {conversations.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              onClick={onSelectConversation}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
