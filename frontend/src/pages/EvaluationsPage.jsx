/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, TrendingUp, BarChart3, Target, AlertTriangle, Search } from "lucide-react";
import api from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { exportToCSV } from "../utils/exportUtils";

const getScoreColor = (score) => {
  if (score >= 90) return "text-emerald-400";
  if (score >= 80) return "text-amber-400";
  return "text-rose-400";
};

const getProgressColor = (score) => {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 80) return "bg-amber-500";
  return "bg-rose-500";
};

const getTrendColor = (trend) => {
  return trend && trend.startsWith("+") ? "text-emerald-400" : "text-rose-400";
};

export const EvaluationsPage = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [failureModes, setFailureModes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState("7d");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [evalData, failureData] = await Promise.all([
          api.getEvaluations({ timeRange }),
          api.getFailureModes(timeRange)
        ]);
        setEvaluations(evalData.evaluations || []);
        setFailureModes(failureData || []);
      } catch (err) {
        console.error("Failed to fetch evaluation data:", err);
        setError("Failed to load evaluation data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading evaluation metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-rose-500">{error}</div>
      </div>
    );
  }

  const avgScore = evaluations.length > 0
    ? Math.round(evaluations.reduce((acc, e) => acc + e.score, 0) / evaluations.length)
    : 0;

  const searchLower = search.toLowerCase();
  const filteredEvaluations = search
    ? evaluations.filter((e) => e.name?.toLowerCase().includes(searchLower))
    : evaluations;
  const filteredFailureModes = search
    ? failureModes.filter((m) => m.name?.toLowerCase().includes(searchLower))
    : failureModes;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Evaluations</h1>
          <p className="mt-1 text-slate-400">Track evaluation metrics and scoring trends</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-900/80 border border-slate-800 rounded-lg p-1">
            {["24h", "7d", "30d"].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeRange === range
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
                  }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => exportToCSV(evaluations, "evaluations_report")}>
            <BarChart3 className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Overall Score</p>
              <p className={`text-3xl font-bold mt-1 ${getScoreColor(avgScore)}`}>{avgScore}%</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Target className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Avg Latency</p>
              <p className="text-3xl font-bold mt-1 text-purple-400">
                {evaluations.length > 0
                  ? (evaluations.reduce((acc, e) => acc + (e.avg_latency || 0), 0) / evaluations.length).toFixed(2)
                  : "0.00"}s
              </p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Total Cost</p>
              <p className="text-3xl font-bold mt-1 text-amber-400">
                ${evaluations.reduce((acc, e) => acc + (e.total_cost || 0), 0).toFixed(4)}
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Total Tokens</p>
              <p className="text-3xl font-bold mt-1 text-emerald-400">
                {(evaluations.reduce((acc, e) => acc + (e.total_tokens || 0), 0) / 1000).toFixed(1)}k
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <BarChart3 className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search evaluations or failure modes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Evaluation Criteria */}
        <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
            <h2 className="text-lg font-semibold text-white">Evaluation Criteria & Metrics</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {filteredEvaluations.map((evaluation) => (
              <div key={evaluation.id} className="p-6 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-base font-medium text-white">{evaluation.name}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 ${getTrendColor(evaluation.trend)}`}>
                      {evaluation.trend}
                    </span>
                  </div>
                  <span className={`text-2xl font-bold ${getScoreColor(evaluation.score)}`}>
                    {evaluation.score}%
                  </span>
                </div>

                {/* Metric Badges */}
                <div className="flex items-center space-x-4 mb-3 text-xs text-slate-400">
                  <div className="flex items-center">
                    <span className="font-medium text-slate-300 mr-1">{evaluation.avg_latency?.toFixed(2)}s</span> latency
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-slate-300 mr-1">${evaluation.total_cost?.toFixed(4)}</span> cost
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-slate-300 mr-1">{evaluation.total_tokens?.toLocaleString()}</span> tokens
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-slate-300 mr-1">{evaluation.pass_rate}%</span> pass rate
                  </div>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(evaluation.score)}`}
                    style={{ width: `${evaluation.score}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Failure Mode Analysis */}
        <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden h-fit">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Failure Mode Analysis</h2>
            <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">Last 7 Days</span>
          </div>
          <div className="p-6 space-y-6">
            {filteredFailureModes.map((mode) => (
              <div key={mode.id}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center">
                    <AlertTriangle className="w-4 h-4 text-orange-400 mr-2" />
                    <span className="text-sm font-medium text-slate-300">{mode.name}</span>
                  </div>
                  <span className="text-sm font-medium text-white">{mode.count} incidents ({mode.percentage}%)</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full"
                    style={{ width: `${mode.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}

            {filteredFailureModes.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No failure modes detected in this period.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
