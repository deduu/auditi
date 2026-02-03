import React from 'react';
import { Check, X } from 'lucide-react';

/**
 * ScoreInput - Renders appropriate input based on score config type
 * Supports: numerical (slider), categorical (buttons), binary (toggle)
 */
export const ScoreInput = ({ config, value, onChange }) => {
  if (!config) return null;

  switch (config.data_type) {
    case 'numerical':
      return (
        <NumericalInput
          config={config}
          value={value}
          onChange={onChange}
        />
      );
    case 'categorical':
      return (
        <CategoricalInput
          config={config}
          value={value}
          onChange={onChange}
        />
      );
    case 'binary':
      return (
        <BinaryInput
          config={config}
          value={value}
          onChange={onChange}
        />
      );
    default:
      return null;
  }
};

/**
 * Numerical score input with slider
 */
const NumericalInput = ({ config, value, onChange }) => {
  const min = config.min_value ?? 0;
  const max = config.max_value ?? 1;
  const step = max <= 1 ? 0.1 : 1;
  const currentValue = value ?? min;

  const getColorClass = (val) => {
    const normalized = (val - min) / (max - min);
    if (normalized >= 0.7) return 'text-emerald-400';
    if (normalized >= 0.4) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">{config.name}</label>
        <span className={`text-lg font-bold ${getColorClass(currentValue)}`}>
          {currentValue.toFixed(1)}
        </span>
      </div>
      {config.description && (
        <p className="text-xs text-slate-500">{config.description}</p>
      )}
      <div className="flex items-center space-x-3">
        <span className="text-xs text-slate-500">{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:bg-blue-500
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:hover:bg-blue-400
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:bg-blue-500
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:border-0"
        />
        <span className="text-xs text-slate-500">{max}</span>
      </div>
      {/* Quick select buttons */}
      <div className="flex items-center space-x-2">
        {[0, 0.25, 0.5, 0.75, 1].map((preset) => {
          const presetValue = min + preset * (max - min);
          return (
            <button
              key={preset}
              onClick={() => onChange(presetValue)}
              className={`flex-1 py-1 text-xs rounded transition-all ${Math.abs(currentValue - presetValue) < 0.01
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
            >
              {presetValue.toFixed(1)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Categorical score input with button options
 */
const CategoricalInput = ({ config, value, onChange }) => {
  const categories = config.categories || [];

  const getCategoryColor = (index, total) => {
    const ratio = index / (total - 1 || 1);
    if (ratio >= 0.7) return 'emerald';
    if (ratio >= 0.4) return 'amber';
    return 'rose';
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-slate-300">{config.name}</label>
      {config.description && (
        <p className="text-xs text-slate-500">{config.description}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat, index) => {
          const isSelected = value === cat.value;
          const color = getCategoryColor(index, categories.length);

          return (
            <button
              key={cat.value}
              onClick={() => onChange(cat.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isSelected
                  ? color === 'emerald'
                    ? 'bg-emerald-500 text-white'
                    : color === 'amber'
                      ? 'bg-amber-500 text-white'
                      : 'bg-rose-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
            >
              {cat.label}
              <span className="ml-2 text-xs opacity-70">({cat.value})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Binary score input with toggle buttons
 */
const BinaryInput = ({ config, value, onChange }) => {
  const labels = config.binary_labels || { true_label: 'Pass', false_label: 'Fail' };

  // Explicitly check for selected state (value can be null, 0, or 1)
  const isFailSelected = value === 0;
  const isPassSelected = value === 1;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-slate-300">{config.name}</label>
      {config.description && (
        <p className="text-xs text-slate-500">{config.description}</p>
      )}
      <div className="flex items-center space-x-3">
        {/* Fail Button */}
        <button
          onClick={() => onChange(0)}
          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${isFailSelected
              ? 'bg-rose-500 text-white ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-900 scale-[1.02] shadow-lg shadow-rose-500/30'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
        >
          <X className="w-4 h-4" />
          <span>{labels.false_label}</span>
        </button>

        {/* Pass Button */}
        <button
          onClick={() => onChange(1)}
          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${isPassSelected
              ? 'bg-emerald-500 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 scale-[1.02] shadow-lg shadow-emerald-500/30'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
        >
          <Check className="w-4 h-4" />
          <span>{labels.true_label}</span>
        </button>
      </div>

      {/* Selection indicator */}
      {value !== null && (
        <div className={`text-xs text-center py-1 rounded ${isPassSelected
            ? 'text-emerald-400 bg-emerald-500/10'
            : 'text-rose-400 bg-rose-500/10'
          }`}>
          Selected: {isPassSelected ? labels.true_label : labels.false_label}
        </div>
      )}
    </div>
  );
};

export default ScoreInput;
