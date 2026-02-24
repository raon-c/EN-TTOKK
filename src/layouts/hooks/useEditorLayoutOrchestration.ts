import { useCallback, useEffect, useState } from "react";

export type RightSidebarTab =
  | "calendar"
  | "google-calendar"
  | "chat"
  | "jira"
  | "github"
  | "claude-activity";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
};

export function useEditorDirtyState(activeNotePath?: string) {
  const [isDirty, setIsDirty] = useState(false);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeNote?.path 변경 시 리셋 의도
  useEffect(() => {
    setIsDirty(false);
  }, [activeNotePath]);

  return {
    isDirty,
    handleDirtyChange,
  };
}

export function useRightSidebarTabState(
  initialTab: RightSidebarTab = "calendar"
) {
  const [rightSidebarTab, setRightSidebarTab] =
    useState<RightSidebarTab>(initialTab);

  return {
    rightSidebarTab,
    setRightSidebarTab,
  };
}

export function useChatSidebarExpansion(rightSidebarTab: RightSidebarTab) {
  const [isExpanded, setIsExpanded] = useState(rightSidebarTab === "chat");

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    if (rightSidebarTab !== "chat") {
      setIsExpanded(false);
    }
  }, [rightSidebarTab]);

  return {
    isExpanded,
    toggleExpanded,
  };
}

export function useOpenChatShortcut(onOpenChat: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        onOpenChat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChat]);
}
