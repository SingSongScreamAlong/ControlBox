// =====================================================================
// Protected Route
// Redirects unauthenticated users to login
// =====================================================================

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, checkAuth } = useAuthStore();
    const location = useLocation();

    // Check if user is authenticated
    const isAuthenticated = checkAuth() && user;

    if (!isAuthenticated) {
        // Redirect to login, preserving the intended destination
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
