import { formatInKst, getKstDateKey } from "@bun-enttokk/shared";
import { isValid, parse } from "date-fns";
import { Effect } from "effect";
import { create } from "zustand";

import { commands, type FileEntry } from "@/bindings";
import { useVaultStore } from "@/features/vault/store/vaultStore";
import { NoVaultError, runCommand, runEffect, VaultError } from "@/lib/effect";

import {
  type DailyNotesSettings,
  DEFAULT_DAILY_NOTES_SETTINGS,
} from "../types";

function sanitizeFolderName(folder: string): string {
  // Remove path traversal characters and normalize
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

    // Merge with defaults to ensure all fields exist
    const mergedSettings = {
      ...DEFAULT_DAILY_NOTES_SETTINGS,
      ...settings,
    };

    set({ isScanning: true, error: null });

    const program = Effect.gen(function* () {
      const sanitizedFolder = sanitizeFolderName(mergedSettings.folder);
      if (!sanitizedFolder) return new Set<string>();

      const folderPath = `${vaultPath}/${sanitizedFolder}`;

      const result = yield* Effect.tryPromise({
        try: () => commands.readDirectory(folderPath),
        catch: () => ({ status: "ok" as const, data: [] as FileEntry[] }),
      });

      if (result.status === "error") {
        return new Set<string>();
      }

      const files = result.data;
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

      return existingDates;
    });

    try {
      const existingDates = await Effect.runPromise(program);
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

    // Merge with defaults to ensure all fields exist
    const mergedSettings = {
      ...DEFAULT_DAILY_NOTES_SETTINGS,
      ...settings,
    };

    const program = Effect.gen(function* () {
      if (!vaultPath) {
        return yield* Effect.fail(
          new NoVaultError({ message: "No vault open" })
        );
      }

      const sanitizedFolder = sanitizeFolderName(mergedSettings.folder);
      if (!sanitizedFolder) {
        return yield* Effect.fail(
          new VaultError({ message: "Invalid folder name" })
        );
      }

      const formattedDate = formatInKst(date, mergedSettings.dateFormat);
      const folderPath = `${vaultPath}/${sanitizedFolder}`;
      const notePath = `${folderPath}/${formattedDate}.md`;

      const folderExists = yield* Effect.tryPromise({
        try: async () => {
          const result = await commands.readDirectory(folderPath);
          return result.status === "ok";
        },
        catch: () => new VaultError({ message: "Failed to check folder" }),
      });

      if (!folderExists) {
        yield* runCommand(() => commands.createFolder(folderPath, vaultPath));
      }

      const { existingDates } = get();
      const dateKey = getKstDateKey(date);

      if (!existingDates.has(dateKey)) {
        const content = processTemplate(mergedSettings.template, date);
        yield* runCommand(() =>
          commands.writeFile(notePath, content, vaultPath)
        );

        set((state) => ({
          existingDates: new Set([...state.existingDates, dateKey]),
        }));
      }

      yield* Effect.promise(() => refreshFiles());
      yield* Effect.promise(() => openNote(notePath));
    });

    set({ error: null });
    await runEffect({
      effect: program,
      onError: (message) => set({ error: message }),
    });
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
