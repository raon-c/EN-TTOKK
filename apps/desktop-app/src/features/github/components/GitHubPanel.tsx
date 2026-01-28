import { format, isValid, parseISO } from "date-fns";
import { Github, RefreshCw } from "lucide-react";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

import { useGitHubStore } from "../store/githubStore";
import type { GitHubActivityItem, GitHubActivityKind } from "../types";

const formatTimestamp = (value: string) => {
  const parsed = parseISO(value);
  if (!isValid(parsed)) return "Unknown time";
  return format(parsed, "PPpp");
};

const kindLabelMap: Record<GitHubActivityKind, string> = {
  commit: "Commit",
  pull_request: "PR",
  review: "Review",
  comment: "Comment",
};

const getMetaLine = (item: GitHubActivityItem) => {
  const parts = [item.summary, formatTimestamp(item.timestamp)].filter(Boolean);
  return parts.join(" · ");
};

export function GitHubPanel() {
  const status = useGitHubStore((state) => state.status);
  const error = useGitHubStore((state) => state.error);
  const login = useGitHubStore((state) => state.login);
  const activities = useGitHubStore((state) => state.activities);
  const selectedDate = useGitHubStore((state) => state.selectedDate);
  const isLoading = useGitHubStore((state) => state.isLoading);
  const refresh = useGitHubStore((state) => state.refresh);
  const selectDate = useGitHubStore((state) => state.selectDate);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedDateLabel = format(selectedDate, "MMM d, yyyy");
  const isDisconnected = status === "disconnected";

  return (
    <>
      <SidebarHeader className="border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">GitHub</div>
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
        {login && <div className="text-xs text-muted-foreground">@{login}</div>}
        {error && <div className="text-xs text-destructive">{error}</div>}
      </SidebarHeader>

      <SidebarContent>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={selectDate}
          disabled={status === "loading"}
          className="w-full bg-sidebar"
        />

        <Separator />

        <div className="space-y-3 px-3 pb-4">
          <div className="text-sm font-medium">
            Activity on {selectedDateLabel}
          </div>

          {isDisconnected ? (
            <Empty className="border-none p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Github className="size-4" />
                </EmptyMedia>
                <EmptyTitle>Connect GitHub CLI</EmptyTitle>
                <EmptyDescription>
                  Run <span className="font-medium">gh auth login</span> in a
                  terminal, then refresh.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent />
            </Empty>
          ) : isLoading ? (
            <div className="text-xs text-muted-foreground">
              Loading activity...
            </div>
          ) : activities.length === 0 ? (
            <Empty className="border-none p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Github className="size-4" />
                </EmptyMedia>
                <EmptyTitle>No activity</EmptyTitle>
                <EmptyDescription>No activity for this day.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent />
            </Empty>
          ) : (
            <div className="space-y-2">
              {activities.map((item, index) => (
                <div
                  key={`${item.kind}-${item.url}-${index}`}
                  className="rounded-lg border bg-card px-3 py-2 text-sm shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                      >
                        {item.title}
                      </a>
                      <div className="text-xs text-muted-foreground">
                        {item.repo}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {kindLabelMap[item.kind]}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {getMetaLine(item)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SidebarContent>
    </>
  );
}
