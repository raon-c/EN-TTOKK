import {
  endOfKstDay,
  KST_TIMEZONE,
  parseDateKeyInTimeZone,
  startOfKstDay,
} from "@bun-enttokk/shared";
import type {
  GoogleCalendarEvent,
  GoogleCalendarEventsResponse,
  GoogleCalendarTokenResponse,
} from "@enttokk/api-types";
import { openUrl } from "@tauri-apps/plugin-opener";
import { addDays, subDays } from "date-fns";
import { create } from "zustand";

import { apiClient } from "@/lib/api-client";
import { getValue, setValue } from "@/lib/tauri-store";

import {
  AUTH_POLL_INTERVAL_MS,
  AUTH_TIMEOUT_MS,
  DEFAULT_CALENDAR_ID,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_SCOPES,
  POLL_INTERVAL_MS,
  SYNC_RANGE_FUTURE_DAYS,
  SYNC_RANGE_PAST_DAYS,
} from "../config";
import type { GoogleCalendarStoredState, GoogleCalendarTokens } from "../types";
import { buildDayRange, filterEventsForDate } from "../utils/dates";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "../utils/pkce";

const STORAGE_KEY = "googleCalendar";
const GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

class SyncTokenExpiredError extends Error {
  constructor() {
    super("Sync token expired");
  }
}

type GoogleCalendarStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

interface GoogleCalendarStore {
  status: GoogleCalendarStatus;
  error: string | null;
  tokens: GoogleCalendarTokens | null;
  calendarId: string;
  syncToken: string | null;
  lastSyncAt: number | null;
  events: GoogleCalendarEvent[];
  selectedDate: Date | null;
  selectedEvents: GoogleCalendarEvent[];
  isSyncing: boolean;
  isDayLoading: boolean;

  loadFromStore: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  syncNow: () => Promise<void>;
  selectDate: (date: Date | undefined) => Promise<void>;
}

const buildAuthUrl = async (state: string, codeChallenge: string) => {
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

const persistState = async (state: GoogleCalendarStore) => {
  const stored: GoogleCalendarStoredState = {
    tokens: state.tokens,
    calendarId: state.calendarId,
    syncToken: state.syncToken,
    lastSyncAt: state.lastSyncAt,
  };
  await setValue(STORAGE_KEY, stored);
};

const mapTokenResponse = (
  response: GoogleCalendarTokenResponse,
  previous: GoogleCalendarTokens | null
): GoogleCalendarTokens => {
  const expiresAt =
    Date.now() + response.expires_in * 1000 - TOKEN_EXPIRY_SAFETY_MS;
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? previous?.refreshToken,
    expiresAt: Math.max(Date.now(), expiresAt),
    scope: response.scope,
    tokenType: response.token_type,
  };
};

const ensureAccessToken = async (
  get: () => GoogleCalendarStore,
  set: (partial: Partial<GoogleCalendarStore>) => void
): Promise<string> => {
  const current = get().tokens;
  if (!current) {
    throw new Error("Missing tokens");
  }

  const isExpired = current.expiresAt - Date.now() < TOKEN_EXPIRY_SAFETY_MS;
  if (!isExpired) return current.accessToken;

  if (!current.refreshToken) {
    throw new Error("Refresh token missing");
  }

  if (!GOOGLE_CLIENT_ID) {
    throw new Error("VITE_GOOGLE_CLIENT_ID is not configured");
  }

  const refreshed = await apiClient.googleCalendar.exchangeToken({
    grantType: "refresh_token",
    refreshToken: current.refreshToken,
    redirectUri: GOOGLE_REDIRECT_URI,
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET || undefined,
  });

  const updatedTokens = mapTokenResponse(refreshed, current);
  set({ tokens: updatedTokens });
  await persistState(get());
  return updatedTokens.accessToken;
};

