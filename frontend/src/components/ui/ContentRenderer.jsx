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
                    // 2. Strict parse failed. Content might be a Python repr() or JS object literals (single quotes).
                    // We'll try to convert common Python values to JS and then safe-eval.
                    try {
                        // Safety check: Don't eval if it looks like code execution or too long
                        if (trimmed.includes('function') || trimmed.includes('=>') || trimmed.includes('import ') || trimmed.length > 50000) {
                            throw new Error("Unsafe content");
                        }

                        // Replace Python/None booleans with JS equivalents
                        // We use a regex that matches whole words to avoid replacing inside strings roughly
                        let jsFriendly = trimmed
                            .replace(/\bNone\b/g, 'null')
                            .replace(/\bTrue\b/g, 'true')
                            .replace(/\bFalse\b/g, 'false');

                        // Use Function constructor to parse valid JS object literals (which cover strict JSON + single quotes)
                        // This is safer than eval but still allows executing expressions, hence the simple safety check above.
                        const looseParsed = new Function('return ' + jsFriendly)();
                        return {
                            text: JSON.stringify(looseParsed, null, 2),
                            detectedType: 'json'
                        };
                    } catch (err) {
                        // console.warn("Auto-detect failed:", err);
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
        <div className={`prose prose-invert max-w-none prose-pre:p-0 prose-pre:bg-transparent ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    p({ children }) {
                        return <p className="text-base whitespace-pre-wrap break-words leading-relaxed mb-4">{children}</p>;
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
                    }
                }}
            >
                {processedContent.text}
            </ReactMarkdown>
        </div>
    );
};

export default ContentRenderer;
