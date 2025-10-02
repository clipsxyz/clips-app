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
const ClipPage = lazy(() => import('./pages/ClipPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const CompleteBioPage = lazy(() => import('./pages/CompleteBioPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage'));
const FollowersPage = lazy(() => import('./pages/FollowersPage'));
const MessagesPage = lazy(() => import('./components/MessagesPage'));
const LiveStreamPage = lazy(() => import('./components/LiveStreamPage'));
const GroupsPage = lazy(() => import('./components/GroupsPage'));
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
                      <Route path="signup" element={<SignupPage />} />
                      <Route path="clip" element={<ClipPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="profile/complete-bio" element={<CompleteBioPage />} />
                      <Route path="profile/edit" element={<EditProfilePage />} />
                      <Route path="profile/followers" element={<FollowersPage />} />
                      <Route path="profile/following" element={<FollowersPage />} />
                      <Route path="profile/posts" element={<Placeholder name="User Posts" />} />
                      <Route path="messages" element={<MessagesPage />} />
                      <Route path="messages/:conversationId" element={<MessagesPage />} />
                      <Route path="live" element={<LiveStreamPage />} />
                      <Route path="live/create" element={<LiveStreamPage mode="create" />} />
                      <Route path="live/:streamId" element={<LiveStreamPage />} />
                      <Route path="groups" element={<GroupsPage />} />
                      <Route path="groups/:groupId" element={<GroupsPage />} />
                      <Route path="search" element={<Placeholder name="Search" />} />
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
