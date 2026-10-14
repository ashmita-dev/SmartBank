import { describe, expect, it } from "vitest";
import seed from "../demo/seedData.json";
import { buildInitialState } from "../demo/demoApi";
import { calculateRisk, classifyRisk, fraudReason, pickAnalyst } from "../demo/fraudEngine";

const T = seed.tables;
const reference = { accounts: T.account, addresses: T.customer_address };
const MIN = 60 * 1000;

describe("demo fraud engine (JavaScript copy of the PL/SQL rules)", () => {
  // Oracle result recorded on 14 Oct 2026: 01_install_smartbank.sql on an empty
  // schema (Oracle 23ai Free) replayed the same 101 seed transactions through
  // TRG_FRAUD_MONITOR -> DETECT_FRAUD and produced 84 alerts, 3 HIGH, 3 FLAGGED.
  // The laptop database also shows 8 alerts for customer #1.
  it("replays the seed to the same totals Oracle produced", () => {
    const state = buildInitialState();
    const accountOf = new Map(T.account.map((a) => [a.account_id, a.customer_id]));
    const txnAccount = new Map(state.transactions.map((t) => [t.transaction_id, t.account_id]));

    expect(state.transactions).toHaveLength(101);
    expect(state.alerts).toHaveLength(84);
    expect(state.alerts.filter((a) => a.risk_level === "HIGH")).toHaveLength(3);
    expect(state.transactions.filter((t) => t.status === "FLAGGED")).toHaveLength(3);
    expect(state.alerts.filter((a) => accountOf.get(txnAccount.get(a.transaction_id)) === 1)).toHaveLength(8);
  });

  it("uses the CLASSIFY_RISK bands", () => {
    expect([0, 39, 40, 69, 70, 100].map(classifyRisk)).toEqual(["LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH"]);
  });

  it("scores amount, velocity, device and location like CALCULATE_RISK", () => {
    const now = Date.parse("2026-10-14T10:00:00Z");
    const history = [{ transaction_id: 1, account_id: 1, device_id: 1, amount: 100, location: "Mumbai", time_ms: now - 60 * MIN }];
    const state = (extra = []) => ({ transactions: [...history, ...extra], ...reference });
    const txn = (o) => ({ transaction_id: 99, account_id: 1, device_id: 1, amount: 500, location: "Mumbai", time_ms: now, ...o });

    expect(calculateRisk(txn({}), state())).toBe(0);                              // known device, home city
    expect(calculateRisk(txn({ amount: 20000.01 }), state())).toBe(10);
    expect(calculateRisk(txn({ amount: 50000.01 }), state())).toBe(25);
    expect(calculateRisk(txn({ amount: 100000.01 }), state())).toBe(40);
    expect(calculateRisk(txn({ device_id: 3 }), state())).toBe(20);               // new device on this account
    expect(calculateRisk(txn({ location: "mumbai" }), state())).toBe(0);          // case-insensitive city match
    expect(calculateRisk(txn({ location: "Lagos" }), state())).toBe(20);
    const recent = (n) => Array.from({ length: n }, (_, i) =>
      ({ transaction_id: 50 + i, account_id: 1, device_id: 1, amount: 1, location: "Mumbai", time_ms: now - (i + 1) * MIN }));
    expect(calculateRisk(txn({}), state(recent(1)))).toBe(15);
    expect(calculateRisk(txn({}), state(recent(2)))).toBe(25);
    // The documented high-risk demo: 150000 + new device + Lagos = 80; + one recent = 95; capped at 100.
    expect(calculateRisk(txn({ amount: 150000, device_id: 3, location: "Lagos" }), state())).toBe(80);
    expect(calculateRisk(txn({ amount: 150000, device_id: 3, location: "Lagos" }), state(recent(1)))).toBe(95);
    expect(calculateRisk(txn({ amount: 150000, device_id: 3, location: "Lagos" }), state(recent(2)))).toBe(100);
  });

  it("builds DETECT_FRAUD's reason text", () => {
    const now = Date.now();
    const state = { transactions: [], ...reference };
    expect(fraudReason({ transaction_id: 1, account_id: 1, device_id: 3, amount: 150000, location: "Lagos", time_ms: now }, state))
      .toBe("High transaction amount; Unrecognized device; Unusual transaction location; ");
  });

  it("assigns alerts to the analyst with the fewest OPEN alerts", () => {
    const analysts = [{ analyst_id: 1 }, { analyst_id: 2 }];
    expect(pickAnalyst(analysts, [{ analyst_id: 1, status: "OPEN" }])).toBe(2);
    expect(pickAnalyst(analysts, [{ analyst_id: 1, status: "CLOSED" }])).toBe(1);
  });
});
