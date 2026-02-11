import React from "react";
import { ChevronDown } from "lucide-react";

export const DropdownFilter = ({ value, options, onChange }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-sm text-slate-300 hover:border-slate-500 transition-all duration-200"
            >
                <span>{value}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 py-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                        {options && options.map(opt => (
                            <button
                                key={opt}
                                onClick={() => { onChange(opt); setIsOpen(false); }}
                                className={`block w-full text-left px-4 py-2 text-sm transition-colors ${value === opt
                                    ? 'bg-blue-600/20 text-blue-400'
                                    : 'text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
