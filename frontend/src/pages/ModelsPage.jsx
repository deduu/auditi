import React, { useState, useEffect } from "react";
import { Cpu, Zap, Clock, CheckCircle, ArrowUpRight, MoreVertical } from "lucide-react";
import api from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

const getStatusBadge = (status) => {
  switch (status) {
    case "active":
      return <Badge variant="success">active</Badge>;
    case "fallback":
      return <Badge variant="warning">fallback</Badge>;
    case "testing":
      return <Badge variant="info">testing</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
};

export const ModelsPage = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeCount: 0,
    avgAccuracy: 0,
    avgLatency: 0,
    totalRequests: "0K"
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getModels();
        setModels(data);

        // Calculate Stats
        const activeCount = data.filter(m => m.status === "active").length;

        const avgAcc = data.reduce((acc, m) => acc + m.accuracy, 0) / (data.length || 1);

        const avgLat = data.reduce((acc, m) => acc + parseFloat(m.latency.replace('s', '')), 0) / (data.length || 1);

        const totalReqs = data.reduce((acc, m) => {
          let val = parseFloat(m.requests.replace('K', ''));
          return acc + val;
        }, 0);

        setStats({
          activeCount,
          avgAccuracy: Math.round(avgAcc),
          avgLatency: avgLat.toFixed(1),
          totalRequests: `${Math.round(totalReqs)}K`
        });

      } catch (error) {
        console.error("Failed to fetch models:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading models...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Models</h1>
          <p className="mt-1 text-slate-400">Monitor and compare AI model performance</p>
        </div>
        <Button variant="primary">
          <Cpu className="w-4 h-4 mr-2" />
          Add Model
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Active Models</p>
              <p className="text-3xl font-bold mt-1 text-white">{stats.activeCount}</p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Avg Accuracy</p>
              <p className="text-3xl font-bold mt-1 text-blue-400">{stats.avgAccuracy}%</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Avg Latency</p>
              <p className="text-3xl font-bold mt-1 text-purple-400">{stats.avgLatency}s</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <Clock className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Total Requests</p>
              <p className="text-3xl font-bold mt-1 text-white">{stats.totalRequests}</p>
            </div>
            <div className="p-3 bg-slate-700/50 rounded-xl">
              <ArrowUpRight className="w-6 h-6 text-slate-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Models Table */}
      <Card className="bg-slate-900/50 border-slate-800 p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-semibold text-white">Configured Models</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-900/50 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Model</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Accuracy</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Latency</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Requests</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Used</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="bg-transparent divide-y divide-slate-800">
              {models.map((model) => (
                <tr key={model.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-white">{model.name}</div>
                      <div className="text-sm text-slate-500">{model.version}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(model.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-white">{model.accuracy}%</span>
                      <div className="ml-2 w-16 bg-slate-700 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${model.accuracy}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{model.latency}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{model.cost}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{model.requests}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{model.lastUsed}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="text-slate-500 hover:text-white transition-colors">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
