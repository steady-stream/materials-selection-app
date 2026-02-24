import {
    AuthenticationDetails,
    CognitoUser,
    CognitoUserPool,
    type CognitoUserSession,
} from "amazon-cognito-identity-js";
import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Cognito User Pool singleton — config pulled from Vite env vars
// ---------------------------------------------------------------------------
const UserPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  userEmail: string | null;
  /** True when Cognito requires the user to set a new password (first login) */
  newPasswordRequired: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<"authenticated" | "new_password_required">;
  /** Complete the new-password challenge after a first-time / temp-password login */
  completeNewPassword: (newPassword: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // true until session check is done
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [newPasswordRequired, setNewPasswordRequired] = useState(false);

  // Keep the pending CognitoUser for the newPasswordRequired flow in a ref
  // so it doesn't trigger re-renders and is always the latest value
  const pendingUserRef = useRef<CognitoUser | null>(null);

  // -------------------------------------------------------------------------
  // On mount: restore an existing valid session from localStorage / cookies
  // -------------------------------------------------------------------------
  useEffect(() => {
    const cognitoUser = UserPool.getCurrentUser();
    if (!cognitoUser) {
      setIsLoading(false);
      return;
    }

    cognitoUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session?.isValid()) {
          setIsLoading(false);
          return;
        }
        // Session valid — pull the email attribute
        cognitoUser.getUserAttributes((_attrErr, attrs) => {
          const email =
            attrs?.find((a) => a.getName() === "email")?.getValue() ?? null;
          setUserEmail(email);
          setIsAuthenticated(true);
          setIsLoading(false);
        });
      },
    );
  }, []);

  // -------------------------------------------------------------------------
  // Login (SRP under the hood via amazon-cognito-identity-js)
  // -------------------------------------------------------------------------
  const login = (email: string, password: string) =>
    new Promise<"authenticated" | "new_password_required">(
      (resolve, reject) => {
        const cognitoUser = new CognitoUser({
          Username: email,
          Pool: UserPool,
        });

        const authDetails = new AuthenticationDetails({
          Username: email,
          Password: password,
        });

        cognitoUser.authenticateUser(authDetails, {
          onSuccess: (session) => {
            const resolvedEmail =
              session.getIdToken().payload["email"] ?? email;
            setUserEmail(resolvedEmail);
            setIsAuthenticated(true);
            setIsLoading(false);
            setNewPasswordRequired(false);
            pendingUserRef.current = null;
            resolve("authenticated");
          },

          onFailure: (err) => {
            reject(err);
          },

          // First login with a temporary password — user must set a new one
          newPasswordRequired: (_userAttributes, _requiredAttributes) => {
            pendingUserRef.current = cognitoUser;
            setNewPasswordRequired(true);
            setIsLoading(false);
            resolve("new_password_required");
          },
        });
      },
    );

  // -------------------------------------------------------------------------
  // Complete the new-password challenge (first login only)
  // -------------------------------------------------------------------------
  const completeNewPassword = (newPassword: string) =>
    new Promise<void>((resolve, reject) => {
      const pendingUser = pendingUserRef.current;
      if (!pendingUser) {
        reject(new Error("No pending authentication session"));
        return;
      }

      pendingUser.completeNewPasswordChallenge(
        newPassword,
        {}, // no additional attributes required
        {
          onSuccess: (session) => {
            const email =
              session.getIdToken().payload["email"] ?? userEmail ?? "";
            setUserEmail(email);
            setIsAuthenticated(true);
            setNewPasswordRequired(false);
            pendingUserRef.current = null;
            resolve();
          },
          onFailure: (err) => reject(err),
        },
      );
    });

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------
  const logout = () => {
    UserPool.getCurrentUser()?.signOut();
    setIsAuthenticated(false);
    setUserEmail(null);
    setNewPasswordRequired(false);
    pendingUserRef.current = null;
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        userEmail,
        newPasswordRequired,
        login,
        completeNewPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
