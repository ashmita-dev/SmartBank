import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

// Demonstration accounts only. Authentication happens in the browser and is
// NOT secure: the ORDS API itself is unauthenticated. The customer login is
// linked to CUSTOMER_ID 1 in the seed data so the portal shows that
// customer's real accounts and transactions.
const DEMO_USERS = {
  "user@smartbank.com": {
    email: "user@smartbank.com",
    password: "user123",
    role: "user",
    name: "Aarav Sharma",
    customerId: 1,
  },
  "admin@smartbank.com": {
    email: "admin@smartbank.com",
    password: "admin123",
    role: "admin",
    name: "Fraud Analyst",
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem("smartbank_user"));
      const account = DEMO_USERS[savedUser?.email];

      if (!account) return null;

      // Rebuild from the demo table so older saved sessions pick up new fields.
      return {
        email: account.email,
        role: account.role,
        name: account.name,
        customerId: account.customerId ?? null,
      };
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem("smartbank_user", JSON.stringify(user));
      } else {
        localStorage.removeItem("smartbank_user");
      }
    } catch {
      // Storage unavailable (private mode); the session lasts until reload.
    }
  }, [user]);

  function login(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    const account = DEMO_USERS[normalizedEmail];

    if (!account || account.password !== password) {
      return {
        success: false,
        message: "Invalid email or password.",
      };
    }

    const authenticatedUser = {
      email: account.email,
      role: account.role,
      name: account.name,
      customerId: account.customerId ?? null,
    };

    setUser(authenticatedUser);

    return {
      success: true,
      user: authenticatedUser,
    };
  }

  function logout() {
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}