export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatDate(value, { withTime = true } = {}) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function formatShortDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function formatLabel(value) {
  return String(value || "").replaceAll("_", " ");
}

// The ORDS /transactions endpoint returns the column as TRANSACTION_STATUS.
export function transactionStatus(transaction) {
  return String(
    transaction?.transaction_status || transaction?.status || "COMPLETED"
  ).toUpperCase();
}

export function riskClass(level) {
  return String(level || "LOW").toLowerCase();
}

export function statusClass(status) {
  return String(status || "").toLowerCase();
}

export function matchesSearch(values, query) {
  const needle = query.trim().toLowerCase();

  if (!needle) return true;

  return values.some((value) =>
    String(value ?? "").toLowerCase().includes(needle)
  );
}
