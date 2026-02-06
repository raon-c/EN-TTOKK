import type { GoogleCalendarEvent } from "@enttokk/api-types";
import { openUrl } from "@tauri-apps/plugin-opener";
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
  POLL_INTERVAL_MS,
} from "../config";
import type { GoogleCalendarStoredState, GoogleCalendarTokens } from "../types";
import { buildDayRange, filterEventsForDate } from "../utils/dates";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "../utils/pkce";
import {
  buildAuthUrl,
  buildTimeRange,
  fetchAllEvents,
  filterCancelled,
  mapTokenResponse,
  mergeEvents,
  sortEvents,
  SyncTokenExpiredError,
} from "./googleCalendarHelpers";

const STORAGE_KEY = "googleCalendar";
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

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
  lastSyncAt: string | null;
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

const normalizeTimestamps = (
  stored: GoogleCalendarStoredState
): GoogleCalendarStoredState => {
  const normalized = { ...stored };

  if (normalized.tokens?.expiresAt) {
    const expiresAt = normalized.tokens.expiresAt;
    if (typeof expiresAt === "number") {
      normalized.tokens = {
        ...normalized.tokens,
        expiresAt: new Date(expiresAt).toISOString(),
      };
    }
  }

  if (normalized.lastSyncAt && typeof normalized.lastSyncAt === "number") {
    normalized.lastSyncAt = new Date(normalized.lastSyncAt).toISOString();
  }

  return normalized;
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

const ensureAccessToken = async (
  get: () => GoogleCalendarStore,
  set: (partial: Partial<GoogleCalendarStore>) => void
): Promise<string> => {
  const current = get().tokens;
  if (!current) throw new Error("Missing tokens");

  const expiresAtMs = Date.parse(current.expiresAt);
  const isExpired = expiresAtMs - Date.now() < TOKEN_EXPIRY_SAFETY_MS;
  if (!isExpired) return current.accessToken;

  if (!current.refreshToken) throw new Error("Refresh token missing");
  if (!GOOGLE_CLIENT_ID) throw new Error("VITE_GOOGLE_CLIENT_ID is not configured");

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

const pollForAuthCode = async (state: string): Promise<string> => {
  const deadline = Date.now() + AUTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await apiClient.googleCalendar.pollAuthResult(state);
    if (result.status === "complete" && result.code) return result.code;
    if (result.status === "error") throw new Error(result.error ?? "Authorization failed");
    await new Promise((resolve) => setTimeout(resolve, AUTH_POLL_INTERVAL_MS));
  }
  throw new Error("Authorization timed out");
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
        const normalized = normalizeTimestamps(stored);
        set({
          tokens: normalized.tokens,
          calendarId: normalized.calendarId ?? DEFAULT_CALENDAR_ID,
          syncToken: normalized.syncToken ?? null,
          lastSyncAt: normalized.lastSyncAt ?? null,
          status: "connected",
          error: null,
        });
      }
    },

    connect: async () => {
      if (!GOOGLE_CLIENT_ID) {
        set({ status: "error", error: "VITE_GOOGLE_CLIENT_ID is not configured" });
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
        set({ tokens, status: "connected", error: null });

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

        set({ status: "connected", lastSyncAt: new Date().toISOString() });
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
      set({ selectedDate: date, selectedEvents: currentEvents, error: null });

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
        set({ selectedEvents: filtered, events: mergedEvents });
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
