import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Laptop development against the older, unauthenticated smartbank.api module
// (no /auth endpoints). Sign-in falls back to the demo identities ONLY when the
// API is on this computer, and the UI says the password is not checked.
async function loadApp(apiUrl) {
  vi.stubEnv("VITE_API_BASE_URL", apiUrl);
  vi.resetModules();
  return (await import("../App")).default;
}

function fakeLegacyApi() {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const path = new URL(String(input)).pathname;
    const body = path.endsWith("/auth/login") ? "" : JSON.stringify({ items: [] });
    return Promise.resolve(new Response(body, { status: path.endsWith("/auth/login") ? 404 : 200 }));
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

async function signIn() {
  window.history.pushState({}, "", "/login");
  fireEvent.change(await screen.findByLabelText("Customer email"), { target: { value: "user@smartbank.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "anything" } });
  fireEvent.click(screen.getByRole("button", { name: /sign in to smartbank/i }));
}

describe("older local Oracle API (no /auth endpoints)", () => {
  it("signs in on localhost and says the password is not checked", async () => {
    fakeLegacyApi();
    const App = await loadApp("http://localhost:8080/ords/smartbank/sb/api");
    window.history.pushState({}, "", "/login");
    render(<App />);
    await signIn();
    await waitFor(() => expect(window.location.pathname).toBe("/user"));
    expect(await screen.findByText(/without server-side sign-in detected/)).toBeTruthy();
  });

  it("does not fall back when the local API is the new, authenticated one", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path = new URL(String(input)).pathname;
      return Promise.resolve(path.endsWith("/auth/login")
        ? new Response(JSON.stringify({ error: "Invalid email or password." }), { status: 401 })
        : new Response(JSON.stringify({ error: "Sign in to use the SmartBank API." }), { status: 401 }));
    });
    const App = await loadApp("http://localhost:8080/ords/smartbank/sb/api");
    window.history.pushState({}, "", "/login");
    render(<App />);
    await signIn();
    expect(await screen.findByText("Invalid email or password.")).toBeTruthy();
    expect(window.location.pathname).toBe("/login");
  });

  it("does not fall back when the local API is down", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.reject(new TypeError("Failed to fetch")));
    const App = await loadApp("http://localhost:8080/ords/smartbank/sb/api");
    window.history.pushState({}, "", "/login");
    render(<App />);
    await signIn();
    expect(await screen.findByText(/Cannot reach the SmartBank API/)).toBeTruthy();
    expect(window.location.pathname).toBe("/login");
  });

  it("never falls back for a hosted API", async () => {
    fakeLegacyApi();
    const App = await loadApp("https://api.example.test/ords/sb/api");
    window.history.pushState({}, "", "/login");
    render(<App />);
    await signIn();
    expect(await screen.findByText(/endpoint is not published in ORDS/)).toBeTruthy();
    expect(window.location.pathname).toBe("/login");
  });
});

describe("older local API timestamps", () => {
  it("reads 'Z'-suffixed wall-clock times as local time, only for time fields", async () => {
    const { stripUtcSuffix } = await import("../api");
    expect(stripUtcSuffix({
      items: [{ transaction_time: "2026-10-14T16:24:25.708Z", created_at: "2026-09-27T14:01:52Z", location: "Z", note: "2026-10-14T16:24:25Z" }],
    })).toEqual({
      items: [{ transaction_time: "2026-10-14T16:24:25.708", created_at: "2026-09-27T14:01:52", location: "Z", note: "2026-10-14T16:24:25Z" }],
    });
  });
});
