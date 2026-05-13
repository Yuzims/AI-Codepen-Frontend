import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register, RegisterData } from '../services/authService';
import {
    Container,
    Form,
    Title,
    Input,
    Button,
    ErrorMessage,
    LoginLink
} from '../styles/registerPageStyles';

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState<RegisterData>({
        username: '',
        email: '',
        password: ''
    });
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await register(formData);
            navigate('/login');
        } catch (err: any) {
            setError(err.response?.data?.message || '注册失败');
        }
    };

    return (
        <Container>
            <Form onSubmit={handleSubmit}>
                <Title>注册</Title>
                {error && <ErrorMessage>{error}</ErrorMessage>}
                <Input
                    type="text"
                    name="username"
                    placeholder="用户名"
                    value={formData.username}
                    onChange={handleChange}
                    required
                />
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
                <Button type="submit">注册</Button>
                <LoginLink to="/login">已有账号？立即登录</LoginLink>
            </Form>
        </Container>
    );
};

export default RegisterPage;