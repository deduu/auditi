import React from 'react';
import { Search, X } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

/**
 * Filter bar for annotation queues
 *
 * @param {Object} props
 * @param {Object} props.filters - Current filter values
 * @param {Function} props.onFiltersChange - (newFilters) => void
 * @param {Array} props.scoreConfigs - Available score configs for dropdown
 */
export const QueueFilterBar = ({
  filters = {},
  onFiltersChange,
  scoreConfigs = [],
}) => {
  const handleFilterChange = (key, value) => {
    onFiltersChange?.({
      ...filters,
      [key]: value,
    });
  };

  const clearFilters = () => {
    onFiltersChange?.({
      status: 'all',
      scoreConfigId: 'all',
      progress: 'all',
      dateRange: 'all',
      search: '',
    });
  };

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.scoreConfigId !== 'all' ||
    filters.progress !== 'all' ||
    filters.dateRange !== 'all' ||
    filters.search;

  return (
    <Card className="p-4 bg-slate-900/50 border-slate-800 animate-in slide-in-from-top-2">
      <div className="grid grid-cols-5 gap-4">
        {/* Status Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Status
          </label>
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
            value={filters.status || 'all'}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="empty">Empty</option>
          </select>
        </div>

        {/* Score Config Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Score Config
          </label>
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
            value={filters.scoreConfigId || 'all'}
            onChange={(e) => handleFilterChange('scoreConfigId', e.target.value)}
          >
            <option value="all">All Configs</option>
            {scoreConfigs.map((config) => (
              <option key={config.id} value={config.id}>
                {config.name}
              </option>
            ))}
          </select>
        </div>

        {/* Progress Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Progress
          </label>
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
            value={filters.progress || 'all'}
            onChange={(e) => handleFilterChange('progress', e.target.value)}
          >
            <option value="all">Any Progress</option>
            <option value="not_started">Not Started (0%)</option>
            <option value="in_progress">In Progress (1-99%)</option>
            <option value="completed">Completed (100%)</option>
          </select>
        </div>

        {/* Date Range Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Created
          </label>
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
            value={filters.dateRange || 'all'}
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        {/* Search + Clear */}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search queues..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {filters.search && (
              <button
                onClick={() => handleFilterChange('search', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 hover:text-white shrink-0"
              onClick={clearFilters}
            >
              Clear
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default QueueFilterBar;
