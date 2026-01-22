import {
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
} from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { FileTreeNode } from "@/types/note";

import { useVaultStore } from "../store/vaultStore";

interface FileTreeProps {
  items: FileTreeNode[];
  level?: number;
}

export function FileTree({ items, level = 0 }: FileTreeProps) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.path}>
          {item.is_dir ? (
            <FolderItem item={item} level={level} />
          ) : (
            <FileItem item={item} level={level} />
          )}
        </li>
      ))}
    </ul>
  );
}

interface FolderItemProps {
  item: FileTreeNode;
  level: number;
}

function FolderItem({ item, level }: FolderItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-1 rounded-sm px-2 py-1 text-sm hover:bg-accent",
          "text-left"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <ChevronRightIcon
          className={cn(
            "size-4 shrink-0 transition-transform",
            isOpen && "rotate-90"
          )}
        />
        {isOpen ? (
          <FolderOpenIcon className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{item.name}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {item.children && item.children.length > 0 && (
          <FileTree items={item.children} level={level + 1} />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface FileItemProps {
  item: FileTreeNode;
  level: number;
}

function FileItem({ item, level }: FileItemProps) {
  const { activeNote, openNote } = useVaultStore();
  const isActive = activeNote?.path === item.path;
  const displayName = item.name.replace(/\.md$/, "");

  return (
    <button
      type="button"
      onClick={() => openNote(item.path)}
      className={cn(
        "flex w-full items-center gap-1 rounded-sm px-2 py-1 text-sm",
        "text-left hover:bg-accent",
        isActive && "bg-accent"
      )}
      style={{ paddingLeft: `${level * 12 + 28}px` }}
    >
      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{displayName}</span>
    </button>
  );
}
