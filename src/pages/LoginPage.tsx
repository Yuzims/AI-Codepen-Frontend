import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { login, LoginData } from '../services/authService';

import {Container,
  Form,
  Title,
  Input,
  Button,
  ErrorMessage,
  RegisterLink
} from '../styles/loginPageStyles';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { login: authLogin, isAuthenticated } = useAuth();
    const [formData, setFormData] = useState<LoginData>({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/pens');
        }
    }, [isAuthenticated, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await authLogin(formData.email, formData.password);
            navigate('/pens');
        } catch (err: any) {
            setError(err.response?.data?.message || '登录失败');
        }
    };

    return (
        <Container>
            <Form onSubmit={handleSubmit}>
                <Title>登录</Title>
                {error && <ErrorMessage>{error}</ErrorMessage>}
                <Input
                    type="email"
                    name="email"
                    placeholder="邮箱"
                    value={formData.email}
                    onChange={handleChange}
                    required
                />
                <Input
                    type="password"
                    name="password"
                    placeholder="密码"
                    value={formData.password}
                    onChange={handleChange}
                    required
                />
                <Button type="submit">登录</Button>
                <RegisterLink to="/register">还没有账号？立即注册</RegisterLink>
            </Form>
        </Container>
    );
};

export default LoginPage; 