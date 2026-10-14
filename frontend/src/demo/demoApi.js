// DEMO MODE ONLY: an in-browser stand-in for the SmartBank REST API, used by
// the public GitHub Pages build when no Oracle backend is reachable.
//
// It answers the same endpoints with the same JSON shapes, roles and customer
// scoping as PKG_SMARTBANK_API, but NOTHING here touches Oracle: the data is
// the synthetic seed (03_seed_data.sql) replayed through a JavaScript copy of
// the fraud rules (fraudEngine.js), and changes are kept in this browser's
// localStorage only. Every created transaction is marked "simulated": true.
import seed from "./seedData.json";
import { classifyRisk, calculateRisk, detectFraud } from "./fraudEngine";

const STORAGE_KEY = "smartbank_demo_state_v1";
const MAX_AMOUNT = 10000000;
const TXN_TYPES = ["DEBIT", "CREDIT", "TRANSFER", "WITHDRAWAL", "DEPOSIT"];
const ALERT_STATUSES = ["OPEN", "INVESTIGATING", "CONFIRMED_FRAUD", "FALSE_POSITIVE", "CLOSED"];
const IST_OFFSET_MS = 330 * 60 * 1000;

// Demo identities: same emails as the real deployment. In demo mode there is
// nothing to protect (all data lives in the visitor's own browser), so the
// password is not checked; the login page says so.
const DEMO_USERS = {
  "user@smartbank.com": { email: "user@smartbank.com", display_name: "Demo customer", role: "customer", customer_id: 1 },
  "admin@smartbank.com": { email: "admin@smartbank.com", display_name: "Fraud Analyst", role: "analyst", customer_id: null },
};

const T = seed.tables;
const reference = {
  accounts: T.account,
  addresses: T.customer_address,
};

class DemoError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const iso = (ms) => (ms == null ? null : new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z"));
const byId = (rows, key) => new Map(rows.map((r) => [r[key], r]));
const customers = byId(T.customer, "customer_id");
const accounts = byId(T.account, "account_id");
const merchants = byId(T.merchant, "merchant_id");
const devices = byId(T.device, "device_id");
const analysts = byId(T.fraud_analyst, "analyst_id");
const fullName = (c) => (c ? `${c.first_name} ${c.last_name}` : null);
const homeCity = (customerId) =>
  T.customer_address.filter((a) => a.customer_id === customerId).map((a) => a.city).sort()[0] ?? null;

// ---- State -----------------------------------------------------------------
// Replays the seed in insert order, exactly as TRG_FRAUD_MONITOR does when the
// Oracle install script loads BANK_TRANSACTION.
export function buildInitialState() {
  const transactions = [];
  const alerts = [];

  for (const row of T.bank_transaction) {
    const txn = { ...row, time_ms: row.transaction_time };
    delete txn.transaction_time;
    transactions.push(txn);
    const result = detectFraud(txn, { transactions, ...reference }, {
      analysts: T.fraud_analyst, alerts, nextAlertId: alerts.length + 1, createdAtMs: txn.time_ms,
    });
    if (result.alert) alerts.push(result.alert);
    txn.status = result.status;
  }

  return { version: 1, transactions, alerts, sessions: {} };
}

let state = null;

function load() {
  if (state) return state;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 1 && Array.isArray(saved.transactions)) state = saved;
  } catch {
    // ignore unreadable storage
  }
  state ||= buildInitialState();
  return state;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: the simulation lasts until the page is closed.
  }
}

// Discards simulated transactions and alert changes; keeps the visitor signed in.
export function resetDemoState() {
  const sessions = load().sessions;
  state = { ...buildInitialState(), sessions };
  save();
}

export function demoSummary() {
  const s = load();
  return { simulatedTransactions: s.transactions.filter((t) => t.simulated).length };
}

