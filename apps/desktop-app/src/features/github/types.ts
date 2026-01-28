export type GitHubActivityKind =
  | "commit"
  | "pull_request"
  | "review"
  | "comment";

export interface GitHubActivityItem {
  kind: GitHubActivityKind;
  title: string;
  url: string;
  repo: string;
  timestamp: string;
  number?: number;
  summary?: string;
}

export interface GitHubActivityResponse {
  login: string;
  date: string;
  items: GitHubActivityItem[];
}

export type GitHubStatus =
  | "idle"
  | "loading"
  | "connected"
  | "disconnected"
  | "error";
