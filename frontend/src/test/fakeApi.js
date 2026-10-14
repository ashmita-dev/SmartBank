import { vi } from "vitest";

// A small stand-in for the SmartBank REST API, answering by method + path.
// Shapes match PKG_SMARTBANK_API's JSON. Used only by the unit tests.
export const TOKEN = "0123456789abcdef".repeat(4);

export const customerSession = {
  token: TOKEN,
  expires_at: "2099-01-01T00:00:00Z",
  user: { email: "user@smartbank.com", display_name: "Demo customer", role: "customer", customer_id: 1 },
};

export const fixtures = {
  customer: { customer_id: 1, customer_name: "Ashmita Mazumdar", home_city: "Mumbai", home_state: "Maharashtra" },
  accounts: [
    { account_id: 1, account_number: "AC1000001", customer_id: 1, account_type: "SAVINGS", balance: 45000, status: "ACTIVE", home_city: "Mumbai" },
  ],
  merchants: [
    { merchant_id: 1, merchant_name: "Reliance Fresh", category: "Groceries", risk_level: "LOW" },
    { merchant_id: 5, merchant_name: "QuickCash Loans", category: "Finance", risk_level: "HIGH" },
  ],
  devices: [
    { device_id: 1, device_type: "MOBILE", device_identifier: "DEV-AND-0001", customer_usage: 3 },
    { device_id: 3, device_type: "DESKTOP", device_identifier: "DEV-WIN-0003", customer_usage: 0 },
  ],
  transactions: [
    {
      transaction_id: 1, account_id: 1, account_number: "AC1000001", customer_id: 1, customer_name: "Ashmita Mazumdar",
      amount: 1200, transaction_type: "DEBIT", transaction_time: "2026-09-07T08:39:46Z", location: "Mumbai",
      transaction_status: "COMPLETED", merchant_name: "Reliance Fresh", merchant_category: "Groceries",
      device_type: "MOBILE", device_identifier: "DEV-AND-0001",
    },
  ],
  alerts: [],
};

function json(status, body) {
  return Promise.resolve(
    new Response(body === undefined ? "" : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

// routes: { "POST /transactions": (body, url) => [status, json] , ... }
export function installFakeApi(routes = {}) {
  const calls = [];
  const defaults = {
    "GET /health": () => [200, { status: "ok", fraud_engine: "VALID" }],
    "GET /auth/session": () => [200, customerSession],
    "POST /auth/logout": () => [200, { signed_out: true }],
    "GET /transactions": () => [200, { items: fixtures.transactions }],
    "GET /alerts": () => [200, { items: fixtures.alerts }],
    "GET /accounts": () => [200, { items: fixtures.accounts }],
    "GET /merchants": () => [200, { items: fixtures.merchants }],
    "GET /devices": () => [200, { items: fixtures.devices }],
    "GET /customers/:id": () => [200, fixtures.customer],
  };

  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, options = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^.*\/ords\/sb\/api/, "").replace(/\/\d+$/, "/:id");
    const method = options.method || "GET";
    const key = `${method} ${path}`;
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ key, body, headers: options.headers || {} });
    const handler = routes[key] || defaults[key];
    if (!handler) return json(404, { error: `No fake route for ${key}` });
    const [status, payload] = handler(body, url);
    return json(status, payload);
  });

  return { calls, fetchMock };
}

export function storeCustomerSession() {
  localStorage.setItem("smartbank_session", JSON.stringify(customerSession));
}
