import React, { useState, useEffect } from "react";
import { Zap, ArrowRight, CheckCircle2, Clock, AlertTriangle, TrendingUp, X } from "lucide-react";
import api from "../services/api";

const getPriorityStyles = (priority) => {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-700 border-red-200";
    case "medium":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "low":
      return "bg-green-100 text-green-700 border-green-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case "in-progress":
      return <Clock className="w-5 h-5 text-blue-500" />;
    default:
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  }
};

const ActionDetailModal = ({ action, onClose }) => {
  if (!action) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Action Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Title</label>
            <p className="text-gray-900 font-medium">{action.title}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Description</label>
            <p className="text-gray-800">{action.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Priority</label>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityStyles(action.priority)}`}>
                {action.priority.charAt(0).toUpperCase() + action.priority.slice(1)}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
              <div className="flex items-center space-x-2">
                {getStatusIcon(action.status)}
                <span className="text-sm text-gray-700 capitalize">{action.status.replace('-', ' ')}</span>
              </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Category</label>
                <div className="text-sm text-gray-900 bg-gray-100 px-2 py-1 rounded inline-block">
                    {action.category}
                </div>
            </div>
            <div>
                 <label className="block text-sm font-medium text-gray-500 mb-1">Impact</label>
                 <div className="text-sm font-medium text-blue-600">
                    {action.impact}
                 </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const ActionsPage = () => {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    completionRate: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getRecommendedActions();
        setActions(data);

        const total = data.length;
        const pending = data.filter(a => a.status === "pending").length;
        const completed = data.filter(a => a.status === "completed").length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

        setStats({
          total,
          pending,
          completed,
          completionRate: rate
        });
      } catch (error) {
        console.error("Failed to fetch actions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading recommended actions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recommended Actions</h1>
          <p className="mt-1 text-gray-500">Prioritized improvements based on conversation analysis</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
            {stats.pending} Pending
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            {stats.completed} Completed
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Actions</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <Zap className="w-10 h-10 text-blue-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Completion Rate</p>
              <p className="text-3xl font-bold mt-1">{stats.completionRate}%</p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Est. Impact</p>
              <p className="text-3xl font-bold mt-1">+12%</p>
            </div>
            <CheckCircle2 className="w-10 h-10 text-purple-200" />
          </div>
        </div>
      </div>

      {/* Actions List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Action Items</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {actions.map((action) => (
            <div key={action.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  {getStatusIcon(action.status)}
                  <div className="space-y-1">
                    <h3 className="text-base font-medium text-gray-900">{action.title}</h3>
                    <p className="text-sm text-gray-500">{action.description}</p>
                    <div className="flex items-center space-x-2 pt-2">
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityStyles(action.priority)}`}>
                        {action.priority.charAt(0).toUpperCase() + action.priority.slice(1)} Priority
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {action.category}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAction(action)}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                >
                  View <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedAction && (
        <ActionDetailModal
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
        />
      )}
    </div>
  );
};
