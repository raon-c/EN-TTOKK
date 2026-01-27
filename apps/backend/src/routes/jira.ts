import { Hono } from "hono";
import {
  jiraIssuesRequestSchema,
  jiraTestRequestSchema,
} from "../lib/validation";

const jira = new Hono();

const normalizeBaseUrl = (baseUrl: string) => {
  const url = new URL(baseUrl);
  return `${url.protocol}//${url.hostname}`;
};

const buildBasicAuth = (email: string, apiToken: string) => {
  const raw = `${email}:${apiToken}`;
  return Buffer.from(raw).toString("base64");
};

const extractJiraError = (data: unknown, status: number) => {
  if (data && typeof data === "object") {
    const typed = data as {
      errorMessages?: string[];
      errors?: Record<string, string>;
      message?: string;
    };
    if (typed.errorMessages?.length) return typed.errorMessages[0];
    if (typed.message) return typed.message;
    if (typed.errors) {
      const first = Object.values(typed.errors)[0];
      if (first) return first;
    }
  }
  return `Jira request failed: ${status}`;
};

const readJsonBody = async (c: { req: { json: () => Promise<unknown> } }) => {
  try {
    const body = await c.req.json();
    return { ok: true as const, body };
  } catch {
    return { ok: false as const };
  }
};

const requestJira = async (
  url: string,
  auth: string,
  options?: { method?: string; body?: string }
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: options?.method,
      body: options?.body,
      headers: {
        Accept: "application/json",
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Basic ${auth}`,
      },
      redirect: "error",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * POST /integrations/jira/test
 * Test Jira Cloud API token credentials.
 */
jira.post("/integrations/jira/test", async (c) => {
  const parsedBody = await readJsonBody(c);
  if (!parsedBody.ok) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = jiraTestRequestSchema.safeParse(parsedBody.body);

  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      400
    );
  }

  const { baseUrl, email, apiToken } = parsed.data;
  const url = `${normalizeBaseUrl(baseUrl)}/rest/api/3/myself`;
  const auth = buildBasicAuth(email, apiToken);

  try {
    const { response, data } = await requestJira(url, auth);

    if (!response.ok) {
      const status =
        response.status >= 400 && response.status < 500 ? 400 : 502;
      return c.json({ error: extractJiraError(data, response.status) }, status);
    }

    const profile = data as {
      displayName?: string;
      emailAddress?: string;
      accountId?: string;
      avatarUrls?: Record<string, string>;
    };

    return c.json({
      profile: {
        displayName: profile.displayName ?? "Unknown",
        emailAddress: profile.emailAddress,
        accountId: profile.accountId,
        avatarUrls: profile.avatarUrls,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Jira request timed out"
        : "Unable to reach Jira API";
    return c.json({ error: message }, 502);
  }
});

/**
 * POST /integrations/jira/issues
 * Fetch recent issues assigned to the current user.
 */
jira.post("/integrations/jira/issues", async (c) => {
  const parsedBody = await readJsonBody(c);
  if (!parsedBody.ok) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = jiraIssuesRequestSchema.safeParse(parsedBody.body);

  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      400
    );
  }

  const { baseUrl, email, apiToken } = parsed.data;
  const url = `${normalizeBaseUrl(baseUrl)}/rest/api/3/search/jql`;
  const auth = buildBasicAuth(email, apiToken);
  const body = JSON.stringify({
    jql: "assignee = currentUser() ORDER BY updated DESC",
    maxResults: 20,
    fields: ["key", "summary", "status", "assignee", "updated"],
  });

  try {
    const { response, data } = await requestJira(url, auth, {
      method: "POST",
      body,
    });

    if (!response.ok) {
      const status =
        response.status >= 400 && response.status < 500 ? 400 : 502;
      return c.json({ error: extractJiraError(data, response.status) }, status);
    }

    const payload = data as {
      issues?: Array<{
        key?: string;
        fields?: {
          summary?: string;
          status?: { name?: string };
          updated?: string;
          assignee?: { displayName?: string };
        };
      }>;
    };

    const issues = (payload.issues ?? [])
      .map((issue) => ({
        key: issue.key ?? "",
        summary: issue.fields?.summary ?? "Untitled issue",
        status: issue.fields?.status?.name ?? "Unknown",
        updated: issue.fields?.updated,
        assignee: issue.fields?.assignee?.displayName,
      }))
      .filter((issue) => issue.key);

    return c.json({ issues });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Jira request timed out"
        : "Unable to reach Jira API";
    return c.json({ error: message }, 502);
  }
});

export default jira;
