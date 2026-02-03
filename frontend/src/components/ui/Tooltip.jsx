import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export const Tooltip = ({ content, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState({});
    const triggerRef = useRef(null);

    useEffect(() => {
        if (isVisible && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const tooltipWidth = 288; // w-72 = 18rem = 288px
            const tooltipHeight = 200; // estimated max height
            const padding = 8;

            let top, left;

            // Check if there's enough space below
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;

            if (spaceBelow >= tooltipHeight + padding) {
                // Position below
                top = rect.bottom + padding;
            } else if (spaceAbove >= tooltipHeight + padding) {
                // Position above
                top = rect.top - tooltipHeight - padding;
            } else {
                // Default to below if neither fits well
                top = rect.bottom + padding;
            }

            // Align to the right edge of trigger, but keep within viewport
            left = rect.right - tooltipWidth;

            // Ensure tooltip doesn't go off-screen left
            if (left < padding) {
                left = padding;
            }

            // Ensure tooltip doesn't go off-screen right
            if (left + tooltipWidth > window.innerWidth - padding) {
                left = window.innerWidth - tooltipWidth - padding;
            }

            setTooltipStyle({
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                width: `${tooltipWidth}px`,
            });
        }
    }, [isVisible]);

    const tooltipContent = isVisible && createPortal(
        <div
            className="p-4 bg-slate-800 text-sm text-slate-200 rounded-lg shadow-2xl border border-slate-600 animate-in fade-in zoom-in-95 duration-200"
            style={{
                ...tooltipStyle,
                zIndex: 9999,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
            }}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {content}
        </div>,
        document.body
    );

    return (
        <>
            <div
                ref={triggerRef}
                className="inline-block"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onClick={() => setIsVisible(!isVisible)}
            >
                {children}
            </div>
            {tooltipContent}
        </>
    );
};
