import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, TrendingUp, BarChart3, Target, AlertTriangle } from "lucide-react";
import api from "../services/api";
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [evalData, failureData] = await Promise.all([
          api.getEvaluations(),
          api.getFailureModes()
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
  }, []);

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

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Evaluations</h1>
          <p className="mt-1 text-slate-400">Track evaluation metrics and scoring trends</p>
        </div>
        <Button variant="primary" onClick={() => exportToCSV(evaluations, "evaluations_report")}>
          <BarChart3 className="w-4 h-4 mr-2" />
          Export Report
        </Button>
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
              <p className="text-sm text-slate-400 font-medium">Passing</p>
              <p className="text-3xl font-bold mt-1 text-emerald-400">{evaluations.filter(e => e.score >= 80).length}</p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Needs Attention</p>
              <p className="text-3xl font-bold mt-1 text-amber-400">{evaluations.filter(e => e.score < 80).length}</p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
          </div>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Avg Improvement</p>
              <p className="text-3xl font-bold mt-1 text-emerald-400">+3.2%</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Evaluation Criteria */}
        <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
            <h2 className="text-lg font-semibold text-white">Evaluation Criteria</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {evaluations.map((evaluation) => (
              <div key={evaluation.id} className="p-6 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-base font-medium text-white">{evaluation.name}</h3>
                    <span className={`text-sm font-medium ${getTrendColor(evaluation.trend)}`}>
                      {evaluation.trend}
                    </span>
                  </div>
                  <span className={`text-2xl font-bold ${getScoreColor(evaluation.score)}`}>
                    {evaluation.score}%
                  </span>
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
            {failureModes.map((mode) => (
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
            
            {failureModes.length === 0 && (
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
