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
import { API_BASE_URL, getKPIs } from "../api";
import { useAuth } from "../context/AuthContext";

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
  const [apiStatus, setApiStatus] = useState("checking");

  const role = user?.role === "admin" ? "admin" : "user";
  const items = NAVIGATION[role];
  const current =
    [...items].reverse().find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    ) || items[0];

  const pingApi = useCallback(
    () =>
      getKPIs().then(
        () => "online",
        () => "offline"
      ),
    []
  );

  const checkApi = useCallback(() => {
    setApiStatus("checking");
    pingApi().then(setApiStatus);
  }, [pingApi]);

  useEffect(() => {
    let cancelled = false;
    const update = (status) => {
      if (!cancelled) setApiStatus(status);
    };

    pingApi().then(update);
    const timer = setInterval(() => pingApi().then(update), API_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pingApi]);

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

  const statusLabel = {
    checking: "Checking API…",
    online: "API online",
    offline: "API offline",
  }[apiStatus];

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
            title={`ORDS endpoint: ${API_BASE_URL} (click to re-check)`}
          >
            <span className="status-dot" />
            <div>
              <strong>{statusLabel}</strong>
              <span>
                {apiStatus === "offline"
                  ? "Start Oracle XE + ORDS"
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
              {apiStatus === "online" ? "LIVE" : apiStatus === "offline" ? "OFFLINE" : "…"}
            </div>

            <div className="profile">
              <div className="profile-avatar" aria-hidden="true">
                {(user?.name || "SB")
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div className="profile-text">
                <strong>{user?.name}</strong>
                <span>{role === "admin" ? "Operations team" : `Customer #${user?.customerId}`}</span>
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
