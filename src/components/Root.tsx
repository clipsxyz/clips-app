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
import DiscoverPage from '../pages/DiscoverPage';
import StoriesPage from '../pages/StoriesPage';
import ViewProfilePage from '../pages/ViewProfilePage';
import MessagesPage from '../pages/MessagesPage';
import InboxPage from '../pages/InboxPage';
import InstantCreatePage from '../pages/InstantCreatePage';
import InstantFiltersPage from '../pages/InstantFiltersPage';
import SplashPage from '../pages/SplashPage';

const Placeholder = ({ name }: { name: string }) => <div className="p-6">{name}</div>;

export default function Root() {
    return (
        <Sentry.ErrorBoundary fallback={<div className="p-6 text-red-600">Something went wrong.</div>}>
            <AuthProvider>
                <ThemeProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/splash" element={<SplashPage />} />
                            <Route path="/" element={<App />}>
                                <Route index element={<Navigate to="/splash" replace />} />
                                <Route path="feed" element={<FeedPage />} />
                                <Route path="create" element={<CreatePage />} />
                                <Route path="create/instant" element={<InstantCreatePage />} />
                                <Route path="create/filters" element={<InstantFiltersPage />} />
                                <Route path="login" element={<LoginPage />} />
                                <Route path="boost" element={<Placeholder name="Boost" />} />
                                <Route path="clip" element={<ClipPage />} />
                                <Route path="stories" element={<StoriesPage />} />
                                <Route path="discover" element={<DiscoverPage />} />
                                <Route path="search" element={<SearchPage />} />
                                <Route path="profile" element={<ProfilePage />} />
                                <Route path="user/:handle" element={<ViewProfilePage />} />
                            </Route>
                            <Route path="messages/:handle" element={<MessagesPage />} />
                            <Route path="inbox" element={<InboxPage />} />
                        </Routes>
                    </BrowserRouter>
                </ThemeProvider>
            </AuthProvider>
        </Sentry.ErrorBoundary>
    );
}
