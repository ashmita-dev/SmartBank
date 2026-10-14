import { useEffect, useRef, useState } from "react";
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
import { API_CONFIGURED } from "../api";
import { useAuth } from "../context/AuthContext";
import "../App.css";

function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user, notice } = useAuth();
  const passwordRef = useRef(null);

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

  // Demo identities are public; their passwords are not in this bundle.
  // They are checked by the database (see README, "Demonstration login").
  function fillDemoAccount() {
    setEmail(role === "admin" ? "admin@smartbank.com" : "user@smartbank.com");
    setError("");
    passwordRef.current?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loggingIn) return;
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoggingIn(true);
    const result = await login(email, password);
    setLoggingIn(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    // The account's role comes from the database; open the matching portal
    // and say so if the other tab was selected.
    navigate(result.user.role === "admin" ? "/admin" : "/user", { replace: true });
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
            Oracle Database • PL/SQL • ORDS • React
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

          {!API_CONFIGURED && (
            <div className="login-error" role="alert">
              <ShieldAlert size={14} />
              <span>
                This copy of SmartBank was built without an API address, so sign-in is unavailable.
              </span>
            </div>
          )}

          {notice && !error && (
            <div className="login-error" role="status">
              <ShieldAlert size={14} />
              <span>{notice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form" noValidate>
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
                  required
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
                  ref={passwordRef}
                  required
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
              <div className="login-error" role="alert">
                <ShieldAlert size={14} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className={`login-submit ${isAnalyst ? "analyst-submit" : ""}`}
              disabled={loggingIn || !API_CONFIGURED}
            >
              {loggingIn ? (
                "Checking with Oracle…"
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
              <span>Fills in the demo email for this role. Enter the demo password provided with the project.</span>
            </div>

            <button
              type="button"
              className="login-demo-button"
              onClick={fillDemoAccount}
            >
              Use demo account
            </button>
          </div>

          <div className="login-security-note">
            <Shield size={13} />
            <span>
              Academic demonstration with synthetic data. Sign-in is verified by
              the Oracle database, which also enforces each role&apos;s access.
            </span>
          </div>
        </section>
      </div>

      <div className="login-footer">
        SmartBank • Secure banking intelligence • Built with Oracle Database + PL/SQL
      </div>
    </div>
  );
}

export default Login;
