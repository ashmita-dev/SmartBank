// Base URL of the REST API. Set VITE_API_BASE_URL at build time (see
// frontend/.env.example). Never put credentials in VITE_ variables: they are
// bundled into the public JavaScript.
//
// Every endpoint except GET /health and POST /auth/login needs a session
// token issued by the database (PKG_SMARTBANK_API). It is sent in the
// X-Session-Token header; roles and customer scoping are enforced in Oracle.
//
// Without it, the local ORDS URL is used only when the page itself is served
// from this computer (npm run dev / preview). A hosted copy never falls back
// to localhost; it reports that no backend is configured instead.
const LOCAL_ORDS_URL = "http://localhost:8080/ords/smartbank/sb/api";
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];
const servedLocally = typeof window !== "undefined" && LOCAL_HOSTS.includes(window.location.hostname);

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || (servedLocally ? LOCAL_ORDS_URL : "")
).replace(/\/+$/, "");

export const API_CONFIGURED = Boolean(API_BASE_URL);

// Which Oracle database this build talks to, for labels only (from the URL).
export const DATABASE_LABEL = /\.oraclecloudapps\.com/i.test(API_BASE_URL)
  ? "Oracle Autonomous Database (OCI)"
  : /localhost|127\.0\.0\.1/.test(API_BASE_URL)
    ? "Oracle Database 21c XE (local)"
    : "Oracle Database";

// Optional read-only build (VITE_READ_ONLY=true): the UI disables the
// transfer and alert-status actions and the client refuses non-GET requests.
export const READ_ONLY = import.meta.env.VITE_READ_ONLY === "true";

export const READ_ONLY_MESSAGE =
  "This copy of SmartBank was built read-only. Creating transactions and changing alert status are disabled.";

// ---- Session token -------------------------------------------------------
// Kept in localStorage so a page refresh stays signed in; the database
// decides whether it is still valid (8-hour expiry, revoked on sign-out).
const SESSION_KEY = "smartbank_session";
let sessionToken = null;

export function setSessionToken(token) {
  sessionToken = token || null;
}

export function loadStoredSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!saved?.token || !saved?.user) return null;
    if (saved.expires_at && new Date(saved.expires_at).getTime() <= Date.now()) return null;
    return saved;
  } catch {
    return null;
  }
}

export function storeSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("smartbank_user"); // pre-authentication builds
  } catch {
    // Storage unavailable (private mode): the session lasts until reload.
  }
}

// Fired when the API answers 401 to a signed-in request (expired or revoked
// session); AuthContext listens and returns the user to the login page.
export const UNAUTHORIZED_EVENT = "smartbank:unauthorized";

// ORDS paginates collection feeds (25-50 rows by default). Ask for enough
// rows that client-side search and filtering see the whole demo dataset.
const COLLECTION_LIMIT = 1000;

// A request that takes longer than this is abandoned with a clear message,
// so a hung ORDS/database connection never leaves a page spinning forever.
const REQUEST_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function buildQuery(params) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });

  const text = query.toString();
  return text ? `?${text}` : "";
}

