import { formatInKst } from "@bun-enttokk/shared";
import { RefreshCw, Settings, Terminal } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { useClaudeActivityStore } from "../store/claudeActivityStore";
import type { ClaudeActivityItem } from "../types";
import { FolderSubscriptionDialog } from "./FolderSubscriptionDialog";
import { SessionGroup } from "./SessionGroup";

function CalendarDayWithActivity(
  props: React.ComponentProps<typeof CalendarDayButton>
) {
  const activityDates = useClaudeActivityStore((state) => state.activityDates);
  const { day, modifiers, ...rest } = props;
  const dayOfMonth = day.date.getDate();
  const hasActivity = activityDates.has(dayOfMonth);

  return (
    <CalendarDayButton day={day} modifiers={modifiers} {...rest}>
      {dayOfMonth}
      {hasActivity && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary" />
      )}
    </CalendarDayButton>
  );
}

type SessionData = {
  sessionId: string;
  items: ClaudeActivityItem[];
  firstTimestamp: string;
};

function groupBySession(activities: ClaudeActivityItem[]): SessionData[] {
  const sessionMap = new Map<string, ClaudeActivityItem[]>();

  for (const activity of activities) {
    const sessionId = activity.session_id || "unknown";
    const existing = sessionMap.get(sessionId) || [];
    sessionMap.set(sessionId, [...existing, activity]);
  }

  // Convert to array and sort by first timestamp (newest session first)
  const sessions: SessionData[] = [];
  for (const [sessionId, items] of sessionMap) {
    const sortedItems = [...items].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    );
    sessions.push({
      sessionId,
      items: sortedItems,
      firstTimestamp: sortedItems[0]?.timestamp || "",
    });
  }

  // Sort sessions by first timestamp descending (newest first)
  sessions.sort((a, b) => b.firstTimestamp.localeCompare(a.firstTimestamp));

  return sessions;
}

export function ClaudeActivityPanel() {
  const status = useClaudeActivityStore((state) => state.status);
  const error = useClaudeActivityStore((state) => state.error);
  const activities = useClaudeActivityStore((state) => state.activities);
  const selectedDate = useClaudeActivityStore((state) => state.selectedDate);
  const isLoading = useClaudeActivityStore((state) => state.isLoading);
  const subscribedFolders = useClaudeActivityStore(
    (state) => state.subscribedFolders
  );
  const refresh = useClaudeActivityStore((state) => state.refresh);
  const selectDate = useClaudeActivityStore((state) => state.selectDate);
  const loadActivityDates = useClaudeActivityStore(
    (state) => state.loadActivityDates
  );
  const loadSavedFolders = useClaudeActivityStore(
    (state) => state.loadSavedFolders
  );
  const openSettings = useClaudeActivityStore((state) => state.openSettings);

  useEffect(() => {
    const init = async () => {
      await loadSavedFolders();
      await refresh();
    };
    void init();
  }, [loadSavedFolders, refresh]);

  const handleMonthChange = (month: Date) => {
    const year = month.getFullYear();
    const monthNum = month.getMonth() + 1;
    void loadActivityDates(year, monthNum);
  };

  const sessions = useMemo(() => groupBySession(activities), [activities]);

  const selectedDateLabel = formatInKst(selectedDate, "MMM d, yyyy");
  const hasSubscriptions = subscribedFolders.length > 0;

  return (
    <>
      <SidebarHeader className="border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Claude Activity</div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={openSettings}
              title="Folder settings"
            >
              <Settings className="size-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={refresh}
              disabled={isLoading}
              title="Refresh activity"
            >
              <RefreshCw className={cn("size-3", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
        {hasSubscriptions && (
          <div className="text-xs text-muted-foreground truncate">
            {subscribedFolders.length} folder
            {subscribedFolders.length > 1 ? "s" : ""} subscribed
          </div>
        )}
        {error && <div className="text-xs text-destructive">{error}</div>}
      </SidebarHeader>

      <SidebarContent>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={selectDate}
          onMonthChange={handleMonthChange}
          disabled={status === "loading"}
          className="w-full bg-sidebar"
          components={{
            DayButton: CalendarDayWithActivity,
          }}
        />

        <Separator />

        <div className="space-y-3 px-3 pb-4">
          <div className="text-sm font-medium">
            Activity on {selectedDateLabel}
          </div>

          {isLoading ? (
            <div className="text-xs text-muted-foreground">
              Loading activity...
            </div>
          ) : sessions.length === 0 ? (
            <Empty className="border-none p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Terminal className="size-4" />
                </EmptyMedia>
                <EmptyTitle>No activity</EmptyTitle>
                <EmptyDescription>
                  {hasSubscriptions
                    ? "No Claude activity for this day in subscribed folders."
                    : "No Claude activity for this day. Try adjusting folder subscriptions."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {!hasSubscriptions && (
                  <Button variant="outline" size="sm" onClick={openSettings}>
                    <Settings className="size-3 mr-1" />
                    Configure Folders
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          ) : (
            <div className="space-y-2">
              {sessions.map((session, index) => (
                <SessionGroup
                  key={session.sessionId}
                  items={session.items}
                  defaultOpen={index === 0}
                />
              ))}
            </div>
          )}
        </div>
      </SidebarContent>

      <FolderSubscriptionDialog />
    </>
  );
}
