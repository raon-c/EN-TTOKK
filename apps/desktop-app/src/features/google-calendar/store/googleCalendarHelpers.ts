import {
  KST_TIMEZONE,
  parseDateKeyInTimeZone,
  startOfKstDay,
  endOfKstDay,
} from "@bun-enttokk/shared";
import type {
  GoogleCalendarEvent,
  GoogleCalendarEventsResponse,
  GoogleCalendarTokenResponse,
} from "@enttokk/api-types";
import { addDays, subDays } from "date-fns";

import { apiClient } from "@/lib/api-client";

import {
  GOOGLE_CLIENT_ID,
  GOOGLE_REDIRECT_URI,
  GOOGLE_SCOPES,
  SYNC_RANGE_FUTURE_DAYS,
  SYNC_RANGE_PAST_DAYS,
} from "../config";
import type { GoogleCalendarTokens } from "../types";

const GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

export class SyncTokenExpiredError extends Error {
  constructor() {
    super("Sync token expired");
  }
}

export const buildAuthUrl = async (state: string, codeChallenge: string) => {
  const params = new URLSearchParams();
  params.set("client_id", GOOGLE_CLIENT_ID);
  params.set("redirect_uri", GOOGLE_REDIRECT_URI);
  params.set("response_type", "code");
  params.set("access_type", "offline");
  params.set("prompt", "consent");
  params.set("scope", GOOGLE_SCOPES.join(" "));
  params.set("state", state);
  params.set("code_challenge", codeChallenge);
  params.set("code_challenge_method", "S256");
  return `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`;
};

export const mapTokenResponse = (
  response: GoogleCalendarTokenResponse,
  previous: GoogleCalendarTokens | null
): GoogleCalendarTokens => {
  const expiresAtMs =
    Date.now() + response.expires_in * 1000 - TOKEN_EXPIRY_SAFETY_MS;
  const finalExpiresAtMs = Math.max(Date.now(), expiresAtMs);
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? previous?.refreshToken,
    expiresAt: new Date(finalExpiresAtMs).toISOString(),
    scope: response.scope,
    tokenType: response.token_type,
  };
};

export const buildTimeRange = () => {
  const now = new Date();
  const timeMin = startOfKstDay(subDays(now, SYNC_RANGE_PAST_DAYS));
  const timeMax = endOfKstDay(addDays(now, SYNC_RANGE_FUTURE_DAYS));
  return {
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
  };
};

const getEventStart = (event: GoogleCalendarEvent): number => {
  const startValue = event.start?.dateTime ?? event.start?.date;
  if (!startValue) return 0;
  if (event.start?.date && !event.start?.dateTime) {
    const timeZone = event.start.timeZone ?? KST_TIMEZONE;
    const parsed = parseDateKeyInTimeZone(startValue, timeZone);
    return parsed ? parsed.getTime() : 0;
  }
  return new Date(startValue).getTime();
};

export const sortEvents = (events: GoogleCalendarEvent[]) =>
  [...events].sort((a, b) => getEventStart(a) - getEventStart(b));

export const mergeEvents = (
  current: GoogleCalendarEvent[],
  incoming: GoogleCalendarEvent[]
) => {
  const map = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) {
    if (event.status === "cancelled") {
      map.delete(event.id);
    } else {
      map.set(event.id, event);
    }
  }
  return sortEvents(Array.from(map.values()));
};

export const filterCancelled = (events: GoogleCalendarEvent[]) =>
  events.filter((event) => event.status !== "cancelled");

const extractErrorMessage = (data: GoogleCalendarEventsResponse): string => {
  const maybeError = data as unknown as { error?: { message?: string } };
  return maybeError.error?.message ?? "Google Calendar request failed";
};

export const fetchAllEvents = async (params: {
  accessToken: string;
  calendarId: string;
  timeMin?: string;
  timeMax?: string;
  syncToken?: string;
}): Promise<{ events: GoogleCalendarEvent[]; nextSyncToken?: string }> => {
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  const events: GoogleCalendarEvent[] = [];

  while (true) {
    const { status, data } = await apiClient.googleCalendar.listEvents({
      accessToken: params.accessToken,
      calendarId: params.calendarId,
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      syncToken: params.syncToken,
      pageToken,
      maxResults: 250,
    });

    if (status === 410) {
      throw new SyncTokenExpiredError();
    }

    if (status >= 400) {
      throw new Error(extractErrorMessage(data));
    }

    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) {
      nextSyncToken = data.nextSyncToken;
      break;
    }
  }

  return { events, nextSyncToken };
};
