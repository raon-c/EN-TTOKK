import { FileTextIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { DailyNotesCalendar } from "@/features/daily-notes";
import { Editor } from "@/features/editor/components/Editor";
import { FileExplorer } from "@/features/vault/components/FileExplorer";
import { useVaultStore } from "@/features/vault/store/vaultStore";

export function EditorLayout() {
  const { activeNote, saveNote, openNoteByName } = useVaultStore();
  const [isDirty, setIsDirty] = useState(false);

  const handleLinkClick = (target: string) => {
    openNoteByName(target);
  };

  const handleTagClick = (_tag: string) => {
    // TODO: Implement tag search/filter
  };

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  // 노트 전환 시 dirty state 리셋
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeNote?.path 변경 시 리셋 의도
  useEffect(() => {
    setIsDirty(false);
  }, [activeNote?.path]);

  return (
    <div className="relative flex flex-col size-full">
      <div className="w-full flex overflow-hidden flex-1">
        <div className="flex flex-1 h-full overflow-hidden">
          {/* Left SideBar */}
          <SidebarProvider>
            <div className="h-full w-11 z-50 bg-accent border-r">
              <div className="flex h-11 items-center w-full justify-center">
                <SidebarTrigger />
              </div>
            </div>
            <Sidebar>
              <FileExplorer />
            </Sidebar>
          </SidebarProvider>

          <div className="size-full">
            {activeNote ? (
              <div className="flex h-full flex-col">
                <header className="flex h-12 shrink-0 items-center border-b px-4">
                  <FileTextIcon className="mr-2 size-4 text-muted-foreground" />
                  <h1 className="text-sm font-medium">
                    {activeNote.title}
                    {isDirty && (
                      <span
                        className="ml-1 text-muted-foreground"
                        title="저장되지 않은 변경사항"
                      >
                        •
                      </span>
                    )}
                  </h1>
                </header>
                <main className="flex-1 overflow-hidden">
                  <Editor
                    key={activeNote.path}
                    content={activeNote.content}
                    onSave={(content) => saveNote(activeNote.path, content)}
                    onDirtyChange={handleDirtyChange}
                    onLinkClick={handleLinkClick}
                    onTagClick={handleTagClick}
                  />
                </main>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>

          {/* Right SideBar */}
          <SidebarProvider>
            <Sidebar side="right">
              <DailyNotesCalendar />
            </Sidebar>
            <div className="h-full w-11 z-50 bg-accent border-l">
              <div className="flex h-11 items-center w-full justify-center">
                <SidebarTrigger />
              </div>
            </div>
          </SidebarProvider>
        </div>
      </div>
    </div>
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
