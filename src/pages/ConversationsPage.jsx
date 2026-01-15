import React, { useState } from "react";
import { Users, TrendingUp, Filter, Download } from "lucide-react";
import { MetricsOverview } from "../components/dashboard/MetricsOverview";
import { ConversationTable } from "../components/conversations/ConversationTable";
import { useConversations } from "../hooks/useConversations";

export const ConversationsPage = ({ onSelectConversation }) => {
  const { conversations, loading } = useConversations();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-500">Monitor your AI agent performance and user sessions</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </button>
          <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Metrics Section */}
      <MetricsOverview />

      {/* Sessions Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">User Sessions</h2>
                <p className="text-sm text-gray-500">{conversations?.length || 0} sessions • Click to view conversation details and evaluations</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">Live</span>
            </div>
          </div>
        </div>
        <ConversationTable
          conversations={conversations}
          loading={loading}
          onSelectConversation={onSelectConversation}
        />
      </div>
    </div>
  );
};
