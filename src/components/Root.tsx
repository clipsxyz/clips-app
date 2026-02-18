import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from '../App';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthProvider } from '../context/Auth';
import { FeedPageWrapper as FeedPage, BoostPageWrapper as BoostPage } from '../App';
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
import LandingPage from '../pages/LandingPage';
import PaymentPage from '../pages/PaymentPage';
import PaymentSuccessPage from '../pages/PaymentSuccessPage';
import CollectionFeedPage from '../pages/CollectionFeedPage';
import TemplatesPage from '../pages/TemplatesPage';
import TemplateEditorPage from '../pages/TemplateEditorPage';
import VideoEditorPage from '../pages/VideoEditorPage';
import CanvaVideoEditor from '../pages/CanvaVideoEditor';
import TextOnlyPostPage from '../pages/TextOnlyPostPage';
import TextOnlyPostDetailsPage from '../pages/TextOnlyPostDetailsPage';
import ReplyQuestionPage from '../pages/ReplyQuestionPage';
import TermsPage from '../pages/TermsPage';


function ErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
            <div className="max-w-md w-full bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h1 className="text-lg font-semibold text-red-400 mb-2">Something went wrong</h1>
                <p className="text-sm text-gray-300 mb-4 font-mono break-words">{error?.message || String(error)}</p>
                <button
                    onClick={resetError}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#0095f6] hover:bg-[#0084d4] text-white font-medium transition-colors"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}

export default function Root() {
    return (
        <Sentry.ErrorBoundary
            fallback={({ error, resetError }) => <ErrorFallback error={error as Error} resetError={resetError} />}
        >
            <AuthProvider>
                <ThemeProvider>
                    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
                        <Routes>
                            <Route path="/splash" element={<SplashPage />} />
                            <Route path="/landing" element={<LandingPage />} />
                            <Route path="/" element={<App />}>
                                <Route index element={<Navigate to="/splash" replace />} />
                                <Route path="feed" element={<FeedPage />} />
                                <Route path="create" element={<CreatePage />} />
                                <Route path="create/instant" element={<InstantCreatePage />} />
                                <Route path="create/filters" element={<InstantFiltersPage />} />
                                <Route path="create/video-editor" element={<CanvaVideoEditor />} />
                                <Route path="create/text-only" element={<TextOnlyPostPage />} />
                                <Route path="create/text-only/details" element={<TextOnlyPostDetailsPage />} />
                                <Route path="templates" element={<TemplatesPage />} />
                                <Route path="template-editor" element={<TemplateEditorPage />} />
                                <Route path="video-editor" element={<VideoEditorPage />} />
                                <Route path="login" element={<LoginPage />} />
                                <Route path="terms" element={<TermsPage />} />
                                <Route path="boost" element={<BoostPage />} />
                                <Route path="payment" element={<PaymentPage />} />
                                <Route path="payment-success" element={<PaymentSuccessPage />} />
                                <Route path="clip" element={<ClipPage />} />
                                <Route path="stories" element={<StoriesPage />} />
                                <Route path="discover" element={<DiscoverPage />} />
                                <Route path="search" element={<SearchPage />} />
                                <Route path="profile" element={<ProfilePage />} />
                                <Route path="user/:handle" element={<ViewProfilePage />} />
                                <Route path="collection/:collectionId" element={<CollectionFeedPage />} />
                            </Route>
                            <Route path="messages/:handle" element={<MessagesPage />} />
                            <Route path="inbox" element={<InboxPage />} />
                            <Route path="reply-question" element={<ReplyQuestionPage />} />
                        </Routes>
                    </BrowserRouter>
                </ThemeProvider>
            </AuthProvider>
        </Sentry.ErrorBoundary>
    );
}
