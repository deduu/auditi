import React, { createContext, useContext, useState } from 'react';

// Sidebar constants
export const SIDEBAR_EXPANDED_WIDTH = 256; // 64 * 4 = 256px (w-64)
export const SIDEBAR_COLLAPSED_WIDTH = 64;  // 16 * 4 = 64px (w-16)

// Context for sidebar state
const SidebarContext = createContext(null);

export const SidebarProvider = ({ children }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);

    const sidebarWidth = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

    return (
        <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, sidebarWidth }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
};
