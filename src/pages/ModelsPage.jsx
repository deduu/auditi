import React, { useState, useEffect } from "react";
import { Cpu, Zap, Clock, CheckCircle, ArrowUpRight, MoreVertical } from "lucide-react";
import api from "../services/api";

const getStatusStyles = (status) => {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "fallback":
      return "bg-yellow-100 text-yellow-700";
    case "testing":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-gray-100 text-gray-700";
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
         <div className="text-gray-500">Loading models...</div>
       </div>
     );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Models</h1>
          <p className="mt-1 text-gray-500">Monitor and compare AI model performance</p>
        </div>
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Cpu className="w-4 h-4 mr-2" />
          Add Model
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Active Models</p>
              <p className="text-3xl font-bold mt-1 text-gray-900">{stats.activeCount}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Avg Accuracy</p>
              <p className="text-3xl font-bold mt-1 text-blue-600">{stats.avgAccuracy}%</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Avg Latency</p>
              <p className="text-3xl font-bold mt-1 text-purple-600">{stats.avgLatency}s</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Requests</p>
              <p className="text-3xl font-bold mt-1 text-gray-900">{stats.totalRequests}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-xl">
              <ArrowUpRight className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Models Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Configured Models</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requests</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {models.map((model) => (
                <tr key={model.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{model.name}</div>
                      <div className="text-sm text-gray-500">{model.version}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusStyles(model.status)}`}>
                      {model.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">{model.accuracy}%</span>
                      <div className="ml-2 w-16 bg-gray-200 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${model.accuracy}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{model.latency}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{model.cost}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{model.requests}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{model.lastUsed}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
