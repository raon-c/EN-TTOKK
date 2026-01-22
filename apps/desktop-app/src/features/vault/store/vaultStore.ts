import { create } from "zustand";

import {
  commands,
  type FileEntry,
  type Result,
  type VaultConfig,
} from "@/bindings";
import type { Note } from "@/types/note";

// Re-export types from bindings for external use
export type { FileEntry, VaultConfig };

interface VaultStore {
  path: string | null;
  name: string;
  files: FileEntry[];
  activeNote: Note | null;
  allNotes: string[];
  error: string | null;

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

  findNotePath: (name: string) => string | null;
  clearError: () => void;
}

function unwrapResult<T>(result: Result<T, string>): T {
  if (result.status === "error") {
    throw new Error(result.error);
  }
  return result.data;
}

export const useVaultStore = create<VaultStore>((set, get) => ({
  path: null,
  name: "",
  files: [],
  activeNote: null,
  allNotes: [],
  error: null,

  openVault: async (vaultPath: string) => {
    try {
      set({ error: null });
      const config = unwrapResult(await commands.openVault(vaultPath));
      const files = unwrapResult(await commands.readDirectory(vaultPath));
      const allNotes = unwrapResult(await commands.getAllNotes(vaultPath));

      set({
        path: config.path,
        name: config.name,
        files,
        allNotes,
        activeNote: null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to open vault";
      set({ error: message });
      throw new Error(message);
    }
  },

  refreshFiles: async () => {
    const { path } = get();
    if (!path) return;

    try {
      const files = unwrapResult(await commands.readDirectory(path));
      const allNotes = unwrapResult(await commands.getAllNotes(path));

      set({ files, allNotes });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to refresh files";
      set({ error: message });
    }
  },

  openNote: async (notePath: string) => {
    const { path: vaultPath } = get();
    if (!vaultPath) {
      set({ error: "No vault open" });
      return;
    }

    try {
      set({ error: null });
      const content = unwrapResult(
        await commands.readFile(notePath, vaultPath)
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

      set({ activeNote: note });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to open note";
      set({ error: message });
    }
  },

  saveNote: async (notePath: string, content: string) => {
    const { path: vaultPath } = get();
    if (!vaultPath) {
      set({ error: "No vault open" });
      return;
    }

    try {
      unwrapResult(await commands.writeFile(notePath, content, vaultPath));

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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save note";
      set({ error: message });
    }
  },

  createNote: async (name: string, folder?: string) => {
    const { path: vaultPath } = get();
    if (!vaultPath) {
      const message = "No vault open";
      set({ error: message });
      throw new Error(message);
    }

    try {
      set({ error: null });
      const fileName = name.endsWith(".md") ? name : `${name}.md`;
      const notePath = folder
        ? `${folder}/${fileName}`
        : `${vaultPath}/${fileName}`;

      unwrapResult(await commands.createFile(notePath, vaultPath));
      await get().refreshFiles();

      return notePath;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create note";
      set({ error: message });
      throw new Error(message);
    }
  },

  deleteNote: async (notePath: string) => {
    const { path: vaultPath } = get();
    if (!vaultPath) {
      set({ error: "No vault open" });
      return;
    }

    try {
      set({ error: null });
      unwrapResult(await commands.deleteFile(notePath, vaultPath));

      const { activeNote } = get();
      if (activeNote?.path === notePath) {
        set({ activeNote: null });
      }

      await get().refreshFiles();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete note";
      set({ error: message });
    }
  },

  renameNote: async (oldPath: string, newPath: string) => {
    const { path: vaultPath } = get();
    if (!vaultPath) {
      set({ error: "No vault open" });
      return;
    }

    try {
      set({ error: null });
      unwrapResult(await commands.renameFile(oldPath, newPath, vaultPath));

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

      await get().refreshFiles();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to rename note";
      set({ error: message });
    }
  },

  createFolder: async (folderPath: string) => {
    const { path: vaultPath } = get();
    if (!vaultPath) {
      set({ error: "No vault open" });
      return;
    }

    try {
      set({ error: null });
      unwrapResult(await commands.createFolder(folderPath, vaultPath));
      await get().refreshFiles();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create folder";
      set({ error: message });
    }
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
        // Create new note if not found
        const newPath = await createNote(name);
        await openNote(newPath);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to open note by name";
      set({ error: message });
    }
  },

  clearError: () => {
    set({ error: null });
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
