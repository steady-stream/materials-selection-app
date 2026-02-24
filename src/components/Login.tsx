import { type FormEvent, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const {
    isAuthenticated,
    isLoading,
    login,
    completeNewPassword,
    newPasswordRequired,
  } = useAuth();
  const location = useLocation() as {
    state?: { from?: { pathname?: string } };
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Capture the intended destination once at mount — using a ref so re-renders
  // caused by ProtectedRoute bouncing back to /login don't change it.
  const fromRef = useRef<string>(location.state?.from?.pathname ?? "/");

  // Declarative redirect: once isAuthenticated flips to true, navigate away.
  // This fires in the same render cycle as the state update, avoiding the
  // race condition that happens with an imperative navigate() call.
  console.log(
    "[Login] render — isLoading:",
    isLoading,
    "isAuthenticated:",
    isAuthenticated,
    "from:",
    fromRef.current,
  );
  if (!isLoading && isAuthenticated) {
    return <Navigate to={fromRef.current} replace />;
  }

  // ---------------------------------------------------------------------------
  // Handle initial login
  // ---------------------------------------------------------------------------
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      // On success: isAuthenticated becomes true → declarative <Navigate> above fires.
      // On new_password_required: newPasswordRequired becomes true → form swaps below.
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handle new-password challenge (first login with temp password)
  // ---------------------------------------------------------------------------
  const handleNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await completeNewPassword(newPassword);
      // isAuthenticated becomes true → declarative <Navigate> above fires.
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg mb-4">
            <svg
              className="w-9 h-9 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Materials Selection
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {newPasswordRequired
              ? "Set your new password to continue"
              : "Sign in to your account"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ----------------------------------------------------------------
              New password required form (first login / temp password)
          ---------------------------------------------------------------- */}
          {newPasswordRequired ? (
            <form onSubmit={handleNewPassword} className="space-y-5">
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Your account requires a new password. Please set a permanent
                password to continue.
              </p>

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  autoFocus
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Repeat new password"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-lg shadow hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? "Setting password…" : "Set Password & Sign In"}
              </button>
            </form>
          ) : (
            /* ------------------------------------------------------------------
                Standard login form
            ------------------------------------------------------------------ */
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-lg shadow hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? "Signing in…" : "Sign In"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Contact your administrator to request access.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Map Cognito error codes to readable messages
// ---------------------------------------------------------------------------
function friendlyError(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: string }).code;
    switch (code) {
      case "NotAuthorizedException":
        return "Incorrect email or password.";
      case "UserNotFoundException":
        return "No account found with that email address.";
      case "UserNotConfirmedException":
        return "Your account has not been confirmed. Please contact your administrator.";
      case "PasswordResetRequiredException":
        return "A password reset is required. Please contact your administrator.";
      case "InvalidPasswordException":
        return "Password does not meet requirements (min 8 chars, upper, lower, number).";
      case "LimitExceededException":
        return "Too many attempts. Please wait a moment and try again.";
      case "NetworkError":
        return "Network error. Please check your connection.";
      default:
        break;
    }
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred. Please try again.";
}
