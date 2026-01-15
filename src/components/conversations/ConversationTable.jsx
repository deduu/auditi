import React from "react";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

const Spinner = ({ size = "md" }) => {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex items-center justify-center p-12">
      <div
        className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizes[size]}`}
      />
    </div>
  );
};

const getStatusBadge = (status, passCount, failCount) => {
  if (status === "pass") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Pass ({passCount}/{passCount + failCount})
      </span>
    );
  } else if (status === "fail") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <XCircle className="w-3 h-3 mr-1" />
        Fail ({passCount}/{passCount + failCount})
      </span>
    );
  } else {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <AlertCircle className="w-3 h-3 mr-1" />
        Review ({passCount}/{passCount + failCount})
      </span>
    );
  }
};

const SessionRow = ({ session, onClick }) => {
  return (
    <tr
      className="hover:bg-blue-50 cursor-pointer transition-colors"
      onClick={() => onClick(session.id)}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {new Date(session.startTime).toLocaleDateString()}
        </div>
        <div className="text-xs text-gray-500">
          {new Date(session.startTime).toLocaleTimeString()}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
          {session.userId}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900 max-w-xs truncate">
          {session.objective}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-gray-600">
          {session.totalTurns} turns
        </span>
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        <div className="flex flex-wrap gap-1">
          {session.models?.map((model, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
            >
              {model}
            </span>
          ))}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`text-sm font-semibold ${
            session.avgScore >= 8
              ? "text-green-600"
              : session.avgScore >= 6
              ? "text-yellow-600"
              : "text-red-600"
          }`}
        >
          {session.avgScore?.toFixed(1)}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {getStatusBadge(session.overallStatus, session.passCount, session.failCount)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {session.latency}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
      <div className="p-12 text-center text-gray-500">
        No sessions found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date/Time
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              User
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Objective
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Turns
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Models
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Avg Score
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Latency
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cost
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
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
