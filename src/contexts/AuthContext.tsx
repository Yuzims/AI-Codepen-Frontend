import React, { createContext, useContext, useState, useEffect } from 'react';
import { isAuthenticated as checkAuth, getCurrentUser } from '../services/authStorage';
import type { LoginData, User } from '../services/authService';

interface AuthContextType {
    isAuthenticated: boolean;
    loading: boolean;
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const authenticated = checkAuth();
        setIsAuthenticated(authenticated);
        if (authenticated) {
            setUser(getCurrentUser());
        }
        setLoading(false);
    }, []);

    const login = async (email: string, password: string) => {
        const { login: loginService } = await import('../services/authService');
        const loginData: LoginData = { email, password };
        const result = await loginService(loginData);
        setIsAuthenticated(true);
        setUser(result.user);
    };

    const logout = async () => {
        const { logout: logoutService } = await import('../services/authService');
        await logoutService();
        setIsAuthenticated(false);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, loading, user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};