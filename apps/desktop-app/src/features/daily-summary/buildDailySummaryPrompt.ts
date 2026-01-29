import { formatInKst, getKstDateKey } from "@bun-enttokk/shared";
import { isValid, parse, parseISO } from "date-fns";

import { commands } from "@/bindings";
import { DEFAULT_DAILY_NOTES_SETTINGS } from "@/features/daily-notes/types";
import type { GitHubActivityItem } from "@/features/github/types";
import { useGoogleCalendarStore } from "@/features/google-calendar/store/googleCalendarStore";
import { getEventDateKey } from "@/features/google-calendar/utils/dates";
import { useJiraStore } from "@/features/jira/store/jiraStore";
import { useSettingsStore } from "@/features/settings/store/settingsStore";
import { useVaultStore } from "@/features/vault/store/vaultStore";
import { getGitHubActivity } from "@/lib/github";
import { htmlToMarkdown } from "@/lib/markdown";

import type { GoogleCalendarEvent, JiraIssue } from "@enttokk/api-types";

const MAX_DAILY_NOTE_CHARS = 4000;
const MAX_LIST_ITEMS = 20;

type DailyNoteResult = {
  status: "available" | "missing" | "unavailable" | "error";
  content: string | null;
  error?: string;
};

type SourceStatus = "connected" | "disconnected" | "error" | "unknown";

export type DailySummaryRequest = {
  displayMessage: string;
  requestMessage: string;
  date: Date;
};

const sanitizeFolderName = (folder: string): string => {
  return folder
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "")
    .replace(/^[.~]/, "")
    .trim();
};

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
};

const limitItems = <T,>(items: T[], maxItems: number) => {
  if (items.length <= maxItems) return { items, truncated: 0 };
  return {
    items: items.slice(0, maxItems),
    truncated: items.length - maxItems,
  };
};

const parseDateFromTitle = (title: string, formatString: string) => {
  if (!title.trim()) return null;
  const parsed = parse(title.trim(), formatString, new Date());
  return isValid(parsed) ? parsed : null;
};

const resolveDailySummaryDate = () => {
  const { activeNote } = useVaultStore.getState();
  const settings = useSettingsStore.getState().settings.dailyNotes;
  const resolvedSettings = settings ?? DEFAULT_DAILY_NOTES_SETTINGS;
  const dateFormat = resolvedSettings.dateFormat;
  const title = activeNote?.title ?? "";

  const parsed =
    parseDateFromTitle(title, dateFormat) ??
    parseDateFromTitle(title, "yyyy-MM-dd");
  return parsed ?? new Date();
};

const loadDailyNoteContent = async (date: Date): Promise<DailyNoteResult> => {
  const { activeNote, path: vaultPath } = useVaultStore.getState();
  if (!vaultPath) {
    return { status: "unavailable", content: null };
  }

  const settings = useSettingsStore.getState().settings.dailyNotes;
  const resolvedSettings = settings ?? DEFAULT_DAILY_NOTES_SETTINGS;
  const folder = sanitizeFolderName(resolvedSettings.folder);
  if (!folder) {
    return { status: "missing", content: null };
  }

  const fileName = `${formatInKst(date, resolvedSettings.dateFormat)}.md`;
  const notePath = `${vaultPath}/${folder}/${fileName}`;

  if (activeNote?.path === notePath && activeNote.content) {
    const markdown = htmlToMarkdown(activeNote.content);
    return {
      status: "available",
      content: markdown,
    };
  }

  try {
    const result = await commands.readFile(notePath, vaultPath);
    if (result.status === "ok") {
      return {
        status: "available",
        content: result.data,
      };
    }
    return { status: "missing", content: null, error: result.error };
  } catch (error) {
    return {
      status: "error",
      content: null,
      error: error instanceof Error ? error.message : "Failed to read note",
    };
  }
};

const resolveGitHubStatus = (message: string): SourceStatus => {
  const lowered = message.toLowerCase();
  if (
    lowered.includes("auth login") ||
    lowered.includes("not available") ||
    lowered.includes("gh) not found") ||
    lowered.includes("not logged into any hosts") ||
    lowered.includes("not authenticated")
  ) {
    return "disconnected";
  }
  return "error";
};

