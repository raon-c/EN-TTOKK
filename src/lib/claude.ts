import type { ClaudeActivityResponse } from "@/features/claude-activity/types";
import { invokeCommand } from "@/lib/platform";

export async function listClaudeProjects(): Promise<string[]> {
  return invokeCommand<string[]>("list_claude_projects", undefined, {
    fallbackMessage: "Failed to list Claude projects",
    source: "backend.claude.projects",
    code: "claude_projects_failed",
    traceArgName: "traceId",
  });
}

export async function getClaudeActivities(
  date: string,
  subscribedFolders: string[]
): Promise<ClaudeActivityResponse> {
  return invokeCommand<ClaudeActivityResponse>(
    "get_claude_activities",
    {
      date,
      subscribedFolders,
    },
    {
      fallbackMessage: "Failed to load Claude activity",
      source: "backend.claude.activities",
      code: "claude_activity_failed",
      traceArgName: "traceId",
    }
  );
}

export async function getClaudeActivityDates(
  subscribedFolders: string[],
  year: number,
  month: number
): Promise<number[]> {
  return invokeCommand<number[]>(
    "get_claude_activity_dates",
    {
      subscribedFolders,
      year,
      month,
    },
    {
      fallbackMessage: "Failed to load Claude activity dates",
      source: "backend.claude.activity_dates",
      code: "claude_activity_dates_failed",
      traceArgName: "traceId",
    }
  );
}
