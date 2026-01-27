import { afterEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";

import jira from "../src/routes/jira";

const originalFetch = globalThis.fetch;

const createApp = () => {
  const app = new Hono();
  app.route("/", jira);
  return app;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const setFetchMock = (
  handler: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
) => {
  const mockFetch = Object.assign(
    async (...args: Parameters<typeof fetch>) => handler(...args),
    { preconnect: originalFetch.preconnect }
  );
  globalThis.fetch = mockFetch;
};

describe("POST /integrations/jira/test", () => {
  it("returns 400 for invalid JSON", async () => {
    const app = createApp();
    const res = await app.request("/integrations/jira/test", {
      method: "POST",
      body: "{invalid json",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects non-Atlassian base URL", async () => {
    const app = createApp();
    const res = await app.request("/integrations/jira/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://example.com",
        email: "user@example.com",
        apiToken: "token",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 502 on timeout", async () => {
    setFetchMock(async () => {
      const error = new Error("Timeout");
      error.name = "AbortError";
      throw error;
    });
    const app = createApp();
    const res = await app.request("/integrations/jira/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        apiToken: "token",
      }),
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Jira request timed out");
  });

  it("returns profile on success", async () => {
    setFetchMock(
      async () =>
        new Response(
          JSON.stringify({
            displayName: "Test User",
            emailAddress: "user@example.com",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );
    const app = createApp();
    const res = await app.request("/integrations/jira/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        apiToken: "token",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.displayName).toBe("Test User");
  });
});

describe("POST /integrations/jira/issues", () => {
  it("returns 400 for invalid JSON", async () => {
    const app = createApp();
    const res = await app.request("/integrations/jira/issues", {
      method: "POST",
      body: "{invalid json",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  it("returns issues on success", async () => {
    setFetchMock(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      expect(url.includes("/rest/api/3/search/jql")).toBe(true);
      return new Response(
        JSON.stringify({
          issues: [
            {
              key: "ABC-1",
              fields: {
                summary: "Issue summary",
                status: { name: "In Progress" },
                updated: "2026-01-27T10:00:00Z",
                assignee: { displayName: "Alex" },
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const app = createApp();
    const res = await app.request("/integrations/jira/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        apiToken: "token",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.issues[0].key).toBe("ABC-1");
    expect(body.issues[0].status).toBe("In Progress");
  });
});
