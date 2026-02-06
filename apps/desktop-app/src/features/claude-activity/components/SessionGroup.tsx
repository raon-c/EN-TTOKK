import { formatInKst } from "@bun-enttokk/shared";
import { ChevronRight, MessageSquare } from "lucide-react";
import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import type { ClaudeActivityItem } from "../types";
import { ActivityItem } from "./ActivityItem";

interface SessionGroupProps {
  items: ClaudeActivityItem[];
  defaultOpen?: boolean;
}

const extractProjectName = (projectPath: string) => {
  const parts = projectPath.split("/");
  return parts[parts.length - 1] || projectPath;
};

const formatSessionTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return formatInKst(date, "HH:mm");
};

const getSessionSummary = (items: ClaudeActivityItem[]) => {
  const userCount = items.filter((i) => i.kind === "user").length;
  const assistantCount = items.filter((i) => i.kind === "assistant").length;
  return { userCount, assistantCount };
};

const getFirstUserMessage = (items: ClaudeActivityItem[]) => {
  const firstUser = items.find((i) => i.kind === "user");
  if (!firstUser) return null;

  const content = firstUser.content.trim();
  // Truncate to first line or 80 chars
  const firstLine = content.split("\n")[0];
  if (firstLine.length > 80) {
    return `${firstLine.slice(0, 80)}...`;
  }
  return firstLine;
};

export function SessionGroup({
  items,
  defaultOpen = false,
}: SessionGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  // Sort items by timestamp ascending within session
  const sortedItems = [...items].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  const firstItem = sortedItems[0];
  const projectName = extractProjectName(firstItem.project_path);
  const startTime = formatSessionTime(firstItem.timestamp);
  const { userCount, assistantCount } = getSessionSummary(items);
  const firstMessage = getFirstUserMessage(sortedItems);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border bg-card p-2 text-left hover:bg-accent/50 transition-colors",
            isOpen && "rounded-b-none border-b-0"
          )}
        >
          <ChevronRight
            className={cn(
              "size-4 shrink-0 mt-0.5 text-muted-foreground transition-transform",
              isOpen && "rotate-90"
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{projectName}</span>
              <span>·</span>
              <span>{startTime}</span>
              <span>·</span>
              <div className="flex items-center gap-1">
                <MessageSquare className="size-3" />
                <span>{userCount + assistantCount}</span>
              </div>
            </div>
            {firstMessage && (
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {firstMessage}
              </p>
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 rounded-b-lg border border-t-0 bg-muted/30 p-2">
          {sortedItems.map((item, index) => (
            <ActivityItem
              key={`${item.session_id}-${item.timestamp}-${index}`}
              item={item}
              compact
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
