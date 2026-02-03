import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { createPortal } from 'react-dom';

/**
 * Reusable dropdown menu component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.trigger - Custom trigger element (optional, defaults to MoreHorizontal icon)
 * @param {Array} props.items - Array of menu items: { label, icon: LucideIcon, onClick, variant: 'default'|'danger', divider?: boolean }
 * @param {'left'|'right'} props.align - Menu alignment (default: 'right')
 * @param {string} props.className - Additional classes for the container
 */
export const DropdownMenu = ({
  trigger,
  items = [],
  align = 'right',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const contentRef = useRef(null); // Ref for the portal content

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside BOTH the trigger (menuRef) AND the content (contentRef)
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        (!contentRef.current || !contentRef.current.contains(event.target))
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleItemClick = (item) => {
    if (item.onClick) {
      item.onClick();
    }
    setIsOpen(false);
  };

  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Calculate position when opening
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      // Default to displaying below the trigger
      let top = rect.bottom + scrollY + 4; // 4px gap
      let left = rect.left + scrollX;

      // Adjust alignment
      if (align === 'right') {
        left = rect.right + scrollX - 192; // 192px = w-48 (min-width)
        // If it goes off-screen left, align left instead
        if (left < 4) left = rect.left + scrollX;
      }

      // Check for bottom overflow
      const menuHeight = items.length * 40 + 10; // Approx height
      if (rect.bottom + menuHeight > window.innerHeight) {
        // Show above trigger if no space below
        top = rect.top + scrollY - menuHeight - 4;
      }

      setPosition({ top, left });
    }
  }, [isOpen, align, items.length]);

  return (
    <div className={`inline-block ${className}`} ref={menuRef}>
      {/* Trigger */}
      {trigger ? (
        <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          aria-label="More options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      )}

      {/* Dropdown Menu - Rendered via Portal */}
      {isOpen && createPortal(
        <>
          {/* Backdrop to close when clicking outside */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
          />

          <div
            ref={contentRef}
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
            className="absolute min-w-48 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden z-[9999] animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="py-1">
              {items.map((item, index) => {
                // Render divider
                if (item.divider) {
                  return (
                    <div key={`divider-${index}`} className="border-t border-slate-700 my-1" />
                  );
                }

                const Icon = item.icon;
                const isDanger = item.variant === 'danger';

                return (
                  <button
                    key={item.label || index}
                    onClick={() => handleItemClick(item)}
                    disabled={item.disabled}
                    className={`w-full px-4 py-2 text-sm flex items-center transition-colors text-left ${item.disabled
                      ? 'text-slate-600 cursor-not-allowed'
                      : isDanger
                        ? 'text-red-400 hover:bg-slate-700 hover:text-red-300'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                  >
                    {Icon && <Icon className="w-4 h-4 mr-3" />}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default DropdownMenu;
