import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  UNAUTHORIZED_EVENT,
  getSession,
  loadStoredSession,
  login as apiLogin,
  logout as apiLogout,
  setSessionToken,
  storeSession,
} from "../api";

const AuthContext = createContext(null);

// Sign-in is checked by the database (PKG_SMARTBANK_API.AUTH_LOGIN): the
// password is verified against a salted PBKDF2 hash and Oracle issues a
// session token. Every API call sends that token, and Oracle enforces the
// role (customer / analyst) and the customer's data scope. The routes below
// only decide which pages to show; they are not the security boundary.
//
// API roles map to the app's route names: customer -> "user", analyst -> "admin".
function toAppUser(apiUser) {
  if (!apiUser) return null;
  const role = apiUser.role === "analyst" ? "admin" : apiUser.role === "customer" ? "user" : null;
  if (!role) return null;

  return {
    email: apiUser.email,
    role,
    name: apiUser.display_name,
    customerId: apiUser.customer_id ?? null,
  };
}

function initialSession() {
  const saved = loadStoredSession();
  const user = toAppUser(saved?.user);
  if (!saved || !user) return null;
  setSessionToken(saved.token);
  return { ...saved, appUser: user };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(initialSession);
  const [notice, setNotice] = useState("");

  const endSession = useCallback((message = "") => {
    setSessionToken(null);
    storeSession(null);
    setSession(null);
    setNotice(message);
  }, []);

  // A stored session is shown immediately (so refresh keeps the page), then
  // confirmed with the database; an expired or revoked one signs out.
  useEffect(() => {
    if (!session?.token) return undefined;
    let cancelled = false;

    getSession().catch((err) => {
      if (!cancelled && err.status === 401) {
        endSession("Your session has ended. Please sign in again.");
      }
    });

    return () => {
      cancelled = true;
    };
    // Only on first load: later 401s arrive through UNAUTHORIZED_EVENT.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onUnauthorized = () => endSession("Your session has ended. Please sign in again.");
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [endSession]);

  const login = useCallback(async (email, password) => {
    try {
      const result = await apiLogin(email.trim().toLowerCase(), password);
      const appUser = toAppUser(result?.user);

      if (!result?.token || !appUser) {
        return { success: false, message: "The server returned an unexpected sign-in response." };
      }

      const next = { token: result.token, expires_at: result.expires_at, user: result.user };
      setSessionToken(next.token);
      storeSession(next);
      setSession({ ...next, appUser });
      setNotice("");
      return { success: true, user: appUser };
    } catch (err) {
      return { success: false, message: err.message || "Sign-in failed." };
    }
  }, []);

  const logout = useCallback(() => {
    // Revoke the token in the database; sign out locally either way.
    if (session?.token) apiLogout().catch(() => {});
    endSession("");
  }, [session, endSession]);

  const value = useMemo(
    () => ({
      user: session?.appUser ?? null,
      isAuthenticated: Boolean(session?.appUser),
      expiresAt: session?.expires_at ?? null,
      notice,
      login,
      logout,
    }),
    [session, notice, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
