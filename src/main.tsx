import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { AuthProvider } from './context/Auth';
import { initSentry } from './sentry';
import './index.css';

// Initialize Sentry early
initSentry();

// Initialize Web Vitals in production
if (import.meta.env.PROD) {
  import('./utils/vitals').then(m => m.initVitals());
}

// Import pages directly to avoid lazy loading issues
import { FeedPageWrapper as FeedPage } from './App';
import ClipPage from './pages/ClipPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import SearchPage from './pages/SearchPage';
const Placeholder = ({ name }: { name: string }) => <div className="p-6">{name}</div>;

const Root = () => (
  <Sentry.ErrorBoundary fallback={<div className="p-6 text-red-600">Something went wrong.</div>}>
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />}>
              <Route index element={<Navigate to="/feed" replace />} />
              <Route path="feed" element={<FeedPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="boost" element={<Placeholder name="Boost" />} />
              <Route path="clip" element={<ClipPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  </Sentry.ErrorBoundary>
);

function SimpleAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState(null);

  const login = (userData: any) => {
    setUser(userData);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <div>
      {children}
    </div>
  );
}

function SimpleApp() {
  return (
    <main className="mx-auto max-w-md min-h-screen pb-16">
      <SimpleTopBar />
      <div className="p-6 text-blue-600 dark:text-blue-400">Simple App component with ThemeProvider works!</div>
      <Outlet />
    </main>
  );
}

function SimpleTopBar() {
  const { theme, toggle } = useTheme();

  return (
    <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-md px-4 h-11 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-brand-600 dark:text-brand-400">Gazetteer</span>
        </div>
        <button
          onClick={toggle}
          className="p-2 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
