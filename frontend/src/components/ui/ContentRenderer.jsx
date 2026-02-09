import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

const ContentRenderer = ({ content, type = 'auto', className = '' }) => {
    const processedContent = useMemo(() => {
        if (content === null || content === undefined) return '';

        // If it's an object, it's definitely JSON
        if (typeof content === 'object') {
            return {
                text: JSON.stringify(content, null, 2),
                detectedType: 'json'
            };
        }

        const stringContent = String(content);

        if (type === 'json') {
            return {
                text: stringContent,
                detectedType: 'json'
            };
        }

        if (type === 'markdown') {
            return {
                text: stringContent,
                detectedType: 'markdown'
            };
        }

        if (type === 'auto') {
            // Try to detect JSON
            const trimmed = stringContent.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                try {
                    const parsed = JSON.parse(trimmed);
                    return {
                        text: JSON.stringify(parsed, null, 2),
                        detectedType: 'json'
                    };
                } catch (e) {
                    // 2. Strict parse failed. Content might be a Python repr() with
                    // single quotes or Python booleans. Try safe conversion to JSON.
                    try {
                        let jsonFriendly = trimmed
                            .replace(/\bNone\b/g, 'null')
                            .replace(/\bTrue\b/g, 'true')
                            .replace(/\bFalse\b/g, 'false')
                            .replace(/'/g, '"');

                        const looseParsed = JSON.parse(jsonFriendly);
                        return {
                            text: JSON.stringify(looseParsed, null, 2),
                            detectedType: 'json'
                        };
                    } catch (err) {
                        // Not valid JSON even after conversion; fall through to markdown
                    }
                }
            }

            return {
                text: stringContent,
                detectedType: 'markdown'
            };
        }

        return {
            text: stringContent,
            detectedType: 'text'
        };
    }, [content, type]);

    if (!content) return null;

    if (processedContent.detectedType === 'json') {
        return (
            <div className={`rounded-lg overflow-hidden border border-slate-700/50 text-sm ${className}`}>
                <SyntaxHighlighter
                    language="json"
                    style={vscDarkPlus}
                    customStyle={{
                        margin: 0,
                        padding: '1rem',
                        background: 'rgba(2, 6, 23, 0.5)',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        overflowWrap: 'anywhere'
                    }}
                    codeTagProps={{
                        style: {
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere'
                        }
                    }}
                    wrapLongLines={true}
                >
                    {processedContent.text}
                </SyntaxHighlighter>
            </div>
        );
    }

    // Markdown renderer
    // Preprocess content to ensure newlines are respected (replace single \n with <space><space>\n for hard breaks)
    const markdownContent = processedContent.text.replace(/\n/g, '  \n');

    return (
        <div className={`max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    p({ children }) {
                        return <p className="text-sm text-slate-300 whitespace-pre-wrap break-words leading-relaxed mb-3">{children}</p>;
                    },
                    code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                            <div className="rounded-md overflow-hidden border border-slate-700/50 my-2">
                                <div className="bg-slate-800/50 px-3 py-1 text-xs text-slate-400 border-b border-slate-700/50 flex justify-between">
                                    <span>{match[1]}</span>
                                </div>
                                <SyntaxHighlighter
                                    language={match[1]}
                                    style={vscDarkPlus}
                                    customStyle={{
                                        margin: 0,
                                        padding: '1rem',
                                        background: 'rgba(2, 6, 23, 0.5)',
                                        fontSize: '0.875rem',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-all',
                                        overflowWrap: 'anywhere'
                                    }}
                                    codeTagProps={{
                                        style: {
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all',
                                            overflowWrap: 'anywhere'
                                        }
                                    }}
                                    wrapLongLines={true}
                                    PreTag="div"
                                    {...props}
                                >
                                    {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                            </div>
                        ) : (
                            <code className="bg-slate-800/50 text-slate-200 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-700/50" {...props}>
                                {children}
                            </code>
                        );
                    },
                    // Custom styling for other elements if needed
                    table({ children }) {
                        return <div className="overflow-x-auto my-4 border border-slate-700 rounded-lg"><table className="min-w-full divide-y divide-slate-700 bg-slate-900/50 text-slate-300">{children}</table></div>
                    },
                    thead({ children }) {
                        return <thead className="bg-slate-800 text-slate-200">{children}</thead>
                    },
                    th({ children }) {
                        return <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">{children}</th>
                    },
                    td({ children }) {
                        return <td className="px-4 py-3 whitespace-nowrap text-sm border-t border-slate-800">{children}</td>
                    },
                    a({ children, href }) {
                        return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline">{children}</a>
                    },
                    blockquote({ children }) {
                        return <blockquote className="border-l-4 border-slate-600 pl-4 py-1 my-4 text-slate-400 italic bg-slate-900/30 rounded-r">{children}</blockquote>
                    },
                    h1: ({ children }) => <h1 className="text-xl font-bold text-slate-100 mt-5 mb-3">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg font-bold text-slate-100 mt-4 mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-base font-semibold text-slate-200 mt-4 mb-2">{children}</h3>,
                    h4: ({ children }) => <h4 className="text-sm font-semibold text-slate-200 mt-3 mb-1">{children}</h4>,
                    ol: ({ children }) => <ol className="list-decimal list-outside pl-5 space-y-2 mb-3 text-sm text-slate-300">{children}</ol>,
                    ul: ({ children }) => <ul className="list-disc list-outside pl-5 space-y-1 mb-3 text-sm text-slate-300">{children}</ul>,
                    li: ({ children }) => <li className="text-sm text-slate-300 leading-relaxed [&>p]:inline [&>p]:mb-0">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
                    em: ({ children }) => <em className="italic text-slate-400">{children}</em>,
                    hr: () => <hr className="border-slate-700 my-4" />,
                }}
            >
                {processedContent.text}
            </ReactMarkdown>
        </div>
    );
};

export default ContentRenderer;