const formatTimestamp = (value: string) => {
  const parsed = parseISO(value);
  if (!isValid(parsed)) return "Unknown time";
  return formatInKst(parsed, "PPpp");
};

const formatEventTime = (
  start?: string,
  end?: string,
  isAllDay?: boolean
) => {
  if (isAllDay) return "All day";
  if (!start) return "Unknown time";
  const startDate = parseISO(start);
  if (!end) return formatInKst(startDate, "HH:mm");
  const endDate = parseISO(end);
  return `${formatInKst(startDate, "HH:mm")}-${formatInKst(endDate, "HH:mm")}`;
};

const formatGoogleCalendarLines = (
  events: GoogleCalendarEvent[],
  targetKey: string
) => {
  const filtered = events.filter((event) => getEventDateKey(event) === targetKey);
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

const formatJiraLines = (issues: JiraIssue[], targetKey: string) => {
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

const formatGitHubLines = (items: GitHubActivityItem[]) => {
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

const formatDailyNoteBlock = (result: DailyNoteResult) => {
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

const formatStatusLabel = (status: SourceStatus) => {
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

export async function buildDailySummaryPrompt(
  dateInput?: Date
): Promise<DailySummaryRequest> {
  const date = dateInput ?? resolveDailySummaryDate();
  const targetKey = getKstDateKey(date);
  const dateLabel = formatInKst(date, "yyyy-MM-dd");

  const [dailyNoteResult, githubResult, jiraResult] = await Promise.all([
    loadDailyNoteContent(date),
    getGitHubActivity(targetKey)
      .then((response) => ({
        status: "connected" as const,
        items: response.items ?? [],
        error: null as string | null,
      }))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        return {
          status: resolveGitHubStatus(message),
          items: [] as GitHubActivityItem[],
          error: message,
        };
      }),
    (async () => {
      try {
        const store = useJiraStore.getState();
        await store.loadFromStore();
        const state = useJiraStore.getState();
        if (state.status === "connected") {
          await state.fetchIssues();
        }
        const nextState = useJiraStore.getState();
        const resolvedStatus: SourceStatus =
          nextState.status === "connected"
            ? "connected"
            : nextState.status === "error"
              ? "error"
              : "disconnected";
        return {
          status: resolvedStatus,
          error: nextState.error,
          issues: nextState.issues,
        };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "Jira load failed",
          issues: [] as JiraIssue[],
        };
      }
    })(),
  ]);

  const googleState = useGoogleCalendarStore.getState();
  const googleStatus: SourceStatus =
    googleState.status === "connected"
      ? "connected"
      : googleState.status === "error"
        ? "error"
        : "disconnected";

  const dailyNoteBlock = formatDailyNoteBlock(dailyNoteResult);
  const googleLines = formatGoogleCalendarLines(googleState.events, targetKey);
  const jiraLines = formatJiraLines(jiraResult.issues ?? [], targetKey);
  const githubLines = formatGitHubLines(githubResult.items ?? []);

  const requestMessage = [
    "당신은 업무일지를 작성하는 비서입니다.",
    "다음 자료를 바탕으로 한국어 업무일지를 작성하세요.",
    "규칙:",
    "- 사실 기반으로만 작성하고 추측하지 않습니다.",
    "- 해당 항목이 없으면 '없음'으로 표기합니다.",
    "- 아래 형식을 그대로 유지합니다.",
    "",
    "형식:",
    "요약:",
    "오늘 한 일:",
    "이슈/블로커:",
    "내일 할 일:",
    "",
    `날짜: ${dateLabel} (KST)`,
    "",
    "[데일리 노트]",
    dailyNoteBlock,
    "",
    "[Google Calendar]",
    `상태: ${formatStatusLabel(googleStatus)}${
      googleState.error ? ` (${googleState.error})` : ""
    }`,
    ...googleLines.lines,
    "",
    "[Jira]",
    `상태: ${formatStatusLabel(jiraResult.status)}${
      jiraResult.error ? ` (${jiraResult.error})` : ""
    }`,
    ...jiraLines.lines,
    "",
    "[GitHub]",
    `상태: ${formatStatusLabel(githubResult.status)}${
      githubResult.error ? ` (${githubResult.error})` : ""
    }`,
    ...githubLines.lines,
  ].join("\n");

  return {
    displayMessage: `Daily Summary (${dateLabel})`,
    requestMessage,
    date,
  };
}
