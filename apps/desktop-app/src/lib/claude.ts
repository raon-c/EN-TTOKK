import { invoke } from "@tauri-apps/api/core";

import type {
  ClaudeActivityResponse,
} from "@/features/claude-activity/types";

export async function listClaudeProjects(): Promise<string[]> {
  return invoke<string[]>("list_claude_projects");
}

export async function getClaudeActivities(
  date: string,
  subscribedFolders: string[]
): Promise<ClaudeActivityResponse> {
  return invoke<ClaudeActivityResponse>("get_claude_activities", {
    date,
    subscribedFolders,
  });
}

export async function getClaudeActivityDates(
  subscribedFolders: string[],
  year: number,
  month: number
): Promise<number[]> {
  return invoke<number[]>("get_claude_activity_dates", {
    subscribedFolders,
    year,
    month,
  });
}
