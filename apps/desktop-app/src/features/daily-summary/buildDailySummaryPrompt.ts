import { formatInKst, getKstDateKey } from "@bun-enttokk/shared";
import type { JiraIssue } from "@enttokk/api-types";
import { isValid, parse } from "date-fns";
import { commands } from "@/bindings";
import { useClaudeActivityStore } from "@/features/claude-activity/store/claudeActivityStore";
import type { ClaudeActivityItem } from "@/features/claude-activity/types";
import { DEFAULT_DAILY_NOTES_SETTINGS } from "@/features/daily-notes/types";
import type { GitHubActivityItem } from "@/features/github/types";
import { useGoogleCalendarStore } from "@/features/google-calendar/store/googleCalendarStore";
import { useJiraStore } from "@/features/jira/store/jiraStore";
import { useSettingsStore } from "@/features/settings/store/settingsStore";
import { useVaultStore } from "@/features/vault/store/vaultStore";
import { getClaudeActivities } from "@/lib/claude";
import { getGitHubActivity } from "@/lib/github";
import { htmlToMarkdown } from "@/lib/markdown";

import {
  type DailyNoteResult,
  formatClaudeActivityLines,
  formatDailyNoteBlock,
  formatGitHubLines,
  formatGoogleCalendarLines,
  formatJiraLines,
  formatStatusLabel,
  type SourceStatus,
} from "./formatters";

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
    return { status: "available", content: markdown };
  }

  try {
    const result = await commands.readFile(notePath, vaultPath);
    if (result.status === "ok") {
      return { status: "available", content: result.data };
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

export async function buildDailySummaryPrompt(
  dateInput?: Date
): Promise<DailySummaryRequest> {
  const date = dateInput ?? resolveDailySummaryDate();
  const targetKey = getKstDateKey(date);
  const dateLabel = formatInKst(date, "yyyy-MM-dd");

  const [dailyNoteResult, githubResult, jiraResult, claudeResult] =
    await Promise.all([
      loadDailyNoteContent(date),
      getGitHubActivity(targetKey)
        .then((response) => ({
          status: "connected" as const,
          items: response.items ?? [],
          error: null as string | null,
        }))
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : String(error);
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
      (async () => {
        try {
          const claudeStore = useClaudeActivityStore.getState();
          await claudeStore.loadSavedFolders();
          const { subscribedFolders } = useClaudeActivityStore.getState();
          if (subscribedFolders.length === 0) {
            return {
              status: "disconnected" as SourceStatus,
              items: [] as ClaudeActivityItem[],
              error: "구독 폴더 없음",
            };
          }
          const response = await getClaudeActivities(
            targetKey,
            subscribedFolders
          );
          return {
            status: "connected" as SourceStatus,
            items: response.items ?? [],
            error: null as string | null,
          };
        } catch (error) {
          return {
            status: "error" as SourceStatus,
            items: [] as ClaudeActivityItem[],
            error:
              error instanceof Error ? error.message : "Claude activity failed",
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
  const claudeLines = formatClaudeActivityLines(claudeResult.items ?? []);

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
    "",
    "[Claude Activity]",
    `상태: ${formatStatusLabel(claudeResult.status)}${
      claudeResult.error ? ` (${claudeResult.error})` : ""
    }`,
    ...claudeLines.lines,
  ].join("\n");

  return {
    displayMessage: `Daily Summary (${dateLabel})`,
    requestMessage,
    date,
  };
}
