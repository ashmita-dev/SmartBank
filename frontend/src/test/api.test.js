import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE_URL,
  API_CONFIGURED,
  UNAUTHORIZED_EVENT,
  createTransaction,
  getTransactions,
  login,
  setSessionToken,
} from "../api";

function respond(status, body, contentType = "application/json") {
  return Promise.resolve(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": contentType },
    })
  );
}

afterEach(() => {
  setSessionToken(null);
});

describe("API configuration", () => {
  it("uses the build-time VITE_API_BASE_URL without a trailing slash", () => {
    expect(API_CONFIGURED).toBe(true);
    expect(API_BASE_URL).toBe("https://api.example.test/ords/sb/api");
  });
});

describe("request handling", () => {
  it("sends the session token in the X-Session-Token header", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => respond(200, { items: [] }));
    setSessionToken("ab".repeat(32));

    await getTransactions("AC1");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/ords/sb/api/transactions?search=AC1&limit=1000");
    expect(options.headers["X-Session-Token"]).toBe("ab".repeat(32));
  });

  it("does not send a token header when signed out", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => respond(200, { items: [] }));
    await getTransactions();
    expect(fetchMock.mock.calls[0][1].headers["X-Session-Token"]).toBeUndefined();
  });

  it("posts login credentials as JSON and returns the session", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      respond(200, { token: "t", user: { role: "customer" } })
    );
    const result = await login("user@smartbank.com", "secret-pass");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/login$/);
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ email: "user@smartbank.com", password: "secret-pass" });
    expect(result.token).toBe("t");
  });

  it("shows the database's own error message", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      respond(400, { error: "amount can have at most two decimal places." })
    );
    await expect(createTransaction({ amount: 1.234 })).rejects.toMatchObject({
      message: "amount can have at most two decimal places.",
      status: 400,
    });
  });

  it("announces an expired session so the app can sign out", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => respond(401, { error: "Your session has expired." }));
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);
    setSessionToken("cd".repeat(32));

    await expect(getTransactions()).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it("reports a network failure as an unreachable API, not as empty data", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(getTransactions()).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/Cannot reach/) });
  });

  it("rejects a non-JSON response instead of treating it as an empty list", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => respond(200, "<html>proxy page</html>", "text/html"));
    await expect(getTransactions()).rejects.toThrow(/unexpected response format/);
  });

  it("explains a database connection failure", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => respond(503, ""));
    await expect(getTransactions()).rejects.toThrow(/cannot get a database connection/);
  });
});
