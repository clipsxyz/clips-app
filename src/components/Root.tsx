import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from '../App';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthProvider } from '../context/Auth';
import { FeedPageWrapper as FeedPage } from '../App';
import ClipPage from '../pages/ClipPage';
import CreatePage from '../pages/CreatePage';
import LoginPage from '../pages/LoginPage';
import ProfilePage from '../pages/ProfilePage';
import SearchPage from '../pages/SearchPage';
import StoriesPage from '../pages/StoriesPage';
import ViewProfilePage from '../pages/ViewProfilePage';
import MessagesPage from '../pages/MessagesPage';

const Placeholder = ({ name }: { name: string }) => <div className="p-6">{name}</div>;

export default function Root() {
    return (
        <Sentry.ErrorBoundary fallback={<div className="p-6 text-red-600">Something went wrong.</div>}>
            <AuthProvider>
                <ThemeProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/" element={<App />}>
                                <Route index element={<Navigate to="/feed" replace />} />
                                <Route path="feed" element={<FeedPage />} />
                                <Route path="create" element={<CreatePage />} />
                                <Route path="login" element={<LoginPage />} />
                                <Route path="boost" element={<Placeholder name="Boost" />} />
                                <Route path="clip" element={<ClipPage />} />
                                <Route path="stories" element={<StoriesPage />} />
                                <Route path="search" element={<SearchPage />} />
                                <Route path="profile" element={<ProfilePage />} />
                                <Route path="user/:handle" element={<ViewProfilePage />} />
                            </Route>
                            <Route path="messages/:handle" element={<MessagesPage />} />
                        </Routes>
                    </BrowserRouter>
                </ThemeProvider>
            </AuthProvider>
        </Sentry.ErrorBoundary>
    );
}
