export type ClaudeActivityKind = "user" | "assistant";

export interface ClaudeActivityItem {
  kind: ClaudeActivityKind;
  content: string;
  timestamp: string;
  project_path: string;
  session_id: string;
}

export interface ClaudeActivityResponse {
  date: string;
  items: ClaudeActivityItem[];
}

export type ClaudeActivityStatus = "idle" | "loading" | "loaded" | "error";

export interface ClaudeSubscriptionSettings {
  subscribedFolders: string[];
}
