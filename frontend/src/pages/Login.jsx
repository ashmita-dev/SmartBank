import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../App.css";

function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  const [role, setRole] = useState("user");
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

  function switchRole(nextRole) {
    setRole(nextRole);
    setEmail("");
    setPassword("");
    setError("");
    setShowPassword(false);
  }

  function fillDemoAccount() {
    if (role === "admin") {
      setEmail("admin@smartbank.com");
      setPassword("admin123");
    } else {
      setEmail("user@smartbank.com");
      setPassword("user123");
    }

    setError("");
  }

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

      const expectedRole = role === "admin" ? "admin" : "user";

      if (result.user.role !== expectedRole) {
        setError(
          role === "admin"
            ? "This account does not have analyst access."
            : "This account does not have customer access."
        );
        setLoggingIn(false);
        return;
      }

      navigate(result.user.role === "admin" ? "/admin" : "/user", {
        replace: true,
      });

      setLoggingIn(false);
    }, 450);
  }

  const isAnalyst = role === "admin";

  return (
    <div className="login-page">
      <div className="login-background-grid" />
      <div className="login-glow login-glow-one" />
      <div className="login-glow login-glow-two" />

      <div className="login-shell">
        <section className="login-brand-panel">
          <div className="login-brand">
            <div className="login-brand-icon">
              <Shield size={25} />
            </div>

            <div>
              <strong>SmartBank</strong>
              <span>FRAUD INTELLIGENCE</span>
            </div>
          </div>

          <div className="login-hero">
            <div className="login-eyebrow">
              <Sparkles size={13} />
              INTELLIGENT BANKING SECURITY
            </div>

            <h1>
              Banking built for <span>trust.</span>
            </h1>

            <p>
              A real-time fraud intelligence platform that monitors banking
              activity, detects suspicious transactions and gives analysts the
              context they need to investigate risk.
            </p>

            <div className="login-feature-list">
              <div className="login-feature">
                <ShieldCheck size={16} />
                <span>Continuous transaction monitoring</span>
              </div>

              <div className="login-feature">
                <Activity size={16} />
                <span>PL/SQL-powered risk detection</span>
              </div>

              <div className="login-feature">
                <Fingerprint size={16} />
                <span>Device, location and amount intelligence</span>
              </div>
            </div>
          </div>

          <div className="login-security-visual" aria-hidden="true">
            <div className="login-orbit" />
            <div className="login-security-core">
              {isAnalyst ? <ShieldAlert size={38} /> : <ShieldCheck size={38} />}
            </div>
          </div>

          <div className="login-brand-footer">
            SmartBank Fraud Intelligence
            <br />
            Oracle 21c XE • PL/SQL • ORDS • React
          </div>
        </section>

        <section className="login-form-panel">
          <div className="login-form-header">
            <div className="section-label">
              <LockKeyhole size={13} />
              SECURE ACCESS
            </div>

            <h2>{isAnalyst ? "Analyst Console" : "Customer Portal"}</h2>

            <p>
              {isAnalyst
                ? "Authorized fraud analysts can monitor alerts and investigate suspicious activity."
                : "Access your SmartBank account and securely manage your banking activity."}
            </p>
          </div>

          <div className="login-role-switcher">
            <button
              type="button"
              className={`login-role-button ${role === "user" ? "active" : ""}`}
              onClick={() => switchRole("user")}
            >
              <UserRound size={18} />
              <div>
                <strong>Customer</strong>
                <span>Personal banking access</span>
              </div>
            </button>

            <button
              type="button"
              className={`login-role-button analyst ${role === "admin" ? "active" : ""}`}
              onClick={() => switchRole("admin")}
            >
              <ShieldAlert size={18} />
              <div>
                <strong>Fraud Analyst</strong>
                <span>Security operations access</span>
              </div>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="email">
                {isAnalyst ? "Analyst email" : "Customer email"}
              </label>

              <div className="login-input-wrapper">
                <UserRound size={16} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={
                    isAnalyst
                      ? "analyst@smartbank.com"
                      : "customer@smartbank.com"
                  }
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>

              <div className="login-input-wrapper">
                <LockKeyhole size={16} />
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
                  className="login-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                <ShieldAlert size={14} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className={`login-submit ${isAnalyst ? "analyst-submit" : ""}`}
              disabled={loggingIn}
            >
              {loggingIn ? (
                "Authenticating..."
              ) : (
                <>
                  {isAnalyst ? "Enter Analyst Console" : "Sign in to SmartBank"}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="login-demo">
            <div className="login-demo-copy">
              <strong>PROJECT DEMO ACCESS</strong>
              <span>Use the presentation account for this role.</span>
            </div>

            <button
              type="button"
              className="login-demo-button"
              onClick={fillDemoAccount}
            >
              Use demo credentials
            </button>
          </div>

          <div className="login-security-note">
            <Shield size={13} />
            <span>
              Academic demonstration: sign-in is checked in the browser with
              demo accounts. Banking data is served live from Oracle via ORDS.
            </span>
          </div>
        </section>
      </div>

      <div className="login-footer">
        SmartBank • Secure banking intelligence • Built with Oracle 21c XE + PL/SQL
      </div>
    </div>
  );
}

export default Login;
