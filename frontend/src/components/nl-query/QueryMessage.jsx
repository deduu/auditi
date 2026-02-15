import React from 'react';
import Markdown from 'react-markdown';
import { User, Sparkles, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { QueryDataRenderer } from './QueryDataRenderer';

function AssistantContent({ content }) {
  return (
    <Markdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 last:mb-0 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="text-slate-200">{children}</li>,
        code: ({ inline, children }) =>
          inline !== false && !String(children).includes('\n')
            ? <code className="px-1 py-0.5 bg-slate-700 rounded text-xs text-blue-300 font-mono">{children}</code>
            : <pre className="bg-slate-900 rounded-lg p-2 my-2 overflow-x-auto"><code className="text-xs text-slate-300 font-mono">{children}</code></pre>,
        h1: ({ children }) => <h3 className="text-sm font-semibold text-white mb-1">{children}</h3>,
        h2: ({ children }) => <h3 className="text-sm font-semibold text-white mb-1">{children}</h3>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-white mb-1">{children}</h3>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{children}</a>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-600 pl-3 text-slate-400 italic my-2">{children}</blockquote>,
        table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs w-full">{children}</table></div>,
        th: ({ children }) => <th className="text-left px-2 py-1 border-b border-slate-700 text-slate-400 font-medium">{children}</th>,
        td: ({ children }) => <td className="px-2 py-1 border-b border-slate-800/50 text-slate-300">{children}</td>,
      }}
    >
      {content}
    </Markdown>
  );
}

function VersionNav({ versions, activeVersion, onPrev, onNext, onRegenerate, isLoading }) {
  const total = versions.length;
  const hasPrev = activeVersion > 0;
  const hasNext = activeVersion < total - 1;

  return (
    <div className="flex items-center gap-1 mt-1">
      {/* Version navigation — only show arrows when there are multiple versions */}
      {total > 1 && (
        <div className="flex items-center gap-0.5 mr-1">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="p-0.5 text-slate-500 hover:text-slate-300 disabled:text-slate-700 disabled:cursor-default transition-colors rounded"
            title="Previous version"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-slate-500 tabular-nums min-w-[2.5rem] text-center">
            {activeVersion + 1} / {total}
          </span>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="p-0.5 text-slate-500 hover:text-slate-300 disabled:text-slate-700 disabled:cursor-default transition-colors rounded"
            title="Next version"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* Regenerate button */}
      <button
        onClick={onRegenerate}
        disabled={isLoading}
        className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-slate-300 disabled:text-slate-700 disabled:cursor-default transition-colors rounded hover:bg-slate-800"
        title="Regenerate response"
      >
        <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        Regenerate
      </button>
    </div>
  );
}

export function QueryMessage({ message, index, onRegenerate, onVersionChange, isLoading }) {
  const isUser = message.role === 'user';

  // For assistant messages, get the active version's content
  const activeVersion = isUser ? null : (message.activeVersion ?? 0);
  const versions = isUser ? null : (message.versions || [{ content: message.content, data: message.data, visualization: message.visualization }]);
  const current = isUser ? null : versions[activeVersion] || versions[0];

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
          {current?.isError ? (
            <AlertCircle className="w-4 h-4 text-white" />
          ) : (
            <Sparkles className="w-4 h-4 text-white" />
          )}
        </div>
      )}

      <div className={`max-w-[85%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-md whitespace-pre-wrap'
              : current?.isError
              ? 'bg-red-900/30 border border-red-800/50 text-red-300 rounded-tl-md whitespace-pre-wrap'
              : 'bg-slate-800 text-slate-200 rounded-tl-md'
          }`}
        >
          {isUser ? message.content : (
            current?.isError
              ? current.content
              : <AssistantContent content={current?.content || ''} />
          )}
        </div>

        {/* Data visualization */}
        {!isUser && current?.data && current.data.length > 0 && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
            <QueryDataRenderer data={current.data} visualization={current.visualization} />
          </div>
        )}

        {/* Version navigation + regenerate */}
        {!isUser && onRegenerate && (
          <VersionNav
            versions={versions}
            activeVersion={activeVersion}
            onPrev={() => onVersionChange(index, activeVersion - 1)}
            onNext={() => onVersionChange(index, activeVersion + 1)}
            onRegenerate={() => onRegenerate(index)}
            isLoading={isLoading}
          />
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-slate-300" />
        </div>
      )}
    </div>
  );
}
