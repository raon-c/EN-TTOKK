import {
  type DailyNotesSettings,
  DEFAULT_DAILY_NOTES_SETTINGS,
} from "@/features/daily-notes/types";

export type Theme = "light" | "dark" | "system";

export interface Settings {
  theme: Theme;
  dailyNotes: DailyNotesSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  dailyNotes: DEFAULT_DAILY_NOTES_SETTINGS,
};
