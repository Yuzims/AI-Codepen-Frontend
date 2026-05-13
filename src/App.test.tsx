import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

test('未登录时会跳转到登录页', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: '登录' })).toBeInTheDocument();
});
