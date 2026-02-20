import { create } from "zustand";

import {
  type DailyNotesSettings,
  DEFAULT_DAILY_NOTES_SETTINGS,
} from "@/features/daily-notes/types";
import { getValue, setValue } from "@/lib/tauri-store";

import { DEFAULT_SETTINGS, type Settings, type Theme } from "../types";

const SETTINGS_KEY = "settings";

interface SettingsStore {
  settings: Settings;
  isLoading: boolean;
  _hasHydrated: boolean;

  setTheme: (theme: Theme) => Promise<void>;
  setDailyNotesFolder: (folder: string) => Promise<void>;
  setDailyNotesTemplate: (template: string) => Promise<void>;
  setDailyNotesSettings: (settings: DailyNotesSettings) => Promise<void>;
  loadSettings: () => Promise<void>;
  setHasHydrated: (state: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: true,
  _hasHydrated: false,

  setTheme: async (theme: Theme) => {
    const { settings } = get();
    const newSettings: Settings = { ...settings, theme };

    set({ settings: newSettings });
    await setValue(SETTINGS_KEY, newSettings);
  },

  setDailyNotesFolder: async (folder: string) => {
    const { settings } = get();
    const newSettings: Settings = {
      ...settings,
      dailyNotes: {
        ...DEFAULT_DAILY_NOTES_SETTINGS,
        ...settings.dailyNotes,
        folder,
      },
    };

    set({ settings: newSettings });
    await setValue(SETTINGS_KEY, newSettings);
  },

  setDailyNotesTemplate: async (template: string) => {
    const { settings } = get();
    const newSettings: Settings = {
      ...settings,
      dailyNotes: {
        ...DEFAULT_DAILY_NOTES_SETTINGS,
        ...settings.dailyNotes,
        template,
      },
    };

    set({ settings: newSettings });
    await setValue(SETTINGS_KEY, newSettings);
  },

  setDailyNotesSettings: async (dailyNotes: DailyNotesSettings) => {
    const { settings } = get();
    const newSettings: Settings = {
      ...settings,
      dailyNotes: {
        ...DEFAULT_DAILY_NOTES_SETTINGS,
        ...dailyNotes,
      },
    };

    set({ settings: newSettings });
    await setValue(SETTINGS_KEY, newSettings);
  },

  loadSettings: async () => {
    set({ isLoading: true });

    try {
      const stored = await getValue<Settings>(SETTINGS_KEY);
      if (stored) {
        // Deep merge for nested objects like dailyNotes
        const mergedSettings: Settings = {
          ...DEFAULT_SETTINGS,
          ...stored,
          dailyNotes: {
            ...DEFAULT_SETTINGS.dailyNotes,
            ...stored.dailyNotes,
          },
        };
        set({ settings: mergedSettings });
      }
    } catch {
      // Failed to load settings, use defaults silently
    } finally {
      set({ isLoading: false, _hasHydrated: true });
    }
  },

  setHasHydrated: (state: boolean) => {
    set({ _hasHydrated: state });
  },
}));
