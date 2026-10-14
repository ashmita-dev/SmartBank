// SmartBank public read-only API gateway.
//
// Runs on the same machine as ORDS and forwards ONLY the read-only GET
// endpoints the dashboard needs. Every write (POST /transactions,
// PUT /alerts/:id) and every other path is refused, so the unauthenticated
// ORDS module itself never has to be exposed. Put an HTTPS tunnel in front of
// this process, never in front of ORDS (port 8080) or Oracle (port 1521).
//
// No dependencies: Node 18+ only.
//   node gateway/server.mjs
//
// Environment (all optional, none secret):
//   GATEWAY_PORT     port to listen on, loopback only      (default 8787)
//   ORDS_BASE_URL    upstream ORDS module URL               (default http://127.0.0.1:8080/ords/smartbank/sb/api)
//   ALLOWED_ORIGINS  comma-separated browser origins       (default https://ashmita-dev.github.io)
//   RATE_LIMIT       requests per minute per client         (default 240)
import http from "node:http";
import process from "node:process";

const PORT = Number(process.env.GATEWAY_PORT || 8787);
const ORDS = (process.env.ORDS_BASE_URL || "http://127.0.0.1:8080/ords/smartbank/sb/api").replace(/\/+$/, "");
const ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || "https://ashmita-dev.github.io")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean)
);
const RATE_LIMIT = Number(process.env.RATE_LIMIT || 240);
const UPSTREAM_TIMEOUT_MS = 12000;
const MAX_LIMIT = 1000;

// The only paths that are forwarded, with the query parameters each accepts.
const ROUTES = [
  { re: /^\/kpis$/, params: [] },
  { re: /^\/transactions$/, params: ["search"] },
  { re: /^\/alerts$/, params: ["risk_level"] },
  { re: /^\/alerts\/\d{1,9}$/, params: [] },
  { re: /^\/risk-distribution$/, params: [] },
  { re: /^\/daily-analytics$/, params: [] },
  { re: /^\/analysts\/workload$/, params: [] },
  { re: /^\/accounts$/, params: ["customer_id"] },
  { re: /^\/merchants$/, params: [] },
  { re: /^\/devices$/, params: ["customer_id"] },
  { re: /^\/customers\/\d{1,9}$/, params: [] },
];
const PAGING = ["limit", "offset"];

const hits = new Map();

function rateLimited(client) {
  const now = Date.now();
  const recent = (hits.get(client) || []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(client, recent);
  if (hits.size > 5000) hits.clear(); // bounded memory
  return recent.length > RATE_LIMIT;
}

function send(res, status, body, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
  };
  if (origin && ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Accept";
    headers["Access-Control-Max-Age"] = "600";
  }
  res.writeHead(status, headers);
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function log(req, status, note = "") {
  // Paths and status only; no headers, bodies or client addresses are logged.
  console.log(`${new Date().toISOString()} ${req.method} ${req.url.split("?")[0]} ${status}${note ? " " + note : ""}`);
}

const server = http.createServer(async (req, res) => {
  const origin = (req.headers.origin || "").replace(/\/+$/, "");
  let url;

  try {
    url = new URL(req.url, "http://gateway");
  } catch {
    log(req, 400);
    return send(res, 400, { error: "Bad request." }, origin);
  }

  // Accept both /kpis and /api/kpis so the public base URL can end in /api.
  const path = url.pathname.replace(/^\/api(?=\/)/, "").replace(/\/+$/, "") || "/";

  if (path === "/" || path === "/health") {
    log(req, 200);
    return send(res, 200, { service: "smartbank-gateway", mode: "read-only" }, origin);
  }

  if (req.method === "OPTIONS") {
    log(req, 204);
    return send(res, 204, "", origin);
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    log(req, 405);
    return send(res, 405, {
      error: "This public SmartBank demo is read-only. Creating transactions and changing alert status are only available in the local installation.",
    }, origin);
  }

  const route = ROUTES.find((r) => r.re.test(path));
  if (!route) {
    log(req, 404);
    return send(res, 404, { error: `GET ${path} is not available through the public gateway.` }, origin);
  }

  const client = req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "local";
  if (rateLimited(client)) {
    log(req, 429);
    return send(res, 429, { error: "Too many requests. Please wait a minute and try again." }, origin);
  }

  // Forward only known query parameters; cap page size.
  const query = new URLSearchParams();
  for (const key of [...route.params, ...PAGING]) {
    const value = url.searchParams.get(key);
    if (value === null || value === "") continue;
    if ((key === "limit" || key === "offset" || key === "customer_id") && !/^\d{1,9}$/.test(value)) continue;
    query.set(key, key === "limit" ? String(Math.min(Number(value), MAX_LIMIT)) : value.slice(0, 100));
  }
  const target = `${ORDS}${path}${query.size ? `?${query}` : ""}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(target, { headers: { Accept: "application/json" }, signal: controller.signal });
    const text = await upstream.text();
    // ORDS embeds absolute "links" that point at the private ORDS URL; drop them.
    let body = text;
    try {
      const json = JSON.parse(text);
      delete json.links;
      if (Array.isArray(json.items)) json.items.forEach((item) => item && delete item.links);
      body = JSON.stringify(json);
    } catch {
      body = JSON.stringify({ error: `ORDS returned a non-JSON response (HTTP ${upstream.status}).` });
    }
    log(req, upstream.status);
    return send(res, upstream.status, req.method === "HEAD" ? "" : body, origin);
  } catch (err) {
    const timedOut = err.name === "AbortError";
    log(req, timedOut ? 504 : 502);
    return send(res, timedOut ? 504 : 502, {
      error: timedOut
        ? "The SmartBank database did not answer in time."
        : "The SmartBank backend is offline (the host computer, Oracle or ORDS is not running).",
    }, origin);
  } finally {
    clearTimeout(timer);
  }
});

// Loopback only: the tunnel connects locally, nothing on the LAN can.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`SmartBank read-only gateway on http://127.0.0.1:${PORT}  ->  ${ORDS}`);
  console.log(`Allowed browser origins: ${[...ORIGINS].join(", ")}`);
});
