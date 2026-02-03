import React from 'react';
import {
  ListTodo,
  Play,
  Clock,
  BarChart3,
  CheckCircle2,
  Eye,
  Plus,
  Download,
  Trash2,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { DropdownMenu } from '../ui/DropdownMenu';

/**
 * Queue Card component with improved layout and action hierarchy
 *
 * @param {Object} props
 * @param {Object} props.queue - Queue data object
 * @param {Array} props.scoreConfigs - Score configs for displaying tags
 * @param {boolean} props.isSelected - Checkbox selection state
 * @param {Function} props.onToggleSelect - (queueId) => void
 * @param {Function} props.onStart - (queue) => void
 * @param {Function} props.onView - (queue) => void
 * @param {Function} props.onAddTraces - (queue) => void
 * @param {Function} props.onDelete - (queue) => void
 * @param {Function} props.onExport - (queue) => void
 */
export const QueueCard = ({
  queue,
  scoreConfigs = [],
  isSelected = false,
  onToggleSelect,
  onStart,
  onView,
  onAddTraces,
  onDelete,
  onExport,
}) => {
  const totalPending = (queue.pending_items || 0) + (queue.in_progress_items || 0);
  const isEmpty = queue.total_items === 0;
  const hasCompleted = (queue.completed_items || 0) > 0;
  const isComplete = queue.progress_percentage >= 100 && !isEmpty;

  // Dropdown menu items
  const moreMenuItems = [
    {
      label: 'Add Traces',
      icon: Plus,
      onClick: () => onAddTraces?.(queue),
    },
    {
      label: 'Export',
      icon: Download,
      onClick: () => onExport?.(queue),
      disabled: !hasCompleted,
    },
    { divider: true },
    {
      label: 'Delete Queue',
      icon: Trash2,
      onClick: () => onDelete?.(queue),
      variant: 'danger',
    },
  ];

  return (
    <Card hover className="p-4">
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <div className="pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect?.(queue.id)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500/50 focus:ring-offset-0 cursor-pointer"
          />
        </div>

        {/* Icon */}
        <div className="p-2 bg-purple-500/10 rounded-lg shrink-0">
          <ListTodo className="w-5 h-5 text-purple-400" />
        </div>

        {/* Queue Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-white">{queue.name}</h4>
              {queue.description && (
                <p className="text-sm text-slate-400 mt-0.5">{queue.description}</p>
              )}
            </div>
          </div>

          {/* Score Config Tags */}
          {queue.score_config_ids?.length > 0 && (
            <div className="mt-2 flex items-center flex-wrap gap-1.5">
              <span className="text-xs text-slate-500">Scoring:</span>
              {queue.score_config_ids.map((configId) => {
                const config = scoreConfigs.find((c) => c.id === configId);
                return config ? (
                  <span
                    key={configId}
                    className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded"
                  >
                    {config.name}
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Stats Section */}
        <div className="flex items-center gap-6 shrink-0">
          {/* Progress Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-slate-400" title="Pending">
              <Clock className="w-4 h-4" />
              <span>{queue.pending_items || 0}</span>
            </div>
            <div className="flex items-center gap-1 text-amber-400" title="In Progress">
              <BarChart3 className="w-4 h-4" />
              <span>{queue.in_progress_items || 0}</span>
            </div>
            <div className="flex items-center gap-1 text-emerald-400" title="Completed">
              <CheckCircle2 className="w-4 h-4" />
              <span>{queue.completed_items || 0}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-24">
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${queue.progress_percentage || 0}%` }}
              />
            </div>
            <div className="text-xs text-slate-500 mt-1 text-center">
              {Math.round(queue.progress_percentage || 0)}%
            </div>
          </div>

          {/* Actions - Visual Hierarchy: View (secondary) | Start (primary) | More */}
          <div className="flex items-center gap-3">
            {/* Secondary: View button - show when there are completed items */}
            {hasCompleted && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onView?.(queue)}
                className="hover:shadow-[0_0_10px_rgba(59,130,246,0.3)] hover:border-blue-400/50 transition-all duration-200 active:scale-95"
              >
                <Eye className="w-4 h-4 mr-2" />
                View ({queue.completed_items})
              </Button>
            )}

            {/* Primary: Start button - show when there are pending items */}
            {totalPending > 0 && (
              <Button
                size="sm"
                onClick={() => onStart?.(queue)}
                className="bg-blue-500 hover:bg-blue-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 shadow-lg shadow-blue-500/20"
              >
                <Play className="w-4 h-4 mr-2 fill-current" />
                Start Labeling
              </Button>
            )}

            {/* If queue is empty, show Add Traces as primary */}
            {isEmpty && (
              <Button
                size="sm"
                onClick={() => onAddTraces?.(queue)}
                className="hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Traces
              </Button>
            )}

            {/* More dropdown menu */}
            <DropdownMenu items={moreMenuItems} align="right" />
          </div>
        </div>
      </div>

      {/* Empty state hint */}
      {isEmpty && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-sm text-amber-400">
            <span className="font-medium">No traces in queue.</span> Click "Add Traces" to select traces for annotation.
          </p>
        </div>
      )}
    </Card>
  );
};

export default QueueCard;
