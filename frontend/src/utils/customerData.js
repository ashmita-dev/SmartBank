import { getAccounts, getTransactions } from "../api";

// Loads the signed-in customer's accounts and transactions.
// If GET /accounts is not published yet (older ORDS module), accounts are
// derived from the customer's transactions and `accountsError` explains why
// balances are missing. Nothing is invented.
export async function loadCustomerData(customerId) {
  const [transactionsResult, accountsResult] = await Promise.allSettled([
    getTransactions(),
    getAccounts(customerId),
  ]);

  if (transactionsResult.status === "rejected") {
    throw transactionsResult.reason;
  }

  const transactions = transactionsResult.value.filter(
    (t) => Number(t.customer_id) === Number(customerId)
  );

  if (accountsResult.status === "fulfilled") {
    return {
      transactions,
      accounts: accountsResult.value,
      accountsError: null,
    };
  }

  const derived = new Map();

  transactions.forEach((t) => {
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

  return {
    transactions,
    accounts: [...derived.values()],
    accountsError: accountsResult.reason,
  };
}
