// Base URL of the REST API. Set VITE_API_BASE_URL at build time (see
// frontend/.env.example). Never put credentials in VITE_ variables: they are
// bundled into the public JavaScript.
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

// Public read-only demo (VITE_READ_ONLY=true): the gateway refuses writes, and
// the UI disables the transfer and alert-status actions up front.
export const READ_ONLY = import.meta.env.VITE_READ_ONLY === "true";

export const READ_ONLY_MESSAGE =
  "This public demo is read-only. Creating transactions and changing alert status work only in the local installation, where the request goes straight to Oracle.";

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
    return `The ${method} ${routeName(endpoint)} endpoint is not published in ORDS yet. ` +
      "Run scripts\\register-endpoints.ps1 to register the latest API, then press Retry.";
  }

  if (status === 571 || status === 503) {
    return "ORDS is running but cannot connect to the Oracle database. Check the listener and the ORDS pool (scripts\\start-backend.ps1).";
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

  if (READ_ONLY && method !== "GET") {
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
        ...(fetchOptions.headers || {}),
      },
    });
  } catch (err) {
    if (timedOut) {
      throw new ApiError(
        `${method} ${routeName(endpoint)} did not answer within ${timeoutMs / 1000} s. ` +
          "ORDS may be waiting on the database; check scripts\\start-backend.ps1.",
        0
      );
    }
    if (signal?.aborted) throw err; // cancelled by the caller; not an API failure
    throw new ApiError(
      `Cannot reach the SmartBank API at ${API_BASE_URL}. Check that Oracle XE and ORDS are running.`,
      0
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  const body = await readBody(response);

  if (!response.ok) {
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
