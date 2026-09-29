import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

const DEMO_USERS = {
  "user@smartbank.com": {
    email: "user@smartbank.com",
    password: "user123",
    role: "user",
    name: "SmartBank Customer",
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
      const savedUser = localStorage.getItem("smartbank_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("smartbank_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("smartbank_user");
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

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}