import type { VaultConfig as BindingVaultConfig, FileEntry } from "@/bindings";

// Re-export bindings types with aliases for backward compatibility
export type FileTreeNode = FileEntry;
export type VaultConfig = BindingVaultConfig;

export interface Note {
  id: string;
  title: string;
  path: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  links: WikiLink[];
}

export interface WikiLink {
  target: string;
  alias?: string;
  exists: boolean;
}

export interface VaultState {
  path: string | null;
  name: string;
  files: FileTreeNode[];
  activeNote: Note | null;
}
