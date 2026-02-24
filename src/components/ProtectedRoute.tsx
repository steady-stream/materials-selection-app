import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Layout route guard — used as a pathless parent <Route element={<ProtectedRoute />}>.
 * - Loading  → neutral spinner (avoids flash of unauthenticated content)
 * - Not auth → redirect to /login, preserving the intended destination in state
 * - Auth     → renders the next nested route via <Outlet />
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="flex flex-col items-center gap-3 text-indigo-600">
          <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span className="text-sm font-medium text-gray-500">Loading…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve the original destination so Login can redirect back after auth
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Render the matched child route
  return <Outlet />;
}
