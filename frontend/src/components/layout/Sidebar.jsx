import React from 'react';
import {
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Zap,
  FileText,
  Settings,
  LayoutDashboard
} from 'lucide-react';

export const Sidebar = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'conversations', label: 'Conversations', icon: MessageSquare },
    { id: 'evaluations', label: 'Evaluations', icon: CheckCircle },
    { id: 'failure-modes', label: 'Failure Modes', icon: AlertTriangle },
    { id: 'models', label: 'Models', icon: Zap },
    { id: 'actions', label: 'Recommended Actions', icon: FileText },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-50">
      <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
          Auditi
        </h1>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Monitoring
        </div>

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group ${isActive
                ? 'bg-blue-600/10 text-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <Icon className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-white'
                }`} />
              {tab.label}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
              )}
            </button>
          );
        })}

        <div className="mt-8 px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          System
        </div>
        <button
          onClick={() => onTabChange('settings')}
          className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group ${activeTab === 'settings'
            ? 'bg-blue-600/10 text-blue-400'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
        >
          <Settings className={`w-5 h-5 mr-3 transition-colors ${activeTab === 'settings' ? 'text-blue-400' : 'text-slate-500 group-hover:text-white'
            }`} />
          Settings
        </button>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-slate-800/50">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              Admin User
            </p>
            <p className="text-xs text-slate-500 truncate">
              admin@auditi.ai
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
