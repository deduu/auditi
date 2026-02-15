/*
 * Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  FileText,
  AlertTriangle,
  Zap,
  LayoutDashboard,
  CheckCircle,
  Database,
  PanelLeft,
  Settings,
  LogOut,
  User,
  Gavel,
  UserCheck,
  BarChart2,
  TrendingUp,
  Wrench,
  Sparkles
} from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ activeTab, onTabChange, onToggleNLQuery }) => {
  const { isCollapsed, toggleSidebar, sidebarWidth } = useSidebar();
  const { user, logout } = useAuth();
  const [logoHovered, setLogoHovered] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  /* Navigation Configuration */
  const navSections = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      items: [
        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
      ]
    },
    {
      id: 'monitoring',
      label: 'Monitoring',
      items: [
        { id: 'conversations', label: 'Conversations', icon: MessageSquare },
        { id: 'traces', label: 'Traces', icon: FileText },
      ]
    },
    {
      id: 'evaluation',
      label: 'Evaluation',
      items: [
        { id: 'scores', label: 'Scores', icon: BarChart2 },
        { id: 'llm-judge', label: 'LLM-as-a-Judge', icon: Gavel },
        { id: 'human-annotation', label: 'Human Annotation', icon: UserCheck },
        { id: 'datasets', label: 'Datasets', icon: Database },
      ]
    },
    {
      id: 'analytics',
      label: 'Analytics',
      items: [
        { id: 'trends', label: 'Trends', icon: TrendingUp },
        { id: 'models', label: 'Models', icon: Zap },
        { id: 'tool-calls', label: 'Tool Calls', icon: Wrench },
        { id: 'failure-modes', label: 'Failure Modes', icon: AlertTriangle },
        { id: 'actions', label: 'Recommendations', icon: LayoutDashboard },
      ]
    }
  ];

  const handleSettingsClick = () => {
    onTabChange('settings');
    setShowUserMenu(false);
  };

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-50 transition-all duration-300"
    >
      {/* Header with logo and toggle button */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Logo area - when collapsed, hovering shows toggle button overlay */}
          <div
            className="relative"
            onMouseEnter={() => setLogoHovered(true)}
            onMouseLeave={() => setLogoHovered(false)}
          >
            {/* Logo */}
            <div className={`w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0 transition-opacity duration-200 ${isCollapsed && logoHovered ? 'opacity-0' : 'opacity-100'}`}>
              <Zap className="w-5 h-5 text-fixed-white" />
            </div>

            {/* Toggle button overlay - appears on hover when collapsed */}
            {isCollapsed && (
              <button
                onClick={toggleSidebar}
                className={`absolute inset-0 w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg transition-all duration-200 ${logoHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                title="Expand sidebar"
              >
                <PanelLeft className="w-5 h-5 text-white" />
              </button>
            )}
          </div>

          {!isCollapsed && (
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-50 to-slate-400 whitespace-nowrap">
              Auditi
            </h1>
          )}
        </div>

        {/* Toggle sidebar button - only visible when expanded */}
        {!isCollapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            title="Collapse sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-4 overflow-y-auto custom-scrollbar">
        {navSections.map((section) => (
          <div key={section.id}>
            {!isCollapsed && (
              <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {section.label}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group ${isActive
                      ? 'bg-blue-600/10 text-blue-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                  >
                    <Icon className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'} transition-colors shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-white'
                      }`} />
                    {!isCollapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Ask Auditi button */}
      <div className="px-3 py-2">
        <button
          onClick={onToggleNLQuery}
          title={isCollapsed ? 'Ask Auditi' : undefined}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/20 hover:from-blue-600/30 hover:to-indigo-600/30 hover:border-blue-500/30 transition-all duration-200 group`}
        >
          <Sparkles className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'} text-blue-400 group-hover:text-blue-300 shrink-0`} />
          {!isCollapsed && (
            <span className="text-sm font-medium text-blue-300 group-hover:text-blue-200">Ask Auditi</span>
          )}
        </button>
      </div>

      {/* User profile section with dropdown */}
      <div className="p-4 border-t border-slate-800 relative" ref={userMenuRef}>
        {showUserMenu && (
          <div className={`absolute bottom-full left-0 mb-2 w-64 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden transform transition-all duration-200 origin-bottom-left ${isCollapsed ? 'left-4' : 'left-4'}`}>
            <div className="py-1">
              <button
                className="w-full px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center"
                onClick={() => setShowUserMenu(false)}
              >
                <User className="w-4 h-4 mr-3" />
                Personalization
              </button>
              <button
                className="w-full px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center"
                onClick={handleSettingsClick}
              >
                <Settings className="w-4 h-4 mr-3" />
                Settings
              </button>
              <div className="border-t border-slate-700 my-1"></div>
              <button
                className="w-full px-4 py-2 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 flex items-center"
                onClick={() => { setShowUserMenu(false); logout(); }}
              >
                <LogOut className="w-4 h-4 mr-3" />
                Log out
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3 px-3'} py-2 rounded-lg hover:bg-slate-800/50 transition-colors focus:outline-none`}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-fixed-white shrink-0 shadow-lg shadow-purple-500/20">
            {userInitials}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-white truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {user?.email || ''}
              </p>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};

