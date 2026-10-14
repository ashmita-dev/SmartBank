import { getAccounts, getAlerts, getCustomer, getTransactions } from "../api";
import { attachAlerts } from "./fraud";

// Customer identity comes from the database: GET /customers/:id, or (if that
// endpoint is not published yet) the CUSTOMER_NAME on the customer's own
// transactions. Nothing is hard-coded, so the portal never shows one
// customer's records under another name.
export async function loadCustomerProfile(customerId, transactions) {
  try {
    const profile = await getCustomer(customerId);
    return { ...profile, source: "customers" };
  } catch (err) {
    const rows = transactions ?? (await getTransactions()).filter(
      (t) => Number(t.customer_id) === Number(customerId)
    );
    const name = rows[0]?.customer_name;
    return name
      ? { customer_id: customerId, customer_name: name, source: "transactions", error: err }
      : { customer_id: customerId, customer_name: null, source: null, error: err };
  }
}

// Loads the signed-in customer's transactions (with their fraud alerts),
// accounts and profile. Optional parts that fail are reported via *Error
// fields instead of being replaced with invented values.
export async function loadCustomerData(customerId) {
  const [transactionsResult, accountsResult, alertsResult] = await Promise.allSettled([
    getTransactions(),
    getAccounts(customerId),
    getAlerts(),
  ]);

  if (transactionsResult.status === "rejected") {
    throw transactionsResult.reason;
  }

  const own = transactionsResult.value.filter(
    (t) => Number(t.customer_id) === Number(customerId)
  );
  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : null;
  const transactions = attachAlerts(own, alerts);
  const profile = await loadCustomerProfile(customerId, own);

  let accounts;
  let accountsError = null;

  if (accountsResult.status === "fulfilled") {
    accounts = accountsResult.value;
  } else {
    accountsError = accountsResult.reason;
    const derived = new Map();
    own.forEach((t) => {
      if (!derived.has(t.account_id)) {
        derived.set(t.account_id, {
          account_id: t.account_id,
          account_number: t.account_number,
          customer_name: t.customer_name,
          account_type: null,
          balance: null,
          status: null,
        });
      }
    });
    accounts = [...derived.values()];
  }

  return {
    transactions,
    accounts,
    accountsError,
    alertsError: alertsResult.status === "rejected" ? alertsResult.reason : null,
    profile,
  };
}
