import React from 'react';
import { MessageSquareText, Trash2, Plus, Clock } from 'lucide-react';

function formatRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

export function ChatHistory({ sessions, currentSessionId, onSelect, onNewChat, onDelete }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Chat History</h3>
        <button
          onClick={onNewChat}
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New chat
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No conversations yet</p>
          <p className="text-xs text-slate-600 mt-1">Your chat history will appear here</p>
        </div>
      ) : (
        <div className="space-y-1">
          {sessions.map((session) => {
            const isCurrent = session.id === currentSessionId;
            const msgCount = session.messages?.filter((m) => m.role === 'user').length || 0;

            return (
              <div
                key={session.id}
                className={`group flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  isCurrent
                    ? 'bg-blue-500/10 border border-blue-500/20'
                    : 'hover:bg-slate-800/50 border border-transparent'
                }`}
                onClick={() => onSelect(session)}
              >
                <MessageSquareText className={`w-4 h-4 mt-0.5 shrink-0 ${isCurrent ? 'text-blue-400' : 'text-slate-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${isCurrent ? 'text-blue-300' : 'text-slate-300'}`}>
                    {session.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500">
                      {msgCount} {msgCount === 1 ? 'message' : 'messages'}
                    </span>
                    <span className="text-[10px] text-slate-600">·</span>
                    <span className="text-[10px] text-slate-500">
                      {formatRelativeTime(session.updatedAt)}
                    </span>
                    {session.tokenUsage > 0 && (
                      <>
                        <span className="text-[10px] text-slate-600">·</span>
                        <span className="text-[10px] text-slate-500">
                          {session.tokenUsage.toLocaleString()} tokens
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(session.id);
                    }}
                    className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
