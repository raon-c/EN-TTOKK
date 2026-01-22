import { FileTextIcon } from "lucide-react";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Editor } from "@/features/editor/components/Editor";
import { FileExplorer } from "@/features/vault/components/FileExplorer";
import { useVaultStore } from "@/features/vault/store/vaultStore";

export function EditorLayout() {
  const { activeNote, saveNote, openNoteByName } = useVaultStore();

  const handleLinkClick = (target: string) => {
    openNoteByName(target);
  };

  const handleTagClick = (_tag: string) => {
    // TODO: Implement tag search/filter
  };

  return (
    <SidebarProvider>
      <Sidebar className="border-r">
        <FileExplorer />
      </Sidebar>
      <SidebarInset className="flex flex-col">
        {activeNote ? (
          <div className="flex h-full flex-col">
            <header className="flex h-12 shrink-0 items-center border-b px-4">
              <FileTextIcon className="mr-2 size-4 text-muted-foreground" />
              <h1 className="text-sm font-medium">{activeNote.title}</h1>
            </header>
            <main className="flex-1 overflow-hidden">
              <Editor
                content={activeNote.content}
                onSave={(content) => saveNote(activeNote.path, content)}
                onLinkClick={handleLinkClick}
                onTagClick={handleTagClick}
              />
            </main>
          </div>
        ) : (
          <EmptyState />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <FileTextIcon className="size-12" />
      <div className="text-center">
        <p className="text-lg font-medium">No note selected</p>
        <p className="text-sm">
          Select a note from the sidebar or create a new one
        </p>
      </div>
    </div>
  );
}