// ---- Row shapes (match PKG_SMARTBANK_API) -----------------------------------
function txnRow(t) {
  const a = accounts.get(t.account_id);
  const c = customers.get(a?.customer_id);
  const m = merchants.get(t.merchant_id);
  const d = devices.get(t.device_id);
  return {
    transaction_id: t.transaction_id, account_id: t.account_id, account_number: a?.account_number,
    customer_id: c?.customer_id, customer_name: fullName(c), amount: t.amount,
    transaction_type: t.transaction_type, transaction_time: iso(t.time_ms), location: t.location,
    transaction_status: t.status, merchant_name: m?.merchant_name ?? null, merchant_category: m?.category ?? null,
    device_type: d?.device_type ?? null, device_identifier: d?.device_identifier ?? null,
    simulated: Boolean(t.simulated),
  };
}

function alertRow(al, detail = false) {
  const t = load().transactions.find((x) => x.transaction_id === al.transaction_id);
  const base = txnRow(t);
  const an = analysts.get(al.analyst_id);
  const row = {
    alert_id: al.alert_id, transaction_id: al.transaction_id, analyst_id: al.analyst_id,
    analyst_name: an?.name ?? null, risk_score: al.risk_score, risk_level: al.risk_level,
    reason: al.reason, status: al.status, created_at: iso(al.created_ms), amount: t.amount,
    transaction_type: t.transaction_type, location: t.location, transaction_time: iso(t.time_ms),
    customer_id: base.customer_id, customer_name: base.customer_name, account_number: base.account_number,
    simulated: Boolean(t.simulated),
  };
  if (detail) {
    Object.assign(row, {
      analyst_department: an?.department ?? null, account_id: t.account_id, transaction_status: t.status,
      merchant_name: base.merchant_name, merchant_category: base.merchant_category,
      device_type: base.device_type, device_identifier: base.device_identifier,
    });
  }
  return row;
}

// ---- Sessions ----------------------------------------------------------------
function requireSession(token, role) {
  const session = token ? load().sessions[token] : null;
  if (!session) throw new DemoError(401, "Your demo session has ended. Please sign in again.");
  if (role && session.role !== role) {
    throw new DemoError(403, role === "analyst" ? "This action requires a fraud analyst account." : "This action requires a customer account.");
  }
  return session;
}

function randomToken() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- Validation (same messages as PKG_SMARTBANK_API) ------------------------
function parseBody(raw) {
  if (!raw) throw new DemoError(400, "The request body must be a JSON object.");
  try {
    const body = JSON.parse(raw);
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    // fall through
  }
  throw new DemoError(400, "The request body must be a JSON object.");
}

function idField(body, name) {
  const v = body[name];
  if (v == null) throw new DemoError(400, `${name} is required.`);
  if (typeof v !== "number") throw new DemoError(400, `${name} must be a number.`);
  if (!Number.isInteger(v) || v < 1 || v > 999999999) throw new DemoError(400, `${name} must be a positive whole number.`);
  return v;
}

