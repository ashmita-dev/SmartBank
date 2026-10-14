import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  ChevronRight,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShieldAlert,
  Users,
  Wallet,
  WalletCards,
  X,
} from "lucide-react";
import { API_BASE_URL, API_CONFIGURED, READ_ONLY, REQUIRED_ENDPOINTS, probeEndpoints } from "../api";
import { useAuth } from "../context/AuthContext";
import { loadCustomerProfile } from "../utils/customerData";

const NAVIGATION = {
  admin: [
    { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/admin/transactions", label: "Transactions", icon: WalletCards },
    { to: "/admin/alerts", label: "Fraud Alerts", icon: ShieldAlert },
    { to: "/admin/analysts", label: "Analyst Workload", icon: Users },
    { to: "/admin/settings", label: "System & Settings", icon: Settings },
  ],
  user: [
    { to: "/user", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/user/accounts", label: "My Accounts", icon: Wallet },
    { to: "/user/transactions", label: "Transactions", icon: WalletCards },
    { to: "/user/transfer", label: "New Transfer", icon: ArrowLeftRight },
    { to: "/user/settings", label: "Profile", icon: Settings },
  ],
};

const API_CHECK_INTERVAL_MS = 60000;

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [health, setHealth] = useState({ status: "checking", failed: [] });
  const [profileName, setProfileName] = useState(null);

  const role = user?.role === "admin" ? "admin" : "user";
  const items = NAVIGATION[role];
  const current =
    [...items].reverse().find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    ) || items[0];

  // Health = every endpoint this portal depends on, not just one ping.
  const probe = useCallback(
    () =>
      probeEndpoints(REQUIRED_ENDPOINTS[role], { customerId: user?.customerId }).then((results) => {
        const failed = results.filter((r) => !r.ok);
        // No answer at all, or a gateway/ORDS reporting the backend down
        // (502/503/504/571) for every endpoint, means offline, not degraded.
        const unreachable =
          failed.length === results.length && failed.every((r) => [0, 502, 503, 504, 571].includes(r.status));
        return {
          status: failed.length === 0 ? "online" : unreachable ? "offline" : "degraded",
          failed,
        };
      }),
    [role, user?.customerId]
  );

  const checkApi = useCallback(() => {
    setHealth((h) => ({ ...h, status: "checking" }));
    probe().then(setHealth);
  }, [probe]);

  useEffect(() => {
    let cancelled = false;
    const update = (result) => {
      if (!cancelled) setHealth(result);
    };

    probe().then(update);
    const timer = setInterval(() => probe().then(update), API_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [probe]);

  // Customer display name comes from the CUSTOMER table, not the login.
  useEffect(() => {
    if (role !== "user" || !user?.customerId) return undefined;
    let cancelled = false;

    loadCustomerProfile(user.customerId)
      .then((profile) => {
        if (!cancelled) setProfileName(profile.customer_name);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [role, user?.customerId]);

  useEffect(() => {
    document.title = `${current.label} | SmartBank`;
  }, [current.label]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") setSidebarOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const apiStatus = health.status;
  const failedNames = health.failed.map((f) => f.path).join(", ");
  const statusLabel = {
    checking: "Checking API…",
    online: "API online",
    degraded: "API degraded",
    offline: "API offline",
  }[apiStatus];
  const displayName = role === "user" ? profileName || user?.email : user?.name;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      {sidebarOpen && (
        <button
          type="button"
          className="mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={sidebarOpen ? "sidebar open" : "sidebar"} aria-label="Main navigation">
        <div className="brand">
          <div className="brand-icon">
            <Shield size={24} />
          </div>

          <div>
            <strong>SmartBank</strong>
            <span>{role === "admin" ? "FRAUD INTELLIGENCE" : "CUSTOMER PORTAL"}</span>
          </div>

          <button
            type="button"
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-section-label">
          {role === "admin" ? "FRAUD OPERATIONS" : "MY BANKING"}
        </div>

        <nav className="navigation">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className={`system-status ${apiStatus}`}
            onClick={checkApi}
            title={`API: ${API_BASE_URL || "not configured"}${failedNames ? ` · Unavailable: ${failedNames}` : ""} · click to re-check`}
          >
            <span className="status-dot" />
            <div>
              <strong>{statusLabel}</strong>
              <span>
                {apiStatus === "offline"
                  ? !API_CONFIGURED
                    ? "No backend configured"
                    : READ_ONLY
                    ? "Host computer is offline"
                    : "Start Oracle XE + ORDS"
                  : apiStatus === "degraded"
                  ? `Unavailable: ${failedNames}`
                  : READ_ONLY
                  ? "Oracle 21c XE · read-only demo"
                  : "Oracle 21c XE · ORDS"}
              </span>
            </div>
          </button>

          <div className="database-card">
            <Database size={19} />
            <div>
              <strong>SMARTBANK_USER</strong>
              <span>Oracle Database 21c XE</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>

            <div className="breadcrumb">
              <span>{role === "admin" ? "Analyst Console" : "Customer Portal"}</span>
              <ChevronRight size={14} />
              <strong>{current.label}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <div className={`live-status ${apiStatus}`} aria-live="polite">
              <span className="live-dot" />
              {{ online: "LIVE", degraded: "DEGRADED", offline: "OFFLINE" }[apiStatus] || "…"}
            </div>

            <div className="profile">
              <div className="profile-avatar" aria-hidden="true">
                {(displayName || "SB")
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div className="profile-text">
                <strong>{displayName || "…"}</strong>
                <span>{role === "admin" ? "Operations team" : "Personal banking"}</span>
              </div>

              <button
                type="button"
                className="logout-button"
                onClick={handleLogout}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </header>

        <div className="page-content" id="main-content" tabIndex={-1}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AppLayout;
