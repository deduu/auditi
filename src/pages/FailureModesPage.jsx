import React, { useState, useEffect } from "react";
import { AlertTriangle, TrendingDown, Filter, Download } from "lucide-react";
import { FailureModeCharts } from "../components/analytics/FailureModeCharts";
import api from "../services/api";

export const FailureModesPage = () => {
  const [stats, setStats] = useState({
    totalFailures: 0,
    failureRate: 0,
    topCategory: "None",
    topCategoryPercentage: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [modes, metrics] = await Promise.all([
          api.getFailureModes(),
          api.getMetrics()
        ]);

        const totalFailures = modes.reduce((acc, mode) => acc + mode.count, 0);
        const topMode = modes.length > 0 ? modes[0] : { name: "None", percentage: 0 };
        const failureRate = 100 - (metrics.passRate || 0);

        setStats({
          totalFailures,
          failureRate,
          topCategory: topMode.name,
          topCategoryPercentage: topMode.percentage
        });
      } catch (error) {
        console.error("Failed to fetch failure stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading failure analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Failure Modes</h1>
          <p className="mt-1 text-gray-500">Analyze patterns and root causes of agent failures</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </button>
          <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Failures</p>
              <p className="text-3xl font-bold mt-1 text-red-600">{stats.totalFailures}</p>
              <p className="text-sm text-gray-500 mt-1">Last 7 days</p>
            </div>
            <div className="p-3 bg-red-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Failure Rate</p>
              <p className="text-3xl font-bold mt-1 text-yellow-600">{stats.failureRate}%</p>
              <p className="text-sm text-green-600 mt-1">↓ 0.8% from last week</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-xl">
              <TrendingDown className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Top Category</p>
              <p className="text-xl font-bold mt-1 text-gray-900">{stats.topCategory}</p>
              <p className="text-sm text-gray-500 mt-1">{stats.topCategoryPercentage}% of all failures</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <FailureModeCharts />
    </div>
  );
};
