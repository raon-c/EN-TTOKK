import { formatInKst } from "@bun-enttokk/shared";
import type { GoogleCalendarEvent, JiraIssue } from "@enttokk/api-types";
import { isValid, parseISO } from "date-fns";

import type { ClaudeActivityItem } from "@/features/claude-activity/types";
import type { GitHubActivityItem } from "@/features/github/types";
import { getEventDateKey } from "@/features/google-calendar/utils/dates";

const MAX_DAILY_NOTE_CHARS = 4000;
const MAX_LIST_ITEMS = 20;
const MAX_CLAUDE_SESSIONS = 10;
const CLAUDE_TASK_SUMMARY_LENGTH = 80;

export type DailyNoteResult = {
  status: "available" | "missing" | "unavailable" | "error";
  content: string | null;
  error?: string;
};

export type SourceStatus = "connected" | "disconnected" | "error" | "unknown";

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
};

const limitItems = <T>(items: T[], maxItems: number) => {
  if (items.length <= maxItems) return { items, truncated: 0 };
  return {
    items: items.slice(0, maxItems),
    truncated: items.length - maxItems,
  };
};

export const formatTimestamp = (value: string) => {
  const parsed = parseISO(value);
  if (!isValid(parsed)) return "Unknown time";
  return formatInKst(parsed, "PPpp");
};

const formatEventTime = (start?: string, end?: string, isAllDay?: boolean) => {
  if (isAllDay) return "All day";
  if (!start) return "Unknown time";
  const startDate = parseISO(start);
  if (!end) return formatInKst(startDate, "HH:mm");
  const endDate = parseISO(end);
  return `${formatInKst(startDate, "HH:mm")}-${formatInKst(endDate, "HH:mm")}`;
};

export const formatGoogleCalendarLines = (
  events: GoogleCalendarEvent[],
  targetKey: string
) => {
  const filtered = events.filter(
    (event) => getEventDateKey(event) === targetKey
  );
  const { items, truncated } = limitItems(filtered, MAX_LIST_ITEMS);
  const lines = items.map((event) => {
    const start = event.start?.dateTime ?? event.start?.date;
    const end = event.end?.dateTime ?? event.end?.date;
    const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
    const timeLabel = formatEventTime(start, end, isAllDay);
    const title = event.summary?.trim() || "Untitled event";
    const location = event.location ? ` (${event.location})` : "";
    return `- ${timeLabel} ${title}${location}`;
  });
  if (lines.length === 0) {
    return { lines: ["- 없음"], truncated: 0 };
  }
  if (truncated > 0) {
    lines.push(`- ... 외 ${truncated}건`);
  }
  return { lines, truncated };
};

const getIssueUpdatedKey = (updated?: string) => {
  if (!updated) return null;
  const parsed = parseISO(updated);
  if (!isValid(parsed)) return null;
  return formatInKst(parsed, "yyyy-MM-dd");
};

export const formatJiraLines = (issues: JiraIssue[], targetKey: string) => {
  const filtered = issues.filter(
    (issue) => getIssueUpdatedKey(issue.updated) === targetKey
  );
  const { items, truncated } = limitItems(filtered, MAX_LIST_ITEMS);
  const lines = items.map((issue) => {
    const updatedLabel = issue.updated ? formatTimestamp(issue.updated) : "";
    const updatedSuffix = updatedLabel ? ` (updated ${updatedLabel})` : "";
    return `- ${issue.key} ${issue.summary} [${issue.status}]${updatedSuffix}`;
  });
  if (lines.length === 0) {
    return { lines: ["- 없음"], truncated: 0 };
  }
  if (truncated > 0) {
    lines.push(`- ... 외 ${truncated}건`);
  }
  return { lines, truncated };
};

export const formatGitHubLines = (items: GitHubActivityItem[]) => {
  const { items: trimmed, truncated } = limitItems(items, MAX_LIST_ITEMS);
  const kindLabel: Record<GitHubActivityItem["kind"], string> = {
    commit: "Commit",
    pull_request: "PR",
    review: "Review",
    comment: "Comment",
  };
  const lines = trimmed.map((item) => {
    const timeLabel = formatTimestamp(item.timestamp);
    const summary = item.summary ? ` (${item.summary})` : "";
    return `- ${kindLabel[item.kind]} ${item.title}${summary} · ${item.repo} · ${timeLabel}`;
  });
  if (lines.length === 0) {
    return { lines: ["- 없음"], truncated: 0 };
  }
  if (truncated > 0) {
    lines.push(`- ... 외 ${truncated}건`);
  }
  return { lines, truncated };
};

export const formatClaudeActivityLines = (items: ClaudeActivityItem[]) => {
  const sessionGroups = new Map<string, ClaudeActivityItem[]>();
  for (const item of items) {
    if (!sessionGroups.has(item.session_id)) {
      sessionGroups.set(item.session_id, []);
    }
    sessionGroups.get(item.session_id)?.push(item);
  }

  const lines: string[] = [];
  let sessionCount = 0;

  for (const sessionItems of sessionGroups.values()) {
    if (sessionCount >= MAX_CLAUDE_SESSIONS) {
      const remaining = sessionGroups.size - MAX_CLAUDE_SESSIONS;
      lines.push(`- ... 외 ${remaining}개 세션`);
      break;
    }

    const projectPath = sessionItems[0]?.project_path ?? "Unknown";
    const pathParts = projectPath.split("/");
    const projectName = pathParts[pathParts.length - 1] ?? projectPath;

    const userMessages = sessionItems.filter((item) => item.kind === "user");
    const firstUserMessage = userMessages[0]?.content ?? "";
    const firstLine = firstUserMessage.split("\n")[0] ?? "";
    const taskSummary = truncateText(firstLine, CLAUDE_TASK_SUMMARY_LENGTH);

    const timestamp = sessionItems[0]?.timestamp;
    const timeLabel = timestamp ? formatTimestamp(timestamp) : "";
    const label = taskSummary || "대화 세션";

    lines.push(
      `- [${projectName}] ${label} (${userMessages.length}개 질문) · ${timeLabel}`
    );
    sessionCount++;
  }

  if (lines.length === 0) {
    return { lines: ["- 없음"], truncated: 0 };
  }

  return { lines, truncated: 0 };
};

export const formatDailyNoteBlock = (result: DailyNoteResult) => {
  if (result.status === "available" && result.content) {
    return truncateText(result.content.trim(), MAX_DAILY_NOTE_CHARS) || "없음";
  }
  if (result.status === "unavailable") {
    return "Vault가 열려 있지 않습니다.";
  }
  if (result.status === "error") {
    return result.error ? `에러: ${result.error}` : "에러가 발생했습니다.";
  }
  return "없음";
};

export const formatStatusLabel = (status: SourceStatus) => {
  switch (status) {
    case "connected":
      return "연결됨";
    case "disconnected":
      return "연결 안 됨";
    case "error":
      return "에러";
    default:
      return "알 수 없음";
  }
};
