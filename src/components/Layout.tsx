import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Pathless layout route — renders nav + <Outlet /> for all protected routes.
 * Used as <Route element={<Layout />}> with child routes nested inside.
 */
const Layout = () => {
  const location = useLocation();
  const { userEmail, logout } = useAuth();

  const isActive = (path: string) => {
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <img
                    src="/expertise_header.png"
                    alt="MegaPros"
                    className="w-8 h-8 object-contain"
                  />
                  Materials Selection
                </h1>
              </div>
              <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
                <Link
                  to="/"
                  className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    isActive("/projects") || location.pathname === "/"
                      ? "bg-white/20 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  📁 Projects
                </Link>
                <Link
                  to="/vendors"
                  className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    isActive("/vendors")
                      ? "bg-white/20 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  🏪 Vendors
                </Link>
                <Link
                  to="/manufacturers"
                  className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    isActive("/manufacturers")
                      ? "bg-white/20 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  🏭 Manufacturers
                </Link>
                <Link
                  to="/products"
                  className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    isActive("/products")
                      ? "bg-white/20 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  📦 Products
                </Link>
              </div>
            </div>

            {/* Right side: signed-in user + sign out */}
            <div className="flex items-center gap-3">
              {userEmail && (
                <span className="hidden sm:block text-white/70 text-xs truncate max-w-[180px]">
                  {userEmail}
                </span>
              )}
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                title="Sign out"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
