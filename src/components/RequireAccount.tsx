import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/Auth';

const AUTH_PATHS = new Set(['/login', '/terms']);

/**
 * Full app (feed, inbox, profile, …) requires an account.
 * Login/terms stay reachable so landing can send people to create one.
 */
export default function RequireAccount() {
    const { user, ready } = useAuth();
    const loc = useLocation();

    if (!ready) {
        return <div className="min-h-screen bg-black" />;
    }
    if (user || AUTH_PATHS.has(loc.pathname)) {
        return <Outlet />;
    }
    return <Navigate to="/landing" replace />;
}
