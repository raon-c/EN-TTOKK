import { Hono } from "hono";
import {
  googleEventsRequestSchema,
  googleTokenRequestSchema,
} from "../lib/validation";

const OAUTH_RESULT_TTL_MS = 5 * 60 * 1000;

type OAuthResult = {
  code?: string;
  error?: string;
  receivedAt: number;
};

const oauthResults = new Map<string, OAuthResult>();

const pruneOauthResults = () => {
  const now = Date.now(); // UTC epoch ms
  for (const [state, result] of oauthResults.entries()) {
    if (now - result.receivedAt > OAUTH_RESULT_TTL_MS) {
      oauthResults.delete(state);
    }
  }
};

const googleCalendar = new Hono();

/**
 * OAuth callback endpoint for loopback redirect.
 * Stores the result temporarily for the app to poll.
 */
googleCalendar.get("/oauth/google/callback", (c) => {
  const state = c.req.query("state");
  const code = c.req.query("code");
  const error = c.req.query("error");

  if (!state) {
    return c.text("Missing state", 400);
  }

  pruneOauthResults();
  oauthResults.set(state, {
    code: code ?? undefined,
    error: error ?? undefined,
    receivedAt: Date.now(), // UTC epoch ms
  });

  return c.html(
    `
      <html>
        <head><title>Google Calendar Connected</title></head>
        <body style="font-family: sans-serif; padding: 24px;">
          <h2>Connection received</h2>
          <p>You can return to the app. This window can be closed.</p>
        </body>
      </html>
    `.trim()
  );
});

/**
 * Poll for OAuth result by state.
 */
googleCalendar.get("/oauth/google/result", (c) => {
  const state = c.req.query("state");
  if (!state) {
    return c.json({ error: "Missing state" }, 400);
  }

  pruneOauthResults();
  const result = oauthResults.get(state);

  if (!result) {
    return c.json({ status: "pending" });
  }

  if (result.error) {
    oauthResults.delete(state);
    return c.json({ status: "error", error: result.error });
  }

  if (result.code) {
    oauthResults.delete(state);
    return c.json({ status: "complete", code: result.code });
  }

  return c.json({ status: "pending" });
});

/**
 * Exchange or refresh OAuth tokens.
 */
googleCalendar.post("/integrations/google/token", async (c) => {
  const body = await c.req.json();
  const parsed = googleTokenRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      400
    );
  }

  const {
    grantType,
    code,
    codeVerifier,
    refreshToken,
    redirectUri,
    clientId,
    clientSecret,
  } = parsed.data;

  const params = new URLSearchParams();
  params.set("client_id", clientId);
  const resolvedSecret = clientSecret ?? process.env.GOOGLE_CLIENT_SECRET;
  if (resolvedSecret) {
    params.set("client_secret", resolvedSecret);
  }

  if (grantType === "authorization_code") {
    params.set("grant_type", "authorization_code");
    params.set("redirect_uri", redirectUri);
    params.set("code", code ?? "");
    params.set("code_verifier", codeVerifier ?? "");
  } else {
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", refreshToken ?? "");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await response.json().catch(() => ({}));
  return c.json(data, response.status);
});

/**
 * Proxy Google Calendar events list.
 */
googleCalendar.post("/integrations/google/events", async (c) => {
  const body = await c.req.json();
  const parsed = googleEventsRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      400
    );
  }

  const {
    accessToken,
    calendarId,
    timeMin,
    timeMax,
    syncToken,
    pageToken,
    maxResults,
  } = parsed.data;

  if (!syncToken && (!timeMin || !timeMax)) {
    return c.json(
      { error: "timeMin and timeMax are required without syncToken" },
      400
    );
  }

  const params = new URLSearchParams();

  if (syncToken) {
    params.set("syncToken", syncToken);
    params.set("showDeleted", "true");
  } else {
    params.set("timeMin", timeMin ?? "");
    params.set("timeMax", timeMax ?? "");
    params.set("singleEvents", "true");
    params.set("orderBy", "startTime");
    params.set("showDeleted", "true");
  }

  if (pageToken) params.set("pageToken", pageToken);
  if (maxResults) params.set("maxResults", maxResults.toString());

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calendarId ?? "primary"
  )}/events?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  return c.json(data, response.status);
});

export default googleCalendar;
