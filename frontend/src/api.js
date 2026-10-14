// Base URL of the ORDS REST module. Override with VITE_API_BASE_URL in
// frontend/.env.local. Never put credentials in VITE_ variables: they are
// bundled into the public JavaScript.
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8080/ords/smartbank/sb/api"
).replace(/\/+$/, "");

// ORDS paginates collection feeds (25-50 rows by default). Ask for enough
// rows that client-side search and filtering see the whole demo dataset.
const COLLECTION_LIMIT = 1000;

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

function errorMessage(body, status) {
  if (body && typeof body === "object") {
    return body.error || body.message || body.title || `Request failed (HTTP ${status})`;
  }

  if (status === 404) {
    return "Endpoint not found (HTTP 404). Re-run database/ords_endpoints.sql to publish the latest API.";
  }

  return `Request failed (HTTP ${status})`;
}

async function request(endpoint, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiError(
      `Cannot reach the SmartBank API at ${API_BASE_URL}. Check that Oracle XE and ORDS are running.`,
      0
    );
  }

  const body = await readBody(response);

  if (!response.ok) {
    throw new ApiError(errorMessage(body, response.status), response.status);
  }

  return body;
}

function items(body) {
  if (Array.isArray(body)) return body;
  return body?.items || [];
}

async function collection(endpoint, params = {}) {
  return items(await request(`${endpoint}${buildQuery({ ...params, limit: COLLECTION_LIMIT })}`));
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

export function createTransaction(transaction) {
  return request("/transactions", {
    method: "POST",
    body: JSON.stringify(transaction),
  });
}
