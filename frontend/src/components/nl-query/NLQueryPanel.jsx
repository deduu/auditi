import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Send, Sparkles, Loader2, Maximize2, Minimize2, History } from 'lucide-react';
import { useNLQuery } from '@hooks/useNLQuery';
import { QueryMessage } from './QueryMessage';
import { QuerySuggestions } from './QuerySuggestions';
import { ChatHistory } from './ChatHistory';

const MIN_WIDTH = 380;
const DEFAULT_WIDTH = 480;
const MAX_WIDTH_RATIO = 0.8;

export function NLQueryPanel({ isOpen, onClose }) {
  const [input, setInput] = useState('');
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const {
    messages, isLoading, sessionId, tokenUsage,
    sendQuery, regenerate, setActiveVersion,
    resetSession, loadSession, deleteSession, savedSessions,
  } = useNLQuery();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isDraggingRef = useRef(false);
  const panelRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Drag-to-resize handler
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startX = e.clientX;
    const startWidth = isMaximized ? window.innerWidth : panelWidth;

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startX - moveEvent.clientX;
      const maxWidth = window.innerWidth * MAX_WIDTH_RATIO;
      const newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + delta));
      if (isMaximized) setIsMaximized(false);
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth, isMaximized]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || isLoading) return;
    setInput('');
    setShowHistory(false);
    sendQuery(q);
  };

  const handleSuggestionClick = (text) => {
    setShowHistory(false);
    sendQuery(text);
  };

  const handleReset = () => {
    resetSession();
    setInput('');
    setShowHistory(false);
  };

  const handleToggleMaximize = () => {
    setIsMaximized((prev) => !prev);
  };

  const handleSelectHistory = (session) => {
    loadSession(session);
    setShowHistory(false);
  };

  if (!isOpen) return null;

  const computedWidth = isMaximized ? '100vw' : `${panelWidth}px`;

  const panel = (
    <div className="fixed inset-y-0 right-0 z-[60] flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 pointer-events-none" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative ml-auto max-w-full bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl animate-slide-in-right"
        style={{ width: computedWidth }}
      >
        {/* Drag handle */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors z-10"
          title="Drag to resize"
        />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-sm font-semibold text-white">Ask Auditi</h2>
            {tokenUsage > 0 && (
              <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
                {tokenUsage.toLocaleString()} tokens
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory((v) => !v)}
              title="Chat history"
              className={`p-1.5 rounded-lg transition-colors ${showHistory ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              title="New conversation"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleToggleMaximize}
              title={isMaximized ? 'Restore size' : 'Maximize'}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
          {showHistory ? (
            <ChatHistory
              sessions={savedSessions}
              currentSessionId={sessionId}
              onSelect={handleSelectHistory}
              onNewChat={handleReset}
              onDelete={deleteSession}
            />
          ) : messages.length === 0 && !isLoading ? (
            <QuerySuggestions onSelect={handleSuggestionClick} />
          ) : (
            <>
              {messages.map((msg, i) => (
                <QueryMessage
                  key={i}
                  message={msg}
                  index={i}
                  onRegenerate={regenerate}
                  onVersionChange={setActiveVersion}
                  isLoading={isLoading}
                />
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-slate-800 text-slate-400 text-sm flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing your data...
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="px-4 py-3 border-t border-slate-800">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your traces, scores, costs..."
              disabled={isLoading}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
