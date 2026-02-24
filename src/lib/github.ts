import type { GitHubActivityResponse } from "@/features/github/types";
import { invokeCommand } from "@/lib/platform";

export async function getGitHubActivity(
  date: string
): Promise<GitHubActivityResponse> {
  return invokeCommand<GitHubActivityResponse>(
    "get_github_activity",
    { date },
    {
      fallbackMessage: "Failed to load GitHub activity",
      source: "backend.github.activity",
      code: "github_activity_failed",
      traceArgName: "traceId",
      retries: 1,
      retryDelayMs: 700,
      shouldRetry: (error) => {
        const message =
          error instanceof Error
            ? error.message.toLowerCase()
            : typeof error === "string"
              ? error.toLowerCase()
              : "";

        return (
          message.includes("secondary rate") ||
          message.includes("rate limit") ||
          message.includes("retry-after")
        );
      },
    }
  );
}
