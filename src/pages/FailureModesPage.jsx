import React, { useState, useEffect } from "react";
import { AlertTriangle, TrendingDown, Filter, Download, X, Calendar } from "lucide-react";
import { FailureModeCharts } from "../components/analytics/FailureModeCharts";
import api from "../services/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { exportToCSV } from "../utils/exportUtils";

export const FailureModesPage = () => {
  const [stats, setStats] = useState({
    totalFailures: 0,
    failureRate: 0,
    topCategory: "None",
    topCategoryPercentage: 0
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");
  const [showFilter, setShowFilter] = useState(false);
  const [rawModes, setRawModes] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [modes, metrics] = await Promise.all([
          api.getFailureModes(timeRange),
          api.getMetrics(timeRange)
        ]);

        setRawModes(modes);
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
  }, [timeRange]);

  const handleExport = () => {
    exportToCSV(rawModes, "failure_modes_export");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading failure analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Failure Modes</h1>
          <p className="mt-1 text-slate-400">Analyze patterns and root causes of agent failures</p>
        </div>
        <div className="flex items-center space-x-3 relative">
          <Button 
            variant="secondary" 
            className={`bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 ${showFilter ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setShowFilter(!showFilter)}
          >
            <Filter className="w-4 h-4 mr-2" />
            {timeRange === '24h' ? 'Last 24h' : timeRange === '7d' ? 'Last 7d' : 'Last 30d'}
          </Button>

          {showFilter && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-1">
                {[
                  { id: '24h', label: 'Last 24 Hours' },
                  { id: '7d', label: 'Last 7 Days' },
                  { id: '30d', label: 'Last 30 Days' },
                ].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => {
                      setTimeRange(range.id);
                      setShowFilter(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                      timeRange === range.id 
                        ? 'bg-blue-600/10 text-blue-400' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button variant="primary" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Total Failures</p>
              <p className="text-3xl font-bold mt-1 text-rose-500">{stats.totalFailures}</p>
              <p className="text-sm text-slate-500 mt-1">Last 7 days</p>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>
          </div>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Failure Rate</p>
              <p className="text-3xl font-bold mt-1 text-amber-500">{stats.failureRate}%</p>
              <p className="text-sm text-emerald-400 mt-1">↓ 0.8% from last week</p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <TrendingDown className="w-6 h-6 text-amber-500" />
            </div>
          </div>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Top Category</p>
              <p className="text-xl font-bold mt-1 text-white">{stats.topCategory}</p>
              <p className="text-sm text-slate-500 mt-1">{stats.topCategoryPercentage}% of all failures</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <FailureModeCharts />
    </div>
  );
};