async function readBody(response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function routeName(endpoint) {
  // "/alerts/81?x=1" -> "GET /alerts/:id"; keeps messages readable.
  const path = endpoint.split("?")[0].replace(/\/\d+(?=\/|$)/g, "/:id");
  return path;
}

function errorMessage(body, status, endpoint, method) {
  // Messages written by our own PL/SQL handlers ({"error": "..."}).
  if (body && typeof body === "object" && body.error) {
    return body.error;
  }

  if (status === 404) {
    return `The ${method} ${routeName(endpoint)} endpoint is not published in ORDS. ` +
      "Install the latest API (docs/SETUP.md), then press Retry.";
  }

  if (status === 401) {
    return "Your session has ended. Please sign in again.";
  }

  if (status === 429) {
    return "The database is busy or a demo limit was reached. Please wait a moment and try again.";
  }

  if (status === 571 || status === 502 || status === 503 || status === 504) {
    return "The SmartBank API is reachable but cannot get a database connection right now. Please retry in a minute.";
  }

  const detail = body && typeof body === "object" ? body.message || body.title : "";
  return `${method} ${routeName(endpoint)} failed (HTTP ${status})${detail ? `: ${detail}` : ""}.`;
}

async function request(endpoint, options = {}) {
  const { signal, timeoutMs = REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
  const method = fetchOptions.method || "GET";

  if (!API_CONFIGURED) {
    throw new ApiError(
      "This hosted copy of SmartBank is not connected to a backend (VITE_API_BASE_URL was not set when it was built). See the README for how to run it with the Oracle database.",
      0
    );
  }

  if (READ_ONLY && method !== "GET" && !endpoint.startsWith("/auth/")) {
    throw new ApiError(READ_ONLY_MESSAGE, 405);
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
        ...(sessionToken ? { "X-Session-Token": sessionToken } : {}),
        ...(fetchOptions.headers || {}),
      },
    });
  } catch (err) {
    if (timedOut) {
      throw new ApiError(
        `${method} ${routeName(endpoint)} did not answer within ${timeoutMs / 1000} s. ` +
          "The database may be starting up or busy; please retry.",
        0
      );
    }
    if (signal?.aborted) throw err; // cancelled by the caller; not an API failure
    throw new ApiError(
      `Cannot reach the SmartBank API at ${API_BASE_URL}. Check your connection, or the backend may be offline.`,
      0
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  const body = await readBody(response);

  if (!response.ok) {
    if (response.status === 401 && sessionToken && !endpoint.startsWith("/auth/login")) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(errorMessage(body, response.status, endpoint, method), response.status);
  }

  return body;
}

function items(body, endpoint) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object" && Array.isArray(body.items)) return body.items;
  // Anything else (HTML error page, proxy text, wrong handler) is not data.
  throw new ApiError(`GET ${routeName(endpoint)} returned an unexpected response format (expected a JSON list).`, 200);
}

async function collection(endpoint, params = {}, options = {}) {
  return items(await request(`${endpoint}${buildQuery({ ...params, limit: COLLECTION_LIMIT })}`, options), endpoint);
}

export function getHealth() {
  return request("/health", { timeoutMs: 10000 });
}

export function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getSession() {
  return request("/auth/session");
}

export function logout() {
  return request("/auth/logout", { method: "POST", body: "{}", timeoutMs: 5000 });
}

export function getKPIs() {
  return request("/kpis");
}

export function getTransactions(search = "") {
  return collection("/transactions", { search });
}

export function getAlerts(riskLevel = "") {
  return collection("/alerts", { risk_level: riskLevel });
}

export function getAlertById(id) {
  return request(`/alerts/${encodeURIComponent(id)}`);
}

export function updateAlert(id, status) {
  return request(`/alerts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export function getRiskDistribution() {
  return collection("/risk-distribution");
}

export function getDailyAnalytics() {
  return collection("/daily-analytics");
}

export function getAnalystWorkload() {
  return collection("/analysts/workload");
}

export function getAccounts(customerId) {
  return collection("/accounts", { customer_id: customerId });
}

export function getMerchants() {
  return collection("/merchants");
}

export function getDevices(customerId) {
  return collection("/devices", { customer_id: customerId });
}

export function getCustomer(customerId) {
  return request(`/customers/${encodeURIComponent(customerId)}`);
}

export function createTransaction(transaction) {
  return request("/transactions", {
    method: "POST",
    body: JSON.stringify(transaction),
  });
}

// Read-only endpoints each portal depends on. Used by the health indicator;
// collections are probed with limit=1 to keep the check cheap.
export const REQUIRED_ENDPOINTS = {
  admin: ["/kpis", "/transactions", "/alerts", "/risk-distribution", "/daily-analytics", "/analysts/workload"],
  user: ["/transactions", "/alerts", "/accounts", "/merchants", "/devices", "/customers/:id"],
};

// Resolves to [{ path, ok, status, message }]. Never throws.
export async function probeEndpoints(paths, { customerId } = {}) {
  return Promise.all(
    paths.map(async (path) => {
      const url = path.includes(":id")
        ? path.replace(":id", encodeURIComponent(customerId ?? 1))
        : `${path}?limit=1${path === "/accounts" || path === "/devices" ? `&customer_id=${customerId ?? 1}` : ""}`;

      try {
        await request(url, { timeoutMs: 8000 });
        return { path, ok: true, status: 200 };
      } catch (err) {
        return { path, ok: false, status: err.status ?? 0, message: err.message };
      }
    })
  );
}
