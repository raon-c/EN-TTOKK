import { create } from "zustand";

import { commands, type FileEntry, type VaultConfig } from "@/bindings";
import { htmlToMarkdown, markdownToHtml } from "@/lib/markdown";
import { unwrap } from "@/lib/tauri-helpers";
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
    } catch {
      // Silently fail — vault will remain unset
    } finally {
      set({ _hasHydrated: true });
    }
  },

  openVault: async (vaultPath: string) => {
    set({ error: null });
    try {
      const { path, name } = await unwrap(commands.openVault(vaultPath));
      const files = await unwrap(commands.readDirectory(vaultPath));
      const allNotes = await unwrap(commands.getAllNotes(vaultPath));

      set({ path, name, files, allNotes, activeNote: null });

      await setValue(VAULT_KEY, { path, name });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  refreshFiles: async () => {
    const { path } = get();
    if (!path) return;

    try {
      const files = await unwrap(commands.readDirectory(path));
      const allNotes = await unwrap(commands.getAllNotes(path));
      set({ files, allNotes });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  openNote: async (notePath: string) => {
    const { path: vaultPath } = get();

    try {
      if (!vaultPath) throw new Error("No vault open");

      const rawContent = await unwrap(commands.readFile(notePath, vaultPath));

      const content = markdownToHtml(rawContent);
      const fileName = notePath.split("/").pop() ?? "Untitled";
      const title = fileName.replace(/\.md$/, "");

      const note: Note = {
        id: notePath,
        title,
        path: notePath,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: extractTags(rawContent),
        links: extractWikiLinks(rawContent),
      };

      set({ activeNote: note, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  saveNote: async (notePath: string, content: string) => {
    const { path: vaultPath } = get();

    try {
      if (!vaultPath) throw new Error("No vault open");

      const markdownContent = htmlToMarkdown(content);
      await unwrap(commands.writeFile(notePath, markdownContent, vaultPath));

      const { activeNote } = get();
      if (activeNote && activeNote.path === notePath) {
        set({
          activeNote: {
            ...activeNote,
            content,
            updatedAt: new Date().toISOString(),
            tags: extractTags(markdownContent),
            links: extractWikiLinks(markdownContent),
          },
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  createNote: async (name: string, folder?: string) => {
    const { path: vaultPath } = get();

    set({ error: null });
    try {
      if (!vaultPath) throw new Error("No vault open");

      const fileName = name.endsWith(".md") ? name : `${name}.md`;
      const notePath = folder
        ? `${folder}/${fileName}`
        : `${vaultPath}/${fileName}`;

      await unwrap(commands.createFile(notePath, vaultPath));
      await get().refreshFiles();

      return notePath;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },

  deleteNote: async (notePath: string) => {
    const { path: vaultPath } = get();

    set({ error: null });
    try {
      if (!vaultPath) throw new Error("No vault open");

      await unwrap(commands.deleteFile(notePath, vaultPath));

      const { activeNote } = get();
      if (activeNote?.path === notePath) {
        set({ activeNote: null });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
    await get().refreshFiles();
  },

  renameNote: async (oldPath: string, newPath: string) => {
    const { path: vaultPath } = get();

    set({ error: null });
    try {
      if (!vaultPath) throw new Error("No vault open");

      await unwrap(commands.renameFile(oldPath, newPath, vaultPath));

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
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }

    await get().refreshFiles();
  },

  createFolder: async (folderPath: string) => {
    const { path: vaultPath } = get();

    set({ error: null });
    try {
      if (!vaultPath) throw new Error("No vault open");
      await unwrap(commands.createFolder(folderPath, vaultPath));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
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
    try {
      const { findNotePath, openNote, createNote } = get();
      const notePath = findNotePath(name);

      if (notePath) {
        await openNote(notePath);
      } else {
        const newPath = await createNote(name);
        await openNote(newPath);
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
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
