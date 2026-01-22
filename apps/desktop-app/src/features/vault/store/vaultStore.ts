import { Effect } from "effect";
import { create } from "zustand";

import { commands, type FileEntry, type VaultConfig } from "@/bindings";
import { NoVaultError, runCommand, runEffect } from "@/lib/effect";
import { getValue, setValue } from "@/lib/tauri-store";
import type { Note } from "@/types/note";

// Re-export types from bindings for external use
export type { FileEntry, VaultConfig };

const VAULT_KEY = "vault";

interface StoredVault {
  path: string;
  name: string;
}

interface VaultStore {
  path: string | null;
  name: string;
  files: FileEntry[];
  activeNote: Note | null;
  allNotes: string[];
  error: string | null;
  _hasHydrated: boolean;

  loadVault: () => Promise<void>;
  openVault: (path: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;

  refreshFiles: () => Promise<void>;
  openNote: (path: string) => Promise<void>;
  openNoteByName: (name: string) => Promise<void>;
  saveNote: (path: string, content: string) => Promise<void>;
  createNote: (name: string, folder?: string) => Promise<string>;
  deleteNote: (path: string) => Promise<void>;
  renameNote: (oldPath: string, newPath: string) => Promise<void>;
  closeNote: () => void;
  closeVault: () => Promise<void>;

  findNotePath: (name: string) => string | null;
  clearError: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useVaultStore = create<VaultStore>()((set, get) => ({
  path: null,
  name: "",
  files: [],
  activeNote: null,
  allNotes: [],
  error: null,
  _hasHydrated: false,

  loadVault: async () => {
    try {
      const stored = await getValue<StoredVault>(VAULT_KEY);
      if (stored) {
        set({ path: stored.path, name: stored.name });
      }
    } catch (error) {
      console.error("Failed to load vault:", error);
    } finally {
      set({ _hasHydrated: true });
    }
  },

  openVault: async (vaultPath: string) => {
    set({ error: null });

    const program = Effect.gen(function* () {
      const { path, name } = yield* runCommand(() =>
        commands.openVault(vaultPath)
      );
      const files = yield* runCommand(() => commands.readDirectory(vaultPath));
      const allNotes = yield* runCommand(() => commands.getAllNotes(vaultPath));

      set({
        path,
        name,
        files,
        allNotes,
        activeNote: null,
      });

      return { path, name };
    });

    const result = await runEffect({
      effect: program,
      onError: (message) => set({ error: message }),
    });

    // Save to Tauri Store after successful open
    if (result) {
      await setValue(VAULT_KEY, { path: result.path, name: result.name });
    }
  },

  refreshFiles: async () => {
    const { path } = get();
    if (!path) return;

    const program = Effect.gen(function* () {
      const files = yield* runCommand(() => commands.readDirectory(path));
      const allNotes = yield* runCommand(() => commands.getAllNotes(path));

      set({ files, allNotes });
    });

    await runEffect({
      effect: program,
      onError: (message) => set({ error: message }),
    });
  },

  openNote: async (notePath: string) => {
    const { path: vaultPath } = get();

    const program = Effect.gen(function* () {
      if (!vaultPath) {
        return yield* Effect.fail(
          new NoVaultError({ message: "No vault open" })
        );
      }

      const content = yield* runCommand(() =>
        commands.readFile(notePath, vaultPath)
      );

      const fileName = notePath.split("/").pop() ?? "Untitled";
      const title = fileName.replace(/\.md$/, "");

      const note: Note = {
        id: notePath,
        title,
        path: notePath,
        content,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: extractTags(content),
        links: extractWikiLinks(content),
      };

      set({ activeNote: note, error: null });
    });

    await runEffect({
      effect: program,
      onError: (message) => set({ error: message }),
    });
  },

  saveNote: async (notePath: string, content: string) => {
    const { path: vaultPath } = get();

    const program = Effect.gen(function* () {
      if (!vaultPath) {
        return yield* Effect.fail(
          new NoVaultError({ message: "No vault open" })
        );
      }

      yield* runCommand(() => commands.writeFile(notePath, content, vaultPath));

      const { activeNote } = get();
      if (activeNote && activeNote.path === notePath) {
        set({
          activeNote: {
            ...activeNote,
            content,
            updatedAt: new Date(),
            tags: extractTags(content),
            links: extractWikiLinks(content),
          },
        });
      }
    });

    await runEffect({
      effect: program,
      onError: (message) => set({ error: message }),
    });
  },

  createNote: async (name: string, folder?: string) => {
    const { path: vaultPath } = get();

    const program = Effect.gen(function* () {
      if (!vaultPath) {
        return yield* Effect.fail(
          new NoVaultError({ message: "No vault open" })
        );
      }

      const fileName = name.endsWith(".md") ? name : `${name}.md`;
      const notePath = folder
        ? `${folder}/${fileName}`
        : `${vaultPath}/${fileName}`;

      yield* runCommand(() => commands.createFile(notePath, vaultPath));

      return notePath;
    });

    set({ error: null });
    const notePath = await runEffect({
      effect: program,
      onError: (message) => set({ error: message }),
    });
    await get().refreshFiles();

    return notePath;
  },

  deleteNote: async (notePath: string) => {
    const { path: vaultPath } = get();

    const program = Effect.gen(function* () {
      if (!vaultPath) {
        return yield* Effect.fail(
          new NoVaultError({ message: "No vault open" })
        );
      }

      yield* runCommand(() => commands.deleteFile(notePath, vaultPath));

      const { activeNote } = get();
      if (activeNote?.path === notePath) {
        set({ activeNote: null });
      }
    });

    set({ error: null });
    await runEffect({
      effect: program,
      onError: (message) => set({ error: message }),
    });
    await get().refreshFiles();
  },

  renameNote: async (oldPath: string, newPath: string) => {
    const { path: vaultPath } = get();

    const program = Effect.gen(function* () {
      if (!vaultPath) {
        return yield* Effect.fail(
          new NoVaultError({ message: "No vault open" })
        );
      }

      yield* runCommand(() => commands.renameFile(oldPath, newPath, vaultPath));

      const { activeNote } = get();
      if (activeNote?.path === oldPath) {
        const fileName = newPath.split("/").pop() ?? "Untitled";
        const title = fileName.replace(/\.md$/, "");
        set({
          activeNote: {
            ...activeNote,
            path: newPath,
            title,
          },
        });
      }
    });

    set({ error: null });
    await runEffect({
      effect: program,
      onError: (message) => set({ error: message }),
    });

    await get().refreshFiles();
  },

  createFolder: async (folderPath: string) => {
    const { path: vaultPath } = get();

    const program = Effect.gen(function* () {
      if (!vaultPath) {
        return yield* Effect.fail(
          new NoVaultError({ message: "No vault open" })
        );
      }

      yield* runCommand(() => commands.createFolder(folderPath, vaultPath));
    });

    set({ error: null });
    await runEffect({
      effect: program,
      onError: (message) => set({ error: message }),
    });
    await get().refreshFiles();
  },

  closeNote: () => {
    set({ activeNote: null });
  },

  findNotePath: (name: string) => {
    const { files, path: vaultPath } = get();
    if (!vaultPath) return null;

    const searchName = name.endsWith(".md") ? name : `${name}.md`;

    const findInTree = (nodes: FileEntry[]): string | null => {
      for (const node of nodes) {
        if (
          !node.is_dir &&
          node.name.toLowerCase() === searchName.toLowerCase()
        ) {
          return node.path;
        }
        if (node.is_dir && node.children) {
          const found = findInTree(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    return findInTree(files);
  },

  openNoteByName: async (name: string) => {
    const program = Effect.gen(function* () {
      const { findNotePath, openNote, createNote } = get();
      const notePath = findNotePath(name);

      if (notePath) {
        yield* Effect.promise(() => openNote(notePath));
      } else {
        const newPath = yield* Effect.promise(() => createNote(name));
        yield* Effect.promise(() => openNote(newPath));
      }
    });

    await runEffect({
      effect: program,
      onError: (message) => set({ error: message }),
    });
  },

  clearError: () => {
    set({ error: null });
  },

  closeVault: async () => {
    set({
      path: null,
      name: "",
      files: [],
      activeNote: null,
      allNotes: [],
      error: null,
    });

    // Clear from Tauri Store
    await setValue(VAULT_KEY, null);
  },

  setHasHydrated: (state: boolean) => {
    set({ _hasHydrated: state });
  },
}));

function extractTags(content: string): string[] {
  const tagRegex = /#([a-zA-Z0-9_-]+)/g;
  const matches = content.match(tagRegex);
  if (!matches) return [];
  return [...new Set(matches.map((tag) => tag.slice(1)))];
}

function extractWikiLinks(content: string): Note["links"] {
  const linkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const matches = content.matchAll(linkRegex);

  return Array.from(matches).map((match) => ({
    target: match[1],
    alias: match[2],
    exists: true,
  }));
}
