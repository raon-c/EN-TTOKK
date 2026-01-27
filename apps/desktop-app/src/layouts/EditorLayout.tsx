import {
  CalendarDays,
  CalendarIcon,
  FileTextIcon,
  MessageSquare,
} from "lucide-react";
import { JiraIcon } from "@/components/icons/JiraIcon";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ChatPanel } from "@/features/chat";
import { DailyNotesCalendar } from "@/features/daily-notes";
import { Editor } from "@/features/editor/components/Editor";
import { GoogleCalendarPanel } from "@/features/google-calendar";
import { JiraPanel } from "@/features/jira";
import { FileExplorer } from "@/features/vault/components/FileExplorer";
import { useVaultStore } from "@/features/vault/store/vaultStore";
import { cn } from "@/lib/utils";

type RightSidebarTab = "calendar" | "google-calendar" | "chat" | "jira";

export function EditorLayout() {
  const {
    activeNote,
    path: vaultPath,
    saveNote,
    openNoteByName,
  } = useVaultStore();
  const [isDirty, setIsDirty] = useState(false);
  const [rightSidebarTab, setRightSidebarTab] =
    useState<RightSidebarTab>("calendar");

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

          {/* Main Content */}
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
              {rightSidebarTab === "calendar" && <DailyNotesCalendar />}
              {rightSidebarTab === "google-calendar" && <GoogleCalendarPanel />}
              {rightSidebarTab === "chat" && (
                <ChatPanel workingDirectory={vaultPath ?? undefined} />
              )}
              {rightSidebarTab === "jira" && <JiraPanel />}
            </Sidebar>
            <RightSidebarButtons
              activeTab={rightSidebarTab}
              onTabChange={setRightSidebarTab}
            />
          </SidebarProvider>
        </div>
      </div>
    </div>
  );
}

interface RightSidebarButtonsProps {
  activeTab: RightSidebarTab;
  onTabChange: (tab: RightSidebarTab) => void;
}

function RightSidebarButtons({
  activeTab,
  onTabChange,
}: RightSidebarButtonsProps) {
  const { open, setOpen } = useSidebar();

  const handleTabClick = (tab: RightSidebarTab) => {
    if (activeTab === tab && open) {
      // 같은 탭을 클릭하면 사이드바 토글
      setOpen(false);
    } else {
      // 다른 탭을 클릭하면 해당 탭으로 전환하고 사이드바 열기
      onTabChange(tab);
      setOpen(true);
    }
  };

  return (
    <div className="h-full w-11 z-50 bg-accent border-l flex flex-col">
      <div className="flex h-11 items-center w-full justify-center">
        <SidebarTrigger />
      </div>
      <div className="flex flex-col items-center gap-1 px-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleTabClick("calendar")}
          title="Calendar"
          className={cn(activeTab === "calendar" && open && "bg-secondary")}
        >
          <CalendarIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleTabClick("google-calendar")}
          title="Google Calendar"
          className={cn(
            activeTab === "google-calendar" && open && "bg-secondary"
          )}
        >
          <CalendarDays className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleTabClick("chat")}
          title="Chat with Claude"
          className={cn(activeTab === "chat" && open && "bg-secondary")}
        >
          <MessageSquare className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleTabClick("jira")}
          title="Jira"
          className={cn(activeTab === "jira" && open && "bg-secondary")}
        >
          <JiraIcon className="size-4" />
        </Button>
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
