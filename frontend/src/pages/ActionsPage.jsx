/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState, useEffect } from "react";
import {
  Zap, ArrowRight, CheckCircle2, Clock, AlertTriangle, TrendingUp, X,
  Lightbulb, DollarSign, Activity, ShieldAlert, Target, Brain
} from "lucide-react";
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

const getCategoryIcon = (category) => {
  switch (category) {
    case "performance":
      return <Activity className="w-5 h-5 text-blue-400" />;
    case "cost":
      return <DollarSign className="w-5 h-5 text-emerald-400" />;
    case "reliability":
      return <ShieldAlert className="w-5 h-5 text-amber-400" />;
    case "quality":
      return <Target className="w-5 h-5 text-purple-400" />;
    default:
      return <Brain className="w-5 h-5 text-slate-400" />;
  }
};

const getTypeBadge = (type) => {
  switch (type) {
    case "danger":
      return <Badge variant="error">Critical</Badge>;
    case "warning":
      return <Badge variant="warning">Warning</Badge>;
    case "success":
      return <Badge variant="success">Good</Badge>;
    case "info":
      return <Badge variant="info">Info</Badge>;
    default:
      return <Badge variant="default">{type}</Badge>;
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
  const [insights, setInsights] = useState([]);
  const [insightsSummary, setInsightsSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState(null);
  const [activeTab, setActiveTab] = useState("insights");
  const [timeRange, setTimeRange] = useState("7d");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    completionRate: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch both actions and insights in parallel
        const [actionsData, insightsData] = await Promise.all([
          api.getRecommendedActions(),
          api.getInsights(timeRange)
        ]);

        setActions(actionsData);
        setInsights(insightsData.insights || []);
        setInsightsSummary(insightsData.summary || null);

        const total = actionsData.length;
        const pending = actionsData.filter(a => a.status === "pending").length;
        const completed = actionsData.filter(a => a.status === "completed").length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

        setStats({
          total,
          pending,
          completed,
          completionRate: rate
        });
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading recommended actions...</div>
      </div>
    );
  }

  const criticalInsights = insights.filter(i => i.type === "danger").length;
  const warningInsights = insights.filter(i => i.type === "warning").length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Recommendations</h1>
          <p className="mt-1 text-slate-400">Data-driven insights and prioritized actions</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white shadow-lg shadow-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Total Insights</p>
              <p className="text-3xl font-bold mt-1">{insights.length}</p>
            </div>
            <Lightbulb className="w-10 h-10 text-amber-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-6 text-white shadow-lg shadow-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Critical Issues</p>
              <p className="text-3xl font-bold mt-1">{criticalInsights}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg shadow-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Action Items</p>
              <p className="text-3xl font-bold mt-1">{stats.pending}</p>
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
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("insights")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "insights"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-white"
              }`}
          >
            <Lightbulb className="w-4 h-4 inline mr-2" />
            Data-Driven Insights
            {criticalInsights > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
                {criticalInsights}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("actions")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "actions"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-white"
              }`}
          >
            <CheckCircle2 className="w-4 h-4 inline mr-2" />
            Action Items
            {stats.pending > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">
                {stats.pending}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "insights" && (
        <div className="space-y-6">
          {/* Insights Summary */}
          {insightsSummary && (
            <Card className="bg-slate-900/50 border-slate-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-white">{insightsSummary.total_volume || 0}</p>
                  <p className="text-sm text-slate-400">Traces Analyzed</p>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-white">{insightsSummary.current_score?.toFixed(1) || 0}%</p>
                  <p className="text-sm text-slate-400">Avg Score</p>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-white">${insightsSummary.total_cost?.toFixed(2) || "0.00"}</p>
                  <p className="text-sm text-slate-400">Total Cost</p>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-white">{insightsSummary.current_error_rate?.toFixed(1) || 0}%</p>
                  <p className="text-sm text-slate-400">Error Rate</p>
                </div>
              </div>
            </Card>
          )}

          {/* Insights List */}
          <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
              <h2 className="text-lg font-semibold text-white">Insights & Recommendations</h2>
            </div>
            {insights.length === 0 ? (
              <div className="p-12 text-center">
                <Lightbulb className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No insights available for the selected time range.</p>
                <p className="text-sm text-slate-500 mt-2">Try selecting a longer time range or check back later.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {insights.map((insight, index) => (
                  <div key={index} className="p-6 hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-start space-x-4">
                      <div className="mt-1">
                        {getCategoryIcon(insight.category)}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-medium text-white">{insight.title}</h3>
                          {getTypeBadge(insight.type)}
                        </div>
                        <p className="text-sm text-slate-400">{insight.description}</p>
                        {insight.recommendation && (
                          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <p className="text-sm text-blue-300">
                              <span className="font-medium">Recommendation:</span> {insight.recommendation}
                            </p>
                          </div>
                        )}
                        {insight.metric_value && (
                          <div className="flex items-center space-x-4 mt-2">
                            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                              {insight.metric_name}: {typeof insight.metric_value === 'number'
                                ? insight.metric_value.toFixed(2)
                                : insight.metric_value}
                            </span>
                            <span className="text-xs text-slate-500 capitalize bg-slate-800 px-2 py-1 rounded">
                              Category: {insight.category}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "actions" && (
        <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Action Items</h2>
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {stats.pending} Pending
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {stats.completed} Completed
              </span>
            </div>
          </div>
          {actions.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No action items available.</p>
            </div>
          ) : (
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
          )}
        </Card>
      )}

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
