import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, TrendingUp, BarChart3, Target, AlertTriangle } from "lucide-react";
import api from "../services/api";

const getScoreColor = (score) => {
  if (score >= 90) return "text-green-600";
  if (score >= 80) return "text-yellow-600";
  return "text-red-600";
};

const getProgressColor = (score) => {
  if (score >= 90) return "bg-green-500";
  if (score >= 80) return "bg-yellow-500";
  return "bg-red-500";
};

const getTrendColor = (trend) => {
  return trend && trend.startsWith("+") ? "text-green-600" : "text-red-600";
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
        <div className="text-gray-500">Loading evaluation metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{error}</div>
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
          <h1 className="text-3xl font-bold text-gray-900">Evaluations</h1>
          <p className="mt-1 text-gray-500">Track evaluation metrics and scoring trends</p>
        </div>
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <BarChart3 className="w-4 h-4 mr-2" />
          Export Report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Overall Score</p>
              <p className={`text-3xl font-bold mt-1 ${getScoreColor(avgScore)}`}>{avgScore}%</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Passing</p>
              <p className="text-3xl font-bold mt-1 text-green-600">{evaluations.filter(e => e.score >= 80).length}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Needs Attention</p>
              <p className="text-3xl font-bold mt-1 text-yellow-600">{evaluations.filter(e => e.score < 80).length}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-xl">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Avg Improvement</p>
              <p className="text-3xl font-bold mt-1 text-green-600">+3.2%</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Evaluation Criteria */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Evaluation Criteria</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {evaluations.map((evaluation) => (
              <div key={evaluation.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-base font-medium text-gray-900">{evaluation.name}</h3>
                    <span className={`text-sm font-medium ${getTrendColor(evaluation.trend)}`}>
                      {evaluation.trend}
                    </span>
                  </div>
                  <span className={`text-2xl font-bold ${getScoreColor(evaluation.score)}`}>
                    {evaluation.score}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(evaluation.score)}`}
                    style={{ width: `${evaluation.score}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Failure Mode Analysis */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-fit">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Failure Mode Analysis</h2>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">Last 7 Days</span>
          </div>
          <div className="p-6 space-y-6">
            {failureModes.map((mode) => (
              <div key={mode.id}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center">
                    <AlertTriangle className="w-4 h-4 text-orange-500 mr-2" />
                    <span className="text-sm font-medium text-gray-700">{mode.name}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{mode.count} incidents ({mode.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full"
                    style={{ width: `${mode.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
            
            {failureModes.length === 0 && (
               <div className="text-center py-8 text-gray-500">
                  No failure modes detected in this period.
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
