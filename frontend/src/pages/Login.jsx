import { useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Shield, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../App.css";

function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    navigate(user.role === "admin" ? "/admin" : "/user", {
      replace: true,
    });
  }, [isAuthenticated, user, navigate]);

  function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoggingIn(true);

    setTimeout(() => {
      const result = login(email, password);

      if (!result.success) {
        setError(result.message);
        setLoggingIn(false);
        return;
      }

      navigate(result.user.role === "admin" ? "/admin" : "/user", {
        replace: true,
      });

      setLoggingIn(false);
    }, 450);
  }

  function fillDemoAccount(role) {
    if (role === "admin") {
      setEmail("admin@smartbank.com");
      setPassword("admin123");
    } else {
      setEmail("user@smartbank.com");
      setPassword("user123");
    }

    setError("");
  }

  return (
    <div className="login-page">
      <div className="login-background-grid" />

      <div className="login-glow login-glow-one" />
      <div className="login-glow login-glow-two" />

      <div className="login-container">
        <div className="login-brand">
          <div className="login-brand-icon">
            <Shield size={28} />
          </div>

          <div>
            <strong>SmartBank</strong>
            <span>FRAUD INTELLIGENCE</span>
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-header">
            <div className="login-security-icon">
              <LockKeyhole size={22} />
            </div>

            <div className="login-eyebrow">
              <Sparkles size={14} />
              SECURE ACCESS
            </div>

            <h1>Welcome back</h1>

            <p>
              Sign in to access the SmartBank fraud monitoring platform.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="email">Email address</label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>

              <div className="password-input">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loggingIn}
            >
              {loggingIn ? "Authenticating..." : "Sign in securely"}
            </button>
          </form>

          <div className="demo-section">
            <div className="demo-heading">
              <span>DEMO ACCESS</span>
              <span>For project presentation</span>
            </div>

            <div className="demo-buttons">
              <button
                type="button"
                className="demo-button"
                onClick={() => fillDemoAccount("user")}
              >
                <div>
                  <strong>Customer</strong>
                  <span>user@smartbank.com</span>
                </div>
              </button>

              <button
                type="button"
                className="demo-button"
                onClick={() => fillDemoAccount("admin")}
              >
                <div>
                  <strong>Fraud Analyst</strong>
                  <span>admin@smartbank.com</span>
                </div>
              </button>
            </div>
          </div>

          <div className="login-security-note">
            <Shield size={16} />
            <span>
              Protected by SmartBank's transaction monitoring and fraud
              detection engine.
            </span>
          </div>
        </div>

        <div className="login-footer">
          SmartBank • Oracle 21c XE • PL/SQL Fraud Intelligence
        </div>
      </div>
    </div>
  );
}

export default Login;