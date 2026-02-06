import { formatInKst, getKstDateKey } from "@bun-enttokk/shared";
import { isValid, parse } from "date-fns";
import { create } from "zustand";

import { commands, type FileEntry } from "@/bindings";
import { useVaultStore } from "@/features/vault/store/vaultStore";
import { unwrap } from "@/lib/tauri-helpers";

import {
  type DailyNotesSettings,
  DEFAULT_DAILY_NOTES_SETTINGS,
} from "../types";

function sanitizeFolderName(folder: string): string {
  return folder
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "")
    .replace(/^[.~]/, "")
    .trim();
}

function processTemplate(template: string, date: Date): string {
  const year = formatInKst(date, "yyyy");
  const month = formatInKst(date, "MM");
  const day = formatInKst(date, "dd");
  const dateStr = formatInKst(date, "yyyy-MM-dd");
  const dayOfWeek = formatInKst(date, "EEEE");
  const dayOfWeekShort = formatInKst(date, "EEE");

  return template
    .replace(/\{\{date\}\}/g, dateStr)
    .replace(/\{\{year\}\}/g, year)
    .replace(/\{\{month\}\}/g, month)
    .replace(/\{\{day\}\}/g, day)
    .replace(/\{\{dayOfWeek\}\}/g, dayOfWeek)
    .replace(/\{\{dayOfWeekShort\}\}/g, dayOfWeekShort);
}

interface DailyNotesStore {
  existingDates: Set<string>;
  isScanning: boolean;
  error: string | null;

  scanDailyNotes: (settings?: DailyNotesSettings) => Promise<void>;
  openOrCreateDailyNote: (
    date: Date,
    settings?: DailyNotesSettings
  ) => Promise<void>;
  hasNoteForDate: (date: Date, settings?: DailyNotesSettings) => boolean;
  clearError: () => void;
}

export const useDailyNotesStore = create<DailyNotesStore>()((set, get) => ({
  existingDates: new Set<string>(),
  isScanning: false,
  error: null,

  scanDailyNotes: async (settings = DEFAULT_DAILY_NOTES_SETTINGS) => {
    const vaultPath = useVaultStore.getState().path;
    if (!vaultPath) return;

    const mergedSettings = {
      ...DEFAULT_DAILY_NOTES_SETTINGS,
      ...settings,
    };

    set({ isScanning: true, error: null });

    try {
      const sanitizedFolder = sanitizeFolderName(mergedSettings.folder);
      if (!sanitizedFolder) {
        set({ existingDates: new Set(), isScanning: false });
        return;
      }

      const folderPath = `${vaultPath}/${sanitizedFolder}`;
      const result = await commands.readDirectory(folderPath);

      const files: FileEntry[] = result.status === "ok" ? result.data : [];

      const datePattern = /^\d{4}-\d{2}-\d{2}\.md$/;
      const existingDates = new Set<string>();

      for (const file of files) {
        if (file.is_dir) continue;
        if (!datePattern.test(file.name)) continue;

        const dateStr = file.name.replace(/\.md$/, "");
        const parsed = parse(dateStr, "yyyy-MM-dd", new Date());

        if (isValid(parsed)) {
          existingDates.add(dateStr);
        }
      }

      set({ existingDates, isScanning: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to scan",
        isScanning: false,
      });
    }
  },

  openOrCreateDailyNote: async (
    date: Date,
    settings = DEFAULT_DAILY_NOTES_SETTINGS
  ) => {
    const {
      path: vaultPath,
      openNote,
      refreshFiles,
    } = useVaultStore.getState();

    const mergedSettings = {
      ...DEFAULT_DAILY_NOTES_SETTINGS,
      ...settings,
    };

    set({ error: null });

    try {
      if (!vaultPath) throw new Error("No vault open");

      const sanitizedFolder = sanitizeFolderName(mergedSettings.folder);
      if (!sanitizedFolder) throw new Error("Invalid folder name");

      const formattedDate = formatInKst(date, mergedSettings.dateFormat);
      const folderPath = `${vaultPath}/${sanitizedFolder}`;
      const notePath = `${folderPath}/${formattedDate}.md`;

      const folderResult = await commands.readDirectory(folderPath);
      const folderExists = folderResult.status === "ok";

      if (!folderExists) {
        await unwrap(commands.createFolder(folderPath, vaultPath));
      }

      const { existingDates } = get();
      const dateKey = getKstDateKey(date);

      if (!existingDates.has(dateKey)) {
        const content = processTemplate(mergedSettings.template, date);
        await unwrap(commands.writeFile(notePath, content, vaultPath));

        set((state) => ({
          existingDates: new Set([...state.existingDates, dateKey]),
        }));
      }

      await refreshFiles();
      await openNote(notePath);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  hasNoteForDate: (date: Date, settings = DEFAULT_DAILY_NOTES_SETTINGS) => {
    const mergedSettings = {
      ...DEFAULT_DAILY_NOTES_SETTINGS,
      ...settings,
    };
    const dateKey = formatInKst(date, mergedSettings.dateFormat);
    return get().existingDates.has(dateKey);
  },

  clearError: () => {
    set({ error: null });
  },
}));
