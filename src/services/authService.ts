import api from './api';

export interface LoginData {
    email: string;
    password: string;
}

export interface RegisterData {
    username: string;
    email: string;
    password: string;
}

export interface User {
    id: string;
    username: string;
    email: string;
}

export const login = async (data: LoginData) => {
    try {
        const response = await api.post('/users/login', data);
        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            if (response.data.user) {
                localStorage.setItem('user', JSON.stringify(response.data.user));
            }
        }
        return response.data;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};

export const register = async (data: RegisterData) => {
    try {
        const response = await api.post('/users/register', data);
        return response.data;
    } catch (error) {
        console.error('Register error:', error);
        throw error;
    }
};

export const logout = async () => {
    try {
        await api.post('/users/logout');
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
};

export const isAuthenticated = () => {
    return !!localStorage.getItem('token');
};

export const getCurrentUser = (): User | null => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            return JSON.parse(userStr);
        } catch (error) {
            console.error('Error parsing user data:', error);
            return null;
        }
    }
    return null;
};

export const getUserProfile = async (): Promise<User> => {
    try {
        const response = await api.get('/users/profile/me');
        return response.data;
    } catch (error) {
        console.error('Get user profile error:', error);
        throw error;
    }
}; 