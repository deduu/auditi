import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [setupRequired, setSetupRequired] = useState(false);

    const checkAuth = useCallback(async () => {
        try {
            const setupStatus = await client.get('/auth/setup-status');
            if (!setupStatus.is_setup_complete) {
                setSetupRequired(true);
                setIsLoading(false);
                return;
            }

            const userData = await client.get('/auth/me');
            setUser(userData);
        } catch (error) {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // Listen for 401 events from the API client
    useEffect(() => {
        const handler = () => setUser(null);
        window.addEventListener('auth:unauthorized', handler);
        return () => window.removeEventListener('auth:unauthorized', handler);
    }, []);

    const login = async (email, password) => {
        const response = await client.post('/auth/login', { email, password });
        setUser(response.user);
        return response;
    };

    const logout = async () => {
        try {
            await client.post('/auth/logout');
        } catch (e) {
            // Ignore errors on logout
        }
        setUser(null);
    };

    const setup = async (email, name, password) => {
        const response = await client.post('/auth/setup', { email, name, password });
        setUser(response);
        setSetupRequired(false);
        return response;
    };

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isAuthenticated: !!user,
            setupRequired,
            login,
            logout,
            setup,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
