import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../App";
import { setSessionToken } from "../api";
import { TOKEN, customerSession, installFakeApi, storeCustomerSession } from "./fakeApi";

function openApp(path) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

beforeEach(() => {
  localStorage.clear();
  setSessionToken(null);
});

afterEach(() => {
  cleanup();
});

describe("protected routes", () => {
  it("sends a signed-out visitor to the login page", async () => {
    installFakeApi();
    openApp("/user/transfer");
    expect(await screen.findByRole("heading", { name: "Customer Portal" })).toBeTruthy();
    expect(window.location.pathname).toBe("/login");
  });

  it("keeps a signed-in customer out of the analyst portal", async () => {
    installFakeApi();
    storeCustomerSession();
    openApp("/admin/alerts");
    await waitFor(() => expect(window.location.pathname).toBe("/user"));
  });

  it("stays on the same page after a refresh and re-checks the session with the server", async () => {
    const { calls } = installFakeApi();
    storeCustomerSession();
    openApp("/user/transactions");
    expect(await screen.findByRole("heading", { name: /transactions/i })).toBeTruthy();
    expect(window.location.pathname).toBe("/user/transactions");
    expect(calls.some((c) => c.key === "GET /auth/session" && c.headers["X-Session-Token"] === TOKEN)).toBe(true);
  });

  it("signs out when the server says the stored session has ended", async () => {
    installFakeApi({ "GET /auth/session": () => [401, { error: "Your session has expired. Please sign in again." }] });
    storeCustomerSession();
    openApp("/user");
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(await screen.findByText(/session has ended/i)).toBeTruthy();
    expect(localStorage.getItem("smartbank_session")).toBeNull();
  });
});

describe("login", () => {
  it("shows the database's message for a wrong password", async () => {
    installFakeApi({ "POST /auth/login": () => [401, { error: "Invalid email or password." }] });
    openApp("/login");

    fireEvent.change(await screen.findByLabelText("Customer email"), { target: { value: "user@smartbank.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in to smartbank/i }));

    expect(await screen.findByText("Invalid email or password.")).toBeTruthy();
    expect(localStorage.getItem("smartbank_session")).toBeNull();
  });

  it("asks for both fields before calling the server", async () => {
    const { calls } = installFakeApi();
    openApp("/login");
    fireEvent.click(await screen.findByRole("button", { name: /sign in to smartbank/i }));
    expect(await screen.findByText("Please enter your email and password.")).toBeTruthy();
    expect(calls.some((c) => c.key === "POST /auth/login")).toBe(false);
  });

  it("signs in through the API, stores the session and opens the customer portal", async () => {
    const { calls } = installFakeApi({ "POST /auth/login": () => [200, customerSession] });
    openApp("/login");

    fireEvent.click(await screen.findByRole("button", { name: /use demo account/i }));
    expect(screen.getByLabelText("Customer email").value).toBe("user@smartbank.com");
    expect(screen.getByLabelText("Password").value).toBe(""); // no password in the bundle

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in to smartbank/i }));

    await waitFor(() => expect(window.location.pathname).toBe("/user"));
    expect(calls.find((c) => c.key === "POST /auth/login").body).toEqual({
      email: "user@smartbank.com",
      password: "correct-password",
    });
    expect(JSON.parse(localStorage.getItem("smartbank_session")).token).toBe(TOKEN);
    await waitFor(() =>
      expect(calls.some((c) => c.key === "GET /transactions" && c.headers["X-Session-Token"] === TOKEN)).toBe(true)
    );
  });
});