const buildTimeRange = () => {
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

const sortEvents = (events: GoogleCalendarEvent[]) =>
  [...events].sort((a, b) => getEventStart(a) - getEventStart(b));

const mergeEvents = (
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

const filterCancelled = (events: GoogleCalendarEvent[]) =>
  events.filter((event) => event.status !== "cancelled");

const extractErrorMessage = (data: GoogleCalendarEventsResponse): string => {
  const maybeError = data as unknown as { error?: { message?: string } };
  return maybeError.error?.message ?? "Google Calendar request failed";
};

const pollForAuthCode = async (state: string): Promise<string> => {
  const deadline = Date.now() + AUTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await apiClient.googleCalendar.pollAuthResult(state);
    if (result.status === "complete" && result.code) {
      return result.code;
    }
    if (result.status === "error") {
      throw new Error(result.error ?? "Authorization failed");
    }
    await new Promise((resolve) => setTimeout(resolve, AUTH_POLL_INTERVAL_MS));
  }
  throw new Error("Authorization timed out");
};

const fetchAllEvents = async (params: {
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

export const useGoogleCalendarStore = create<GoogleCalendarStore>(
  (set, get) => ({
    status: "disconnected",
    error: null,
    tokens: null,
    calendarId: DEFAULT_CALENDAR_ID,
    syncToken: null,
    lastSyncAt: null,
    events: [],
    selectedDate: null,
    selectedEvents: [],
    isSyncing: false,
    isDayLoading: false,

    loadFromStore: async () => {
      const stored = await getValue<GoogleCalendarStoredState>(STORAGE_KEY);
      if (stored?.tokens?.accessToken) {
        set({
          tokens: stored.tokens,
          calendarId: stored.calendarId ?? DEFAULT_CALENDAR_ID,
          syncToken: stored.syncToken ?? null,
          lastSyncAt: stored.lastSyncAt ?? null,
          status: "connected",
          error: null,
        });
      }
    },

    connect: async () => {
      if (!GOOGLE_CLIENT_ID) {
        set({
          status: "error",
          error: "VITE_GOOGLE_CLIENT_ID is not configured",
        });
        return;
      }

      set({ status: "connecting", error: null });

      try {
        const state = generateState();
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const authUrl = await buildAuthUrl(state, codeChallenge);

        await openUrl(authUrl);

        const code = await pollForAuthCode(state);

        const tokenResponse = await apiClient.googleCalendar.exchangeToken({
          grantType: "authorization_code",
          code,
          codeVerifier,
          redirectUri: GOOGLE_REDIRECT_URI,
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET || undefined,
        });

        const tokens = mapTokenResponse(tokenResponse, get().tokens);

        set({
          tokens,
          status: "connected",
          error: null,
        });

        await persistState(get());
        await get().syncNow();
        await get().selectDate(new Date());
      } catch (error) {
        set({
          status: "error",
          error: error instanceof Error ? error.message : "Failed to connect",
        });
      }
    },

    disconnect: async () => {
      set({
        status: "disconnected",
        error: null,
        tokens: null,
        syncToken: null,
        lastSyncAt: null,
        events: [],
        selectedDate: null,
        selectedEvents: [],
        isDayLoading: false,
      });
      await setValue(STORAGE_KEY, null);
    },

    syncNow: async () => {
      if (get().isSyncing) return;
      if (!get().tokens?.accessToken) return;

      set({ isSyncing: true, error: null });
      let shouldRetryFullSync = false;

      try {
        const accessToken = await ensureAccessToken(get, set);
        const calendarId = get().calendarId ?? DEFAULT_CALENDAR_ID;
        const currentSyncToken = get().syncToken;

        if (currentSyncToken) {
          const { events, nextSyncToken } = await fetchAllEvents({
            accessToken,
            calendarId,
            syncToken: currentSyncToken,
          });
          const mergedEvents = mergeEvents(get().events, events);
          const selectedDate = get().selectedDate;
          set({
            events: mergedEvents,
            syncToken: nextSyncToken ?? currentSyncToken,
            selectedEvents: selectedDate
              ? filterEventsForDate(mergedEvents, selectedDate)
              : get().selectedEvents,
          });
        } else {
          const { timeMin, timeMax } = buildTimeRange();
          const { events, nextSyncToken } = await fetchAllEvents({
            accessToken,
            calendarId,
            timeMin,
            timeMax,
          });
          const sortedEvents = sortEvents(filterCancelled(events));
          const selectedDate = get().selectedDate;
          set({
            events: sortedEvents,
            syncToken: nextSyncToken ?? null,
            selectedEvents: selectedDate
              ? filterEventsForDate(sortedEvents, selectedDate)
              : get().selectedEvents,
          });
        }

        set({
          status: "connected",
          lastSyncAt: Date.now(),
        });
        await persistState(get());
      } catch (error) {
        if (error instanceof SyncTokenExpiredError) {
          set({ syncToken: null });
          await persistState(get());
          shouldRetryFullSync = true;
        } else {
          set({
            status: "error",
            error: error instanceof Error ? error.message : "Sync failed",
          });
        }
      } finally {
        set({ isSyncing: false });
      }

      if (shouldRetryFullSync) {
        await get().syncNow();
      }
    },

    selectDate: async (date: Date | undefined) => {
      if (!date) return;
      const currentEvents = filterEventsForDate(get().events, date);
      set({
        selectedDate: date,
        selectedEvents: currentEvents,
        error: null,
      });

      if (!get().tokens?.accessToken) return;

      set({ isDayLoading: true });

      try {
        const accessToken = await ensureAccessToken(get, set);
        const { timeMin, timeMax } = buildDayRange(date);
        const calendarId = get().calendarId ?? DEFAULT_CALENDAR_ID;
        const { events } = await fetchAllEvents({
          accessToken,
          calendarId,
          timeMin,
          timeMax,
        });
        const filtered = sortEvents(filterCancelled(events));
        const mergedEvents = mergeEvents(get().events, filtered);
        set({
          selectedEvents: filtered,
          events: mergedEvents,
        });
      } catch (error) {
        set({
          status: "error",
          error:
            error instanceof Error ? error.message : "Failed to load events",
        });
      } finally {
        set({ isDayLoading: false });
      }
    },
  })
);

export const GOOGLE_CALENDAR_POLL_INTERVAL = POLL_INTERVAL_MS;
