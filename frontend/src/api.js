const API_BASE_URL = "http://localhost:8080/ords/smartbank/sb/api";

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json();
}

export async function getKPIs() {
  return request("/kpis");
}

export async function getTransactions(search = "") {
  const query = search
    ? `?search=${encodeURIComponent(search)}`
    : "";

  return request(`/transactions${query}`);
}

export async function getAlerts(riskLevel = "") {
  const query = riskLevel
    ? `?risk_level=${encodeURIComponent(riskLevel)}`
    : "";

  return request(`/alerts${query}`);
}

export async function getRiskDistribution() {
  return request("/risk-distribution");
}

export async function getDailyAnalytics() {
  return request("/daily-analytics");
}

export async function getAnalystWorkload() {
  return request("/analysts/workload");
}

export async function getAlertById(id) {
  return request(`/alerts/${id}`);
}

export async function updateAlert(id, status) {
  return request(`/alerts/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      status,
    }),
  });
}