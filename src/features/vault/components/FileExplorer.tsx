import { FilePlusIcon, FolderPlusIcon, MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useVaultStore } from "../store/vaultStore";
import { FileTree } from "./FileTree";
import { NewNoteDialog } from "./NewNoteDialog";

export function FileExplorer() {
  const { files, name, path } = useVaultStore();
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);

  if (!path) {
    return (
      <SidebarContent>
        <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
          No vault open
        </div>
      </SidebarContent>
    );
  }

  return (
    <>
      <SidebarHeader className="border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium">{name}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7">
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsNewNoteOpen(true)}>
                <FilePlusIcon className="mr-2 size-4" />
                New Note
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FolderPlusIcon className="mr-2 size-4" />
                New Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
          <SidebarGroup className="px-2 py-2">
            {files.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No notes yet
              </div>
            ) : (
              <FileTree items={files} />
            )}
          </SidebarGroup>
        </ScrollArea>
      </SidebarContent>
      <NewNoteDialog open={isNewNoteOpen} onOpenChange={setIsNewNoteOpen} />
    </>
  );
}
