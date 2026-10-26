import { Navigate, useLocation } from 'react-router-dom';
import App from '../App';
import { useAuth } from '../context/Auth';
import { parsePublicShareLink } from '../utils/publicShareLink';
import PublicStoryPage from '../pages/PublicStoryPage';

const AUTH_PATHS = new Set(['/login', '/terms']);

/**
 * Logged-out visitors may only stay on login/terms, or a shared story URL.
 * Everything else in the App chrome goes to landing.
 */
export default function AppGate() {
    const { user, ready } = useAuth();
    const loc = useLocation();

    if (!ready) {
        return <div className="min-h-screen bg-black" />;
    }

    if (!user) {
        const share = parsePublicShareLink(loc.pathname, loc.search);
        if (share?.kind === 'story') {
            return <PublicStoryPage />;
        }
        if (!AUTH_PATHS.has(loc.pathname)) {
            return <Navigate to="/landing" replace />;
        }
    }

    return <App />;
}
