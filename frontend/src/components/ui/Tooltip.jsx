import React, { useState } from 'react';

export const Tooltip = ({ content, children }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            onClick={() => setIsVisible(!isVisible)}
        >
            {children}
            {isVisible && (
                <div className="absolute z-50 bottom-full mb-2 right-0 w-64 p-3 bg-slate-800 text-xs text-slate-200 rounded-lg shadow-xl border border-slate-700 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                    {content}
                </div>
            )}
        </div>
    );
};
