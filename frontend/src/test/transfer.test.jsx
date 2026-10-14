import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../App";
import { setSessionToken } from "../api";
import { installFakeApi, storeCustomerSession } from "./fakeApi";

beforeEach(() => {
  localStorage.clear();
  setSessionToken(null);
  storeCustomerSession();
  window.history.pushState({}, "", "/user/transfer");
});

afterEach(() => {
  cleanup();
});

async function fillForm({ amount, merchant = "5", device = "3", location = "Lagos" }) {
  fireEvent.change(await screen.findByLabelText("Payee (merchant)"), { target: { value: merchant } });
  fireEvent.change(screen.getByLabelText("Amount (₹)"), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText("Device"), { target: { value: device } });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: location } });
}

const submitButton = () => screen.getByRole("button", { name: /submit transfer/i });

describe("transfer form validation", () => {
  it("rejects more than two decimal places before calling the API", async () => {
    const { calls } = installFakeApi();
    render(<App />);
    await fillForm({ amount: "10.123" });

    expect(screen.getByText("Use at most two decimal places.")).toBeTruthy();
    expect(submitButton().disabled).toBe(true);
    expect(calls.some((c) => c.key === "POST /transactions")).toBe(false);
  });

  it("rejects amounts above the database trigger limit", async () => {
    installFakeApi();
    render(<App />);
    await fillForm({ amount: "10000001" });
    expect(screen.getByText(/cannot exceed ₹1,00,00,000/)).toBeTruthy();
    expect(submitButton().disabled).toBe(true);
  });

  it("lists what is missing", async () => {
    installFakeApi();
    render(<App />);
    expect(await screen.findByText(/Select a payee, an amount to continue/)).toBeTruthy();
  });
});

describe("transfer submission", () => {
  it("posts the transfer and shows the database's HIGH-risk result and alert", async () => {
    const { calls } = installFakeApi({
      "POST /transactions": () => [201, {
        transaction_id: 222, transaction_status: "FLAGGED", account_id: 1, amount: 150000,
        risk_score: 95, risk_level: "HIGH", score_source: "FRAUD_ALERT",
        reasons: ["High transaction amount", "Unrecognized device", "Unusual transaction location"],
        alert: { alert_id: 221, risk_score: 95, risk_level: "HIGH", status: "OPEN", reason: "High transaction amount; " },
      }],
    });
    render(<App />);
    await fillForm({ amount: "150000" });
    fireEvent.click(submitButton());

    expect(await screen.findByText("Transaction #222 recorded")).toBeTruthy();
    expect(screen.getByText("Risk score 95/100")).toBeTruthy();
    expect(screen.getByText(/Fraud alert #221 \(OPEN\)/)).toBeTruthy();
    expect(screen.getByText(/HIGH risk also flagged the transaction/)).toBeTruthy();
    expect(screen.getByText("Unrecognized device")).toBeTruthy();

    const post = calls.find((c) => c.key === "POST /transactions");
    expect(post.body).toEqual({
      account_id: 1, merchant_id: 5, device_id: 3, amount: 150000, transaction_type: "TRANSFER", location: "Lagos",
    });
  });

  it("shows a LOW-risk result without inventing an alert", async () => {
    installFakeApi({
      "POST /transactions": () => [201, {
        transaction_id: 223, transaction_status: "COMPLETED", risk_score: 0, risk_level: "LOW",
        score_source: "CALCULATE_RISK", reasons: [], alert: null,
      }],
    });
    render(<App />);
    await fillForm({ amount: "500", merchant: "1", device: "1", location: "Mumbai" });
    fireEvent.click(submitButton());

    expect(await screen.findByText("Transaction #223 recorded")).toBeTruthy();
    expect(screen.getByText("Risk score 0/100")).toBeTruthy();
    expect(screen.getByText(/No fraud alert was raised/)).toBeTruthy();
  });

  it("accepts the older local handler's reply (no score for LOW risk)", async () => {
    installFakeApi({
      "POST /transactions": () => [201, { transaction_id: 225, transaction_status: "COMPLETED" }],
    });
    render(<App />);
    await fillForm({ amount: "500", merchant: "1", device: "1", location: "Mumbai" });
    fireEvent.click(submitButton());

    expect(await screen.findByText("Transaction #225 recorded")).toBeTruthy();
    expect(screen.getByText(/below 40 \(not reported by this API version\)/)).toBeTruthy();
  });

  it("uses the alert's score and reasons from the older local handler", async () => {
    installFakeApi({
      "POST /transactions": () => [201, {
        transaction_id: 226, transaction_status: "FLAGGED",
        alert: { alert_id: 230, risk_score: 80, risk_level: "HIGH", status: "OPEN", reason: "High transaction amount; Unrecognized device; " },
      }],
    });
    render(<App />);
    await fillForm({ amount: "150000" });
    fireEvent.click(submitButton());

    expect(await screen.findByText("Risk score 80/100")).toBeTruthy();
    expect(screen.getByText("Unrecognized device")).toBeTruthy();
  });

  it("shows the database's rejection and keeps the form", async () => {
    installFakeApi({
      "POST /transactions": () => [400, { error: "Cannot process transaction: account 1 is INACTIVE" }],
    });
    render(<App />);
    await fillForm({ amount: "500" });
    fireEvent.click(submitButton());

    expect(await screen.findByText(/account 1 is INACTIVE/)).toBeTruthy();
    expect(screen.queryByText(/Transaction #\d+ recorded/)).toBeNull();
    expect(submitButton()).toBeTruthy();
  });

  it("sends only one request on a double click", async () => {
    const { calls } = installFakeApi({
      "POST /transactions": () => {
        return [201, { transaction_id: 224, transaction_status: "COMPLETED", risk_score: 0, risk_level: "LOW", reasons: [], alert: null }];
      },
    });
    render(<App />);
    await fillForm({ amount: "700" });
    const button = submitButton();
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByText("Transaction #224 recorded");
    await waitFor(() => expect(calls.filter((c) => c.key === "POST /transactions")).toHaveLength(1));
  });
});
