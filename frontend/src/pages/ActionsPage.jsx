import React, { useState, useEffect } from "react";
import { Zap, ArrowRight, CheckCircle2, Clock, AlertTriangle, TrendingUp, X } from "lucide-react";
import api from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

const getPriorityBadge = (priority) => {
  switch (priority) {
    case "high":
      return <Badge variant="error" className="capitalize">{priority} Priority</Badge>;
    case "medium":
      return <Badge variant="warning" className="capitalize">{priority} Priority</Badge>;
    case "low":
      return <Badge variant="success" className="capitalize">{priority} Priority</Badge>;
    default:
      return <Badge variant="default" className="capitalize">{priority} Priority</Badge>;
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    case "in-progress":
      return <Clock className="w-5 h-5 text-blue-500" />;
    default:
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
  }
};

const ActionDetailModal = ({ action, onClose }) => {
  if (!action) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
          <h3 className="text-lg font-semibold text-white">Action Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
            <p className="text-white font-medium">{action.title}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
            <p className="text-slate-300">{action.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Priority</label>
              {getPriorityBadge(action.priority)}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
              <div className="flex items-center space-x-2">
                {getStatusIcon(action.status)}
                <span className="text-sm text-slate-300 capitalize">{action.status.replace('-', ' ')}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
              <div className="text-sm text-slate-300 bg-slate-800 px-2 py-1 rounded inline-block border border-slate-700">
                {action.category}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Impact</label>
              <div className="text-sm font-medium text-blue-400">
                {action.impact}
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700 flex justify-end">
          <Button
            onClick={onClose}
            variant="outline"
          >
            Close
          </Button>
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
        <div className="text-slate-500">Loading recommended actions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Recommended Actions</h1>
          <p className="mt-1 text-slate-400">Prioritized improvements based on conversation analysis</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {stats.pending} Pending
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {stats.completed} Completed
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg shadow-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Actions</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <Zap className="w-10 h-10 text-blue-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Completion Rate</p>
              <p className="text-3xl font-bold mt-1">{stats.completionRate}%</p>
            </div>
            <TrendingUp className="w-10 h-10 text-emerald-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl p-6 text-white shadow-lg shadow-purple-500/20">
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
      <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-semibold text-white">Action Items</h2>
        </div>
        <div className="divide-y divide-slate-800">
          {actions.map((action) => (
            <div key={action.id} className="p-6 hover:bg-slate-800/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  {getStatusIcon(action.status)}
                  <div className="space-y-1">
                    <h3 className="text-base font-medium text-white">{action.title}</h3>
                    <p className="text-sm text-slate-400">{action.description}</p>
                    <div className="flex items-center space-x-2 pt-2">
                      {getPriorityBadge(action.priority)}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {action.category}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => setSelectedAction(action)}
                  variant="ghost"
                  size="sm"
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                >
                  View <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

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
