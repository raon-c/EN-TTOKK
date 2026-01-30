import { getKstDateKey } from "@bun-enttokk/shared";
import { create } from "zustand";

import {
  getClaudeActivities,
  getClaudeActivityDates,
  listClaudeProjects,
} from "@/lib/claude";
import { getValue, setValue } from "@/lib/tauri-store";

import type {
  ClaudeActivityItem,
  ClaudeActivityResponse,
  ClaudeActivityStatus,
} from "../types";

const SUBSCRIBED_FOLDERS_KEY = "claude-activity.subscribedFolders";

type ClaudeActivityStoreState = {
  status: ClaudeActivityStatus;
  error: string | null;
  selectedDate: Date;
  activities: ClaudeActivityItem[];
  isLoading: boolean;
  activeRequestId: number | null;

  // Subscription settings
  subscribedFolders: string[];
  availableProjects: string[];

  // Activity dates for calendar highlighting
  activityDates: Set<number>;
  activityDatesMonth: { year: number; month: number } | null;

  // Settings dialog state
  isSettingsOpen: boolean;

  // Actions
  selectDate: (date: Date | undefined) => Promise<void>;
  refresh: () => Promise<void>;
  loadProjects: () => Promise<void>;
  addSubscribedFolder: (folder: string) => Promise<void>;
  removeSubscribedFolder: (folder: string) => Promise<void>;
  setSubscribedFolders: (folders: string[]) => Promise<void>;
  loadSavedFolders: () => Promise<void>;
  loadActivityDates: (year: number, month: number) => Promise<void>;
  openSettings: () => void;
  closeSettings: () => void;
};

const formatDateKey = (date: Date) => getKstDateKey(date);

const resolveErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
};

const fetchActivity = async (
  date: Date,
  subscribedFolders: string[],
  set: (partial: Partial<ClaudeActivityStoreState>) => void,
  get: () => ClaudeActivityStoreState
) => {
  const dateKey = formatDateKey(date);
  const requestId = Date.now();
  set({
    isLoading: true,
    error: null,
    status: "loading",
    activeRequestId: requestId,
  });

  try {
    const response: ClaudeActivityResponse = await getClaudeActivities(
      dateKey,
      subscribedFolders
    );
    if (get().activeRequestId !== requestId) return;
    set({
      status: "loaded",
      activities: response.items ?? [],
      error: null,
    });
  } catch (error) {
    const message = resolveErrorMessage(
      error,
      "Failed to load Claude activity"
    );
    if (get().activeRequestId !== requestId) return;
    set({
      status: "error",
      activities: [],
      error: message,
    });
  } finally {
    if (get().activeRequestId === requestId) {
      set({ isLoading: false, activeRequestId: null });
    }
  }
};

export const useClaudeActivityStore = create<ClaudeActivityStoreState>(
  (set, get) => ({
    status: "idle",
    error: null,
    selectedDate: new Date(),
    activities: [],
    isLoading: false,
    activeRequestId: null,

    subscribedFolders: [],
    availableProjects: [],

    activityDates: new Set<number>(),
    activityDatesMonth: null,

    isSettingsOpen: false,

    selectDate: async (date) => {
      if (!date) return;
      set({ selectedDate: date });
      await fetchActivity(date, get().subscribedFolders, set, get);
    },

    refresh: async () => {
      const { selectedDate, subscribedFolders } = get();
      await fetchActivity(selectedDate, subscribedFolders, set, get);

      // Also refresh activity dates for current month
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      await get().loadActivityDates(year, month);
    },

    loadProjects: async () => {
      try {
        const projects = await listClaudeProjects();
        set({ availableProjects: projects });
      } catch {
        // Silent fail - settings dialog will show empty project list
      }
    },

    addSubscribedFolder: async (folder) => {
      const current = get().subscribedFolders;
      if (!current.includes(folder)) {
        const updated = [...current, folder];
        set({ subscribedFolders: updated });
        await setValue(SUBSCRIBED_FOLDERS_KEY, updated);
      }
    },

    removeSubscribedFolder: async (folder) => {
      const current = get().subscribedFolders;
      const updated = current.filter((f) => f !== folder);
      set({ subscribedFolders: updated });
      await setValue(SUBSCRIBED_FOLDERS_KEY, updated);
    },

    setSubscribedFolders: async (folders) => {
      set({ subscribedFolders: folders });
      await setValue(SUBSCRIBED_FOLDERS_KEY, folders);
    },

    loadSavedFolders: async () => {
      const saved = await getValue<string[]>(SUBSCRIBED_FOLDERS_KEY);
      if (saved && Array.isArray(saved)) {
        set({ subscribedFolders: saved });
      }
    },

    loadActivityDates: async (year, month) => {
      const { subscribedFolders, activityDatesMonth } = get();

      // Skip if already loaded for this month
      if (
        activityDatesMonth &&
        activityDatesMonth.year === year &&
        activityDatesMonth.month === month
      ) {
        return;
      }

      try {
        const days = await getClaudeActivityDates(
          subscribedFolders,
          year,
          month
        );
        set({
          activityDates: new Set(days),
          activityDatesMonth: { year, month },
        });
      } catch {
        // Silent fail - calendar will not show activity indicators
      }
    },

    openSettings: () => {
      set({ isSettingsOpen: true });
    },

    closeSettings: () => {
      set({ isSettingsOpen: false });
    },
  })
);