function createTransaction(session, body) {
  const s = load();
  const accountId = idField(body, "account_id");
  const merchantId = idField(body, "merchant_id");
  const deviceId = idField(body, "device_id");
  const amount = body.amount;
  const type = String(body.transaction_type ?? "TRANSFER").trim().toUpperCase();
  const location = typeof body.location === "string" ? body.location.trim() : body.location;

  if (amount == null) throw new DemoError(400, "amount is required.");
  if (typeof amount !== "number") throw new DemoError(400, "amount must be a number.");
  if (amount <= 0) throw new DemoError(400, "amount must be greater than zero.");
  if (amount > MAX_AMOUNT) throw new DemoError(400, "amount cannot exceed 10,000,000.");
  if (Math.round(amount * 100) / 100 !== amount) throw new DemoError(400, "amount can have at most two decimal places.");
  if (!TXN_TYPES.includes(type)) throw new DemoError(400, "transaction_type must be one of DEBIT, CREDIT, TRANSFER, WITHDRAWAL, DEPOSIT.");
  if (typeof location !== "string" || location.length < 2) throw new DemoError(400, "location is required (a city name).");
  if (location.length > 100) throw new DemoError(400, "location must be at most 100 characters.");
  if (!/^\p{L}[\p{L} .,'()-]*$/u.test(location)) throw new DemoError(400, "location may contain only letters, spaces and . , ' ( ) -");

  const account = accounts.get(accountId);
  if (!account || account.customer_id !== session.customer_id) {
    throw new DemoError(404, `Account ${accountId} was not found among your accounts.`);
  }
  if (!merchants.has(merchantId)) throw new DemoError(400, `Merchant ${merchantId} does not exist.`);
  if (!devices.has(deviceId)) throw new DemoError(400, `Device ${deviceId} does not exist.`);
  // TRG_VALIDATE_TRANSACTION
  if (account.status !== "ACTIVE") {
    throw new DemoError(400, `Cannot process transaction: account ${accountId} is ${account.status}`);
  }

  const txn = {
    transaction_id: Math.max(0, ...s.transactions.map((t) => t.transaction_id)) + 1,
    account_id: accountId, merchant_id: merchantId, device_id: deviceId, amount,
    transaction_type: type, time_ms: Date.now(), location, status: "COMPLETED", simulated: true,
  };
  s.transactions.push(txn);

  const result = detectFraud(txn, { transactions: s.transactions, ...reference }, {
    analysts: T.fraud_analyst, alerts: s.alerts,
    nextAlertId: Math.max(0, ...s.alerts.map((a) => a.alert_id)) + 1, createdAtMs: txn.time_ms,
  });
  txn.status = result.status;
  if (result.alert) s.alerts.push(result.alert);
  save();

  return {
    transaction_id: txn.transaction_id, transaction_status: txn.status, transaction_time: iso(txn.time_ms),
    account_id: accountId, amount, transaction_type: type, location,
    risk_score: result.score, risk_level: result.level, score_source: "BROWSER_SIMULATION",
    reasons: result.reason.split(";").map((r) => r.trim()).filter(Boolean),
    alert: result.alert
      ? { alert_id: result.alert.alert_id, risk_score: result.alert.risk_score, risk_level: result.alert.risk_level,
          reason: result.alert.reason, status: result.alert.status, analyst_id: result.alert.analyst_id }
      : null,
    simulated: true,
  };
}

// ---- Router ------------------------------------------------------------------
function route(method, path, query, rawBody, token) {
  const s = load();

  if (method === "GET" && path === "/health") {
    return { status: "ok", mode: "demo", service: "smartbank-browser-simulation",
      database: "none: simulated in this browser", fraud_engine: "JavaScript copy of the PL/SQL rules",
      server_time: iso(Date.now()) };
  }

  if (method === "POST" && path === "/auth/login") {
    const body = parseBody(rawBody);
    const user = DEMO_USERS[String(body.email || "").trim().toLowerCase()];
    if (!user) throw new DemoError(401, "Invalid email or password. In demo mode, use user@smartbank.com or admin@smartbank.com.");
    const token = randomToken();
    const expires = Date.now() + 8 * 3600 * 1000;
    s.sessions[token] = { ...user, expires };
    save();
    return { token, expires_at: iso(expires), user };
  }
  if (method === "POST" && path === "/auth/logout") {
    delete s.sessions[token];
    save();
    return { signed_out: true };
  }

  const session = requireSession(token);
  const own = session.role === "customer" ? session.customer_id : null;

  if (method === "GET" && path === "/auth/session") {
    return { expires_at: iso(session.expires), user: { email: session.email, display_name: session.display_name, role: session.role, customer_id: session.customer_id } };
  }

  if (method === "GET" && path === "/kpis") {
    requireSession(token, "analyst");
    return {
      total_customers: T.customer.length, total_accounts: T.account.length,
      total_transactions: s.transactions.length, flagged_transactions: s.alerts.length,
      open_alerts: s.alerts.filter((a) => a.status === "OPEN").length,
      high_risk_alerts: s.alerts.filter((a) => a.risk_level === "HIGH").length,
    };
  }

  if (method === "GET" && path === "/risk-distribution") {
    requireSession(token, "analyst");
    return {
      items: ["HIGH", "MEDIUM", "LOW"].map((level) => {
        const rows = s.alerts.filter((a) => a.risk_level === level);
        return rows.length
          ? { risk_level: level, alert_count: rows.length,
              average_risk_score: Math.round((rows.reduce((n, a) => n + a.risk_score, 0) / rows.length) * 100) / 100 }
          : null;
      }).filter(Boolean),
    };
  }

  if (method === "GET" && path === "/daily-analytics") {
    requireSession(token, "analyst");
    const days = new Map();
    for (const t of s.transactions) {
      const day = new Date(t.time_ms + IST_OFFSET_MS).toISOString().slice(0, 10);
      const d = days.get(day) || { txn_date: day, total_transactions: 0, total_amount: 0, high_risk_count: 0, medium_risk_count: 0 };
      const al = s.alerts.find((a) => a.transaction_id === t.transaction_id);
      d.total_transactions++;
      d.total_amount += t.amount;
      if (al?.risk_level === "HIGH") d.high_risk_count++;
      if (al?.risk_level === "MEDIUM") d.medium_risk_count++;
      days.set(day, d);
    }
    return {
      items: [...days.values()].sort((a, b) => a.txn_date.localeCompare(b.txn_date)).map((d) => ({
        ...d, total_amount: Math.round(d.total_amount * 100) / 100,
        avg_amount: Math.round((d.total_amount / d.total_transactions) * 100) / 100,
      })),
    };
  }

  if (method === "GET" && path === "/analysts/workload") {
    requireSession(token, "analyst");
    const count = (id, status) => s.alerts.filter((a) => a.analyst_id === id && (!status || a.status === status)).length;
    return {
      items: T.fraud_analyst.map((an) => ({
        analyst_id: an.analyst_id, name: an.name, department: an.department,
        open_alerts: count(an.analyst_id, "OPEN"), investigating_alerts: count(an.analyst_id, "INVESTIGATING"),
        confirmed_fraud: count(an.analyst_id, "CONFIRMED_FRAUD"), false_positive: count(an.analyst_id, "FALSE_POSITIVE"),
        total_assigned: count(an.analyst_id),
      })).sort((a, b) => b.total_assigned - a.total_assigned || a.analyst_id - b.analyst_id),
    };
  }

  if (path === "/transactions" && method === "GET") {
    const search = (query.get("search") || "").trim().toUpperCase().slice(0, 100);
    const rows = s.transactions.map(txnRow)
      .filter((r) => own == null || r.customer_id === own)
      .filter((r) => !search || [r.account_number, r.customer_name, r.merchant_name, r.device_identifier, r.location]
        .some((v) => String(v ?? "").toUpperCase().includes(search)))
      .sort((a, b) => b.transaction_time.localeCompare(a.transaction_time) || b.transaction_id - a.transaction_id);
    return { items: rows.slice(0, 1000) };
  }
  if (path === "/transactions" && method === "POST") {
    return [201, createTransaction(requireSession(token, "customer"), parseBody(rawBody))];
  }

  if (path === "/alerts" && method === "GET") {
    const level = (query.get("risk_level") || "").trim().toUpperCase();
    if (level && !["LOW", "MEDIUM", "HIGH"].includes(level)) throw new DemoError(400, "risk_level must be LOW, MEDIUM or HIGH.");
    return {
      items: s.alerts.map((a) => alertRow(a))
        .filter((r) => (own == null || r.customer_id === own) && (!level || r.risk_level === level))
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.alert_id - a.alert_id),
    };
  }

  const alertMatch = /^\/alerts\/(\d{1,9})$/.exec(path);
  if (alertMatch) {
    const id = Number(alertMatch[1]);
    const al = s.alerts.find((a) => a.alert_id === id);
    if (method === "PUT") {
      requireSession(token, "analyst");
      const status = String(parseBody(rawBody).status || "").trim().toUpperCase();
      if (!status) throw new DemoError(400, "status is required.");
      if (!ALERT_STATUSES.includes(status)) throw new DemoError(400, "status must be OPEN, INVESTIGATING, CONFIRMED_FRAUD, FALSE_POSITIVE or CLOSED.");
      if (!al) throw new DemoError(404, `Fraud alert ${id} was not found.`);
      al.status = status;
      save();
      return alertRow(al, true);
    }
    if (method === "GET") {
      const row = al && alertRow(al, true);
      if (!row || (own != null && row.customer_id !== own)) throw new DemoError(404, `Fraud alert ${id} was not found.`);
      return row;
    }
  }

  if (method === "GET" && path === "/accounts") {
    const cust = own ?? (query.get("customer_id") ? Number(query.get("customer_id")) : null);
    return {
      items: T.account.filter((a) => cust == null || a.customer_id === cust).map((a) => {
        const sa = T.savings_account.find((x) => x.account_id === a.account_id);
        const ca = T.current_account.find((x) => x.account_id === a.account_id);
        return {
          account_id: a.account_id, account_number: a.account_number, customer_id: a.customer_id,
          customer_name: fullName(customers.get(a.customer_id)),
          account_type: sa ? "SAVINGS" : ca ? "CURRENT" : "GENERAL", balance: a.balance, status: a.status,
          opened_date: iso(a.opened_date), interest_rate: sa?.interest_rate ?? null,
          minimum_balance: sa?.minimum_balance ?? null, overdraft_limit: ca?.overdraft_limit ?? null,
          home_city: homeCity(a.customer_id),
        };
      }),
    };
  }

  if (method === "GET" && path === "/merchants") {
    return { items: [...T.merchant].sort((a, b) => a.merchant_name.localeCompare(b.merchant_name))
      .map(({ merchant_id, merchant_name, category, location, risk_level }) => ({ merchant_id, merchant_name, category, location, risk_level })) };
  }

  if (method === "GET" && path === "/devices") {
    const cust = own ?? (query.get("customer_id") ? Number(query.get("customer_id")) : null);
    return {
      items: T.device.map((d) => ({
        device_id: d.device_id, device_type: d.device_type, device_identifier: d.device_identifier, location: d.location,
        customer_usage: s.transactions.filter((t) => t.device_id === d.device_id && accounts.get(t.account_id)?.customer_id === cust).length,
      })),
    };
  }

  const customerMatch = /^\/customers\/(\d{1,9})$/.exec(path);
  if (method === "GET" && customerMatch) {
    const id = Number(customerMatch[1]);
    if (own != null && id !== own) throw new DemoError(403, "You can only view your own customer profile.");
    const c = customers.get(id);
    if (!c) throw new DemoError(404, `Customer ${id} was not found.`);
    const addr = T.customer_address.filter((a) => a.customer_id === id).sort((a, b) => a.city.localeCompare(b.city));
    return {
      customer_id: id, first_name: c.first_name, last_name: c.last_name, customer_name: fullName(c),
      email: c.email, phone: c.phone, created_at: iso(c.created_at),
      customer_type: T.individual_customer.some((x) => x.customer_id === id) ? "INDIVIDUAL"
        : T.business_customer.some((x) => x.customer_id === id) ? "BUSINESS" : null,
      home_city: addr[0]?.city ?? null, home_state: [...addr].sort((a, b) => a.state.localeCompare(b.state))[0]?.state ?? null,
    };
  }

  throw new DemoError(404, `${method} ${path} is not available in demo mode.`);
}

// Entry point used by api.js. Resolves to { status, body } like an HTTP reply.
export async function handleDemoRequest(method, endpoint, rawBody, token) {
  const url = new URL(endpoint, "https://demo.invalid");
  try {
    const result = route(method, url.pathname, url.searchParams, rawBody, token);
    const [status, body] = Array.isArray(result) ? result : [200, result];
    return { status, body };
  } catch (err) {
    if (err instanceof DemoError) return { status: err.status, body: { error: err.message } };
    return { status: 500, body: { error: `Demo simulation error: ${err.message}` } };
  }
}

// Exposed for tests.
export const _internals = { calculateRisk, classifyRisk };
