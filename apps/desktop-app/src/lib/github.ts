import { invoke } from "@tauri-apps/api/core";

import type { GitHubActivityResponse } from "@/features/github/types";

export async function getGitHubActivity(
  date: string
): Promise<GitHubActivityResponse> {
  return invoke<GitHubActivityResponse>("get_github_activity", { date });
}
