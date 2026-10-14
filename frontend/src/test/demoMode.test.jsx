import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// The DEMO MODE flag is read when api.js is imported, so each test loads a
// fresh copy of the app with VITE_DEMO_MODE=true.
async function loadDemoApp() {
  vi.stubEnv("VITE_DEMO_MODE", "true");
  vi.resetModules();
  const { default: App } = await import("../App");
  return App;
}

let fetchSpy;

beforeEach(() => {
  localStorage.clear();
  fetchSpy = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

async function signIn(App, role) {
  window.history.pushState({}, "", "/login");
  render(<App />);
  if (role === "analyst") fireEvent.click(await screen.findByRole("button", { name: /Fraud Analyst/ }));
  expect(await screen.findByText(/DEMO MODE: not connected to Oracle/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /use demo account/i }));
  fireEvent.click(screen.getByRole("button", { name: role === "analyst" ? /enter analyst console/i : /sign in to smartbank/i }));
  await waitFor(() => expect(window.location.pathname).toBe(role === "analyst" ? "/admin" : "/user"));
}

describe("DEMO MODE", () => {
  it("labels every signed-in page and never shows LIVE or calls the network", async () => {
    const App = await loadDemoApp();
    await signIn(App, "customer");

    expect(await screen.findByText(/DEMO MODE: simulated, not connected to Oracle/)).toBeTruthy();
    expect(await screen.findByText("DEMO MODE")).toBeTruthy();
    expect(screen.queryByText("LIVE")).toBeNull();
    expect(await screen.findAllByText("Ashmita Mazumdar")).not.toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("labels a transfer as simulated and never claims Oracle processed it", async () => {
    const App = await loadDemoApp();
    await signIn(App, "customer");
    window.history.pushState({}, "", "/user/transfer");
    cleanup();
    render(<App />);

    const payee = await screen.findByLabelText("Payee (merchant)");
    const quickCash = [...payee.options].find((o) => o.textContent.includes("QuickCash"));
    fireEvent.change(payee, { target: { value: quickCash.value } });
    fireEvent.change(screen.getByLabelText("Amount (₹)"), { target: { value: "150000" } });
    const device = screen.getByLabelText("Device");
    const newDevice = [...device.options].find((o) => o.textContent.includes("new for this account"));
    fireEvent.change(device, { target: { value: newDevice.value } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Lagos" } });
    fireEvent.click(screen.getByRole("button", { name: /simulate transfer/i }));

    expect(await screen.findByText(/Simulated transaction #102/)).toBeTruthy();
    expect(screen.getByText(/SIMULATED, not processed by Oracle/)).toBeTruthy();
    expect(screen.getByText("Simulated risk score 80/100")).toBeTruthy();
    expect(screen.getByText(/Simulated fraud alert #85/)).toBeTruthy();
    expect(screen.queryByText(/was inserted into BANK_TRANSACTION/)).toBeNull();
    expect(screen.queryByText(/Transaction #\d+ recorded/)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Survives a "refresh" (fresh module load, same browser storage), tagged SIMULATED.
    cleanup();
    window.history.pushState({}, "", "/user/transactions");
    const Reloaded = await loadDemoApp();
    render(<Reloaded />);
    expect(await screen.findByText("#102")).toBeTruthy();
    expect(screen.getAllByText("SIMULATED").length).toBeGreaterThan(0);
  });

  it("shows the simulated alert to the analyst, still labelled", async () => {
    const App = await loadDemoApp();
    const { handleDemoRequest } = await import("../demo/demoApi.js");
    const login = await handleDemoRequest("POST", "/auth/login", JSON.stringify({ email: "user@smartbank.com" }));
    const created = await handleDemoRequest("POST", "/transactions", JSON.stringify({
      account_id: 1, merchant_id: 5, device_id: 3, amount: 150000, transaction_type: "TRANSFER", location: "Lagos",
    }), login.body.token);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ simulated: true, score_source: "BROWSER_SIMULATION", risk_level: "HIGH", transaction_status: "FLAGGED" });

    await signIn(App, "analyst");
    window.history.pushState({}, "", "/admin/alerts");
    cleanup();
    render(<App />);
    expect(await screen.findByText(`#${created.body.alert.alert_id}`)).toBeTruthy();
    expect(screen.getAllByText("SIMULATED").length).toBeGreaterThan(0);
  });

  it("enforces the same roles and validation as the Oracle API", async () => {
    const { handleDemoRequest } = await import("../demo/demoApi.js");
    const cust = (await handleDemoRequest("POST", "/auth/login", JSON.stringify({ email: "user@smartbank.com" }))).body.token;
    expect((await handleDemoRequest("GET", "/kpis", undefined, cust)).status).toBe(403);
    expect((await handleDemoRequest("GET", "/transactions")).status).toBe(401);
    const bad = await handleDemoRequest("POST", "/transactions", JSON.stringify({
      account_id: 2, merchant_id: 1, device_id: 1, amount: 10.123, location: "Mumbai",
    }), cust);
    expect(bad).toMatchObject({ status: 400, body: { error: "amount can have at most two decimal places." } });
    const other = await handleDemoRequest("POST", "/transactions", JSON.stringify({
      account_id: 2, merchant_id: 1, device_id: 1, amount: 10, location: "Mumbai",
    }), cust);
    expect(other.status).toBe(404);
    const own = (await handleDemoRequest("GET", "/transactions", undefined, cust)).body.items;
    expect(own.every((t) => t.customer_id === 1)).toBe(true);
  });
});
