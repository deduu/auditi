import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useSidebar } from '../../context/SidebarContext';

/**
 * SlidePanel - A slide-over panel that appears from the right side of the screen.
 * 
 * Props:
 * - isOpen: boolean - Controls visibility
 * - onClose: function - Called when panel should close
 * - title: string - Panel header title
 * - children: ReactNode - Panel content
 * - defaultWidth: number - Default panel width in pixels (default: 700)
 * - minWidth: number - Minimum panel width (default: 400)
 * - maxWidth: number - Maximum panel width (default: 1400)
 */
export const SlidePanel = ({
    isOpen,
    onClose,
    title,
    children,
    defaultWidth = 700,
    minWidth = 400,
    maxWidth = 1400,
    closeOnOutsideClick = true
}) => {
    const panelRef = useRef(null);
    const [panelWidth, setPanelWidth] = useState(defaultWidth);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartX = useRef(0);
    const dragStartWidth = useRef(0);

    // Get sidebar width from context
    let sidebarWidth = 256; // Default fallback
    try {
        const sidebarContext = useSidebar();
        sidebarWidth = sidebarContext.sidebarWidth;
    } catch {
        // If context not available, use default
    }

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                if (isFullscreen) {
                    setIsFullscreen(false);
                } else {
                    onClose();
                }
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, isFullscreen, onClose]);

    const handleBackdropClick = (e) => {
        if (closeOnOutsideClick && !isFullscreen && panelRef.current && !panelRef.current.contains(e.target)) {
            onClose();
        }
    };

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
        dragStartX.current = e.clientX;
        dragStartWidth.current = panelWidth;
    }, [panelWidth]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;
        const delta = dragStartX.current - e.clientX;
        const newWidth = Math.min(maxWidth, Math.max(minWidth, dragStartWidth.current + delta));
        setPanelWidth(newWidth);
    }, [isDragging, minWidth, maxWidth]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    if (!isOpen) return null;

    // Calculate panel position and size
    const panelStyle = isFullscreen
        ? {
            left: `${sidebarWidth}px`,
            width: `calc(100% - ${sidebarWidth}px)`
        }
        : {
            width: `${panelWidth}px`
        };

    return createPortal(
        <div
            className={`fixed inset-0 z-40 flex justify-end ${isFullscreen ? '' : 'pointer-events-none'}`}
            onClick={isFullscreen ? undefined : handleBackdropClick}
        >
            {/* Slide Panel */}
            <div
                ref={panelRef}
                style={panelStyle}
                className={`h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 pointer-events-auto ${isFullscreen ? 'fixed top-0 right-0' : 'relative'}`}
                role="dialog"
                aria-modal="true"
            >
                {/* Drag Handle (left edge) - only when not fullscreen */}
                {!isFullscreen && (
                    <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/50 bg-slate-700/30 transition-colors z-10 group"
                        onMouseDown={handleMouseDown}
                        title="Drag to resize"
                    >
                        {/* Visual indicator */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-0.5 bg-slate-500 rounded-full opacity-50 group-hover:opacity-100 group-hover:bg-blue-400 transition-all" />
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0 bg-slate-950/50">
                    <h2 className="text-lg font-semibold text-white truncate">{title}</h2>
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                            title={isFullscreen ? "Exit fullscreen (ESC)" : "Fullscreen"}
                        >
                            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            aria-label="Close panel"
                            title="Close panel"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};
