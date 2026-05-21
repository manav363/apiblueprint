import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import SchemaBuilder from './pages/SchemaBuilder';
import ExportPage from './pages/ExportPage';
import Monitoring from './pages/Monitoring';
import Documentation from './pages/Documentation';
import Settings from './pages/Settings';
import ApiTester from './pages/ApiTester';
import { api, clearAuth, getStoredUsername, hasStoredAuth, persistAuth } from './services/api';

function LoginScreen({ onAuthenticated }) {
  const [username, setUsername] = useState(getStoredUsername());
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function validateStoredSession() {
      if (!hasStoredAuth()) {
        if (!cancelled) setChecking(false);
        return;
      }

      try {
        const session = await api.getSession();
        if (!cancelled) {
          setUsername(session.username);
          onAuthenticated();
        }
      } catch {
        clearAuth();
        if (!cancelled) {
          setError('Your saved session is no longer valid. Sign in again.');
          setChecking(false);
        }
      }
    }

    validateStoredSession();
    return () => {
      cancelled = true;
    };
  }, [onAuthenticated]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const token = await api.login(username, password);
      persistAuth(token.access_token, token.username);
      setUsername(token.username);
      onAuthenticated();
    } catch {
      clearAuth();
      setError('Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#050505', color: '#707070', fontFamily: 'Sora, sans-serif' }}>
        Checking secure session...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at top, rgba(0,212,170,0.18), transparent 38%), #050505', padding: 24 }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 380, background: 'rgba(13,13,13,0.96)', border: '1px solid #1c1c1c', borderRadius: 16, padding: 28, boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
        <div style={{ fontSize: 12, color: '#00d4aa', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Secure Workspace</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 26, lineHeight: 1.1 }}>APIBlueprint</h1>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#707070', lineHeight: 1.7 }}>
          Sign in with the admin credentials from your `.env` file to access projects, specs, and mock controls.
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          <input
            value={username}
            onChange={event => setUsername(event.target.value)}
            placeholder="Admin username"
            autoComplete="username"
            style={{ background: '#111', border: '1px solid #242424', borderRadius: 8, padding: '12px 14px', color: '#f0f0f0', fontSize: 13, outline: 'none' }}
          />
          <input
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Admin password"
            type="password"
            autoComplete="current-password"
            style={{ background: '#111', border: '1px solid #242424', borderRadius: 8, padding: '12px 14px', color: '#f0f0f0', fontSize: 13, outline: 'none' }}
          />
        </div>

        {error && <div style={{ marginTop: 12, color: '#ff5c6a', fontSize: 12 }}>{error}</div>}

        <button
          type="submit"
          disabled={submitting || !username.trim() || !password}
          style={{ width: '100%', marginTop: 18, background: '#00d4aa', color: '#000', border: 'none', borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.75 : 1 }}
        >
          {submitting ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();

  return (
    <ErrorBoundary key={location.pathname}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/schema" element={<SchemaBuilder />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/tester" element={<ApiTester />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/docs" element={<Documentation />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </ErrorBoundary>
  );
}

function AuthenticatedApp() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);

  return (
    <ErrorBoundary key={authenticated ? 'authenticated' : 'login'}>
      {authenticated ? (
        <AuthenticatedApp />
      ) : (
        <LoginScreen onAuthenticated={() => setAuthenticated(true)} />
      )}
    </ErrorBoundary>
  );
}
