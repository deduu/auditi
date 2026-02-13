import React from 'react';
import { Check } from 'lucide-react';
import { useTheme, THEMES } from '../../context/ThemeContext';

const THEME_ORDER = ['original', 'neutral-light', 'soft-light', 'monochrome', 'low-contrast', 'gray-based'];

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {THEME_ORDER.map((id) => {
        const t = THEMES[id];
        const isActive = theme === id;

        return (
          <button
            key={id}
            onClick={() => setTheme(id)}
            className={`group relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
              isActive
                ? 'border-blue-500 ring-2 ring-blue-500/20'
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            {isActive && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-fixed-white" />
              </div>
            )}

            {/* Color preview swatches */}
            <div className="flex gap-1.5 mb-3">
              <div
                className="w-8 h-8 rounded-lg border border-slate-700"
                style={{ backgroundColor: t.preview.bg }}
                title="Background"
              />
              <div
                className="w-8 h-8 rounded-lg border border-slate-700"
                style={{ backgroundColor: t.preview.surface }}
                title="Surface"
              />
              <div
                className="w-8 h-8 rounded-lg border border-slate-700"
                style={{ backgroundColor: t.preview.text }}
                title="Text"
              />
              <div
                className="w-8 h-8 rounded-lg border border-slate-700"
                style={{ backgroundColor: t.preview.accent }}
                title="Accent"
              />
            </div>

            <p className="text-sm font-medium text-white truncate">{t.name}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{t.description}</p>
          </button>
        );
      })}
    </div>
  );
}
