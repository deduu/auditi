import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './Button';

/**
 * Standard Pagination Footer
 * 
 * @param {number} currentPage - Current page number (1-based)
 * @param {number} totalPages - Total number of pages
 * @param {number} pageSize - Number of items per page
 * @param {function} onPageChange - Callback when page changes (newLage) => {}
 * @param {function} onPageSizeChange - Callback when page size changes (newSize) => {}
 * @param {Array<number>} pageSizeOptions - Options for page size dropdown
 * @param {boolean} disabled - Whether pagination is disabled (e.g. loading)
 */
export const PaginationFooter = ({
    currentPage = 1,
    totalPages = 1,
    pageSize = 10,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50, 100],
    disabled = false,
    className = ""
}) => {
    return (
        <div className={`flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-900/50 ${className}`}>
            {/* Rows per page selector */}
            <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">Rows per page</span>
                <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange && onPageSizeChange(Number(e.target.value))}
                    disabled={disabled}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                >
                    {pageSizeOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center space-x-4">
                {/* Page Status */}
                <span className="text-xs text-slate-400">
                    Page {currentPage} of {totalPages || 1}
                </span>

                {/* Navigation Buttons */}
                <div className="flex items-center space-x-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onPageChange(1)}
                        disabled={disabled || currentPage <= 1}
                        title="First page"
                    >
                        <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={disabled || currentPage <= 1}
                        title="Previous page"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={disabled || currentPage >= totalPages}
                        title="Next page"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onPageChange(totalPages)}
                        disabled={disabled || currentPage >= totalPages}
                        title="Last page"
                    >
                        <ChevronsRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
