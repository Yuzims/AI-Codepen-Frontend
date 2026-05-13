import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const Editor = lazy(() => import('./components/Editor'));
const PensPage = lazy(() => import('./pages/PensPage'));
const PreviewPage = lazy(() => import('./pages/PreviewPage'));

const RouteFallback: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '20px' }}>
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto 24px',
          height: '72px',
          borderRadius: '16px',
          background: '#ffffff',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)'
        }}
      />
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px'
        }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            style={{
              height: '200px',
              borderRadius: '8px',
              background: '#ffffff',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}
          />
        ))}
      </div>
    </div>
  );
};

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/p/:id" element={<PreviewPage />} />
      <Route
        path="/pens"
        element={
          <PrivateRoute>
            <PensPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/editor"
        element={
          <PrivateRoute>
            <Editor />
          </PrivateRoute>
        }
      />
      <Route
        path="/editor/:id"
        element={
          <PrivateRoute>
            <Editor />
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/pens" />} />
    </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <LanguageProvider>
          <AppRoutes />
        </LanguageProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
