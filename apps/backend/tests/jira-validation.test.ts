import { describe, expect, it } from "bun:test";

import { jiraTestRequestSchema } from "../src/lib/validation";

describe("jiraTestRequestSchema", () => {
  it("accepts valid Jira Cloud credentials", () => {
    const result = jiraTestRequestSchema.safeParse({
      baseUrl: "https://example.atlassian.net",
      email: "user@example.com",
      apiToken: "token",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-https base URLs", () => {
    const result = jiraTestRequestSchema.safeParse({
      baseUrl: "http://example.atlassian.net",
      email: "user@example.com",
      apiToken: "token",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-Atlassian hosts", () => {
    const result = jiraTestRequestSchema.safeParse({
      baseUrl: "https://example.com",
      email: "user@example.com",
      apiToken: "token",
    });
    expect(result.success).toBe(false);
  });

  it("rejects root atlassian.net host", () => {
    const result = jiraTestRequestSchema.safeParse({
      baseUrl: "https://atlassian.net",
      email: "user@example.com",
      apiToken: "token",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing API token", () => {
    const result = jiraTestRequestSchema.safeParse({
      baseUrl: "https://example.atlassian.net",
      email: "user@example.com",
      apiToken: "",
    });
    expect(result.success).toBe(false);
  });
});
