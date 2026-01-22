import { create } from "zustand";

import { getValue, setValue } from "@/lib/tauri-store";

import { DEFAULT_SETTINGS, type Settings, type Theme } from "../types";

const SETTINGS_KEY = "settings";

interface SettingsStore {
  settings: Settings;
  isLoading: boolean;
  _hasHydrated: boolean;

  setTheme: (theme: Theme) => Promise<void>;
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

  loadSettings: async () => {
    set({ isLoading: true });

    try {
      const stored = await getValue<Settings>(SETTINGS_KEY);
      if (stored) {
        set({ settings: { ...DEFAULT_SETTINGS, ...stored } });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      set({ isLoading: false, _hasHydrated: true });
    }
  },

  setHasHydrated: (state: boolean) => {
    set({ _hasHydrated: state });
  },
}));
