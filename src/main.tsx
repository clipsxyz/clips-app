import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthProvider } from './context/Auth';
import { initSentry } from './sentry';
import './index.css';

// Initialize Sentry early
initSentry();

// Initialize Web Vitals in production
if (import.meta.env.PROD) {
  import('./utils/vitals').then(m => m.initVitals());
}

const FeedPage = lazy(() => import('./App').then(m => ({ default: m.FeedPage })));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
import ClipPage from './pages/ClipPage';
const Placeholder = ({ name }: { name: string }) => <div className="p-6">{name}</div>;

const Root = () => (
  <Sentry.ErrorBoundary fallback={<div className="p-6">Something went wrong.</div>}>
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="p-6">Loading…</div>}>
            <Routes>
              <Route path="/" element={<App />}>
                <Route index element={<Navigate to="/feed" replace />} />
                <Route path="feed" element={<FeedPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="boost" element={<Placeholder name="Boost" />} />
                <Route path="clip" element={<ClipPage />} />
                <Route path="test-clip" element={<ClipPage />} />
                <Route path="search" element={<Placeholder name="Search" />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  </Sentry.ErrorBoundary>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
