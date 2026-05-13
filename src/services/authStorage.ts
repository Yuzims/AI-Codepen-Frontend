import type { User } from './authService';

export const isAuthenticated = (): boolean => !!localStorage.getItem('token');

export const getCurrentUser = (): User | null => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
};
