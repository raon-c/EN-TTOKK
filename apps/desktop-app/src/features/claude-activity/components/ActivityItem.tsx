import { formatInKst } from "@bun-enttokk/shared";
import { Bot, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { ClaudeActivityItem, ClaudeActivityKind } from "../types";

interface ActivityItemProps {
  item: ClaudeActivityItem;
  compact?: boolean;
}

const kindLabelMap: Record<ClaudeActivityKind, string> = {
  user: "User",
  assistant: "Claude",
};

const KindIcon = ({ kind }: { kind: ClaudeActivityKind }) => {
  const iconClass = "size-3";
  return kind === "user" ? (
    <User className={iconClass} />
  ) : (
    <Bot className={iconClass} />
  );
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return formatInKst(date, "HH:mm");
};

const truncateContent = (content: string, maxLength = 200) => {
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength)}...`;
};

const extractProjectName = (projectPath: string) => {
  const parts = projectPath.split("/");
  return parts[parts.length - 1] || projectPath;
};

export function ActivityItem({ item, compact = false }: ActivityItemProps) {
  const isUser = item.kind === "user";

  if (compact) {
    return (
      <div
        className={cn(
          "rounded border bg-card px-2 py-1.5 text-xs",
          isUser && "border-l-2 border-l-blue-500/50",
          !isUser && "border-l-2 border-l-green-500/50"
        )}
      >
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "shrink-0 text-[10px] font-medium",
              isUser && "text-blue-600",
              !isUser && "text-green-600"
            )}
          >
            {isUser ? "You" : "Claude"}
          </span>
          <p className="flex-1 text-xs leading-relaxed whitespace-pre-wrap break-words">
            {truncateContent(item.content, 150)}
          </p>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatTimestamp(item.timestamp)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-3 py-2 text-sm shadow-xs",
        isUser && "border-l-2 border-l-blue-500/50",
        !isUser && "border-l-2 border-l-green-500/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {truncateContent(item.content)}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span title={item.project_path}>
              {extractProjectName(item.project_path)}
            </span>
            <span>·</span>
            <span>{formatTimestamp(item.timestamp)}</span>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 text-[10px] gap-1",
            isUser && "border-blue-500/30 text-blue-600",
            !isUser && "border-green-500/30 text-green-600"
          )}
        >
          <KindIcon kind={item.kind} />
          {kindLabelMap[item.kind]}
        </Badge>
      </div>
    </div>
  );
}
