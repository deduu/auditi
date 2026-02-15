import React, { useState, useEffect } from 'react';
import { Sparkles, MessageSquare, TrendingUp, DollarSign, AlertTriangle, Users, Zap } from 'lucide-react';
import { nlQueryApi } from '@api/nlQuery';

const CATEGORY_ICONS = {
  Traces: MessageSquare,
  Models: Zap,
  Failures: AlertTriangle,
  Costs: DollarSign,
  Latency: TrendingUp,
  Scores: TrendingUp,
  Users: Users,
  Evaluators: Zap,
  Actions: MessageSquare,
};

export function QuerySuggestions({ onSelect }) {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    nlQueryApi.getSuggestions()
      .then((res) => setSuggestions(res.suggestions || []))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
        <Sparkles className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">Ask Auditi</h3>
      <p className="text-sm text-slate-400 mb-6 text-center max-w-xs">
        Ask questions about your traces, evaluations, costs, and more
      </p>

      <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
        {suggestions.map((s, i) => {
          const Icon = CATEGORY_ICONS[s.category] || MessageSquare;
          return (
            <button
              key={i}
              onClick={() => onSelect(s.text)}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-slate-700/50 bg-slate-800/50 hover:bg-slate-700/50 hover:border-slate-600 transition-colors text-left group"
            >
              <Icon className="w-4 h-4 text-slate-500 group-hover:text-blue-400 mt-0.5 shrink-0" />
              <span className="text-sm text-slate-300 group-hover:text-white leading-snug">
                {s.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
